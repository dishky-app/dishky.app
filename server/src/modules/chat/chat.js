/**
 * chat.js — Dishky Staff Chat Module
 *
 * One-to-one messaging between staff (Admin accounts) at the same
 * venue. Every logged-in admin can chat — this is deliberately NOT
 * gated behind the Super-Admin-managed Permissions matrix (like
 * Todo.js, it's a personal-productivity tool available to any
 * authenticated account, not a business-data module).
 *
 * Attachments (image / video / audio / generic file) are stored the
 * same way documents.js and dish/ingredient images already do in
 * this codebase: as a base64 data URL directly on the message doc,
 * capped at 2MB client-side and re-checked server-side. No separate
 * file-storage service required.
 *
 * A conversation between two admins is identified by a deterministic
 * "roomId" — their two ids sorted and joined with "__" — so either
 * side can always resolve the same thread without a separate
 * conversation-lookup collection.
 *
 * DELIVERY / READ STATE (single / double / coloured-double tick)
 * ----------------------------------------------------------------
 * - sent:        always true once the doc is created.
 * - deliveredAt: set the moment the recipient has an active socket
 *                connection — either immediately at send time (they're
 *                already online) or the next time they connect
 *                (chat:register in server.js calls markDelivered).
 * - readAt:      set when the recipient opens the thread
 *                (PATCH /chat/:staffId/read).
 *
 * "CLEAR FOR ME" vs "CLEAR FOR EVERYONE"
 * ----------------------------------------------------------------
 * - everyone: hard-deletes every message in the room (both sides lose
 *   history) — only really meaningful as "we both agree to wipe this".
 * - me: adds the caller's id to each message's deletedFor[] instead of
 *   deleting the row, so the other side's copy is untouched. Every read
 *   route filters deletedFor out for the calling admin.
 */

const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { asPlainString, safeErrorMessage } = require("../../core/validation");

const router = express.Router();

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024; // 2MB, mirrors the client-side guard

/**
 * Chat attachments legitimately span a wider range than staff/document
 * uploads (StaffChat.js supports arbitrary "file" attachments, camera
 * photos/videos, and voice-note recordings — see handleFilePick /
 * startRecording there), so this can't reuse validation.js's narrower
 * image+PDF+Word allow-list without breaking real functionality.
 * What it CAN and must do is stop accepting fileType with literally no
 * check at all (the previous state): block the categories of file that
 * are never a legitimate chat attachment and have no business being
 * exchanged between staff accounts — executables, scripts, and
 * anything else capable of running code on whoever opens it — and, for
 * the specific formats where a real signature check is possible
 * (images, common audio/video containers, PDF), verify the declared
 * type against the actual decoded bytes rather than trusting the
 * client's claim.
 */
const CHAT_ATTACHMENT_BLOCKED_MIME_PATTERNS = [
  /^application\/x-msdownload$/i,
  /^application\/x-msdos-program$/i,
  /^application\/x-executable$/i,
  /^application\/vnd\.microsoft\.portable-executable$/i,
  /^application\/x-sh$/i,
  /^application\/x-bat$/i,
  /^application\/javascript$/i,
  /^text\/javascript$/i,
  /^application\/x-python-code$/i,
  /^image\/svg\+xml$/i, // can carry embedded <script> — never treat as a safe "image"
];
// Filenames ending in these extensions are rejected regardless of the
// declared MIME type — the client-declared fileType is just a string
// the uploader's browser/script chose to send, and the two most common
// ways to smuggle an executable past a MIME check are (a) lying about
// the MIME type, which this doesn't fully close for every possible
// type, or (b) relying on the recipient's OS opening it by extension
// regardless of what the chat UI displayed it as.
const CHAT_ATTACHMENT_BLOCKED_EXTENSIONS = new Set([
  "exe", "msi", "bat", "cmd", "com", "scr", "pif", "vbs", "vbe", "js", "jse",
  "wsf", "wsh", "ps1", "ps1xml", "psc1", "sh", "bash", "app", "jar", "apk",
  "dll", "so", "dylib", "svg", "html", "htm", "svgz",
]);
// Known signatures for the attachment types this can actually verify by
// content. Anything not listed here (e.g. a generic "file" attachment
// whose type isn't one of these) is allowed through on the MIME/
// extension checks above alone — this app has no safe way to validate
// arbitrary document formats' internals without the fuller allow-list
// validation.js already applies to staff/document uploads specifically.
const CHAT_ATTACHMENT_SIGNATURES = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
  "image/webp": "webp", // special-cased below (RIFF....WEBP)
  "application/pdf": [[0x25, 0x50, 0x44, 0x46, 0x2d]],
  "video/mp4": [[0x66, 0x74, 0x79, 0x70], [0x00, 0x00, 0x00]], // "ftyp" box (offset 4) or generic MP4 box-size prefix — checked specially below
  "video/webm": [[0x1a, 0x45, 0xdf, 0xa3]], // EBML header, shared by webm/mkv
  "audio/webm": [[0x1a, 0x45, 0xdf, 0xa3]],
  "audio/mpeg": [[0x49, 0x44, 0x33], [0xff, 0xfb], [0xff, 0xf3], [0xff, 0xf2]], // ID3 tag or raw MP3 frame sync
};

/**
 * validateChatAttachment({ fileName, fileType, fileData }) — the
 * server-side gate for every chat attachment. Never trusts fileType or
 * fileName alone; checks the actual decoded bytes wherever a signature
 * is known for the declared type.
 */
function validateChatAttachment({ fileName, fileType, fileData }) {
  const declaredType = (fileType || "").toLowerCase().trim();
  const ext = (fileName || "").split(".").pop()?.toLowerCase() || "";

  if (CHAT_ATTACHMENT_BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, error: `Files with a .${ext} extension can't be sent as chat attachments` };
  }
  if (CHAT_ATTACHMENT_BLOCKED_MIME_PATTERNS.some((re) => re.test(declaredType))) {
    return { ok: false, error: `File type "${fileType}" can't be sent as a chat attachment` };
  }

  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(fileData || "");
  if (!match) return { ok: false, error: "fileData must be a valid base64 data URL" };
  const [, urlMimeType, base64Data] = match;
  // The MIME type embedded in the data URL itself must also clear the
  // same blocklist — fileType and the data URL's own declared type are
  // two independent client-supplied strings that don't have to agree.
  if (CHAT_ATTACHMENT_BLOCKED_MIME_PATTERNS.some((re) => re.test(urlMimeType.toLowerCase()))) {
    return { ok: false, error: `File type "${urlMimeType}" can't be sent as a chat attachment` };
  }

  const headBytes = Buffer.from(base64Data.slice(0, 32), "base64");
  const sig = CHAT_ATTACHMENT_SIGNATURES[declaredType] || CHAT_ATTACHMENT_SIGNATURES[urlMimeType.toLowerCase()];
  if (sig === "webp") {
    const ok = headBytes.length >= 12 &&
      headBytes.slice(0, 4).toString("ascii") === "RIFF" &&
      headBytes.slice(8, 12).toString("ascii") === "WEBP";
    if (!ok) return { ok: false, error: "File content does not match the declared WebP type" };
  } else if (declaredType === "video/mp4") {
    // MP4's real signature is the "ftyp" box type at byte offset 4, not
    // byte 0 — the box-size prefix in front of it varies per file.
    const ok = headBytes.length >= 8 && headBytes.slice(4, 8).toString("ascii") === "ftyp";
    if (!ok) return { ok: false, error: "File content does not match the declared MP4 type" };
  } else if (Array.isArray(sig)) {
    const ok = sig.some((candidate) =>
      headBytes.length >= candidate.length && candidate.every((b, i) => headBytes[i] === b)
    );
    if (!ok) {
      return { ok: false, error: `File content does not match the declared type "${fileType}"` };
    }
  }
  // No signature entry for this type at all (e.g. a generic document
  // attachment) — nothing further to check here; the extension/MIME
  // blocklists above are still enforced regardless.
  return { ok: true };
}

/* ─────────────────────────────────────────
   SCHEMA
───────────────────────────────────────── */
const chatMessageSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true },
    roomId: { type: String, required: true, index: true }, // `${idA}__${idB}` sorted
    venueId: { type: String, default: null },
    fromId: { type: String, required: true },
    toId: { type: String, required: true },
    type: { type: String, enum: ["text", "image", "video", "audio", "file"], default: "text" },
    text: { type: String, default: "" },
    fileName: { type: String, default: "" },
    fileType: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
    fileData: { type: String, default: "" }, // base64 data URL
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    deletedFor: { type: [String], default: [] }, // admin ids who cleared this "for me"
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
chatMessageSchema.index({ roomId: 1, createdAt: 1 });

const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema, "chatMessages");

function newMessageId() {
  return `msg_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
}

function roomIdFor(idA, idB) {
  return [idA, idB].sort().join("__");
}

function safeMessage(doc) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj._id;
  return obj;
}

/** Rough byte length of a base64 data URL, without decoding it fully. */
function approxDataUrlBytes(dataUrl) {
  if (!dataUrl) return 0;
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

/**
 * Called from server.js's chat:register socket handler when `adminId`
 * connects. Flips every message addressed to them (still undelivered)
 * to delivered, and returns a Map<senderId, messageIds[]> so the
 * caller can tell each sender "these were delivered".
 */
async function markDelivered(adminId) {
  const pending = await ChatMessage.find({ toId: adminId, deliveredAt: null }).select("id fromId").lean();
  if (pending.length === 0) return new Map();

  await ChatMessage.updateMany(
    { toId: adminId, deliveredAt: null },
    { $set: { deliveredAt: new Date() } }
  );

  const bySender = new Map();
  for (const m of pending) {
    if (!bySender.has(m.fromId)) bySender.set(m.fromId, []);
    bySender.get(m.fromId).push(m.id);
  }
  return bySender;
}

/**
 * Deletes every chat message currently in the collection. Called once
 * a week (Sunday 12:00 AM local time) so staff chat history never
 * survives past the start of the next week.
 */
async function purgeAllMessages() {
  const result = await ChatMessage.deleteMany({});
  if (result.deletedCount > 0) {
    console.log(`Staff chat: weekly purge removed ${result.deletedCount} message(s)`);
  }
  return result.deletedCount;
}

/**
 * Schedules purgeAllMessages to run once right at the next Sunday
 * 12:00 AM local time, then every 7 days after that. Call once on
 * server boot. `onPurged` (optional) is called with the deleted count
 * after each run, so the caller can notify any connected clients.
 */
function scheduleWeeklyChatPurge(onPurged) {
  const runOnce = async () => {
    try {
      const deletedCount = await require("../../core/tenancy").runAsPlatform(() => purgeAllMessages());
      if (deletedCount > 0 && typeof onPurged === "function") onPurged(deletedCount);
    } catch (err) {
      console.error("Staff chat weekly purge failed:", err.message);
    }
  };

  const runAndReschedule = async () => {
    await runOnce();
    setInterval(runOnce, 7 * 24 * 60 * 60 * 1000);
  };

  const now = new Date();
  const nextSunday = new Date(now);
  // getDay(): 0 = Sunday. Days remaining until the next Sunday
  // (7 if today already is Sunday but midnight has passed).
  const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(0, 0, 0, 0);
  const msUntilSunday = nextSunday.getTime() - now.getTime();
  setTimeout(runAndReschedule, msUntilSunday);
}

/* ─────────────────────────────────────────
   ROUTES — Mounted at /chat. Any authenticated admin.
───────────────────────────────────────── */
function buildRouter({ requireAuth, logAudit, emitToAdmin, isAdminOnline }) {
  // GET /chat/staff?venueId=... — the left-sidebar list. Everyone can
  // message anybody regardless of venue (only the Super Admin ->
  // reply restriction is venue-agnostic and enforced on send below),
  // so this is unfiltered by venue for regular admins. Super Admin
  // still narrows to whichever venue is selected in the topbar
  // switcher (falls back to every admin if none given, e.g. before
  // the switcher has loaded) since Super Admin's list doubles as a
  // per-venue staff browser.
  router.get("/staff", requireAuth, async (req, res) => {
    try {
      const Admin = mongoose.model("Admin");
      const filter = { id: { $ne: req.admin.id }, status: "active" };
      const venueIdParam = asPlainString(req.query.venueId);
      if (req.admin.roleGroup === "Super Admin" && venueIdParam) {
        filter.venueId = venueIdParam;
      }
      const admins = await Admin.find(filter).select("id name roleTitle roleGroup venueId photo email phone").lean();

      // Last message + unread count per conversation, so the sidebar can
      // show a preview and a badge without N+1 round trips from the client.
      const roomIds = admins.map((a) => roomIdFor(req.admin.id, a.id));
      const lastMessages = await ChatMessage.aggregate([
        { $match: { roomId: { $in: roomIds }, deletedFor: { $ne: req.admin.id } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: "$roomId",
            lastText: { $first: "$text" },
            lastType: { $first: "$type" },
            lastAt: { $first: "$createdAt" },
            lastFromId: { $first: "$fromId" },
          },
        },
      ]);
      const lastByRoom = new Map(lastMessages.map((m) => [m._id, m]));

      const unreadCounts = await ChatMessage.aggregate([
        { $match: { roomId: { $in: roomIds }, toId: req.admin.id, readAt: null, deletedFor: { $ne: req.admin.id } } },
        { $group: { _id: "$roomId", count: { $sum: 1 } } },
      ]);
      const unreadByRoom = new Map(unreadCounts.map((u) => [u._id, u.count]));

      const result = admins.map((a) => {
        const roomId = roomIdFor(req.admin.id, a.id);
        const last = lastByRoom.get(roomId);
        return {
          id: a.id,
          name: a.name,
          roleTitle: a.roleTitle,
          roleGroup: a.roleGroup,
          venueId: a.venueId,
          photo: a.photo || "",
          email: a.email || "",
          phone: a.phone || "",
          lastMessage: last
            ? {
              text: last.lastType === "text" ? last.lastText : `Sent ${last.lastType === "file" ? "a file" : `a${last.lastType === "audio" ? "n" : ""} ${last.lastType}`}`,
              at: last.lastAt,
              fromMe: last.lastFromId === req.admin.id,
            }
            : null,
          unreadCount: unreadByRoom.get(roomId) || 0,
        };
      });

      // Most recently active conversations first, then alphabetical.
      result.sort((a, b) => {
        const at = a.lastMessage ? new Date(a.lastMessage.at).getTime() : 0;
        const bt = b.lastMessage ? new Date(b.lastMessage.at).getTime() : 0;
        if (at !== bt) return bt - at;
        return (a.name || "").localeCompare(b.name || "");
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // GET /chat/:staffId — full thread with one other admin, oldest first,
  // excluding anything the caller cleared "for me".
  router.get("/:staffId", requireAuth, async (req, res) => {
    try {
      const roomId = roomIdFor(req.admin.id, req.params.staffId);
      const messages = await ChatMessage.find({ roomId, deletedFor: { $ne: req.admin.id } })
        .sort({ createdAt: 1 })
        .lean();
      res.json(messages.map(safeMessage));
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // POST /chat/:staffId — send a message (text or attachment) to another admin.
  // Also used for "share/forward" from the client — same shape, new roomId.
  router.post("/:staffId", requireAuth, async (req, res) => {
    try {
      const toId = req.params.staffId;
      if (toId === req.admin.id) {
        return res.status(400).json({ error: "Cannot message yourself" });
      }
      const Admin = mongoose.model("Admin");
      const toAdmin = await Admin.findOne({ id: toId }).lean();
      if (!toAdmin) return res.status(404).json({ error: "Staff member not found" });

      // Super Admin broadcasts/announcements are one-way: any staff
      // member can be messaged by a Super Admin, but staff cannot reply
      // back to a Super Admin. Enforced here (not just hidden in the
      // UI) since a disabled input is trivially bypassable via the API.
      if (toAdmin.roleGroup === "Super Admin" && req.admin.roleGroup !== "Super Admin") {
        return res.status(403).json({ error: "You can't reply to a Super Admin in staff chat" });
      }

      const { type, text, fileName, fileType, fileData } = req.body;
      const msgType = ["text", "image", "video", "audio", "file"].includes(type) ? type : "text";

      if (msgType === "text" && (!text || !text.trim())) {
        return res.status(400).json({ error: "text is required for a text message" });
      }
      let fileSize = 0;
      if (msgType !== "text") {
        if (!fileData) return res.status(400).json({ error: "fileData is required for an attachment" });
        const attachmentCheck = validateChatAttachment({ fileName, fileType, fileData });
        if (!attachmentCheck.ok) {
          return res.status(400).json({ error: attachmentCheck.error });
        }
        fileSize = approxDataUrlBytes(fileData);
        if (fileSize > MAX_ATTACHMENT_BYTES) {
          return res.status(413).json({ error: "Attachment exceeds the 2MB limit" });
        }
      }

      const recipientOnline = typeof isAdminOnline === "function" && isAdminOnline(toId);
      const roomId = roomIdFor(req.admin.id, toId);
      const doc = await ChatMessage.create({
        id: newMessageId(),
        roomId,
        venueId: req.admin.venueId || toAdmin.venueId || null,
        fromId: req.admin.id,
        toId,
        type: msgType,
        text: msgType === "text" ? text.trim() : "",
        fileName: fileName || "",
        fileType: fileType || "",
        fileSize,
        fileData: msgType === "text" ? "" : fileData,
        deliveredAt: recipientOnline ? new Date() : null,
      });

      const result = safeMessage(doc);
      if (typeof emitToAdmin === "function") {
        emitToAdmin(toId, "chat:message", result);
        emitToAdmin(req.admin.id, "chat:message", result); // echo to sender's other tabs/devices
      }
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // PATCH /chat/:staffId/read — mark every message FROM that staff member as read.
  router.patch("/:staffId/read", requireAuth, async (req, res) => {
    try {
      const roomId = roomIdFor(req.admin.id, req.params.staffId);
      const now = new Date();
      const before = await ChatMessage.find({ roomId, toId: req.admin.id, readAt: null }).select("id").lean();
      await ChatMessage.updateMany(
        { roomId, toId: req.admin.id, readAt: null },
        { $set: { readAt: now, deliveredAt: now } }
      );
      if (typeof emitToAdmin === "function" && before.length > 0) {
        emitToAdmin(req.params.staffId, "chat:read", {
          byId: req.admin.id,
          messageIds: before.map((m) => m.id),
          readAt: now,
        });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // DELETE /chat/:staffId?scope=me|everyone — default "everyone" for
  // backward compatibility; the client always sends scope explicitly now.
  router.delete("/:staffId", requireAuth, async (req, res) => {
    try {
      const roomId = roomIdFor(req.admin.id, req.params.staffId);
      const scope = req.query.scope === "me" ? "me" : "everyone";

      if (scope === "everyone") {
        await ChatMessage.deleteMany({ roomId });
        if (typeof emitToAdmin === "function") {
          emitToAdmin(req.params.staffId, "chat:cleared", { byId: req.admin.id, roomId, scope });
        }
      } else {
        await ChatMessage.updateMany({ roomId }, { $addToSet: { deletedFor: req.admin.id } });
      }

      if (logAudit) {
        logAudit(req, { action: "delete", resource: "chat", targetId: roomId, before: { roomId, scope } });
      }
      res.json({ success: true, scope });
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // DELETE /chat/:staffId/messages — bulk-delete selected messages,
  // "for me" only (removes them from the caller's own view; the other
  // side keeps their copy, same semantics as WhatsApp's "delete for me").
  router.delete("/:staffId/messages", requireAuth, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }
      const roomId = roomIdFor(req.admin.id, req.params.staffId);
      await ChatMessage.updateMany(
        { roomId, id: { $in: ids } },
        { $addToSet: { deletedFor: req.admin.id } }
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  return router;
}

module.exports = {
  buildRouter,
  ChatMessage,
  safeMessage,
  roomIdFor,
  markDelivered,
  purgeAllMessages,
  scheduleWeeklyChatPurge,
  MAX_ATTACHMENT_BYTES,
};
/**
 * attenders.js — accounts + sessions for restaurant attenders (waiters).
 *
 * An attender signs in on the user panel (dishky.com/<restaurant>/<venue>/attender)
 * with the mobile number + password the restaurant gave them, then takes dine-in orders for one or more
 * tables. The order is stamped with the attender's id + name so the KOT and
 * the receipt can print who took it.
 *
 * Mounted at /attender-auth in server.js (after the tenant middleware, so every
 * query here is already scoped to one restaurant):
 *
 *   (no signup: accounts are created by the restaurant from the admin panel, see buildAdminRouter below)
 *   POST /attender-auth/login            { mobile, password }
 *   GET  /attender-auth/me
 *   POST /attender-auth/logout
 *   POST /attender-auth/change-password  { currentPassword, newPassword }   (signed-in attender)
 *   POST /attender-auth/forgot-password  { mobile }                    -> sends a 6-digit code
 *   POST /attender-auth/reset-password   { mobile, code, newPassword }
 *   GET  /attender-auth/table-orders?venueId=&tables=1,2   open (unpaid) bills, limited to the dishes this attender took
 *
 * Storage (schemaless tenant-scoped collections, see core/genericModel.js):
 *   attenders          { id, name, mobile, passwordHash, createdAt }
 *   attenderSessions   { sessionId, attenderId, expiresAt, ... }   (TTL-cleaned)
 *   attenderResets     { mobile, codeHash, attemptsLeft, expiresAt } (TTL-cleaned)
 *
 * The session lives in its own httpOnly cookie (dishkyid_att_<restaurantId>) so
 * it never clashes with a customer or admin session in the same browser.
 */
const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { getModel } = require("../../core/genericModel");
const { currentTenantId } = require("../../core/tenancy");
const { buildLimiter } = require("../../core/rateLimitStore");
const { asPlainString, safeErrorMessage, validateOptionalDataUrlFile } = require("../../core/validation");

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // one shift; sliding while the attender keeps working
const RESET_TTL_MS = 10 * 60 * 1000;
const RESET_MAX_ATTEMPTS = 5;
const RESET_RESEND_GAP_MS = 60 * 1000;
const MOBILE_RE = /^\d{10}$/;
// A real bcrypt hash to compare against when the number is unknown, so a wrong number and a wrong password take equally long.
const DUMMY_HASH = bcrypt.hashSync("dishky-attender-dummy", 10);

const authLimiter = buildLimiter("attender-auth", {
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
  skipSuccessfulRequests: true, // only failed attempts count toward the limit
});

const resetLimiter = buildLimiter("attender-reset", {
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many password reset requests. Please try again later." },
});

/* ── helpers ─────────────────────────────────────────────────────────── */
const Attenders = () => getModel("attenders");
const Sessions = () => getModel("attenderSessions");
const Resets = () => getModel("attenderResets");

let indexesEnsured = false;
function ensureIndexes() {
  if (indexesEnsured) return;
  indexesEnsured = true;
  // These go straight to the driver (no tenant plugin), which is what we want for index creation.
  Attenders().collection.createIndex({ restaurantId: 1, mobile: 1 }, { unique: true }).catch(() => { });
  Sessions().collection.createIndex({ sessionId: 1 }, { unique: true }).catch(() => { });
  Sessions().collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => { });
  Resets().collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => { });
}

function cookieName() {
  const id = currentTenantId();
  if (!id) throw new Error("attender session requires a restaurant");
  return `dishkyid_att_${id}`;
}

function cookieOpts() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  };
}

const publicAttender = (a) => ({ id: a.id, name: a.name, mobile: a.mobile });

async function startSession(attender, req, res) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  await Sessions().create({
    sessionId,
    attenderId: attender.id,
    userAgent: req.headers["user-agent"] || "",
    ip: req.ip,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  res.cookie(cookieName(), sessionId, cookieOpts());
}

/**
 * resolveAttender(req) — the attender behind this request's session cookie, or
 * null. Used by POST /orders to stamp an order with a *verified* attender
 * (never with a name the browser claims).
 */
async function resolveAttender(req) {
  try {
    if (!currentTenantId()) return null;
    const sessionId = req.cookies ? req.cookies[cookieName()] : null;
    if (!sessionId) return null;
    const session = await Sessions().findOne({ sessionId }).lean();
    if (!session || session.expiresAt < new Date()) return null;
    const attender = await Attenders().findOne({ id: session.attenderId }).lean();
    if (!attender) return null;
    // Sliding expiry.
    Sessions()
      .updateOne({ sessionId }, { $set: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) } })
      .catch(() => { });
    return publicAttender(attender);
  } catch (_err) {
    return null;
  }
}

const hashCode = (mobile, code) =>
  crypto.createHash("sha256").update(`${currentTenantId()}:${mobile}:${code}`).digest("hex");

/** Delivers the reset code over WhatsApp (AiSensy) when it is configured. */
async function sendResetCode(attender, code) {
  if (!process.env.AISENSY_API_KEY) return false;
  try {
    const { sendTemplate } = require("../whatsapp/whatsapp");
    await sendTemplate({
      phone: `91${attender.mobile}`,
      templateName: process.env.ATTENDER_RESET_TEMPLATE || "attender_password_reset",
      variables: [attender.name || "", code],
    });
    return true;
  } catch (err) {
    console.error("[attender reset] WhatsApp send failed:", err.message);
    return false;
  }
}

/* ── router ──────────────────────────────────────────────────────────── */
function buildRouter() {
  const router = express.Router();

  // Every route needs a restaurant (taken from the X-Restaurant header by the tenant middleware).
  router.use((req, res, next) => {
    if (!currentTenantId()) return res.status(404).json({ error: "Restaurant not found" });
    ensureIndexes();
    next();
  });

  // POST /attender-auth/login
  router.post("/login", authLimiter, async (req, res) => {
    try {
      const mobile = asPlainString(req.body && req.body.mobile).trim();
      const password = asPlainString(req.body && req.body.password);
      if (!MOBILE_RE.test(mobile) || !password) {
        return res.status(400).json({ error: "Enter your mobile number and password." });
      }

      const attender = await Attenders().findOne({ mobile }).lean();
      // Always run one bcrypt compare so an unknown number takes as long as a wrong password.
      const ok = await bcrypt.compare(password.slice(0, 72), attender ? attender.passwordHash : DUMMY_HASH).catch(() => false);
      if (!attender || !ok) return res.status(401).json({ error: "Incorrect mobile number or password." });

      await startSession(attender, req, res);
      res.json({ attender: publicAttender(attender) });
    } catch (err) {
      console.error("POST /attender-auth/login", err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // POST /attender-auth/change-password — a signed-in attender changes their own password.
  router.post("/change-password", authLimiter, async (req, res) => {
    try {
      const me = await resolveAttender(req);
      if (!me) return res.status(401).json({ error: "Not logged in", code: "ATTENDER_SESSION_EXPIRED" });
      const currentPassword = asPlainString(req.body && req.body.currentPassword);
      const newPassword = asPlainString(req.body && req.body.newPassword);
      if (newPassword.length < 6 || newPassword.length > 72) return res.status(400).json({ error: "New password must be 6 to 72 characters." });
      if (newPassword === currentPassword) return res.status(400).json({ error: "Choose a different password from the current one." });
      const attender = await Attenders().findOne({ id: me.id }).lean();
      const ok = attender && await bcrypt.compare(currentPassword.slice(0, 72), attender.passwordHash).catch(() => false);
      if (!ok) return res.status(401).json({ error: "Current password is incorrect." });
      await Attenders().updateOne({ id: me.id }, { $set: { passwordHash: await bcrypt.hash(newPassword, 10) } });
      // sign out every other device, keep this one
      const keep = req.cookies ? req.cookies[cookieName()] : null;
      await Sessions().deleteMany({ attenderId: me.id, ...(keep ? { sessionId: { $ne: keep } } : {}) });
      res.json({ success: true });
    } catch (err) {
      console.error("POST /attender-auth/change-password", err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // GET /attender-auth/me — restores the attender on page load.
  router.get("/me", async (req, res) => {
    const attender = await resolveAttender(req);
    if (!attender) {
      res.clearCookie(cookieName(), cookieOpts());
      return res.status(401).json({ error: "Not logged in" });
    }
    res.json({ attender });
  });

  // POST /attender-auth/logout
  router.post("/logout", async (req, res) => {
    try {
      const sessionId = req.cookies ? req.cookies[cookieName()] : null;
      if (sessionId) await Sessions().deleteOne({ sessionId });
      res.clearCookie(cookieName(), cookieOpts());
      res.json({ success: true });
    } catch (err) {
      console.error("POST /attender-auth/logout", err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // GET /attender-auth/table-orders — the dishes this attender has ordered on still-unpaid bills
  // (other attenders' dishes on the same table are not shown).
  router.get("/table-orders", async (req, res) => {
    try {
      const me = await resolveAttender(req);
      if (!me) return res.status(401).json({ error: "Not logged in", code: "ATTENDER_SESSION_EXPIRED" });
      const venueId = asPlainString(req.query.venueId);
      if (!venueId) return res.status(400).json({ error: "venueId is required" });

      const tableValues = [];
      for (const t of asPlainString(req.query.tables).split(",").map((x) => x.trim()).filter(Boolean).slice(0, 60)) {
        tableValues.push(t);
        if (/^\d+$/.test(t)) tableValues.push(Number(t));
      }
      const or = [{ attenderId: me.id }];
      if (tableValues.length) or.push({ tableNo: { $in: tableValues } });

      const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const docs = await getModel("orders")
        .find({ venueId, createdAt: { $gte: since }, $or: or })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

      const open = docs.filter(
        (o) =>
          o.tableNo != null && String(o.tableNo).trim() !== "" &&
          String(o.paymentStatus || "pending").toLowerCase() !== "completed" &&
          String(o.status || "").toLowerCase().trim() !== "cancelled"
      );
      // Only the dishes THIS attender took. Items carry attenderId; bills created before that
      // was stamped fall back to the bill-level attenderId (when no item has one).
      const mine = [];
      for (const o of open) {
        const all = (Array.isArray(o.items) ? o.items : []).filter(
          (i) => String(i.status || "").toLowerCase().trim() !== "cancelled"
        );
        const stamped = all.some((i) => i.attenderId);
        const own = stamped ? all.filter((i) => i.attenderId === me.id) : (o.attenderId === me.id ? all : []);
        if (!own.length) continue;
        const subtotal = own.reduce((n, i) => n + (Number(i.totalPrice) || 0), 0);
        mine.push({
          id: o.id,
          tableNo: o.tableNo,
          userName: o.userName || "Guest",
          attenderName: me.name || o.attenderName || "",
          status: o.status,
          createdAt: o.createdAt,
          subtotal: Math.round(subtotal * 100) / 100,
          items: own.map((i) => ({
            dishName: i.dishName,
            quantity: i.quantity,
            selectedSize: i.selectedSize || "",
            notes: i.notes || "",
            status: i.status || "placed",
            totalPrice: i.totalPrice,
          })),
        });
      }
      res.set("Cache-Control", "no-store");
      res.json(mine);
    } catch (err) {
      console.error("GET /attender-auth/table-orders", err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // POST /attender-auth/forgot-password — sends a one-time 6-digit code to the attender's WhatsApp.
  // Always answers success-shaped so it can't be used to discover which numbers have accounts.
  router.post("/forgot-password", resetLimiter, async (req, res) => {
    try {
      const mobile = asPlainString(req.body && req.body.mobile).trim();
      if (!MOBILE_RE.test(mobile)) return res.status(400).json({ error: "Enter a valid 10-digit mobile number." });

      const attender = await Attenders().findOne({ mobile }).lean();
      if (!attender) return res.json({ success: true });

      const existing = await Resets().findOne({ mobile }).lean();
      if (existing && Date.now() - new Date(existing.createdAt).getTime() < RESET_RESEND_GAP_MS) {
        return res.json({ success: true }); // a code was just sent; don't spam / reset the attempt counter
      }

      const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
      await Resets().deleteMany({ mobile });
      await Resets().create({
        mobile,
        codeHash: hashCode(mobile, code),
        attemptsLeft: RESET_MAX_ATTEMPTS,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      });

      const sent = await sendResetCode(attender, code);
      if (!sent) {
        console.log(
          "[attender reset] WhatsApp (AiSensy) is not configured or failed — code not delivered. " +
          (process.env.NODE_ENV !== "production" ? "Code returned in API response (non-production only)." : "")
        );
      }
      // Outside production the code is returned so the flow can be tested without a WhatsApp template.
      res.json({ success: true, ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}) });
    } catch (err) {
      console.error("POST /attender-auth/forgot-password", err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // POST /attender-auth/reset-password
  router.post("/reset-password", resetLimiter, async (req, res) => {
    try {
      const mobile = asPlainString(req.body && req.body.mobile).trim();
      const code = asPlainString(req.body && req.body.code).trim();
      const newPassword = asPlainString(req.body && req.body.newPassword);
      const invalid = () => res.status(400).json({ error: "That code is invalid or has expired." });

      if (!MOBILE_RE.test(mobile) || !/^\d{6}$/.test(code)) return invalid();
      if (newPassword.length < 6 || newPassword.length > 72) {
        return res.status(400).json({ error: "Password must be 6 to 72 characters." });
      }

      const record = await Resets().findOne({ mobile }).lean();
      if (!record || record.expiresAt < new Date() || record.attemptsLeft <= 0) return invalid();

      const expected = Buffer.from(record.codeHash, "hex");
      const given = Buffer.from(hashCode(mobile, code), "hex");
      if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
        await Resets().updateOne({ mobile }, { $inc: { attemptsLeft: -1 } });
        return invalid();
      }

      const attender = await Attenders().findOne({ mobile }).lean();
      if (!attender) return invalid();

      await Attenders().updateOne({ id: attender.id }, { $set: { passwordHash: await bcrypt.hash(newPassword, 10) } });
      await Resets().deleteMany({ mobile });
      await Sessions().deleteMany({ attenderId: attender.id }); // sign out every device
      res.json({ success: true });
    } catch (err) {
      console.error("POST /attender-auth/reset-password", err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  return router;
}

/**
 * buildAdminRouter — managing attender accounts from the admin panel (mounted at /attenders behind admin auth).
 * The restaurant creates every account: name, mobile, password and Aadhaar. The attender can only sign in and change
 * their own password; there is no self-service signup.
 */
const AADHAAR_RE = /^\d{12}$/;
const maskAadhaar = (n) => (n ? `XXXX XXXX ${String(n).slice(-4)}` : "");
const adminView = (a, full = false) => ({
  id: a.id, name: a.name, mobile: a.mobile, createdAt: a.createdAt,
  aadhaarMasked: maskAadhaar(a.aadhaarNumber), hasAadhaarImage: !!a.aadhaarImage,
  ...(full ? { aadhaarNumber: a.aadhaarNumber || "", aadhaarImage: a.aadhaarImage || "" } : {}),
});

function buildAdminRouter({ requireAuth, requireRole, logAudit }) {
  const router = express.Router();
  const gate = [requireAuth, requireRole("Super Admin", "Manager")];
  const audit = (req, id, action, extra) => { try { logAudit && logAudit(req, { action, resource: "attenders", targetId: id, after: extra }); } catch (_e) { /* best effort */ } };
  const fail = (res, err) => { console.error("attenders admin", err.message); res.status(500).json({ error: safeErrorMessage(err) }); };

  function readBody(b, { creating }) {
    const out = {};
    if (creating || b.name !== undefined) {
      const name = asPlainString(b.name).replace(/\s+/g, " ").trim();
      if (name.length < 2 || name.length > 100) return { error: "Enter the attender's name." };
      out.name = name;
    }
    if (creating) {
      const mobile = asPlainString(b.mobile).trim();
      if (!MOBILE_RE.test(mobile)) return { error: "Enter a valid 10-digit mobile number." };
      out.mobile = mobile;
    }
    if (creating || (b.password !== undefined && b.password !== "")) {
      const password = asPlainString(b.password);
      if (password.length < 6 || password.length > 72) return { error: "Password must be 6 to 72 characters." };
      out.password = password;
    }
    if (creating || b.aadhaarNumber !== undefined) {
      const aadhaar = asPlainString(b.aadhaarNumber).replace(/\s|-/g, "");
      if (!AADHAAR_RE.test(aadhaar)) return { error: "Enter the 12-digit Aadhaar number." };
      out.aadhaarNumber = aadhaar;
    }
    if (b.aadhaarImage !== undefined) {
      const check = validateOptionalDataUrlFile(b.aadhaarImage);
      if (!check.ok) return { error: `Aadhaar card file invalid: ${check.error}` };
      out.aadhaarImage = b.aadhaarImage || "";
    }
    return { out };
  }

  router.get("/", ...gate, async (req, res) => {
    try {
      const rows = await Attenders().find({}, { aadhaarImage: 0, passwordHash: 0 }).sort({ createdAt: -1 }).limit(1000).lean();
      const withImg = new Set((await Attenders().find({ aadhaarImage: { $nin: ["", null] } }, { id: 1 }).lean()).map((r) => r.id));
      res.json(rows.map((a) => adminView({ ...a, aadhaarImage: withImg.has(a.id) ? "1" : "" })));
    } catch (err) { fail(res, err); }
  });

  router.get("/:id", ...gate, async (req, res) => {
    try {
      const a = await Attenders().findOne({ id: asPlainString(req.params.id) }).lean();
      if (!a) return res.status(404).json({ error: "Attender not found" });
      res.json(adminView(a, true));
    } catch (err) { fail(res, err); }
  });

  router.post("/", ...gate, async (req, res) => {
    try {
      ensureIndexes();
      const { out, error } = readBody(req.body || {}, { creating: true });
      if (error) return res.status(400).json({ error });
      if (await Attenders().exists({ mobile: out.mobile })) return res.status(409).json({ error: "An attender account already exists with this mobile number." });
      const doc = {
        id: `attender_${out.mobile}`, name: out.name, mobile: out.mobile, passwordHash: await bcrypt.hash(out.password, 10),
        aadhaarNumber: out.aadhaarNumber, aadhaarImage: out.aadhaarImage || "", createdAt: new Date().toISOString(), createdBy: req.admin && req.admin.id,
      };
      try { await Attenders().create(doc); }
      catch (err) { if (err && err.code === 11000) return res.status(409).json({ error: "An attender account already exists with this mobile number." }); throw err; }
      audit(req, doc.id, "create", { name: doc.name });
      res.status(201).json(adminView(doc, true));
    } catch (err) { fail(res, err); }
  });

  // mobile number is the login and part of the id, so it is not editable; delete and re-create to change it
  router.patch("/:id", ...gate, async (req, res) => {
    try {
      const id = asPlainString(req.params.id);
      const cur = await Attenders().findOne({ id }).lean();
      if (!cur) return res.status(404).json({ error: "Attender not found" });
      const { out, error } = readBody(req.body || {}, { creating: false });
      if (error) return res.status(400).json({ error });
      const set = { ...out }; delete set.password;
      if (out.password) { set.passwordHash = await bcrypt.hash(out.password, 10); }
      if (Object.keys(set).length) await Attenders().updateOne({ id }, { $set: set });
      if (out.password) await Sessions().deleteMany({ attenderId: id }); // new password signs them out everywhere
      audit(req, id, "update", { passwordReset: !!out.password });
      res.json(adminView({ ...cur, ...set }, true));
    } catch (err) { fail(res, err); }
  });

  router.delete("/:id", ...gate, async (req, res) => {
    try {
      const id = asPlainString(req.params.id);
      const r = await Attenders().deleteOne({ id });
      if (!r.deletedCount) return res.status(404).json({ error: "Attender not found" });
      await Sessions().deleteMany({ attenderId: id });
      audit(req, id, "delete", {});
      res.json({ success: true });
    } catch (err) { fail(res, err); }
  });

  return router;
}

module.exports = { buildRouter, buildAdminRouter, resolveAttender };

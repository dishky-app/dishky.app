/**
 * support/staffService.js — Dishky internal staff: directory CRUD, invitations,
 * developer-panel authentication and password reset.
 *
 * Security properties (all enforced here, server-side):
 *  - no public registration: accounts exist only because a Super Admin created them;
 *    the creator never types a password — the staff member sets it through a
 *    single-use, expiring invitation link;
 *  - passwords are bcrypt-hashed (cost 12); reset/invite tokens are 256-bit random
 *    values of which only the SHA-256 hash is stored; a token works once;
 *  - login and forgot-password give the same answer for unknown / deactivated /
 *    wrong-password cases (no account enumeration), always run bcrypt, lock an
 *    account for 15 minutes after 5 failures;
 *  - deactivation revokes every session and blocks login and new assignments;
 *    staff referenced by tickets are never hard-deleted, so history stays intact.
 */
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const M = require("./models");
const C = require("./constants");
const svc = require("./service");
const { sendMail } = require("../../services/Mailer");

const { DishkyStaff, DevSession, DevReset, Ticket, SupportAudit } = M;

const SESSION_MS = 12 * 60 * 60 * 1000;
const RESET_MS = 30 * 60 * 1000;
const INVITE_MS = 72 * 60 * 60 * 1000;
const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;
const MIN_PASSWORD = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);
const sha = (v) => crypto.createHash("sha256").update(String(v)).digest("hex");
const httpErr = svc.httpErr;

function validatePassword(pw, email) {
  if (typeof pw !== "string" || pw.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
  if (pw.length > 200) return "Password is too long.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Password must contain letters and numbers.";
  if (email && pw.toLowerCase().includes(String(email).split("@")[0].toLowerCase()) && String(email).split("@")[0].length >= 4) return "Password must not contain your email name.";
  return null;
}

function safeStaff(s, extra = {}) {
  if (!s) return s;
  const o = typeof s.toObject === "function" ? s.toObject() : { ...s }; // login passes a live document
  delete o._id; delete o.passwordHash; delete o.failedAttempts; delete o.lockUntil;
  return { ...o, ...extra };
}

async function audit(actor, category, action, target, detail, ip) {
  try {
    await SupportAudit.create({ category, action, targetId: target && target.id, targetLabel: target && (target.name || target.email || target.id), actor: actor && { kind: actor.kind, id: actor.id, name: actor.name }, detail, ip: ip || "" });
  } catch (e) { console.error("[support] audit failed:", e.message); }
}

const devPanelUrl = () => (process.env.DEV_PANEL_URL || "http://localhost:5175").replace(/\/$/, "");

async function issueToken(staffId, purpose) {
  await DevReset.deleteMany({ staffId, usedAt: null }); // older unused links stop working
  const raw = crypto.randomBytes(32).toString("hex");
  await DevReset.create({ tokenHash: sha(raw), staffId, purpose, expiresAt: new Date(Date.now() + (purpose === "invite" ? INVITE_MS : RESET_MS)) });
  return raw;
}

async function sendInvite(staff, raw) {
  const link = `${devPanelUrl()}/reset-password?token=${raw}&invite=1`;
  const res = await sendMail({
    to: staff.email,
    subject: "You've been invited to the Dishky Developer Panel",
    text: `Hi ${staff.name},\n\nYou have been added to Dishky's internal technical team as ${staff.role}.\nSet your password here (valid for 72 hours, single use):\n${link}\n`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px"><h2>Welcome to Dishky</h2><p>Hi ${esc(staff.name)}, you have been added to Dishky's technical team as <b>${esc(staff.role)}</b>.</p><p><a href="${link}" style="background:#16a34a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Set your password</a></p><p style="color:#888;font-size:13px">This link is valid for 72 hours and can be used once.</p></div>`,
  });
  return { sent: res.sent, link };
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ───────── directory CRUD ───────── */
function cleanList(v, maxItems = 30, maxLen = 60) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map((x) => String(x).trim().slice(0, maxLen)).filter(Boolean))].slice(0, maxItems);
}

function validateProfile(b, { partial } = {}) {
  const out = {};
  const need = (k) => !partial || b[k] !== undefined;
  if (need("name")) { const n = String(b.name || "").trim(); if (n.length < 2) throw httpErr(400, "Name is required."); out.name = n.slice(0, 120); }
  if (need("email")) { const e = String(b.email || "").trim().toLowerCase(); if (!EMAIL_RE.test(e)) throw httpErr(400, "A valid email is required."); out.email = e; }
  if (need("role")) { if (!C.STAFF_ROLES.includes(b.role)) throw httpErr(400, "Please choose a valid role."); out.role = b.role; }
  for (const [k, max] of [["phone", 30], ["department", 80], ["designation", 80]]) if (b[k] !== undefined) out[k] = String(b[k] || "").trim().slice(0, max);
  if (b.profileImage !== undefined) {
    const u = String(b.profileImage || "").trim();
    // Either an https URL or a small image picked in the panel (data URL, resized client-side to ~256px).
    const isUrl = /^https:\/\/[^\s]+$/i.test(u) && u.length <= 500;
    const isData = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(u) && u.length <= 200000;
    if (u && !isUrl && !isData) throw httpErr(400, "Profile image must be a PNG, JPG or WebP picture (or an https URL).");
    out.profileImage = u;
  }
  if (b.skills !== undefined) out.skills = cleanList(b.skills);
  if (b.supportedModules !== undefined) out.supportedModules = cleanList(b.supportedModules, 60, 120);
  if (b.restaurantScope !== undefined) out.restaurantScope = cleanList(b.restaurantScope, 200, 80);
  return out;
}

async function createStaff(body, actor, ip) {
  const data = validateProfile(body);
  if (!data.department) data.department = "Engineering";
  const seq = await M.nextSeq("staff");
  let doc;
  try {
    doc = await DishkyStaff.create({ ...data, staffNo: `DSK-${String(seq).padStart(4, "0")}`, status: "invited", createdBy: actor.name });
  } catch (e) {
    if (e && e.code === 11000) throw httpErr(409, "A staff member with this email already exists.");
    throw e;
  }
  const raw = await issueToken(doc.id, "invite");
  const inv = await sendInvite(doc, raw);
  await audit(actor, "staff", "create", doc, { role: doc.role }, ip);
  return { staff: safeStaff(doc.toObject()), emailSent: inv.sent, inviteLink: inv.sent ? undefined : inv.link };
}

async function resendInvite(id, actor, ip) {
  const s = await DishkyStaff.findOne({ id });
  if (!s) throw httpErr(404, "Staff member not found.");
  if (s.status === "deactivated") throw httpErr(409, "This account is deactivated.");
  const raw = await issueToken(s.id, s.passwordHash ? "reset" : "invite");
  const link = `${devPanelUrl()}/reset-password?token=${raw}${s.passwordHash ? "" : "&invite=1"}`;
  const res = await sendMail({ to: s.email, subject: s.passwordHash ? "Reset your Dishky Developer Panel password" : "Your Dishky Developer Panel invitation", text: `Hi ${s.name},\n\nSet your password here:\n${link}\n` });
  await audit(actor, "staff", "resend_invite", s, null, ip);
  return { emailSent: res.sent, inviteLink: res.sent ? undefined : link };
}

async function updateStaff(id, body, actor, ip) {
  const s = await DishkyStaff.findOne({ id });
  if (!s) throw httpErr(404, "Staff member not found.");
  const data = validateProfile(body, { partial: true });
  const before = { role: s.role, department: s.department, designation: s.designation, email: s.email };
  Object.assign(s, data);
  try { await s.save(); } catch (e) { if (e && e.code === 11000) throw httpErr(409, "A staff member with this email already exists."); throw e; }
  if (data.role && data.role !== before.role) {
    await DevSession.deleteMany({ staffId: s.id }); // permissions changed → force re-login so nothing stale lingers
  }
  await audit(actor, "staff", "update", s, { before, after: { role: s.role, department: s.department, designation: s.designation, email: s.email } }, ip);
  return safeStaff(s.toObject());
}

/**
 * A signed-in staff member edits their OWN profile: name, phone and profile picture only
 * (role, email, department etc. stay under Super Admin control). Because this writes the same
 * DishkyStaff record the Super Admin console lists, the new name/picture show up in its Staff module.
 */
async function updateSelf(id, body) {
  const s = await DishkyStaff.findOne({ id });
  if (!s) throw httpErr(404, "Staff member not found.");
  const b = body || {};
  const data = validateProfile({ name: b.name, phone: b.phone, profileImage: b.profileImage }, { partial: true });
  Object.assign(s, data);
  await s.save();
  await audit({ kind: "staff", id: s.id, name: s.name }, "staff", "update_profile", s, { fields: Object.keys(data) });
  return safeStaff(s.toObject());
}

const ACTIVE_WORK = { status: { $in: C.OPEN } };

async function activeTicketsOf(id) {
  return Ticket.find({ ...ACTIVE_WORK, $or: [{ developerId: id }, { testerId: id }, { reviewerId: id }] }).select("ticketId title status developerId testerId reviewerId").lean();
}

/**
 * Deactivate (soft delete). If the person still has open tickets the caller must
 * say who takes the developer work (`reassignTo`); tester/reviewer slots are simply
 * cleared so another QA / reviewer can pick them up. Nothing is ever hard-deleted.
 */
async function deactivateStaff(id, { reassignTo } = {}, actor, ip) {
  const s = await DishkyStaff.findOne({ id });
  if (!s) throw httpErr(404, "Staff member not found.");
  if (s.status === "deactivated") throw httpErr(409, "Already deactivated.");
  const open = await activeTicketsOf(id);
  const asDev = open.filter((t) => t.developerId === id);
  let target = null;
  if (asDev.length) {
    if (!reassignTo) {
      throw Object.assign(httpErr(409, `${s.name} still has ${asDev.length} open ticket(s) as developer. Choose someone to reassign them to.`, "REASSIGN_REQUIRED"), { tickets: asDev.map((t) => t.ticketId) });
    }
    target = await DishkyStaff.findOne({ id: reassignTo, status: "active" }).lean();
    const cfg = await svc.getConfig();
    if (!target || target.id === id || !(cfg.rolePermissions[target.role] || []).includes("tickets.submitForQA")) throw httpErr(400, "The replacement must be a different, active developer.");
  }
  const now = new Date();
  for (const t of asDev) {
    // Re-point the developer, keep status/deadline, and make the new owner re-acknowledge.
    await Ticket.updateOne({ ticketId: t.ticketId }, { $set: { developerId: target.id, developerName: target.name, acknowledgedAt: null, assignedAt: now } });
    await M.TicketHistory.create({ ticketId: t.ticketId, type: "assign", action: "reassign_on_deactivation", note: `Reassigned from ${s.name} to ${target.name} (account deactivated)`, actor: { kind: actor.kind, id: actor.id, name: actor.name } });
    await svc.notify([{ recipientKind: "staff", recipientId: target.id, kind: "assigned", message: `You were assigned ${t.ticketId}: ${t.title}` }], { ticketId: t.ticketId, restaurantId: null });
  }
  await Ticket.updateMany({ testerId: id, ...ACTIVE_WORK }, { $set: { testerId: null, testerName: "" } });
  await Ticket.updateMany({ reviewerId: id, ...ACTIVE_WORK }, { $set: { reviewerId: null, reviewerName: "" } });
  s.status = "deactivated"; s.deactivatedAt = now; s.deactivatedBy = actor.name;
  await s.save();
  await DevSession.deleteMany({ staffId: id });
  await DevReset.deleteMany({ staffId: id, usedAt: null });
  await audit(actor, "staff", "deactivate", s, { reassignedTo: target && target.id, tickets: asDev.length }, ip);
  return { staff: safeStaff(s.toObject()), reassigned: asDev.length };
}

async function reactivateStaff(id, actor, ip) {
  const s = await DishkyStaff.findOne({ id });
  if (!s) throw httpErr(404, "Staff member not found.");
  if (s.status !== "deactivated") throw httpErr(409, "This account is not deactivated.");
  s.status = s.passwordHash ? "active" : "invited"; s.deactivatedAt = null; s.deactivatedBy = ""; s.failedAttempts = 0; s.lockUntil = null;
  await s.save();
  await audit(actor, "staff", "reactivate", s, null, ip);
  let invite;
  if (!s.passwordHash) invite = await resendInvite(id, actor, ip);
  return { staff: safeStaff(s.toObject()), ...(invite || {}) };
}

async function listStaff(q) {
  const f = {};
  if (q.status) f.status = q.status;
  if (q.role) f.role = q.role;
  if (q.department) f.department = q.department;
  if (q.module) f.supportedModules = q.module;
  if (q.search) {
    const re = new RegExp(svc.escapeRegex(String(q.search).trim().slice(0, 80)), "i");
    f.$or = [{ name: re }, { email: re }, { staffNo: re }, { designation: re }, { skills: re }];
  }
  const sortKeys = { name: "name", joinedAt: "joinedAt", role: "role", status: "status", lastActivityAt: "lastActivityAt", staffNo: "staffNo" };
  const sort = { [sortKeys[q.sort] || "name"]: q.dir === "desc" ? -1 : 1 };
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20));
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const [total, rows] = await Promise.all([
    DishkyStaff.countDocuments(f),
    DishkyStaff.find(f).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  const loads = await workloads(rows.map((r) => r.id));
  return { total, page, limit, rows: rows.map((r) => safeStaff(r, { assignments: loads[r.id] || 0 })) };
}

async function workloads(ids) {
  if (!ids.length) return {};
  const agg = await Ticket.aggregate([
    { $match: { developerId: { $in: ids }, status: { $in: C.OPEN } } },
    { $group: { _id: "$developerId", n: { $sum: 1 } } },
  ]);
  const out = {};
  for (const a of agg) out[a._id] = a.n;
  return out;
}

async function staffDetail(id) {
  const s = await DishkyStaff.findOne({ id }).lean();
  if (!s) throw httpErr(404, "Staff member not found.");
  const cfg = await svc.getConfig();
  const tickets = await Ticket.find({ $or: [{ developerId: id }, { testerId: id }, { reviewerId: id }] }).select("ticketId title status priority deadline developerId testerId reviewerId restaurantName updatedAt createdAt").sort({ updatedAt: -1 }).limit(200).lean();
  const active = tickets.filter((t) => C.OPEN.includes(t.status));
  return {
    staff: safeStaff(s, { assignments: active.filter((t) => t.developerId === id).length }),
    permissions: cfg.rolePermissions[s.role] || [],
    activeTickets: active.map(trimTicket(id)),
    historicalTickets: tickets.filter((t) => !C.OPEN.includes(t.status)).map(trimTicket(id)),
  };
}
const trimTicket = (id) => (t) => ({ ticketId: t.ticketId, title: t.title, status: t.status, priority: t.priority, deadline: t.deadline, restaurantName: t.restaurantName, as: t.developerId === id ? "developer" : t.testerId === id ? "tester" : "reviewer", updatedAt: t.updatedAt });

/** Active staff who may take a given slot, with their workload — drives the assignment dialog. */
async function assignable(kind) {
  const cfg = await svc.getConfig();
  const need = { developer: ["tickets.submitForQA"], tester: ["qa.record"], reviewer: ["fix.review", "release.approve"] }[kind];
  if (!need) throw httpErr(400, "kind must be developer, tester or reviewer.");
  const roles = C.STAFF_ROLES.filter((r) => need.some((p) => (cfg.rolePermissions[r] || []).includes(p)));
  const rows = await DishkyStaff.find({ status: "active", role: { $in: roles } }).sort({ name: 1 }).lean();
  const loads = await workloads(rows.map((r) => r.id));
  return rows.map((r) => ({ id: r.id, staffNo: r.staffNo, name: r.name, role: r.role, designation: r.designation, skills: r.skills, supportedModules: r.supportedModules, status: r.status, activeWorkload: loads[r.id] || 0 }));
}

/* ───────── developer-panel authentication ───────── */
const COOKIE = "dishkyid_dev";
function cookieOpts() {
  const prod = process.env.NODE_ENV === "production";
  return { httpOnly: true, secure: prod, sameSite: "strict", maxAge: SESSION_MS, path: "/" };
}

async function login(email, password, req) {
  const GENERIC = "Invalid email or password.";
  const e = String(email || "").trim().toLowerCase();
  const staff = EMAIL_RE.test(e) ? await DishkyStaff.findOne({ email: e }) : null;
  const locked = staff && staff.lockUntil && staff.lockUntil > new Date();
  const valid = await bcrypt.compare(String(password || ""), staff && staff.passwordHash ? staff.passwordHash : DUMMY_HASH);
  if (!staff || staff.status !== "active" || locked || !valid) {
    if (staff && !locked && staff.status === "active") {
      staff.failedAttempts = (staff.failedAttempts || 0) + 1;
      if (staff.failedAttempts >= MAX_FAILED) { staff.lockUntil = new Date(Date.now() + LOCK_MS); staff.failedAttempts = 0; await audit({ kind: "staff", id: staff.id, name: staff.name }, "auth", "locked", staff, null, req.ip); }
      await staff.save();
    }
    await audit(null, "auth", "login_failed", { id: staff ? staff.id : "", name: e }, null, req.ip);
    throw httpErr(401, GENERIC);
  }
  staff.failedAttempts = 0; staff.lockUntil = null; staff.lastLoginAt = new Date(); staff.lastActivityAt = new Date();
  await staff.save();
  const raw = crypto.randomBytes(32).toString("hex");
  await DevSession.create({ tokenHash: sha(raw), staffId: staff.id, ip: req.ip || "", userAgent: String(req.headers["user-agent"] || "").slice(0, 200), expiresAt: new Date(Date.now() + SESSION_MS) });
  await audit({ kind: "staff", id: staff.id, name: staff.name }, "auth", "login_ok", staff, null, req.ip);
  return { raw, staff };
}

async function sessionFromCookie(raw) {
  if (!raw) return null;
  const session = await DevSession.findOne({ tokenHash: sha(raw) }).lean();
  if (!session || session.expiresAt < new Date()) return null;
  const staff = await DishkyStaff.findOne({ id: session.staffId }).lean();
  if (!staff || staff.status !== "active") return null;
  return { session, staff };
}
const logoutSession = (raw) => (raw ? DevSession.deleteOne({ tokenHash: sha(raw) }) : null);

/** Always the same outcome for the caller; mail is sent only for an eligible account. */
async function forgotPassword(email, req) {
  const e = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return;
  const s = await DishkyStaff.findOne({ email: e }).lean();
  if (!s || s.status === "deactivated") return;
  const raw = await issueToken(s.id, "reset");
  const link = `${devPanelUrl()}/reset-password?token=${raw}`;
  sendMail({
    to: s.email, subject: "Reset your Dishky Developer Panel password",
    text: `We received a request to reset your Developer Panel password.\n\nReset link (valid for 30 minutes, single use):\n${link}\n\nIf you didn't request this, ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px"><h2>Reset your password</h2><p>This link is valid for 30 minutes and works once.</p><p><a href="${link}" style="background:#16a34a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Reset password</a></p><p style="color:#888;font-size:13px">If you didn't request this, you can ignore this email.</p></div>`,
  }).catch(() => {});
  await audit({ kind: "staff", id: s.id, name: s.name }, "auth", "reset_requested", s, null, req && req.ip);
}

async function tokenInfo(rawToken) {
  const t = await DevReset.findOne({ tokenHash: sha(rawToken || "") }).lean();
  if (!t || t.usedAt || t.expiresAt < new Date()) return null;
  const s = await DishkyStaff.findOne({ id: t.staffId }).lean();
  if (!s || s.status === "deactivated") return null;
  return { token: t, staff: s };
}

async function resetPassword(rawToken, password, confirm, req) {
  if (password !== confirm) throw httpErr(400, "Passwords do not match.");
  const info = await tokenInfo(rawToken);
  if (!info) throw httpErr(400, "This link is invalid or has expired. Please request a new one.");
  const pwErr = validatePassword(password, info.staff.email);
  if (pwErr) throw httpErr(400, pwErr);
  // Single use: only one concurrent request can flip usedAt from null.
  const claimed = await DevReset.findOneAndUpdate({ tokenHash: info.token.tokenHash, usedAt: null }, { $set: { usedAt: new Date() } });
  if (!claimed) throw httpErr(400, "This link is invalid or has expired. Please request a new one.");
  const hash = await bcrypt.hash(password, 12);
  await DishkyStaff.updateOne({ id: info.staff.id }, { $set: { passwordHash: hash, status: "active", failedAttempts: 0, lockUntil: null } });
  await DevSession.deleteMany({ staffId: info.staff.id });
  await DevReset.deleteMany({ staffId: info.staff.id, usedAt: null });
  await audit({ kind: "staff", id: info.staff.id, name: info.staff.name }, "auth", info.token.purpose === "invite" ? "invite_accepted" : "password_reset", info.staff, null, req && req.ip);
  return { purpose: info.token.purpose };
}

async function changePassword(staffId, currentPassword, newPassword, keepRaw) {
  const s = await DishkyStaff.findOne({ id: staffId });
  if (!s || !(await bcrypt.compare(String(currentPassword || ""), s.passwordHash))) throw httpErr(401, "Current password is incorrect.");
  const pwErr = validatePassword(newPassword, s.email);
  if (pwErr) throw httpErr(400, pwErr);
  s.passwordHash = await bcrypt.hash(newPassword, 12);
  await s.save();
  await DevSession.deleteMany({ staffId, tokenHash: { $ne: sha(keepRaw || "") } });
}

async function touchActivity(staffId) {
  DishkyStaff.updateOne({ id: staffId }, { $set: { lastActivityAt: new Date() } }).catch(() => {});
}

module.exports = {
  COOKIE, cookieOpts, MIN_PASSWORD, validatePassword, safeStaff, audit,
  createStaff, updateStaff, updateSelf, deactivateStaff, reactivateStaff, resendInvite, listStaff, staffDetail, assignable,
  login, sessionFromCookie, logoutSession, forgotPassword, tokenInfo, resetPassword, changePassword, touchActivity,
};

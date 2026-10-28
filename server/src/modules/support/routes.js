/**
 * support/routes.js — HTTP surface of the ticket system. Three routers, one
 * service layer, one ticket collection:
 *
 *   buildRestaurantRouter()  /support            restaurant admins (tenant context + permission matrix)
 *   buildSuperAdminRouter()  /superadmin/support platform admins (mounted inside platform/superadmin.js,
 *                                                 behind its requireAdmin cookie check)
 *   buildDevRouter()         /dev                Dishky staff (own login, own cookie, role permissions)
 *
 * The restaurant a ticket belongs to is ALWAYS taken from the verified session
 * (currentTenantId()), reporter identity from req.admin — never from the body.
 */
const express = require("express");
const mongoose = require("mongoose");
const C = require("./constants");
const M = require("./models");
const svc = require("./service");
const staffSvc = require("./staffService");
const { buildLimiter } = require("../../core/rateLimitStore");
const { currentTenantId, runAsPlatform } = require("../../core/tenancy");

const ACTION_NAMES = new Set(Object.keys(require("./workflow").ACTIONS));
const REPORTER_ACTIONS = new Set(["reporter_respond", "reporter_confirm", "reporter_reopen"]);
const STAFF_ACTIONS = new Set([...ACTION_NAMES].filter((a) => !REPORTER_ACTIONS.has(a)));

function sendErr(res, err, style) {
  const status = err && err.status && err.status < 600 ? err.status : 500;
  if (status === 500) console.error("[support]", err);
  const message = status === 500 ? "Something went wrong." : err.message;
  const extra = err && err.code ? { code: err.code } : {};
  if (err && err.tickets) extra.tickets = err.tickets;
  return res.status(status).json(style === "plain" ? { error: message, ...extra } : { success: false, message, ...extra });
}
const handler = (style, fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => sendErr(res, e, style));
const okJson = (res, data, status = 200) => res.status(status).json({ success: true, data });

/** Restaurant list for the Affected-module dropdown: permission-matrix modules + a few extras. */
function moduleOptions() {
  let labels = [];
  try { labels = Object.values(require("../auth/permissions").MODULES); } catch { /* optional */ }
  return [...new Set([...labels, ...C.EXTRA_MODULES])].sort((a, b) => a.localeCompare(b));
}
function metaPayload() {
  return {
    statuses: C.STATUS_LABEL, categories: C.CATEGORIES, priorities: C.PRIORITIES, severities: C.SEVERITIES,
    modules: moduleOptions(), environments: C.ENVIRONMENTS, deployResults: C.DEPLOY_RESULTS,
    maxAttachments: C.MAX_ATTACHMENTS_PER_REQUEST, maxAttachmentBytes: C.MAX_ATTACHMENT_BYTES,
  };
}

function sendAttachment(res, att) {
  res.set({
    "Content-Type": att.mime,
    "Content-Disposition": `attachment; filename="${String(att.name).replace(/[^\w.\- ]/g, "_")}"`,
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.send(att.data);
}

/* ═════════════ restaurant side ═════════════ */
function buildRestaurantRouter({ requireAuth, hasPermission, logAudit }) {
  const router = express.Router();
  const writeLimiter = buildLimiter("support-write", { windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false, message: { error: "Too many requests. Please try again later." } });
  const createLimiter = buildLimiter("support-create", { windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: "Too many tickets created. Please try again later." } });

  async function actorOf(req) {
    const restaurantId = currentTenantId();
    if (!restaurantId) throw Object.assign(new Error("Restaurant not identified."), { status: 400 });
    const [read, write] = await Promise.all([hasPermission(req.admin, "supportTickets", "read"), hasPermission(req.admin, "supportTickets", "write")]);
    return svc.reporterActor(req.admin, restaurantId, { read, write: write });
  }
  async function needRead(req) {
    const a = await actorOf(req);
    if (!a.canRead) throw Object.assign(new Error("You do not have access to Support & Complaints."), { status: 403 });
    return a;
  }
  const access = (actor) => (t) => svc.reporterCanAccess(actor, t);
  const out = (fn) => handler("plain", fn);

  router.use(requireAuth);

  router.get("/meta", out(async (req, res) => {
    const a = await actorOf(req);
    if (!a.canRead) throw Object.assign(new Error("You do not have access to Support & Complaints."), { status: 403 });
    let venues = [];
    try {
      const { Venue } = require("../venues/venues");
      venues = (await Venue.find({ status: "active" }).select("id name").lean()).map((v) => ({ id: v.id, name: v.name }));
    } catch { /* venues optional */ }
    if (a.roleGroup !== "Super Admin") venues = venues.filter((v) => v.id === a.venueId);
    res.json({ ...metaPayload(), canWrite: a.canWrite, isSuperAdmin: a.roleGroup === "Super Admin", venues, myVenueId: a.venueId });
  }));

  router.get("/tickets", out(async (req, res) => {
    const a = await needRead(req);
    const filter = svc.buildListFilter(req.query, { ...svc.reporterScopeFilter(a) });
    const data = await runAsPlatform(() => svc.listTickets({ filter, q: req.query, mapper: (t) => svc.reporterView(t) }));
    res.json(data);
  }));

  router.post("/tickets", createLimiter, out(async (req, res) => {
    const a = await needRead(req);
    if (!a.canWrite) throw Object.assign(new Error("You do not have permission to create tickets."), { status: 403 });
    const restaurant = req.tenant && req.tenant.restaurant;
    if (!restaurant) throw Object.assign(new Error("Restaurant not identified."), { status: 400 });
    // Branch: non-Super-Admin staff are pinned to their own branch; Super Admin may pick one that exists.
    let venue = null;
    const wanted = a.roleGroup === "Super Admin" ? (req.body && req.body.venueId) || a.venueId : a.venueId;
    if (wanted) {
      const { Venue } = require("../venues/venues");
      const v = await Venue.findOne({ id: String(wanted) }).select("id name").lean(); // tenant-scoped query
      if (!v) throw Object.assign(new Error("Unknown branch."), { status: 400 });
      venue = { id: v.id, name: v.name };
    }
    const t = await runAsPlatform(() => svc.createTicket({ actor: a, body: req.body || {}, restaurant: { id: restaurant.id, name: restaurant.name }, venue }));
    logAudit(req, { action: "create", resource: "supportTickets", targetId: t.ticketId, after: { title: t.title, category: t.category, module: t.module } });
    res.status(201).json({ ticketId: t.ticketId, ticket: svc.reporterView(t) });
  }));

  router.get("/tickets/:id", out(async (req, res) => {
    const a = await needRead(req);
    const t = await runAsPlatform(() => M.Ticket.findOne({ ticketId: req.params.id }).lean());
    if (!t || !svc.reporterCanAccess(a, t)) throw Object.assign(new Error("Ticket not found."), { status: 404 });
    res.json(await runAsPlatform(() => svc.ticketDetailForReporter(t, a)));
  }));

  router.post("/tickets/:id/action", writeLimiter, out(async (req, res) => {
    const a = await needRead(req);
    const { action, ...input } = req.body || {};
    if (!REPORTER_ACTIONS.has(action)) throw Object.assign(new Error("Unknown action."), { status: 400 });
    const t = await runAsPlatform(() => svc.performAction({ ticketId: req.params.id, action, actor: a, input, access: access(a) }));
    logAudit(req, { action: "update", resource: "supportTickets", targetId: t.ticketId, after: { action, status: t.status } });
    res.json({ ticket: svc.reporterView(t) });
  }));

  router.post("/tickets/:id/comments", writeLimiter, out(async (req, res) => {
    const a = await needRead(req);
    const c = await runAsPlatform(() => svc.addComment({ ticketId: req.params.id, actor: a, visibility: "public", body: req.body && req.body.body, access: access(a) }));
    res.status(201).json({ id: c.id });
  }));

  router.post("/tickets/:id/attachments", writeLimiter, out(async (req, res) => {
    const a = await needRead(req);
    const refs = await runAsPlatform(() => svc.addAttachments({ ticketId: req.params.id, actor: a, files: req.body && req.body.attachments, access: access(a) }));
    res.status(201).json({ attachments: refs.map(({ internal, ...r }) => r) });
  }));

  router.get("/tickets/:id/attachments/:attId", out(async (req, res) => {
    const a = await needRead(req);
    const att = await runAsPlatform(() => svc.getAttachment({ ticketId: req.params.id, attId: req.params.attId, access: access(a), reporter: true }));
    sendAttachment(res, att);
  }));

  router.get("/notifications", out(async (req, res) => {
    await needRead(req);
    const restaurantId = currentTenantId(); // read before leaving the tenant context
    res.json(await runAsPlatform(() => svc.listNotifications({ recipientKind: "restaurant", recipientId: req.admin.id, restaurantId })));
  }));
  router.post("/notifications/read", out(async (req, res) => {
    await needRead(req);
    const restaurantId = currentTenantId();
    await runAsPlatform(() => svc.markRead({ recipientKind: "restaurant", recipientId: req.admin.id, restaurantId }, req.body && req.body.ids));
    res.json({ success: true });
  }));

  return router;
}

/* ═════════════ shared staff-side ticket handlers (Super Admin + Developer panels) ═════════════ */
function mountStaffTicketRoutes(router, getActor, style) {
  const H = (fn) => handler(style, fn);
  const wrapOut = (res, data, status) => (style === "plain" ? res.status(status || 200).json(data) : okJson(res, data, status));
  const accessFor = (a) => (t) => svc.staffCanAccess(a, t);
  const writeLimiter = buildLimiter(`support-staff-write-${style}`, { windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many requests. Please slow down." } });

  router.get("/meta", H(async (req, res) => wrapOut(res, metaPayload())));

  router.get("/tickets", H(async (req, res) => {
    const a = await getActor(req);
    const filter = svc.buildListFilter(req.query, svc.staffScopeFilter(a));
    const data = await svc.listTickets({ filter, q: req.query, mapper: (t) => svc.staffView(t) });
    wrapOut(res, data);
  }));

  router.get("/tickets/:id", H(async (req, res) => {
    const a = await getActor(req);
    const t = await M.Ticket.findOne({ ticketId: req.params.id }).lean();
    if (!t || !svc.staffCanAccess(a, t)) throw svc.httpErr(404, "Ticket not found.");
    wrapOut(res, await svc.ticketDetailForStaff(t, a));
  }));

  router.post("/tickets/:id/action", writeLimiter, H(async (req, res) => {
    const a = await getActor(req);
    const { action, ...input } = req.body || {};
    if (!STAFF_ACTIONS.has(action)) throw svc.httpErr(400, "Unknown action.");
    const t = await svc.performAction({ ticketId: req.params.id, action, actor: a, input, access: accessFor(a) });
    wrapOut(res, await svc.ticketDetailForStaff(t, a));
  }));

  router.post("/tickets/:id/comments", writeLimiter, H(async (req, res) => {
    const a = await getActor(req);
    const c = await svc.addComment({ ticketId: req.params.id, actor: a, visibility: req.body && req.body.visibility, body: req.body && req.body.body, access: accessFor(a) });
    wrapOut(res, { id: c.id }, 201);
  }));

  router.post("/tickets/:id/attachments", writeLimiter, H(async (req, res) => {
    const a = await getActor(req);
    const refs = await svc.addAttachments({ ticketId: req.params.id, actor: a, files: req.body && req.body.attachments, internal: !!(req.body && req.body.internal), access: accessFor(a) });
    wrapOut(res, { attachments: refs }, 201);
  }));

  router.get("/tickets/:id/attachments/:attId", H(async (req, res) => {
    const a = await getActor(req);
    sendAttachment(res, await svc.getAttachment({ ticketId: req.params.id, attId: req.params.attId, access: accessFor(a), reporter: false }));
  }));
}

/* ═════════════ Super Admin ═════════════ */
function buildSuperAdminRouter() {
  const router = express.Router();
  const actorOf = async (req) => svc.platformAdminActor(req.platformAdmin);
  const H = (fn) => handler("ok", fn);
  mountStaffTicketRoutes(router, actorOf, "ok");

  router.get("/dashboard", H(async (req, res) => {
    const cfg = await svc.getConfig();
    const [counts, recent] = await Promise.all([
      svc.dashboardCounts({}, cfg),
      M.Ticket.find({}).sort({ createdAt: -1 }).limit(8).select("ticketId title status priority restaurantName createdAt").lean(),
    ]);
    okJson(res, { counts, recent: recent.map(svc.strip) });
  }));

  // Create a ticket on behalf of a restaurant (phone / email support).
  router.post("/tickets", H(async (req, res) => {
    const { Restaurant } = require("../platform/models");
    const r = await Restaurant.findOne({ id: String((req.body && req.body.restaurantId) || "") }).lean();
    if (!r) throw svc.httpErr(400, "Choose a restaurant.");
    const actor = await actorOf(req);
    const t = await svc.createTicket({ actor, body: req.body, restaurant: { id: r.id, name: r.name }, venue: null, onBehalfOf: r.name });
    okJson(res, { ticketId: t.ticketId }, 201);
  }));

  router.get("/restaurants", H(async (req, res) => {
    const { Restaurant } = require("../platform/models");
    const rows = await Restaurant.find({}).select("id name slug").sort({ name: 1 }).lean();
    okJson(res, rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug })));
  }));

  /* staff directory */
  router.get("/staff", H(async (req, res) => okJson(res, await staffSvc.listStaff(req.query))));
  router.get("/staff/assignable", H(async (req, res) => okJson(res, await staffSvc.assignable(String(req.query.kind || "developer")))));
  router.get("/staff/roles", H(async (req, res) => {
    const cfg = await svc.getConfig();
    okJson(res, { roles: C.STAFF_ROLES, rolePermissions: cfg.rolePermissions, permissions: C.PERMISSIONS, group: C.PERMISSION_GROUP, defaults: C.ROLE_DEFAULTS, config: { slaHours: cfg.slaHours, reopenWindowDays: cfg.reopenWindowDays, autoCloseDays: cfg.autoCloseDays, deadlineWarningHours: cfg.deadlineWarningHours } });
  }));
  router.put("/staff/roles", H(async (req, res) => {
    const body = req.body || {};
    const next = {};
    const cfg = await svc.getConfig(true);
    for (const role of C.STAFF_ROLES) {
      const list = body.rolePermissions && body.rolePermissions[role];
      if (list === undefined) { next[role] = cfg.rolePermissions[role]; continue; }
      if (!Array.isArray(list) || list.some((p) => !C.PERMISSION_KEYS.includes(p))) throw svc.httpErr(400, `Invalid permission list for ${role}.`);
      next[role] = [...new Set(list)];
    }
    const set = { rolePermissions: next };
    if (body.slaHours) {
      const sla = {};
      for (const p of C.PRIORITIES) { const n = Number(body.slaHours[p]); if (!Number.isFinite(n) || n < 1 || n > 24 * 365) throw svc.httpErr(400, `SLA hours for ${p} must be between 1 and 8760.`); sla[p] = Math.round(n); }
      set.slaHours = sla;
    }
    for (const [k, min, max] of [["reopenWindowDays", 1, 365], ["autoCloseDays", 0, 365], ["deadlineWarningHours", 1, 168]]) {
      if (body[k] !== undefined) { const n = Number(body[k]); if (!Number.isFinite(n) || n < min || n > max) throw svc.httpErr(400, `${k} must be between ${min} and ${max}.`); set[k] = Math.round(n); }
    }
    await M.SupportConfig.updateOne({ _id: "support" }, { $set: set }, { upsert: true });
    svc.invalidateConfig();
    // Role permissions changed → sessions of affected staff keep working but permissions are read per request, so nothing stale remains.
    const actor = await actorOf(req);
    await staffSvc.audit(actor, "permissions", "update_roles", { id: "support", name: "Role permissions" }, { roles: Object.keys(next) }, req.ip);
    const fresh = await svc.getConfig(true);
    okJson(res, { rolePermissions: fresh.rolePermissions, config: { slaHours: fresh.slaHours, reopenWindowDays: fresh.reopenWindowDays, autoCloseDays: fresh.autoCloseDays, deadlineWarningHours: fresh.deadlineWarningHours } });
  }));
  router.post("/staff/roles/reset", H(async (req, res) => {
    await M.SupportConfig.updateOne({ _id: "support" }, { $set: { rolePermissions: JSON.parse(JSON.stringify(C.ROLE_DEFAULTS)) } }, { upsert: true });
    svc.invalidateConfig();
    await staffSvc.audit(await actorOf(req), "permissions", "reset_roles", { id: "support", name: "Role permissions" }, null, req.ip);
    okJson(res, { rolePermissions: (await svc.getConfig(true)).rolePermissions });
  }));
  router.post("/staff", H(async (req, res) => okJson(res, await staffSvc.createStaff(req.body || {}, await actorOf(req), req.ip), 201)));
  router.get("/staff/:id", H(async (req, res) => okJson(res, await staffSvc.staffDetail(req.params.id))));
  router.patch("/staff/:id", H(async (req, res) => okJson(res, await staffSvc.updateStaff(req.params.id, req.body || {}, await actorOf(req), req.ip))));
  router.post("/staff/:id/deactivate", H(async (req, res) => okJson(res, await staffSvc.deactivateStaff(req.params.id, req.body || {}, await actorOf(req), req.ip))));
  router.post("/staff/:id/reactivate", H(async (req, res) => okJson(res, await staffSvc.reactivateStaff(req.params.id, await actorOf(req), req.ip))));
  router.post("/staff/:id/resend-invite", H(async (req, res) => okJson(res, await staffSvc.resendInvite(req.params.id, await actorOf(req), req.ip))));

  router.get("/audit", H(async (req, res) => {
    const rows = await M.SupportAudit.find({}).sort({ at: -1 }).limit(Math.min(200, parseInt(req.query.limit, 10) || 50)).lean();
    okJson(res, rows.map(svc.strip));
  }));

  router.get("/notifications", H(async (req, res) => okJson(res, await svc.listNotifications({ recipientKind: "superadmin" }))));
  router.post("/notifications/read", H(async (req, res) => { await svc.markRead({ recipientKind: "superadmin" }, req.body && req.body.ids); okJson(res, null); }));

  return router;
}

/* ═════════════ Developer panel ═════════════ */
function buildDevRouter() {
  const router = express.Router();
  const H = (fn) => handler("ok", fn);

  const loginLimiter = buildLimiter("dev-login", { windowMs: 15 * 60 * 1000, max: Number(process.env.DEV_LOGIN_RATE_LIMIT_MAX || 10), standardHeaders: true, legacyHeaders: false, skipSuccessfulRequests: true, message: { success: false, message: "Too many attempts. Please try again later." } });
  const forgotLimiter = buildLimiter("dev-forgot", { windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many requests. Please try again later." } });
  const resetLimiter = buildLimiter("dev-reset", { windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many attempts. Please try again later." } });

  router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

  async function requireStaff(req, res, next) {
    try {
      const found = await staffSvc.sessionFromCookie(req.cookies && req.cookies[staffSvc.COOKIE]);
      if (!found) {
        res.clearCookie(staffSvc.COOKIE, { ...staffSvc.cookieOpts(), maxAge: undefined });
        return res.status(401).json({ success: false, message: "Please sign in." });
      }
      req.devStaff = found.staff;
      req.devActor = await svc.staffActor(found.staff);
      staffSvc.touchActivity(found.staff.id);
      next();
    } catch (e) { sendErr(res, e, "ok"); }
  }

  /* auth (public) */
  router.post("/auth/login", loginLimiter, H(async (req, res) => {
    const { raw, staff } = await staffSvc.login(req.body && req.body.email, req.body && req.body.password, req);
    res.cookie(staffSvc.COOKIE, raw, staffSvc.cookieOpts());
    okJson(res, { staff: await meOf(staff) });
  }));
  router.post("/auth/logout", H(async (req, res) => {
    await staffSvc.logoutSession(req.cookies && req.cookies[staffSvc.COOKIE]);
    res.clearCookie(staffSvc.COOKIE, { ...staffSvc.cookieOpts(), maxAge: undefined });
    okJson(res, null);
  }));
  router.post("/auth/forgot-password", forgotLimiter, H(async (req, res) => {
    await staffSvc.forgotPassword(req.body && req.body.email, req);
    okJson(res, { message: "If that email belongs to a Dishky staff account, a reset link has been sent." });
  }));
  router.get("/auth/reset-password/validate", resetLimiter, H(async (req, res) => {
    const info = await staffSvc.tokenInfo(String(req.query.token || ""));
    okJson(res, { valid: !!info, purpose: info ? info.token.purpose : null });
  }));
  router.post("/auth/reset-password", resetLimiter, H(async (req, res) => {
    const b = req.body || {};
    await staffSvc.resetPassword(String(b.token || ""), b.password, b.confirmPassword, req);
    okJson(res, { message: "Your password has been updated. Please sign in." });
  }));

  async function meOf(staff) {
    const cfg = await svc.getConfig();
    const s = staffSvc.safeStaff(staff);
    return { id: s.id, staffNo: s.staffNo, name: s.name, email: s.email, role: s.role, phone: s.phone, department: s.department, designation: s.designation, profileImage: s.profileImage, skills: s.skills, supportedModules: s.supportedModules, lastLoginAt: s.lastLoginAt, permissions: cfg.rolePermissions[s.role] || [] };
  }

  /* everything below needs a valid staff session */
  router.use(requireStaff);
  router.get("/auth/me", H(async (req, res) => okJson(res, { staff: await meOf(req.devStaff) })));
  // Own profile (name / phone / picture). The Super Admin console's Staff module reads the same record.
  router.patch("/auth/me", H(async (req, res) => {
    const updated = await staffSvc.updateSelf(req.devStaff.id, req.body);
    okJson(res, { staff: await meOf(updated) });
  }));
  router.patch("/auth/change-password", resetLimiter, H(async (req, res) => {
    const b = req.body || {};
    if (b.newPassword !== b.confirmPassword) throw svc.httpErr(400, "Passwords do not match.");
    await staffSvc.changePassword(req.devStaff.id, b.currentPassword, b.newPassword, req.cookies[staffSvc.COOKIE]);
    okJson(res, null);
  }));

  const actorOf = async (req) => req.devActor;
  mountStaffTicketRoutes(router, actorOf, "ok");

  router.get("/dashboard", H(async (req, res) => {
    const a = req.devActor;
    const [counts, mine] = await Promise.all([
      svc.developerDashboard(a, req.query),
      M.Ticket.find({ developerId: a.id, status: { $in: C.OPEN } }).sort({ deadline: 1 }).limit(10).select("ticketId title status priority deadline restaurantName progressPct acknowledgedAt").lean(),
    ]);
    okJson(res, { counts, upcoming: mine.map((t) => ({ ...svc.strip(t), ...{ overdue: !!t.deadline && new Date(t.deadline) < new Date() && C.DEADLINE_ACTIVE.includes(t.status) } })) });
  }));

  // Used by the assignment form for staff who hold tickets.assign (e.g. Project Manager).
  router.get("/staff/assignable", H(async (req, res) => {
    if (!svc.hasPerm(req.devActor, "tickets.assign")) throw svc.httpErr(403, "Missing permission: tickets.assign");
    okJson(res, await staffSvc.assignable(String(req.query.kind || "developer")));
  }));

  router.get("/notifications", H(async (req, res) => okJson(res, await svc.listNotifications({ recipientKind: "staff", recipientId: req.devStaff.id }))));
  router.post("/notifications/read", H(async (req, res) => { await svc.markRead({ recipientKind: "staff", recipientId: req.devStaff.id }, req.body && req.body.ids); okJson(res, null); }));

  return router;
}

module.exports = { buildRestaurantRouter, buildSuperAdminRouter, buildDevRouter, metaPayload };

/**
 * platform/superadmin.js — the Dishky team's console API (mounted at /superadmin).
 *
 * Who can use it: only rows in `platformAdmins`, created from the command line
 * (scripts/create-platform-admin.js). There is no sign-up route.
 *
 * Security:
 *  - email + password (bcrypt), min 12 characters
 *  - 5 wrong passwords lock the account for 15 minutes; the same message is
 *    returned for unknown email / wrong password / locked (no account probing)
 *  - separate httpOnly, SameSite=Strict cookie (`dishkyid_admin`), 12 h absolute session,
 *    stored server-side as a SHA-256 hash
 *  - optional IP allow-list: PLATFORM_ADMIN_ALLOWED_IPS=1.2.3.4,5.6.7.8
 *  - strict rate limit on login; every sign-in event is logged
 *  - read-only: this console never changes a client's data
 */
const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const mongoose = require("mongoose");
const models = require("./models");
const plans = require("./plans");
const { buildLimiter } = require("../../core/rateLimitStore");
const { runAsPlatform } = require("../../core/tenancy");

const {
  Owner, Restaurant, Plan, Subscription, Invoice,
  PlatformAdmin, PlatformAdminSession, PlatformAdminLog,
} = models;

const COOKIE = "dishkyid_admin";
const SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;
const MIN_PASSWORD = 12;
const DAY = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const fail = (res, status, message) => res.status(status).json({ success: false, message });
const sha = (v) => crypto.createHash("sha256").update(String(v)).digest("hex");

function cookieOpts() {
  const prod = process.env.NODE_ENV === "production";
  return { httpOnly: true, secure: prod, sameSite: "strict", maxAge: SESSION_MS, path: "/" };
}

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(`[superadmin] ${req.method} ${req.originalUrl}:`, err);
    fail(res, 500, "Something went wrong.");
  });

/** What the console is told about the signed-in admin. */
function adminOut(a) {
  return { id: a.id, name: a.name, email: a.email, phone: a.phone || "", photo: a.photo || "", lastLoginAt: a.lastLoginAt };
}

function logEvent(req, event, admin, email) {
  return runAsPlatform(() =>
    PlatformAdminLog.create({ adminId: admin ? admin.id : null, email: email || (admin && admin.email) || "", event, ip: req.ip || "" })
  ).catch(() => {});
}

/* ───────── pure helpers (unit-tested) ───────── */

/** When does this client lose (or when did they lose) access? null = never. */
function expiryOf(sub) {
  if (!sub) return null;
  if (sub.comped) return null;
  switch (sub.status) {
    case "trialing": return sub.trialEndsAt || null;
    case "past_due": return sub.graceEndsAt || sub.currentPeriodEnd || null;
    case "active":
    case "cancelled":
    case "expired":
      return sub.currentPeriodEnd || sub.trialEndsAt || null;
    default:
      return sub.currentPeriodEnd || sub.trialEndsAt || null;
  }
}

/** Monthly recurring revenue contributed by a subscription (INR), 0 if not paying. */
function mrrOf(sub, plan) {
  if (!sub || sub.comped || !plan) return 0;
  if (!["active", "past_due"].includes(sub.status)) return 0;
  return sub.billingCycle === "yearly" ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;
}

function csvCell(v) {
  let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* ───────── storage accounting ───────── */

let storageCache = null; // { at, value }
const STORAGE_TTL_MS = 10 * 60 * 1000;
let storageInFlight = null;

/**
 * Bytes of tenant data per restaurant, summed over every collection that carries
 * a restaurantId. Uses $bsonSize (MongoDB 4.4+). If the database does not support
 * it, falls back to document-count x average document size and says so.
 */
async function computeStorage() {
  const db = mongoose.connection.db;
  const perRestaurant = {}; // id -> { bytes, docs }
  const perCollection = {}; // name -> { bytes, docs }
  let approximate = false;

  const colls = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of colls) {
    if (name.startsWith("system.")) continue;
    let rows = [];
    try {
      rows = await db.collection(name).aggregate([
        { $match: { restaurantId: { $type: "string" } } },
        { $group: { _id: "$restaurantId", bytes: { $sum: { $bsonSize: "$$ROOT" } }, docs: { $sum: 1 } } },
      ]).toArray();
    } catch {
      approximate = true;
      try {
        const counts = await db.collection(name).aggregate([
          { $match: { restaurantId: { $type: "string" } } },
          { $group: { _id: "$restaurantId", docs: { $sum: 1 } } },
        ]).toArray();
        let avg = 0;
        try {
          const st = await db.command({ collStats: name });
          avg = st.avgObjSize || (st.count ? st.size / st.count : 0);
        } catch { /* no stats available */ }
        rows = counts.map((c) => ({ _id: c._id, docs: c.docs, bytes: Math.round(c.docs * avg) }));
      } catch { rows = []; }
    }
    for (const r of rows) {
      const t = (perRestaurant[r._id] = perRestaurant[r._id] || { bytes: 0, docs: 0, byCollection: {} });
      t.bytes += r.bytes;
      t.docs += r.docs;
      t.byCollection[name] = { bytes: r.bytes, docs: r.docs };
      const c = (perCollection[name] = perCollection[name] || { bytes: 0, docs: 0 });
      c.bytes += r.bytes;
      c.docs += r.docs;
    }
  }

  let dbStats = {};
  try { dbStats = await db.command({ dbStats: 1 }); } catch { /* not available */ }
  const attributed = Object.values(perRestaurant).reduce((n, t) => n + t.bytes, 0);
  const limitMb = Number(process.env.DB_STORAGE_LIMIT_MB || 0);
  return {
    computedAt: new Date(),
    approximate,
    perRestaurant,
    perCollection,
    database: {
      name: db.databaseName,
      dataBytes: dbStats.dataSize || 0,
      storageBytes: dbStats.storageSize || 0,
      indexBytes: dbStats.indexSize || 0,
      tenantDataBytes: attributed,
      platformAndOtherBytes: Math.max(0, (dbStats.dataSize || 0) - attributed),
      capacityBytes: limitMb > 0 ? limitMb * 1024 * 1024 : null,
    },
  };
}

async function getStorage({ force = false } = {}) {
  if (!force && storageCache && Date.now() - storageCache.at < STORAGE_TTL_MS) return storageCache.value;
  if (!storageInFlight) {
    storageInFlight = computeStorage()
      .then((value) => { storageCache = { at: Date.now(), value }; return value; })
      .finally(() => { storageInFlight = null; });
  }
  return storageInFlight;
}

/* ───────── router ───────── */

function buildRouter() {
  const router = express.Router();

  const loginLimiter = buildLimiter("superadmin-login", {
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.SUPERADMIN_LOGIN_RATE_LIMIT_MAX || 10),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { success: false, message: "Too many attempts. Please try again later." },
  });

  // Optional network allow-list, applied to everything (including login).
  router.use((req, res, next) => {
    const allowed = (process.env.PLATFORM_ADMIN_ALLOWED_IPS || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(req.ip)) return fail(res, 404, "Not found");
    res.set("Cache-Control", "no-store");
    next();
  });

  async function requireAdmin(req, res, next) {
    try {
      const raw = req.cookies && req.cookies[COOKIE];
      if (!raw) return fail(res, 401, "Please sign in.");
      const session = await runAsPlatform(() => PlatformAdminSession.findOne({ tokenHash: sha(raw) }).lean());
      if (!session || session.expiresAt < new Date()) {
        res.clearCookie(COOKIE, { ...cookieOpts(), maxAge: undefined });
        return fail(res, 401, "Your session has expired. Please sign in again.");
      }
      const admin = await runAsPlatform(() => PlatformAdmin.findOne({ id: session.adminId }).lean());
      if (!admin || admin.status !== "active") return fail(res, 401, "Account not available.");
      req.platformAdmin = admin;
      req.platformSession = session;
      next();
    } catch (err) { next(err); }
  }

  // Developer Support & Ticket Management (ticket lifecycle, Dishky staff, role permissions).
  router.use("/support", requireAdmin, require("../support/routes").buildSuperAdminRouter());

  /* ── auth ── */

  router.post("/auth/login", loginLimiter, wrap(async (req, res) => {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    const password = String((req.body && req.body.password) || "");
    const GENERIC = "Invalid email or password.";
    const admin = EMAIL_RE.test(email) ? await runAsPlatform(() => PlatformAdmin.findOne({ email })) : null;
    const locked = admin && admin.lockUntil && admin.lockUntil > new Date();

    // Always run bcrypt so response time doesn't reveal whether the email exists.
    const valid = await bcrypt.compare(password, admin ? admin.password : DUMMY_HASH);

    if (!admin || admin.status !== "active" || locked || !valid) {
      if (admin && !locked) {
        admin.failedAttempts = (admin.failedAttempts || 0) + 1;
        if (admin.failedAttempts >= MAX_FAILED) {
          admin.lockUntil = new Date(Date.now() + LOCK_MS);
          admin.failedAttempts = 0;
          await logEvent(req, "locked", admin);
        }
        await admin.save();
      }
      await logEvent(req, "login_failed", admin, email);
      return fail(res, 401, GENERIC);
    }

    admin.failedAttempts = 0;
    admin.lockUntil = null;
    admin.lastLoginAt = new Date();
    admin.lastLoginIp = req.ip || "";
    await admin.save();

    const raw = crypto.randomBytes(32).toString("hex");
    await runAsPlatform(() => PlatformAdminSession.create({
      tokenHash: sha(raw), adminId: admin.id, ip: req.ip || "",
      userAgent: String(req.headers["user-agent"] || "").slice(0, 200),
      expiresAt: new Date(Date.now() + SESSION_MS),
    }));
    res.cookie(COOKIE, raw, cookieOpts());
    await logEvent(req, "login_ok", admin);
    ok(res, { admin: adminOut(admin) });
  }));

  router.post("/auth/logout", wrap(async (req, res) => {
    const raw = req.cookies && req.cookies[COOKIE];
    if (raw) await runAsPlatform(() => PlatformAdminSession.deleteOne({ tokenHash: sha(raw) }));
    res.clearCookie(COOKIE, { ...cookieOpts(), maxAge: undefined });
    ok(res, null);
  }));

  router.get("/auth/me", requireAdmin, wrap(async (req, res) => {
    const a = req.platformAdmin;
    ok(res, { admin: adminOut(a), sessionExpiresAt: req.platformSession.expiresAt });
  }));

  // Edit own profile: name, phone and profile picture (email and access are not editable here).
  router.patch("/auth/me", requireAdmin, wrap(async (req, res) => {
    const b = req.body || {};
    const patch = {};
    if (b.name !== undefined) {
      const n = String(b.name || "").trim();
      if (n.length < 2) return fail(res, 400, "Name must be at least 2 characters.");
      patch.name = n.slice(0, 120);
    }
    if (b.phone !== undefined) {
      const p = String(b.phone || "").trim();
      if (p && !/^[0-9+()\-\s]{6,30}$/.test(p)) return fail(res, 400, "Enter a valid phone number.");
      patch.phone = p;
    }
    if (b.photo !== undefined) {
      const u = String(b.photo || "").trim();
      const isUrl = /^https:\/\/[^\s]+$/i.test(u) && u.length <= 500;
      const isData = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(u) && u.length <= 200000;
      if (u && !isUrl && !isData) return fail(res, 400, "Profile picture must be a PNG, JPG or WebP image.");
      patch.photo = u;
    }
    const admin = await runAsPlatform(() => PlatformAdmin.findOne({ id: req.platformAdmin.id }));
    if (!admin) return fail(res, 404, "Account not found.");
    Object.assign(admin, patch);
    await admin.save();
    await logEvent(req, "profile_updated", admin);
    ok(res, { admin: adminOut(admin) });
  }));

  router.patch("/auth/change-password", loginLimiter, requireAdmin, wrap(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD) {
      return fail(res, 400, `Password must be at least ${MIN_PASSWORD} characters.`);
    }
    const admin = await runAsPlatform(() => PlatformAdmin.findOne({ id: req.platformAdmin.id }));
    if (!(await bcrypt.compare(String(currentPassword || ""), admin.password))) return fail(res, 401, "Current password is incorrect.");
    admin.password = await bcrypt.hash(newPassword, 12);
    await admin.save();
    const keep = sha(req.cookies[COOKIE]);
    await runAsPlatform(() => PlatformAdminSession.deleteMany({ adminId: admin.id, tokenHash: { $ne: keep } }));
    await logEvent(req, "password_changed", admin);
    ok(res, null);
  }));

  /* ── data (read-only) ── */

  async function loadAll() {
    return runAsPlatform(async () => {
      const [owners, restaurants, subs, planDocs] = await Promise.all([
        Owner.find({}).lean(), Restaurant.find({}).lean(), Subscription.find({}).lean(), Plan.find({}).lean(),
      ]);
      return {
        owners, restaurants, subs, planDocs,
        ownerById: new Map(owners.map((o) => [o.id, o])),
        subByRest: new Map(subs.map((s) => [s.restaurantId, s])),
        planByKey: new Map(planDocs.map((p) => [p.key, p])),
      };
    });
  }

  function row(r, ctx, storage) {
    const sub = ctx.subByRest.get(r.id) || null;
    const owner = ctx.ownerById.get(r.ownerId) || null;
    const plan = sub ? ctx.planByKey.get(sub.planKey) : null;
    const exp = expiryOf(sub);
    const st = storage.perRestaurant[r.id] || { bytes: 0, docs: 0 };
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      restaurantStatus: r.status,
      internal: !!r.internal,
      city: r.contact && r.contact.city,
      createdAt: r.createdAt,
      owner: owner ? { id: owner.id, name: owner.name, email: owner.email, phone: owner.phone, status: owner.status, lastLoginAt: owner.lastLoginAt } : null,
      plan: sub ? sub.planKey : null,
      planName: plan ? plan.name : sub ? sub.planKey : null,
      billingCycle: sub ? sub.billingCycle : null,
      subscriptionStatus: sub ? (sub.comped ? "comped" : sub.status) : null,
      trialEndsAt: sub ? sub.trialEndsAt : null,
      currentPeriodEnd: sub ? sub.currentPeriodEnd : null,
      cancelAtPeriodEnd: !!(sub && sub.cancelAtPeriodEnd),
      pendingPlan: sub && sub.pendingChange && sub.pendingChange.planKey ? sub.pendingChange.planKey : null,
      expiresAt: exp,
      daysLeft: exp ? Math.ceil((new Date(exp).getTime() - Date.now()) / DAY) : null,
      mrr: mrrOf(sub, plan),
      storageBytes: st.bytes,
      storageDocs: st.docs,
    };
  }

  router.get("/overview", requireAdmin, wrap(async (req, res) => {
    const ctx = await loadAll();
    const storage = await getStorage();
    const now = Date.now();
    const byPlan = {};
    const byStatus = {};
    let mrr = 0;
    let expiring7 = 0;
    let expiring30 = 0;
    let trialsEnding7 = 0;
    let paying = 0;
    for (const s of ctx.subs) {
      const key = s.comped ? "comped" : s.status;
      byStatus[key] = (byStatus[key] || 0) + 1;
      byPlan[s.planKey] = (byPlan[s.planKey] || 0) + 1;
      const plan = ctx.planByKey.get(s.planKey);
      const m = mrrOf(s, plan);
      mrr += m;
      if (m > 0) paying += 1;
      const exp = expiryOf(s);
      if (exp && ["trialing", "active", "past_due", "cancelled"].includes(s.status)) {
        const left = new Date(exp).getTime() - now;
        if (left >= 0 && left <= 7 * DAY) { expiring7 += 1; if (s.status === "trialing") trialsEnding7 += 1; }
        if (left >= 0 && left <= 30 * DAY) expiring30 += 1;
      }
    }
    const since30 = now - 30 * DAY;
    ok(res, {
      totals: {
        clients: ctx.owners.length,
        restaurants: ctx.restaurants.length,
        payingRestaurants: paying,
        mrr,
        arr: mrr * 12,
        newClients30d: ctx.owners.filter((o) => new Date(o.createdAt).getTime() >= since30).length,
        newRestaurants30d: ctx.restaurants.filter((r) => new Date(r.createdAt).getTime() >= since30).length,
        expiring7d: expiring7,
        expiring30d: expiring30,
        trialsEnding7d: trialsEnding7,
        expiredOrBlocked: ctx.subs.filter((s) => ["expired", "suspended"].includes(s.status)).length,
        suspendedRestaurants: ctx.restaurants.filter((r) => r.status === "suspended").length,
      },
      byPlan,
      byStatus,
      storage: { ...storage.database, computedAt: storage.computedAt, approximate: storage.approximate },
      plans: ctx.planDocs.map((p) => ({ key: p.key, name: p.name, monthlyPrice: p.monthlyPrice, yearlyPrice: p.yearlyPrice })),
    });
  }));

  const SORTERS = {
    name: (a) => (a.name || "").toLowerCase(),
    owner: (a) => ((a.owner && a.owner.name) || "").toLowerCase(),
    plan: (a) => plans.planRank(a.plan) || 0,
    status: (a) => a.subscriptionStatus || "",
    expiresAt: (a) => (a.expiresAt ? new Date(a.expiresAt).getTime() : Number.MAX_SAFE_INTEGER),
    storage: (a) => a.storageBytes,
    createdAt: (a) => new Date(a.createdAt).getTime(),
    mrr: (a) => a.mrr,
  };

  function filterRows(rows, q) {
    const search = String(q.search || "").trim().toLowerCase();
    return rows.filter((r) => {
      if (q.plan && r.plan !== q.plan) return false;
      if (q.status && r.subscriptionStatus !== q.status) return false;
      if (q.restaurantStatus && r.restaurantStatus !== q.restaurantStatus) return false;
      if (q.expiringInDays) {
        const d = Number(q.expiringInDays);
        if (r.daysLeft === null || r.daysLeft > d) return false;
      }
      if (search) {
        const hay = [r.name, r.slug, r.owner && r.owner.name, r.owner && r.owner.email, r.owner && r.owner.phone, r.city].join(" ").toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }

  function sortRows(rows, q) {
    const key = SORTERS[q.sort] ? q.sort : "createdAt";
    const dir = q.dir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      const x = SORTERS[key](a), y = SORTERS[key](b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }

  router.get("/restaurants", requireAdmin, wrap(async (req, res) => {
    const ctx = await loadAll();
    const storage = await getStorage();
    let rows = ctx.restaurants.map((r) => row(r, ctx, storage));
    rows = sortRows(filterRows(rows, req.query), req.query);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    ok(res, {
      total: rows.length,
      page,
      limit,
      storageComputedAt: storage.computedAt,
      storageApproximate: storage.approximate,
      rows: rows.slice((page - 1) * limit, page * limit),
    });
  }));

  router.get("/restaurants/:id", requireAdmin, wrap(async (req, res) => {
    const ctx = await loadAll();
    const r = ctx.restaurants.find((x) => x.id === req.params.id);
    if (!r) return fail(res, 404, "Restaurant not found.");
    const storage = await getStorage();
    const invoices = await runAsPlatform(() => Invoice.find({ restaurantId: r.id }).sort({ createdAt: -1 }).limit(50).lean());
    const siblings = ctx.restaurants.filter((x) => x.ownerId === r.ownerId && x.id !== r.id).map((x) => ({ id: x.id, name: x.name, slug: x.slug }));
    const st = storage.perRestaurant[r.id] || { bytes: 0, docs: 0, byCollection: {} };
    let usage = null;
    try { usage = await require("./subscriptions").getUsage(r.id); } catch { /* tenant models unavailable */ }
    const sub = ctx.subByRest.get(r.id) || null;
    ok(res, {
      ...row(r, ctx, storage),
      branding: r.branding,
      contact: r.contact,
      usage,
      limits: sub ? (plans.definitionFor(sub.planKey) || {}).entitlements || null : null,
      subscription: sub && {
        provider: sub.provider, status: sub.status, comped: !!sub.comped,
        currentPeriodStart: sub.currentPeriodStart, currentPeriodEnd: sub.currentPeriodEnd,
        graceEndsAt: sub.graceEndsAt, trialEndsAt: sub.trialEndsAt,
        pendingChange: sub.pendingChange && sub.pendingChange.planKey ? sub.pendingChange : null,
      },
      storage: {
        bytes: st.bytes,
        docs: st.docs,
        approximate: storage.approximate,
        computedAt: storage.computedAt,
        collections: Object.entries(st.byCollection || {})
          .map(([name, v]) => ({ name, bytes: v.bytes, docs: v.docs }))
          .sort((a, b) => b.bytes - a.bytes),
      },
      invoices: invoices.map((i) => ({
        id: i.id, planKey: i.planKey, billingCycle: i.billingCycle, amount: i.amount, currency: i.currency,
        status: i.status, provider: i.provider, paidAt: i.paidAt, periodStart: i.periodStart, periodEnd: i.periodEnd,
      })),
      otherRestaurantsOfOwner: siblings,
    });
  }));

  router.get("/clients", requireAdmin, wrap(async (req, res) => {
    const ctx = await loadAll();
    const storage = await getStorage();
    const search = String(req.query.search || "").trim().toLowerCase();
    const rows = ctx.owners.map((o) => {
      const rs = ctx.restaurants.filter((r) => r.ownerId === o.id).map((r) => row(r, ctx, storage));
      return {
        id: o.id, name: o.name, email: o.email, phone: o.phone, status: o.status,
        createdAt: o.createdAt, lastLoginAt: o.lastLoginAt,
        restaurants: rs.map((r) => ({ id: r.id, name: r.name, slug: r.slug, plan: r.plan, planName: r.planName, subscriptionStatus: r.subscriptionStatus, expiresAt: r.expiresAt })),
        restaurantCount: rs.length,
        mrr: rs.reduce((n, r) => n + r.mrr, 0),
        storageBytes: rs.reduce((n, r) => n + r.storageBytes, 0),
      };
    }).filter((o) => !search || [o.name, o.email, o.phone, ...o.restaurants.map((r) => r.name)].join(" ").toLowerCase().includes(search));
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    ok(res, { total: rows.length, page, limit, rows: rows.slice((page - 1) * limit, page * limit) });
  }));

  router.post("/storage/refresh", requireAdmin, wrap(async (_req, res) => {
    const s = await getStorage({ force: true });
    ok(res, { computedAt: s.computedAt, approximate: s.approximate, database: s.database });
  }));

  router.get("/export/restaurants.csv", requireAdmin, wrap(async (req, res) => {
    const ctx = await loadAll();
    const storage = await getStorage();
    const rows = sortRows(filterRows(ctx.restaurants.map((r) => row(r, ctx, storage)), req.query), req.query);
    const head = ["Restaurant", "URL name", "Owner", "Owner email", "Owner phone", "Plan", "Billing", "Status", "Expires", "Days left", "MRR (INR)", "Storage (bytes)", "Signed up"];
    const lines = [head.map(csvCell).join(",")].concat(rows.map((r) => [
      r.name, r.slug, r.owner && r.owner.name, r.owner && r.owner.email, r.owner && r.owner.phone,
      r.planName, r.billingCycle, r.subscriptionStatus, r.expiresAt, r.daysLeft, r.mrr, r.storageBytes, r.createdAt,
    ].map(csvCell).join(",")));
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="dishky-restaurants.csv"');
    res.send(lines.join("\n"));
  }));

  return router;
}

module.exports = { buildRouter, expiryOf, mrrOf, csvCell, computeStorage, COOKIE, MIN_PASSWORD };

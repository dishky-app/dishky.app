/**
 * platform/index.js — the API behind dishky.com (mounted at /platform).
 *
 *   public    plans, slug check, contact / demo / newsletter
 *   owner     signup, login, restaurants, "open dashboard"
 *   billing   checkout, confirm, change plan, cancel / resume, invoices
 *   webhooks  provider -> us (signature verified, idempotent)
 *
 * Responses use { success, data, message } to match the website client.
 */
const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const models = require("./models");
const plans = require("./plans");
const slugs = require("./slugs");
const subs = require("./subscriptions");
const provision = require("./provision");
const { selectProvider } = require("./billing");
const { buildLimiter } = require("../../core/rateLimitStore");
const { runAsPlatform } = require("../../core/tenancy");
const { sendResetPasswordEmail } = require("../../services/Mailer");
const { invalidateRestaurant } = require("./tenantResolver");

const { Owner, OwnerSession, OwnerReset, Restaurant, Plan, Subscription, Invoice, SsoToken, Contact, DemoRequest, Newsletter } = models;

const OWNER_COOKIE = "dishkyid_owner";
const OWNER_SESSION_MS = 14 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SITE_URL = () => (process.env.PUBLIC_SITE_URL || "https://www.dishky.com").replace(/\/$/, "");
const ADMIN_URL = () => (process.env.ADMIN_APP_URL || "https://app.dishky.com").replace(/\/$/, "");

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, message, data });
const fail = (res, status, message, extra) => res.status(status).json({ success: false, message, ...(extra || {}) });

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((err) => {
  if (err && err.status && err.status < 500) {
    const { status, message, over, code, kind, limit, used } = err;
    return fail(res, status, message, { over, code, kind, limit, used });
  }
  console.error(`[platform] ${req.method} ${req.originalUrl}:`, err);
  return fail(res, 500, "Something went wrong. Please try again.");
});

function ownerCookieOpts() {
  const prod = process.env.NODE_ENV === "production";
  return { httpOnly: true, secure: prod, sameSite: "lax", maxAge: OWNER_SESSION_MS, path: "/" };
}

const ADDRESS_FIELDS = { doorNo: 20, street: 80, area: 80, district: 60, state: 60, pincode: 6 };

/** Keeps only the six known address fields, as trimmed strings of a sane length. */
function cleanAddress(a) {
  const src = a && typeof a === "object" ? a : {};
  const out = {};
  for (const [k, max] of Object.entries(ADDRESS_FIELDS)) out[k] = String(src[k] ?? "").trim().slice(0, max);
  return out;
}

function publicOwner(o) {
  return { id: o.id, name: o.name, email: o.email, phone: o.phone, address: cleanAddress(o.address) };
}

async function ensureDefaultPlans() {
  for (const def of plans.PLAN_DEFINITIONS) {
    const { entitlements, ...marketing } = def;
    await runAsPlatform(() =>
      Plan.findOneAndUpdate({ key: def.key }, { $set: marketing }, { upsert: true, setDefaultsOnInsert: true })
    );
  }
}

function publicPlan(p) {
  const def = plans.definitionFor(p.key);
  return {
    _id: p.key,
    key: p.key,
    name: p.name,
    tagline: p.tagline,
    monthlyPrice: p.monthlyPrice,
    yearlyPrice: p.yearlyPrice,
    currency: p.currency,
    features: p.features,
    mostPopular: p.mostPopular,
    ctaLabel: p.ctaLabel,
    order: p.order,
    selfServe: p.selfServe,
    limits: def ? {
      maxVenues: def.entitlements.maxVenues,
      maxTables: def.entitlements.maxTables,
      maxStaffAccounts: def.entitlements.maxStaffAccounts,
    } : null,
  };
}

function restaurantUrls(r) {
  return { site: `${SITE_URL()}/${r.slug}`, admin: `${ADMIN_URL()}/login?restaurant=${encodeURIComponent(r.slug)}` };
}

async function subscriptionSummary(restaurantId) {
  subs.invalidate(restaurantId); // owner views must never show a stale state
  const fresh = await subs.getAccessState(restaurantId);
  const sub = fresh.subscription || {};
  return {
    planKey: fresh.planKey,
    status: sub.status || null,
    billingCycle: sub.billingCycle || null,
    trialEndsAt: sub.trialEndsAt || null,
    currentPeriodEnd: sub.currentPeriodEnd || null,
    graceEndsAt: sub.graceEndsAt || null,
    cancelAtPeriodEnd: !!sub.cancelAtPeriodEnd,
    pendingChange: sub.pendingChange && sub.pendingChange.planKey ? sub.pendingChange : null,
    comped: !!sub.comped,
    access: fresh.access,
    limits: {
      maxVenues: fresh.entitlements.maxVenues,
      maxTables: fresh.entitlements.maxTables,
      maxStaffAccounts: fresh.entitlements.maxStaffAccounts,
    },
  };
}

function buildRouter() {
  const router = express.Router();

  const authLimiter = buildLimiter("owner-auth", {
    windowMs: 15 * 60 * 1000, max: Number(process.env.OWNER_AUTH_RATE_LIMIT_MAX || 20), standardHeaders: true, legacyHeaders: false,
    message: { success: false, message: "Too many attempts. Please try again later." },
    skipSuccessfulRequests: true,
  });
  const signupLimiter = buildLimiter("owner-signup", {
    windowMs: 60 * 60 * 1000, max: Number(process.env.SIGNUP_RATE_LIMIT_MAX || 10), standardHeaders: true, legacyHeaders: false,
    message: { success: false, message: "Too many sign-ups from this device. Please try again later." },
  });
  const formLimiter = buildLimiter("site-forms", {
    windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
    message: { success: false, message: "Too many submissions from this device. Please try again later." },
  });

  /* ───────────── public ───────────── */

  router.get("/plans", wrap(async (_req, res) => {
    const list = await runAsPlatform(() => Plan.find({ active: true }).sort({ order: 1 }).lean());
    res.json({ success: true, count: list.length, data: list.map(publicPlan) });
  }));

  router.get("/reserved-slugs", (_req, res) => ok(res, slugs.RESERVED_SLUGS));

  router.get("/slug-check", wrap(async (req, res) => {
    const slug = slugs.slugify(req.query.slug || req.query.name || "");
    const result = await provision.isSlugAvailable(slug);
    const suggestions = result.available || !slug ? [] : await provision.suggestSlugs(slug);
    ok(res, { slug, ...result, suggestions });
  }));

  router.post("/contact", formLimiter, wrap(async (req, res) => {
    const { name, email, phone, message } = req.body || {};
    if (!String(name || "").trim()) return fail(res, 400, "Name is required.");
    if (!EMAIL_RE.test(String(email || "").trim())) return fail(res, 400, "Enter a valid email address.");
    if (!String(message || "").trim()) return fail(res, 400, "Message is required.");
    if (String(message).length > 2000) return fail(res, 400, "Message is too long.");
    const c = await runAsPlatform(() => Contact.create({ name, email, phone, message }));
    ok(res, { id: c.id }, "Thanks for reaching out — we'll get back to you soon.", 201);
  }));

  router.post("/demo", formLimiter, wrap(async (req, res) => {
    const b = req.body || {};
    if (!String(b.restaurantName || "").trim()) return fail(res, 400, "Restaurant name is required.");
    if (!String(b.contactName || "").trim()) return fail(res, 400, "Contact name is required.");
    const phone = String(b.phone || "").trim();
    if (phone.length < 7 || phone.length > 20) return fail(res, 400, "Enter a valid phone number.");
    if (!EMAIL_RE.test(String(b.email || "").trim())) return fail(res, 400, "Enter a valid email address.");
    const outlets = b.numberOfOutlets === undefined || b.numberOfOutlets === "" ? 1 : Number(b.numberOfOutlets);
    if (!Number.isInteger(outlets) || outlets < 1) return fail(res, 400, "Enter a valid number of outlets.");
    const d = await runAsPlatform(() => DemoRequest.create({
      restaurantName: b.restaurantName, contactName: b.contactName, phone, email: b.email, city: b.city,
      restaurantType: b.restaurantType, numberOfOutlets: outlets, currentSoftware: b.currentSoftware,
      message: String(b.message || "").slice(0, 2000),
    }));
    ok(res, { id: d.id }, "Demo request received. Our team will reach out shortly.", 201);
  }));

  router.post("/newsletter", formLimiter, wrap(async (req, res) => {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return fail(res, 400, "Enter a valid email address.");
    const existing = await runAsPlatform(() => Newsletter.findOne({ email }));
    if (existing) {
      if (existing.status === "subscribed") return ok(res, null, "You're already subscribed.");
      existing.status = "subscribed";
      existing.subscribedAt = new Date();
      await existing.save();
      return ok(res, null, "Welcome back — you're re-subscribed.");
    }
    await runAsPlatform(() => Newsletter.create({ email }));
    ok(res, null, "Subscribed successfully.", 201);
  }));

  /* ───────────── owner auth ───────────── */

  async function startOwnerSession(owner, req, res) {
    const sessionId = crypto.randomBytes(32).toString("hex");
    await runAsPlatform(() => OwnerSession.create({
      sessionId, ownerId: owner.id, userAgent: req.headers["user-agent"] || "", ip: req.ip,
      expiresAt: new Date(Date.now() + OWNER_SESSION_MS),
    }));
    res.cookie(OWNER_COOKIE, sessionId, ownerCookieOpts());
  }

  async function requireOwner(req, res, next) {
    try {
      const sid = req.cookies && req.cookies[OWNER_COOKIE];
      if (!sid) return fail(res, 401, "Please sign in.");
      const session = await runAsPlatform(() => OwnerSession.findOne({ sessionId: sid }).lean());
      if (!session || session.expiresAt < new Date()) {
        res.clearCookie(OWNER_COOKIE, ownerCookieOpts());
        return fail(res, 401, "Your session has expired. Please sign in again.");
      }
      const owner = await runAsPlatform(() => Owner.findOne({ id: session.ownerId }).lean());
      if (!owner || owner.status !== "active") return fail(res, 401, "Account not available.");
      req.owner = owner;
      next();
    } catch (err) { next(err); }
  }

  async function ownedRestaurant(req, res, next) {
    try {
      const r = await runAsPlatform(() => Restaurant.findOne({ id: req.params.id, ownerId: req.owner.id }).lean());
      if (!r) return fail(res, 404, "Restaurant not found.");
      req.restaurant = r;
      next();
    } catch (err) { next(err); }
  }

  function validatePassword(pw) {
    if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters.";
    if (pw.length > 200) return "Password is too long.";
    return null;
  }

  router.post("/auth/signup", signupLimiter, wrap(async (req, res) => {
    const b = req.body || {};
    const name = String(b.name || "").trim();
    const email = String(b.email || "").trim().toLowerCase();
    if (name.length < 2) return fail(res, 400, "Please enter your name.");
    if (!EMAIL_RE.test(email)) return fail(res, 400, "Enter a valid email address.");
    const pwErr = validatePassword(b.password);
    if (pwErr) return fail(res, 400, pwErr);
    const planKey = b.planKey || "growth";
    const def = plans.definitionFor(planKey);
    if (!def || !def.selfServe) return fail(res, 400, "Please choose a plan you can start online, or contact sales.");

    // Check the restaurant name BEFORE creating the owner so a taken name leaves nothing behind.
    const slug = slugs.slugify(b.slug || b.restaurantName);
    const avail = await provision.isSlugAvailable(slug);
    if (!avail.available) return fail(res, 409, avail.reason, { suggestions: await provision.suggestSlugs(slug || "my-restaurant") });

    const existing = await runAsPlatform(() => Owner.findOne({ email }).lean());
    if (existing) return fail(res, 409, "An account with this email already exists. Please sign in.");

    const owner = await runAsPlatform(async () => Owner.create({
      name, email, phone: String(b.phone || "").trim(), address: cleanAddress(b.address), password: await bcrypt.hash(b.password, 10),
    }));
    let result;
    try {
      result = await provision.provisionRestaurant({
        owner: owner.toObject(), name: b.restaurantName, slug, planKey,
        cycle: b.billingCycle === "yearly" ? "yearly" : "monthly",
        contact: { phone: String(b.phone || "").trim(), city: String(b.city || "").trim() },
      });
    } catch (err) {
      await runAsPlatform(() => Owner.deleteOne({ id: owner.id }));
      throw err;
    }
    await startOwnerSession(owner, req, res);
    ok(res, {
      owner: publicOwner(owner),
      restaurant: { id: result.restaurant.id, slug: result.restaurant.slug, name: result.restaurant.name, urls: restaurantUrls(result.restaurant) },
    }, "Your restaurant is ready.", 201);
  }));

  router.post("/auth/login", authLimiter, wrap(async (req, res) => {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    const password = String((req.body && req.body.password) || "");
    const owner = await runAsPlatform(() => Owner.findOne({ email }));
    const valid = await bcrypt.compare(password, owner ? owner.password : DUMMY_HASH);
    if (!owner || !valid) return fail(res, 401, "Invalid email or password.");
    if (owner.status !== "active") return fail(res, 403, "This account is disabled.");
    owner.lastLoginAt = new Date();
    await owner.save();
    await startOwnerSession(owner, req, res);
    ok(res, { owner: publicOwner(owner) });
  }));

  router.post("/auth/logout", wrap(async (req, res) => {
    const sid = req.cookies && req.cookies[OWNER_COOKIE];
    if (sid) await runAsPlatform(() => OwnerSession.deleteOne({ sessionId: sid }));
    res.clearCookie(OWNER_COOKIE, ownerCookieOpts());
    ok(res, null);
  }));

  router.get("/auth/me", requireOwner, wrap(async (req, res) => ok(res, { owner: publicOwner(req.owner) })));

  router.patch("/auth/me", requireOwner, wrap(async (req, res) => {
    const b = req.body || {};
    const update = {};
    if (b.name !== undefined) {
      if (String(b.name).trim().length < 2) return fail(res, 400, "Please enter your name.");
      update.name = String(b.name).trim();
    }
    if (b.phone !== undefined) update.phone = String(b.phone).trim();
    if (b.address !== undefined) update.address = cleanAddress(b.address);
    await runAsPlatform(() => Owner.updateOne({ id: req.owner.id }, { $set: update }));
    ok(res, { owner: publicOwner({ ...req.owner, ...update }) });
  }));

  router.patch("/auth/change-password", authLimiter, requireOwner, wrap(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    const pwErr = validatePassword(newPassword);
    if (pwErr) return fail(res, 400, pwErr);
    const owner = await runAsPlatform(() => Owner.findOne({ id: req.owner.id }));
    if (!(await bcrypt.compare(String(currentPassword || ""), owner.password))) return fail(res, 401, "Current password is incorrect.");
    owner.password = await bcrypt.hash(newPassword, 10);
    await owner.save();
    const keep = req.cookies[OWNER_COOKIE];
    await runAsPlatform(() => OwnerSession.deleteMany({ ownerId: owner.id, sessionId: { $ne: keep } }));
    ok(res, null, "Password updated. Note: your restaurant dashboard keeps its own password until you change it there.");
  }));

  router.post("/auth/forgot-password", authLimiter, wrap(async (req, res) => {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    const owner = EMAIL_RE.test(email) ? await runAsPlatform(() => Owner.findOne({ email }).lean()) : null;
    if (owner) {
      const token = crypto.randomBytes(24).toString("hex");
      await runAsPlatform(() => OwnerReset.create({
        tokenHash: crypto.createHash("sha256").update(token).digest("hex"), ownerId: owner.id,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }));
      const link = `${SITE_URL()}/reset-password?token=${token}`;
      const { sent } = await sendResetPasswordEmail(owner.email, token, null, link).catch(() => ({ sent: false }));
      if (!sent) console.log("[platform] SMTP not configured — owner reset email not sent.");
      if (!sent && process.env.NODE_ENV !== "production") return ok(res, { token }, "If that email exists, a reset link has been sent.");
    }
    ok(res, null, "If that email exists, a reset link has been sent.");
  }));

  router.post("/auth/reset-password", authLimiter, wrap(async (req, res) => {
    const { token, newPassword } = req.body || {};
    const pwErr = validatePassword(newPassword);
    if (pwErr) return fail(res, 400, pwErr);
    const tokenHash = crypto.createHash("sha256").update(String(token || "")).digest("hex");
    const rec = await runAsPlatform(() => OwnerReset.findOneAndUpdate(
      { tokenHash, used: false, expiresAt: { $gt: new Date() } }, { $set: { used: true } }, { returnDocument: "before" }
    ).lean());
    if (!rec) return fail(res, 400, "Reset link is invalid or expired.");
    const hash = await bcrypt.hash(newPassword, 10);
    await runAsPlatform(async () => {
      await Owner.updateOne({ id: rec.ownerId }, { $set: { password: hash } });
      await OwnerSession.deleteMany({ ownerId: rec.ownerId });
    });
    ok(res, null, "Password updated. You can sign in now.");
  }));

  /* ───────────── restaurants ───────────── */

  router.get("/restaurants", requireOwner, wrap(async (req, res) => {
    const list = await runAsPlatform(() => Restaurant.find({ ownerId: req.owner.id }).sort({ createdAt: 1 }).lean());
    const out = [];
    for (const r of list) {
      out.push({ id: r.id, slug: r.slug, name: r.name, status: r.status, urls: restaurantUrls(r), subscription: await subscriptionSummary(r.id) });
    }
    ok(res, out);
  }));

  router.post("/restaurants", signupLimiter, requireOwner, wrap(async (req, res) => {
    const b = req.body || {};
    const planKey = b.planKey || "growth";
    const def = plans.definitionFor(planKey);
    if (!def || !def.selfServe) return fail(res, 400, "Please choose a plan you can start online, or contact sales.");
    const full = await runAsPlatform(() => Owner.findOne({ id: req.owner.id }).lean());
    const result = await provision.provisionRestaurant({
      owner: full, name: b.restaurantName, slug: b.slug, planKey, cycle: b.billingCycle === "yearly" ? "yearly" : "monthly",
    });
    ok(res, { id: result.restaurant.id, slug: result.restaurant.slug, name: result.restaurant.name, urls: restaurantUrls(result.restaurant) }, "Restaurant created.", 201);
  }));

  router.get("/restaurants/:id", requireOwner, ownedRestaurant, wrap(async (req, res) => {
    const r = req.restaurant;
    ok(res, { id: r.id, slug: r.slug, name: r.name, status: r.status, branding: r.branding, urls: restaurantUrls(r), subscription: await subscriptionSummary(r.id) });
  }));

  router.patch("/restaurants/:id", requireOwner, ownedRestaurant, wrap(async (req, res) => {
    const b = req.body || {};
    const update = {};
    if (b.name !== undefined) {
      const n = String(b.name).trim();
      if (n.length < 2 || n.length > 80) return fail(res, 400, "Restaurant name must be 2-80 characters.");
      update.name = n; // display name only; the URL name (slug) never changes so printed QR codes keep working
    }
    if (b.branding && typeof b.branding === "object") {
      for (const k of ["logo", "primaryColor", "tagline"]) {
        if (b.branding[k] !== undefined) update[`branding.${k}`] = String(b.branding[k]).slice(0, k === "logo" ? 500000 : 200);
      }
    }
    await runAsPlatform(() => Restaurant.updateOne({ id: req.restaurant.id }, { $set: update }));
    invalidateRestaurant(req.restaurant.slug);
    subs.invalidate(req.restaurant.id);
    ok(res, null, "Saved.");
  }));

  router.post("/restaurants/:id/dashboard-link", requireOwner, ownedRestaurant, wrap(async (req, res) => {
    const state = await subs.getAccessState(req.restaurant.id);
    if (state.access.level === "blocked") return fail(res, 403, "This restaurant account is not active.");
    const token = crypto.randomBytes(32).toString("hex");
    await runAsPlatform(() => SsoToken.create({
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      restaurantId: req.restaurant.id, ownerId: req.owner.id, expiresAt: new Date(Date.now() + 60 * 1000),
    }));
    ok(res, { url: `${ADMIN_URL()}/sso?restaurant=${encodeURIComponent(req.restaurant.slug)}&token=${token}` });
  }));

  /* ───────────── billing ───────────── */

  router.get("/restaurants/:id/billing", requireOwner, ownedRestaurant, wrap(async (req, res) => {
    const rid = req.restaurant.id;
    const usage = await subs.getUsage(rid);
    const invoices = await runAsPlatform(() => Invoice.find({ restaurantId: rid }).sort({ createdAt: -1 }).limit(24).lean());
    const planList = await runAsPlatform(() => Plan.find({ active: true }).sort({ order: 1 }).lean());
    const prov = selectProvider();
    ok(res, {
      subscription: await subscriptionSummary(rid),
      usage,
      invoices: invoices.map((i) => ({
        id: i.id, planKey: i.planKey, billingCycle: i.billingCycle, amount: i.amount, currency: i.currency,
        status: i.status, paidAt: i.paidAt, periodStart: i.periodStart, periodEnd: i.periodEnd,
      })),
      plans: planList.map(publicPlan),
      provider: prov.unavailable ? null : prov.name,
      trialDays: plans.TRIAL_DAYS,
    });
  }));

  router.post("/restaurants/:id/billing/checkout", requireOwner, ownedRestaurant, wrap(async (req, res) => {
    const { planKey, billingCycle } = req.body || {};
    const result = await subs.changePlan({ restaurantId: req.restaurant.id, ownerId: req.owner.id, planKey, cycle: billingCycle });
    ok(res, result);
  }));

  router.post("/restaurants/:id/billing/confirm", requireOwner, ownedRestaurant, wrap(async (req, res) => {
    const { providerSubscriptionId, payload } = req.body || {};
    await subs.confirmCheckout({ restaurantId: req.restaurant.id, providerSubscriptionId, payload });
    ok(res, { subscription: await subscriptionSummary(req.restaurant.id) }, "Payment received. Your plan is active.");
  }));

  router.post("/restaurants/:id/billing/cancel", requireOwner, ownedRestaurant, wrap(async (req, res) => {
    await subs.cancelSubscription({ restaurantId: req.restaurant.id });
    ok(res, { subscription: await subscriptionSummary(req.restaurant.id) }, "Your subscription will end at the close of the current period.");
  }));

  router.post("/restaurants/:id/billing/resume", requireOwner, ownedRestaurant, wrap(async (req, res) => {
    const r = await subs.resumeSubscription({ restaurantId: req.restaurant.id, ownerId: req.owner.id });
    ok(res, { ...r, subscription: await subscriptionSummary(req.restaurant.id) });
  }));

  router.delete("/restaurants/:id/billing/pending-change", requireOwner, ownedRestaurant, wrap(async (req, res) => {
    const sub = await runAsPlatform(() => Subscription.findOne({ restaurantId: req.restaurant.id }));
    if (sub) {
      sub.pendingChange = { planKey: null, billingCycle: null, effectiveAt: null };
      await sub.save();
      subs.invalidate(sub.restaurantId);
    }
    ok(res, { subscription: await subscriptionSummary(req.restaurant.id) });
  }));

  /* ───────────── webhooks ───────────── */

  async function processWebhook(provName, parse, req, res) {
    if (!req.rawBody) return fail(res, 400, "Invalid webhook");
    let events;
    try { events = parse(req.rawBody, req.headers); }
    catch (err) { return fail(res, err.status || 400, "Invalid webhook signature"); }
    for (const evt of events) await subs.handleProviderEvent(evt, provName);
    res.json({ success: true });
  }

  router.post("/webhooks/razorpay", wrap(async (req, res) => {
    const prov = selectProvider();
    if (prov.unavailable || prov.name !== "razorpay") return fail(res, 404, "Not found");
    await processWebhook("razorpay", prov.parseWebhook, req, res);
  }));

  // Unsigned simulated events: development and tests only, never production.
  router.post("/webhooks/mock", wrap(async (req, res) => {
    const prov = selectProvider();
    if (process.env.NODE_ENV === "production" || prov.unavailable || prov.name !== "mock") return fail(res, 404, "Not found");
    await processWebhook("mock", prov.parseWebhook, req, res);
  }));

  return router;
}

module.exports = { buildRouter, ensureDefaultPlans, OWNER_COOKIE, restaurantUrls };

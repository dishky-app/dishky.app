/**
 * subscriptions.js — provider-independent subscription lifecycle.
 *
 * States:  trialing -> active <-> past_due -> expired
 *                         \-> cancelled (access until period end) -> expired
 *          suspended (set by the Dishky team; always blocked)
 *
 * Access is derived from DATES at read time (evaluateAccess), so correctness
 * never depends on a background job having run; the sweeper only persists the
 * derived state and applies scheduled plan changes.
 */
const { Restaurant, Plan, Subscription, Invoice, WebhookEvent } = require("./models");
const plans = require("./plans");
const { selectProvider } = require("./billing");
const { runInTenant, runAsPlatform } = require("../../core/tenancy");

const DAY = 24 * 60 * 60 * 1000;

function httpError(status, message, extra) {
  return Object.assign(new Error(message), { status, ...extra });
}

function provider() {
  const p = selectProvider();
  if (p.unavailable) throw httpError(503, p.reason);
  return p;
}

/* ───────────────────────── access ───────────────────────── */

/**
 * level: "full"     everything the plan includes
 *        "readonly" can look, cannot change data; customers cannot place orders
 *        "blocked"  nothing works (suspended / closed)
 */
function evaluateAccess(restaurant, sub, now = new Date()) {
  if (!restaurant || restaurant.status !== "active") {
    return { level: "blocked", reason: restaurant ? `restaurant_${restaurant.status}` : "unknown_restaurant" };
  }
  if (!sub) return { level: "readonly", reason: "no_subscription" };
  if (sub.status === "suspended") return { level: "blocked", reason: "subscription_suspended" };
  if (sub.comped || sub.provider === "internal") return { level: "full", reason: "comped" };

  const t = now.getTime();
  const grace = plans.PAST_DUE_GRACE_DAYS * DAY;
  switch (sub.status) {
    case "trialing": {
      const end = sub.trialEndsAt ? sub.trialEndsAt.getTime() : 0;
      return t < end
        ? { level: "full", reason: "trial", daysLeft: Math.ceil((end - t) / DAY) }
        : { level: "readonly", reason: "trial_ended" };
    }
    case "active": {
      const end = sub.currentPeriodEnd ? sub.currentPeriodEnd.getTime() : 0;
      if (t <= end) return { level: "full", reason: "active" };
      // Renewal webhook is late or the payment failed silently: honour the grace window.
      return t <= end + grace
        ? { level: "full", reason: "renewal_overdue", warn: true, daysLeft: Math.ceil((end + grace - t) / DAY) }
        : { level: "readonly", reason: "payment_overdue" };
    }
    case "past_due": {
      const end = sub.graceEndsAt ? sub.graceEndsAt.getTime() : 0;
      return t < end
        ? { level: "full", reason: "past_due_grace", warn: true, daysLeft: Math.ceil((end - t) / DAY) }
        : { level: "readonly", reason: "payment_overdue" };
    }
    case "cancelled": {
      const end = sub.currentPeriodEnd ? sub.currentPeriodEnd.getTime() : 0;
      return t < end
        ? { level: "full", reason: "cancelled_until_period_end", daysLeft: Math.ceil((end - t) / DAY) }
        : { level: "readonly", reason: "cancelled" };
    }
    default:
      return { level: "readonly", reason: sub.status };
  }
}

function entitlementsFor(planKey) {
  const def = plans.definitionFor(planKey);
  return def ? def.entitlements : { maxVenues: 0, maxTables: 0, maxStaffAccounts: 0, modules: [] };
}

/** Cached per restaurant for a few seconds: this sits on every request. */
const cache = new Map();
const CACHE_MS = 5000;
function invalidate(restaurantId) {
  if (restaurantId) cache.delete(restaurantId);
  else cache.clear();
}

async function getAccessState(restaurantId) {
  const hit = cache.get(restaurantId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const [restaurant, sub] = await runAsPlatform(() =>
    Promise.all([Restaurant.findOne({ id: restaurantId }).lean(), Subscription.findOne({ restaurantId }).lean()])
  );
  const access = evaluateAccess(restaurant, sub);
  const planKey = sub ? sub.planKey : null;
  const value = {
    restaurant,
    subscription: sub,
    access,
    planKey,
    entitlements: entitlementsFor(planKey),
  };
  cache.set(restaurantId, { at: Date.now(), value });
  return value;
}

/* ───────────────────────── usage ───────────────────────── */

async function getUsage(restaurantId) {
  const { Venue } = require("../venues/venues");
  const { Admin } = require("../auth/auth");
  const mongoose = require("mongoose");
  return runInTenant(restaurantId, async () => {
    const [venues, staffAccounts, tableDocs] = await Promise.all([
      Venue.countDocuments({ status: "active" }),
      Admin.countDocuments({}),
      (mongoose.models.tables || mongoose.model("tables", new mongoose.Schema({}, { strict: false, id: false, versionKey: false }), "tables")).find({}).lean(),
    ]);
    const tables = tableDocs.reduce((n, d) => n + (Array.isArray(d.list) ? d.list.length : 0), 0);
    return { venues, tables, staffAccounts };
  });
}

function usageOverLimits(usage, entitlements) {
  const over = [];
  const chk = (key, label, limit) => {
    if (limit !== null && limit !== undefined && usage[key] > limit) over.push({ key, label, used: usage[key], limit });
  };
  chk("venues", "venues", entitlements.maxVenues);
  chk("tables", "tables", entitlements.maxTables);
  chk("staffAccounts", "staff accounts", entitlements.maxStaffAccounts);
  return over;
}

/* ───────────────────────── lifecycle ───────────────────────── */

async function startTrial({ restaurantId, ownerId, planKey, cycle }) {
  const def = plans.definitionFor(planKey);
  if (!def || !def.selfServe) throw httpError(400, "That plan cannot be started online. Please contact sales.");
  const now = new Date();
  const sub = await runAsPlatform(() =>
    Subscription.create({
      restaurantId,
      ownerId,
      planKey,
      billingCycle: cycle === "yearly" ? "yearly" : "monthly",
      status: "trialing",
      trialEndsAt: new Date(now.getTime() + plans.TRIAL_DAYS * DAY),
      provider: (selectProvider().name) || "mock",
    })
  );
  invalidate(restaurantId);
  return sub;
}

async function applyPaid(sub, { planKey, cycle, providerSubscriptionId, paymentId, amount, periodStart, periodEnd, restaurant }) {
  const prov = selectProvider();
  // Idempotent per payment: checkout-return and webhook both report the same payment.
  if (paymentId && (await runAsPlatform(() => Invoice.exists({ providerPaymentId: paymentId })))) return sub;
  const oldProviderSubId = sub.providerSubscriptionId;
  sub.planKey = planKey || sub.planKey;
  sub.billingCycle = cycle || sub.billingCycle;
  sub.status = "active";
  sub.provider = prov.name;
  if (providerSubscriptionId) sub.providerSubscriptionId = providerSubscriptionId;
  sub.currentPeriodStart = periodStart || new Date();
  sub.currentPeriodEnd = periodEnd || (require("./billing/mock").addMonths(sub.currentPeriodStart, sub.billingCycle === "yearly" ? 12 : 1));
  sub.graceEndsAt = null;
  sub.cancelAtPeriodEnd = false;
  sub.trialEndsAt = sub.trialEndsAt; // kept for history
  if (sub.pendingChange && sub.pendingChange.effectiveAt && sub.pendingChange.planKey === sub.planKey) {
    sub.pendingChange = { planKey: null, billingCycle: null, effectiveAt: null };
  }
  await sub.save();
  await runAsPlatform(() =>
    Invoice.create({
      restaurantId: sub.restaurantId,
      ownerId: sub.ownerId,
      subscriptionId: sub.id,
      planKey: sub.planKey,
      billingCycle: sub.billingCycle,
      amount: amount ?? plans.priceFor(sub.planKey, sub.billingCycle) ?? 0,
      status: "paid",
      provider: prov.name,
      providerPaymentId: paymentId || null,
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      paidAt: new Date(),
    })
  );
  invalidate(sub.restaurantId);
  // An upgrade made by a fresh checkout replaces the previous provider subscription.
  if (oldProviderSubId && providerSubscriptionId && oldProviderSubId !== providerSubscriptionId && prov.cancel) {
    prov.cancel(oldProviderSubId, { atPeriodEnd: false }).catch((e) => console.warn("[billing] could not cancel superseded subscription:", e.message));
  }
  return sub;
}

/**
 * Start a payment for (plan, cycle). Used both for the first purchase and for
 * upgrades. Nothing is activated here — only a verified payment does that.
 */
async function beginCheckout({ restaurantId, ownerId, planKey, cycle }) {
  const prov = provider();
  const def = plans.definitionFor(planKey);
  if (!def || !def.selfServe) throw httpError(400, "That plan cannot be purchased online. Please contact sales.");
  if (!["monthly", "yearly"].includes(cycle)) throw httpError(400, "billingCycle must be monthly or yearly");
  const amount = plans.priceFor(planKey, cycle);
  const [restaurant, sub] = await runAsPlatform(() =>
    Promise.all([Restaurant.findOne({ id: restaurantId }), Subscription.findOne({ restaurantId })])
  );
  if (!restaurant || !sub) throw httpError(404, "Restaurant not found");
  if (sub.status === "suspended") throw httpError(403, "This account is suspended. Please contact support.");

  const usage = await getUsage(restaurantId);
  const over = usageOverLimits(usage, def.entitlements);
  if (over.length) throw httpError(409, `Your current usage exceeds the ${def.name} plan`, { over });

  const { Owner } = require("./models");
  const owner = await runAsPlatform(() => Owner.findOne({ id: ownerId }).lean());
  const { providerSubscriptionId, checkout } = await prov.createCheckout({
    restaurant, owner, planKey, cycle, amount, Plan,
  });
  await runAsPlatform(() =>
    Subscription.updateOne(
      { id: sub.id },
      { $set: { pendingCheckout: { providerSubscriptionId, planKey, billingCycle: cycle, amount, createdAt: new Date() } } }
    )
  );
  return { checkout, planKey, cycle, amount, provider: prov.name };
}

async function loadPending(restaurantId, providerSubscriptionId) {
  const sub = await runAsPlatform(() => Subscription.findOne({ restaurantId }));
  const pc = sub && sub.pendingCheckout;
  if (!sub || !pc || !pc.providerSubscriptionId || pc.providerSubscriptionId !== providerSubscriptionId) return { sub, pc: null };
  return { sub, pc };
}

/** Browser returned from checkout: verify the payment server-side, then activate. */
async function confirmCheckout({ restaurantId, providerSubscriptionId, payload }) {
  const prov = provider();
  const { sub, pc } = await loadPending(restaurantId, providerSubscriptionId);
  if (!pc) {
    // The webhook may have activated it already; confirming again is harmless.
    if (sub && sub.providerSubscriptionId === providerSubscriptionId && sub.status === "active") return sub;
    throw httpError(404, "No pending checkout found");
  }
  const v = await prov.verifyCheckout({ providerSubscriptionId, payload });
  if (!v.ok) throw httpError(402, v.error || "Payment could not be verified");
  await applyPaid(sub, {
    planKey: pc.planKey, cycle: pc.billingCycle, providerSubscriptionId,
    paymentId: v.paymentId, amount: pc.amount, periodStart: v.periodStart, periodEnd: v.periodEnd,
  });
  await runAsPlatform(() => Subscription.updateOne({ id: sub.id }, { $unset: { pendingCheckout: 1 } }));
  return sub;
}

/**
 * Change plan / cycle for an existing subscription.
 *   upgrade (higher plan, or monthly -> yearly)  -> immediate, needs a new payment
 *   downgrade (lower plan, or yearly -> monthly)  -> scheduled for period end
 */
async function changePlan({ restaurantId, ownerId, planKey, cycle }) {
  const def = plans.definitionFor(planKey);
  if (!def || !def.selfServe) throw httpError(400, "That plan cannot be selected online. Please contact sales.");
  cycle = cycle === "yearly" ? "yearly" : "monthly";
  const sub = await runAsPlatform(() => Subscription.findOne({ restaurantId }));
  if (!sub) throw httpError(404, "No subscription");

  const sameTarget = sub.planKey === planKey && sub.billingCycle === cycle;
  const isPaying = sub.status === "active" || sub.status === "past_due" || sub.status === "cancelled";
  if (sameTarget && isPaying && !sub.cancelAtPeriodEnd) throw httpError(400, "You are already on this plan");

  // Trial / lapsed / cancelled-and-ended: it is simply a fresh purchase.
  const access = evaluateAccess(await runAsPlatform(() => Restaurant.findOne({ id: restaurantId }).lean()), sub);
  if (!isPaying || access.level !== "full" || sub.status === "past_due") {
    const r = await beginCheckout({ restaurantId, ownerId, planKey, cycle });
    return { mode: "checkout", ...r };
  }

  const cur = plans.planRank(sub.planKey);
  const next = plans.planRank(planKey);
  const isUpgrade = next > cur || (next === cur && sub.billingCycle === "monthly" && cycle === "yearly");
  if (isUpgrade) {
    const r = await beginCheckout({ restaurantId, ownerId, planKey, cycle });
    return { mode: "checkout", ...r };
  }

  // Downgrade: must fit the target plan, applied when the paid period ends.
  const usage = await getUsage(restaurantId);
  const over = usageOverLimits(usage, def.entitlements);
  if (over.length) throw httpError(409, `You are using more than the ${def.name} plan allows`, { over });
  const prov = provider();
  if (prov.changePlan && sub.providerSubscriptionId) {
    await prov.changePlan(sub.providerSubscriptionId, { planKey, cycle, amount: plans.priceFor(planKey, cycle), Plan });
  }
  sub.pendingChange = { planKey, billingCycle: cycle, effectiveAt: sub.currentPeriodEnd };
  sub.cancelAtPeriodEnd = false;
  await sub.save();
  invalidate(restaurantId);
  return { mode: "scheduled", effectiveAt: sub.currentPeriodEnd, planKey, cycle };
}

async function cancelSubscription({ restaurantId }) {
  const sub = await runAsPlatform(() => Subscription.findOne({ restaurantId }));
  if (!sub) throw httpError(404, "No subscription");
  if (sub.status === "trialing") {
    sub.status = "cancelled";
    sub.currentPeriodEnd = sub.trialEndsAt;
    sub.cancelAtPeriodEnd = true;
  } else if (["active", "past_due"].includes(sub.status)) {
    const prov = provider();
    if (sub.providerSubscriptionId && prov.cancel && !sub.comped) {
      await prov.cancel(sub.providerSubscriptionId, { atPeriodEnd: true });
    }
    sub.cancelAtPeriodEnd = true;
    sub.status = "cancelled";
    if (!sub.currentPeriodEnd) sub.currentPeriodEnd = new Date();
  } else {
    throw httpError(400, "This subscription is not active");
  }
  sub.pendingChange = { planKey: null, billingCycle: null, effectiveAt: null };
  await sub.save();
  invalidate(restaurantId);
  return sub;
}

/** Undo a cancellation made earlier in the same paid period. */
async function resumeSubscription({ restaurantId, ownerId }) {
  const sub = await runAsPlatform(() => Subscription.findOne({ restaurantId }));
  if (!sub || sub.status !== "cancelled") throw httpError(400, "Nothing to resume");
  const now = new Date();
  if (sub.currentPeriodEnd && sub.currentPeriodEnd > now && sub.providerSubscriptionId && sub.provider !== "mock") {
    // The provider subscription was cancelled at cycle end and cannot be revived: re-subscribe.
    const r = await beginCheckout({ restaurantId, ownerId, planKey: sub.planKey, cycle: sub.billingCycle });
    return { mode: "checkout", ...r };
  }
  if (sub.currentPeriodEnd && sub.currentPeriodEnd > now) {
    sub.status = "active";
    sub.cancelAtPeriodEnd = false;
    await sub.save();
    invalidate(restaurantId);
    return { mode: "resumed" };
  }
  const r = await beginCheckout({ restaurantId, ownerId, planKey: sub.planKey, cycle: sub.billingCycle });
  return { mode: "checkout", ...r };
}

/* ───────────────────────── webhooks ───────────────────────── */

async function handleProviderEvent(evt, providerName) {
  if (!evt || evt.type === "ignored") return { handled: false };
  // Idempotency: a retried delivery of the same event is a no-op.
  try {
    await runAsPlatform(() => WebhookEvent.create({ eventId: String(evt.id), provider: providerName, type: evt.type }));
  } catch (e) {
    if (e && (e.code === 11000 || /duplicate/i.test(e.message))) return { handled: false, duplicate: true };
    throw e;
  }
  if (!evt.providerSubscriptionId) return { handled: false };
  // The subscription the provider is talking about: current one, or one mid-checkout.
  let sub = await runAsPlatform(() => Subscription.findOne({ providerSubscriptionId: evt.providerSubscriptionId }));
  let pc = null;
  if (!sub) {
    sub = await runAsPlatform(() => Subscription.findOne({ "pendingCheckout.providerSubscriptionId": evt.providerSubscriptionId }));
    pc = sub && sub.pendingCheckout;
  }
  if (!sub) return { handled: false };

  switch (evt.type) {
    case "payment.succeeded": {
      await applyPaid(sub, {
        planKey: pc ? pc.planKey : undefined,
        cycle: pc ? pc.billingCycle : undefined,
        providerSubscriptionId: evt.providerSubscriptionId,
        paymentId: evt.paymentId, amount: evt.amount, periodStart: evt.periodStart, periodEnd: evt.periodEnd,
      });
      if (pc) await runAsPlatform(() => Subscription.updateOne({ id: sub.id }, { $unset: { pendingCheckout: 1 } }));
      await applyPendingChangeIfDue(sub);
      return { handled: true };
    }
    case "payment.failed": {
      if (sub.providerSubscriptionId !== evt.providerSubscriptionId) return { handled: false }; // abandoned checkout
      if (["active", "past_due"].includes(sub.status)) {
        sub.status = "past_due";
        if (!sub.graceEndsAt) sub.graceEndsAt = new Date(Date.now() + plans.PAST_DUE_GRACE_DAYS * DAY);
        await sub.save();
        invalidate(sub.restaurantId);
      }
      return { handled: true };
    }
    case "subscription.cancelled":
    case "subscription.completed": {
      if (sub.providerSubscriptionId !== evt.providerSubscriptionId) return { handled: false };
      if (!sub.cancelAtPeriodEnd) {
        sub.status = "cancelled";
        sub.cancelAtPeriodEnd = true;
        await sub.save();
        invalidate(sub.restaurantId);
      }
      return { handled: true };
    }
    default:
      return { handled: false };
  }
}

/* ───────────────────────── sweeper ───────────────────────── */

async function applyPendingChangeIfDue(sub, now = new Date()) {
  const pc = sub.pendingChange;
  if (!pc || !pc.planKey || !pc.effectiveAt || pc.effectiveAt > now) return false;
  sub.planKey = pc.planKey;
  sub.billingCycle = pc.billingCycle || sub.billingCycle;
  sub.pendingChange = { planKey: null, billingCycle: null, effectiveAt: null };
  await sub.save();
  invalidate(sub.restaurantId);
  return true;
}

/** Persist states that have become true by the passage of time. Idempotent. */
async function sweep(now = new Date()) {
  const subs = await runAsPlatform(() => Subscription.find({ status: { $in: ["trialing", "active", "past_due", "cancelled"] } }));
  let changed = 0;
  for (const sub of subs) {
    const restaurant = await runAsPlatform(() => Restaurant.findOne({ id: sub.restaurantId }).lean());
    const access = evaluateAccess(restaurant, sub, now);
    if (access.level === "readonly" && ["trial_ended", "cancelled", "payment_overdue"].includes(access.reason)) {
      if (sub.status !== "expired") { sub.status = "expired"; await sub.save(); changed++; }
    } else if (sub.status === "active" && access.reason === "renewal_overdue") {
      sub.status = "past_due";
      sub.graceEndsAt = new Date(sub.currentPeriodEnd.getTime() + plans.PAST_DUE_GRACE_DAYS * DAY);
      await sub.save(); changed++;
    }
    if (await applyPendingChangeIfDue(sub, now)) changed++;
  }
  invalidate();
  return changed;
}

function startSweeper(intervalMs = 60 * 60 * 1000) {
  const run = () => sweep().catch((e) => console.error("[billing] sweep failed:", e.message));
  run();
  return setInterval(run, intervalMs).unref();
}

module.exports = {
  evaluateAccess, entitlementsFor, getAccessState, invalidate, getUsage, usageOverLimits,
  startTrial, beginCheckout, confirmCheckout, changePlan, cancelSubscription, resumeSubscription,
  handleProviderEvent, sweep, startSweeper, applyPaid, httpError,
};

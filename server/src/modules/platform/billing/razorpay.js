/**
 * razorpay.js — Razorpay Subscriptions adapter.
 *
 * Flow:
 *   1. createCheckout(): ensure a Razorpay Plan exists for (plan, cycle), then
 *      create a Razorpay Subscription. The browser opens Razorpay Checkout with
 *      the returned subscription id + key id.
 *   2. verifyCheckout(): the browser returns razorpay_payment_id /
 *      razorpay_subscription_id / razorpay_signature; we verify the HMAC
 *      server-side. Activation is also driven by the webhook (authoritative),
 *      whichever arrives first wins and the other is a no-op.
 *   3. parseWebhook(): verifies X-Razorpay-Signature over the RAW body and
 *      normalizes events for the provider-independent subscription service.
 *
 * Env: RAZORPAY_BILLING_KEY_ID / RAZORPAY_BILLING_KEY_SECRET /
 *      RAZORPAY_BILLING_WEBHOOK_SECRET — Dishky's OWN Razorpay account, used to
 *      charge restaurant owners. These are deliberately separate from the
 *      restaurant-facing UPI-QR keys (payments.js), which collect customers'
 *      table payments.
 *
 * NOTE: written against Razorpay's documented Subscriptions API; it has not
 * been exercised against a live Razorpay account in this repo's test suite
 * (the suite runs on the mock provider). Run a test-mode checkout end to end
 * before taking real money.
 */
const crypto = require("crypto");
const Razorpay = require("razorpay");
const { validateWebhookSignature } = require("razorpay/dist/utils/razorpay-utils");

const name = "razorpay";

const KEY_ID = process.env.RAZORPAY_BILLING_KEY_ID || "";
const KEY_SECRET = process.env.RAZORPAY_BILLING_KEY_SECRET || "";
const WEBHOOK_SECRET = process.env.RAZORPAY_BILLING_WEBHOOK_SECRET || "";

let client = null;
function rz() {
  if (!KEY_ID || !KEY_SECRET) throw new Error("Razorpay billing keys are not configured");
  if (!client) client = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
  return client;
}

const TOTAL_COUNT = { monthly: 120, yearly: 10 };

async function ensureProviderPlan({ Plan, planKey, cycle, amount }) {
  const plan = await Plan.findOne({ key: planKey });
  const mapKey = `razorpay:${cycle}:${amount}`;
  const existing = plan.providerPlanIds && plan.providerPlanIds.get(mapKey);
  if (existing) return existing;
  const created = await rz().plans.create({
    period: cycle === "yearly" ? "yearly" : "monthly",
    interval: 1,
    item: { name: `Dishky ${plan.name} (${cycle})`, amount: Math.round(amount * 100), currency: "INR" },
    notes: { planKey, cycle },
  });
  plan.providerPlanIds.set(mapKey, created.id);
  await plan.save();
  return created.id;
}

async function createCheckout({ restaurant, owner, planKey, cycle, amount, Plan }) {
  const planId = await ensureProviderPlan({ Plan, planKey, cycle, amount });
  const sub = await rz().subscriptions.create({
    plan_id: planId,
    total_count: TOTAL_COUNT[cycle] || TOTAL_COUNT.monthly,
    quantity: 1,
    customer_notify: 1,
    notes: { restaurantId: restaurant.id, planKey, cycle },
  });
  return {
    providerSubscriptionId: sub.id,
    checkout: {
      provider: "razorpay",
      keyId: KEY_ID,
      subscriptionId: sub.id,
      name: "Dishky",
      description: `${planKey} plan (${cycle})`,
      prefill: { name: owner.name, email: owner.email, contact: owner.phone || "" },
    },
  };
}

async function verifyCheckout({ providerSubscriptionId, payload }) {
  const { razorpay_payment_id: paymentId, razorpay_subscription_id: subId, razorpay_signature: sig } = payload || {};
  if (!paymentId || !subId || !sig || subId !== providerSubscriptionId) {
    return { ok: false, error: "Invalid payment response" };
  }
  const expected = crypto.createHmac("sha256", KEY_SECRET).update(`${paymentId}|${subId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(sig));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, error: "Signature mismatch" };
  const sub = await rz().subscriptions.fetch(subId);
  return {
    ok: true,
    paymentId,
    periodStart: sub.current_start ? new Date(sub.current_start * 1000) : new Date(),
    periodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
  };
}

async function cancel(providerSubscriptionId, { atPeriodEnd }) {
  await rz().subscriptions.cancel(providerSubscriptionId, atPeriodEnd ? 1 : 0);
  return { ok: true };
}

/** Schedule a plan change on the existing subscription (applies at cycle end). */
async function changePlan(providerSubscriptionId, { planKey, cycle, amount, Plan }) {
  const planId = await ensureProviderPlan({ Plan, planKey, cycle, amount });
  await rz().subscriptions.update(providerSubscriptionId, { plan_id: planId, schedule_change_at: "cycle_end" });
  return { ok: true };
}

/** Verify the signature over the raw body and normalize the event. */
function parseWebhook(rawBody, headers) {
  const signature = headers["x-razorpay-signature"];
  if (!signature || !WEBHOOK_SECRET) throw Object.assign(new Error("Invalid webhook signature"), { status: 400 });
  if (!validateWebhookSignature(rawBody.toString(), signature, WEBHOOK_SECRET)) {
    throw Object.assign(new Error("Invalid webhook signature"), { status: 400 });
  }
  const evt = JSON.parse(rawBody.toString());
  const id = headers["x-razorpay-event-id"] || `${evt.event}:${evt.created_at}:${evt.payload?.payment?.entity?.id || evt.payload?.subscription?.entity?.id}`;
  const subEntity = evt.payload?.subscription?.entity;
  const payEntity = evt.payload?.payment?.entity;
  const providerSubscriptionId = subEntity?.id || payEntity?.subscription_id || null;
  const base = { id, providerSubscriptionId, paymentId: payEntity?.id || null, amount: payEntity ? payEntity.amount / 100 : null };

  switch (evt.event) {
    case "subscription.activated":
    case "subscription.charged":
      return [{
        ...base,
        type: "payment.succeeded",
        periodStart: subEntity?.current_start ? new Date(subEntity.current_start * 1000) : new Date(),
        periodEnd: subEntity?.current_end ? new Date(subEntity.current_end * 1000) : null,
      }];
    case "payment.failed":
    case "subscription.pending":
    case "subscription.halted":
      return [{ ...base, type: "payment.failed" }];
    case "subscription.cancelled":
      return [{ ...base, type: "subscription.cancelled" }];
    case "subscription.completed":
      return [{ ...base, type: "subscription.completed" }];
    default:
      return [{ ...base, type: "ignored" }];
  }
}

module.exports = { name, createCheckout, verifyCheckout, cancel, changePlan, parseWebhook };

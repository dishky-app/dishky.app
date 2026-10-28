/**
 * mock.js — a billing provider that needs no external account.
 *
 * Used for local development and automated tests. It behaves like a hosted
 * checkout: createCheckout() hands the browser a token, the "payment" is
 * confirmed by calling verifyCheckout() with that token. Never enabled in
 * production unless BILLING_ALLOW_MOCK=true (see billing/index.js).
 */
const crypto = require("crypto");

const name = "mock";
const tokens = new Map(); // providerSubscriptionId -> { amount, createdAt }

function monthsFor(cycle) {
  return cycle === "yearly" ? 12 : 1;
}
function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

async function createCheckout({ restaurant, planKey, cycle, amount }) {
  const providerSubscriptionId = `mocksub_${crypto.randomBytes(8).toString("hex")}`;
  tokens.set(providerSubscriptionId, { amount, planKey, cycle, restaurantId: restaurant.id });
  return {
    providerSubscriptionId,
    checkout: { provider: "mock", subscriptionId: providerSubscriptionId, amount, currency: "INR" },
  };
}

async function verifyCheckout({ providerSubscriptionId, payload }) {
  const t = tokens.get(providerSubscriptionId);
  if (!t) return { ok: false, error: "Unknown checkout" };
  if (!payload || payload.mockPaymentSuccess !== true) return { ok: false, error: "Payment not completed" };
  tokens.delete(providerSubscriptionId);
  const now = new Date();
  return {
    ok: true,
    paymentId: `mockpay_${crypto.randomBytes(8).toString("hex")}`,
    amount: t.amount,
    periodStart: now,
    periodEnd: addMonths(now, monthsFor(t.cycle)),
  };
}

async function cancel() {
  return { ok: true };
}

/** Mock supports in-place plan changes (so scheduled downgrades are simple). */
async function changePlan() {
  return { ok: true };
}

/** Test helper: mock "webhook" with a trusted shape (no signature). */
function parseWebhook(rawBody) {
  const body = JSON.parse(rawBody.toString());
  return [body];
}

module.exports = { name, createCheckout, verifyCheckout, cancel, changePlan, parseWebhook, addMonths, monthsFor };

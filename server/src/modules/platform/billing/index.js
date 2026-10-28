/**
 * Billing provider selection.
 *   BILLING_PROVIDER=razorpay  -> live/test Razorpay Subscriptions
 *   BILLING_PROVIDER=mock      -> local simulated checkout (dev/tests)
 * Default: razorpay when keys are present, otherwise mock outside production.
 * In production the mock provider is refused unless BILLING_ALLOW_MOCK=true, so
 * a missing env var can never turn into "everyone gets a free plan".
 */
function selectProvider() {
  const prod = process.env.NODE_ENV === "production";
  let want = (process.env.BILLING_PROVIDER || "").toLowerCase();
  if (!want) want = process.env.RAZORPAY_BILLING_KEY_ID ? "razorpay" : "mock";
  if (want === "mock") {
    if (prod && process.env.BILLING_ALLOW_MOCK !== "true") {
      return { unavailable: true, name: "mock", reason: "Billing is not configured on this server." };
    }
    return require("./mock");
  }
  if (want === "razorpay") return require("./razorpay");
  return { unavailable: true, name: want, reason: `Unknown BILLING_PROVIDER "${want}"` };
}

module.exports = { selectProvider };

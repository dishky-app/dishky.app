import { useAuth } from "../context/AuthContext";
import "./PlanBanner.css";

// Thin banner under the top bar that explains the restaurant's plan state:
// trial countdown, payment problems, read-only mode, and plan-limit errors
// reported by the server. Billing itself lives on dishky.com.
const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

const PlanBanner = () => {
  const { subscription, subscriptionProblem, dismissSubscriptionProblem, isSuperAdmin } = useAuth();
  if (!subscription && !subscriptionProblem) return null;

  const manageUrl = subscription?.manageUrl || subscriptionProblem?.upgradeUrl || "https://www.dishky.com/account/billing";
  const manage = isSuperAdmin
    ? <a className="pb-link" href={manageUrl} target="_blank" rel="noreferrer">Manage plan</a>
    : <span className="pb-note">Ask your restaurant owner to manage the plan.</span>;

  let tone = null;
  let text = null;
  if (subscriptionProblem) {
    tone = "warn";
    text = subscriptionProblem.error || "Your plan doesn't allow that.";
  } else if (subscription.access === "blocked") {
    tone = "bad";
    text = "Your subscription has ended. Renew to get your dashboard back.";
  } else if (subscription.access === "readonly") {
    tone = "bad";
    text = subscription.status === "past_due"
      ? "Payment failed. Your dashboard is read-only until the payment goes through."
      : "Your dashboard is read-only. Renew your subscription to make changes.";
  } else if (subscription.status === "past_due") {
    tone = "warn";
    text = "We couldn't take your last payment. Update your payment method to avoid interruption.";
  } else if (subscription.status === "trialing" && subscription.trialEndsAt) {
    const d = daysLeft(subscription.trialEndsAt);
    tone = d <= 3 ? "warn" : "info";
    text = d === 0 ? "Your free trial ends today." : `Free trial: ${d} day${d === 1 ? "" : "s"} left.`;
  } else if (subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd) {
    tone = "info";
    text = `Your plan ends on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}.`;
  }
  if (!text) return null;

  return (
    <div className={`pb-banner pb-${tone}`} role="status">
      <span className="pb-text">{text}</span>
      {manage}
      {subscriptionProblem && (
        <button type="button" className="pb-close" aria-label="Dismiss" onClick={dismissSubscriptionProblem}>×</button>
      )}
    </div>
  );
};

export default PlanBanner;

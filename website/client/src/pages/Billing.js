import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import AccountLayout from "../components/Account/AccountLayout.js";
import { toast } from "../components/Toast/Toast.js";
import { useOwner } from "../context/OwnerContext.js";
import { PLAN_NAMES, statusLine } from "./Account.js";
import {
  cancelPendingChange, cancelSubscription, confirmCheckout, getBilling, listRestaurants,
  resumeSubscription, startCheckout,
} from "../services/api.js";

const RANK = { starter: 1, growth: 2, pro: 3, enterprise: 4 };
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    document.body.appendChild(s);
  });
}

// Opens the payment window for a checkout the server created, and resolves
// with the payload to send to /billing/confirm. Rejects if the owner closes it.
async function runCheckout(checkout, amount) {
  if (checkout.provider === "razorpay") {
    const Razorpay = await loadRazorpay();
    return new Promise((resolve, reject) => {
      const rz = new Razorpay({
        key: checkout.keyId,
        subscription_id: checkout.subscriptionId,
        name: checkout.name || "Dishky",
        description: checkout.description,
        prefill: checkout.prefill,
        theme: { color: "#f33716" },
        handler: (resp) => resolve(resp),
        modal: { ondismiss: () => reject(new Error("Payment cancelled.")) },
      });
      rz.open();
    });
  }
  // "mock" provider: development and test servers only. Never offered in production.
  if (!(await toast.confirm(`TEST MODE: simulate a successful payment of ${inr(amount)}?`, { title: "Test payment", confirmLabel: "Simulate payment" }))) throw new Error("Payment cancelled.");
  return { mockPaymentSuccess: true };
}

function Usage({ label, used, limit }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-ink/60">{used} / {limit ?? "unlimited"}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
        <div className={`h-full ${pct >= 100 ? "bg-red-500" : "bg-amber"}`} style={{ width: limit ? `${pct}%` : "8%" }} />
      </div>
    </div>
  );
}

export default function Billing() {
  const { owner, loading } = useOwner();
  const [params, setParams] = useSearchParams();
  const [restaurants, setRestaurants] = useState([]);
  const [data, setData] = useState(null);
  const [cycle, setCycle] = useState("monthly");
  const [busy, setBusy] = useState("");

  const restaurantId = params.get("restaurant") || restaurants[0]?.id;

  useEffect(() => {
    if (!owner) return;
    listRestaurants().then((res) => setRestaurants(res.data)).catch((e) => toast.error(e.message));
  }, [owner]);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await getBilling(restaurantId);
      setData(res.data);
      if (res.data.subscription.billingCycle) setCycle(res.data.subscription.billingCycle);
    } catch (e) {
      toast.error(e.message);
    }
  }, [restaurantId]);
  useEffect(() => { setData(null); load(); }, [load]);

  const current = data?.subscription;
  const restaurant = restaurants.find((r) => r.id === restaurantId);
  const plans = useMemo(() => (data?.plans || []).filter((p) => p.key !== "enterprise" || p.selfServe), [data]);
  const subscribed = current && ["active", "past_due"].includes(current.status) && !current.comped;

  const act = async (key, fn, okText) => {
    setBusy(key);
    try {
      const res = await fn();
      if (okText) toast.success(res?.message || okText);
      await load();
      return res;
    } catch (e) {
      const over = e.body?.over;
      toast.error(
        over?.length
          ? `${e.message}. Reduce your usage first: ${over.map((o) => `${o.label || o.key} ${o.used}/${o.limit}`).join(", ")}.`
          : e.message
      );
      return null;
    } finally {
      setBusy("");
    }
  };

  const choose = (plan) =>
    act(`plan-${plan.key}`, async () => {
      const res = await startCheckout(restaurantId, plan.key, cycle);
      const d = res.data;
      if (d.mode === "scheduled") {
        return { message: `Your plan changes to ${PLAN_NAMES[d.planKey] || d.planKey} on ${fmtDate(d.effectiveAt)}.` };
      }
      const payload = await runCheckout(d.checkout, d.amount);
      const sid = d.checkout.subscriptionId;
      return confirmCheckout(restaurantId, sid, payload);
    }, "Your plan is active.");

  if (loading) return <AccountLayout wide title="Plan & billing" />;
  if (!owner) return <Navigate to={`/login?next=${encodeURIComponent("/account/billing")}`} replace />;

  return (
    <AccountLayout wide title="Plan & billing">
      <div className="space-y-6">
        <Link to="/account" className="text-sm text-ink/60 underline hover:text-ink">← Back to your restaurants</Link>

        {restaurants.length > 1 && (
          <label className="block text-sm font-semibold">
            Restaurant{" "}
            <select className="input mt-1 max-w-sm" value={restaurantId || ""} onChange={(e) => setParams({ restaurant: e.target.value })}>
              {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
        )}

        {!data ? (
          <p className="text-ink/60">Loading…</p>
        ) : (
          <>
            <section className="dk-auto-h rounded-3xl border border-ink/10 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-ink/60">{restaurant?.name}</p>
                  <h2 className="font-display text-2xl font-bold">{PLAN_NAMES[current.planKey] || "No plan"}</h2>
                  <p className="mt-1 text-sm text-ink/60">{statusLine(current)}</p>
                  {current.pendingChange && (
                    <p className="mt-2 text-sm">
                      Switching to <strong>{PLAN_NAMES[current.pendingChange.planKey]}</strong> on {fmtDate(current.pendingChange.effectiveAt)}.{" "}
                      <button type="button" className="underline" disabled={!!busy}
                        onClick={() => act("pending", () => cancelPendingChange(restaurantId), "Scheduled change removed.")}>
                        Keep my current plan
                      </button>
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {current.cancelAtPeriodEnd ? (
                    <button type="button" disabled={!!busy} className="btn-secondary !min-h-[44px]"
                      onClick={() => act("resume", async () => {
                        const res = await resumeSubscription(restaurantId);
                        if (res.data?.mode === "checkout" && res.data.checkout) {
                          const payload = await runCheckout(res.data.checkout, res.data.amount);
                          return confirmCheckout(restaurantId, res.data.checkout.subscriptionId, payload);
                        }
                        return res;
                      }, "Your subscription will continue.")}>
                      Keep my subscription
                    </button>
                  ) : subscribed ? (
                    <button type="button" disabled={!!busy} className="btn-secondary !min-h-[44px]"
                      onClick={async () => {
                        if (await toast.confirm(`Cancel at the end of the current period (${fmtDate(current.currentPeriodEnd)})? You keep full access until then.`, { title: "Cancel subscription?", confirmLabel: "Yes, cancel" })) {
                          act("cancel", () => cancelSubscription(restaurantId), "Your subscription will end at the close of the current period.");
                        }
                      }}>
                      Cancel subscription
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <Usage label="Branches" used={data.usage.venues} limit={current.limits.maxVenues} />
                <Usage label="Tables" used={data.usage.tables} limit={current.limits.maxTables} />
                <Usage label="Staff logins" used={data.usage.staffAccounts} limit={current.limits.maxStaffAccounts} />
              </div>
            </section>

            <section className="dk-auto-h">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl font-bold">{subscribed ? "Change plan" : "Choose a plan"}</h2>
                <div className="inline-flex rounded-full bg-ink/5 p-1 text-sm" role="group" aria-label="Billing period">
                  {["monthly", "yearly"].map((c) => (
                    <button key={c} type="button" aria-pressed={cycle === c} onClick={() => setCycle(c)}
                      className={`min-h-[40px] rounded-full px-4 font-medium ${cycle === c ? "bg-ink text-cream" : "text-ink/60"}`}>
                      {c === "monthly" ? "Monthly" : "Yearly · save ~17%"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {plans.map((p) => {
                  const here = p.key === current.planKey && (!subscribed || cycle === current.billingCycle);
                  const price = cycle === "yearly" ? p.yearlyPrice : p.monthlyPrice;
                  const custom = !p.selfServe || price === 0;
                  const down = subscribed && RANK[p.key] < RANK[current.planKey];
                  return (
                    <article key={p.key} className={`flex flex-col rounded-3xl border p-5 sm:p-6 ${p.key === current.planKey ? "border-amber bg-white" : "border-ink/10 bg-white"}`}>
                      <h3 className="font-display text-lg font-bold">{p.name}</h3>
                      <p className="text-sm text-ink/60">{p.tagline}</p>
                      <p className="mt-4 font-display text-3xl font-extrabold">
                        {custom ? "Custom" : inr(cycle === "yearly" ? Math.round(price / 12) : price)}
                        {!custom && <span className="text-base font-medium text-ink/50">/mo</span>}
                      </p>
                      {!custom && cycle === "yearly" && <p className="text-xs text-ink/50">Billed {inr(price)} per year</p>}
                      <ul className="mt-4 flex-1 space-y-2 text-sm">
                        {p.features.slice(0, 6).map((f) => (
                          <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-amber" />{f}</li>
                        ))}
                      </ul>
                      {custom ? (
                        <Link to="/contact" className="btn-secondary mt-5 !min-h-[44px]">Talk to sales</Link>
                      ) : (
                        <button type="button" disabled={here || !!busy} onClick={() => choose(p)}
                          className="btn-primary mt-5 !min-h-[44px] disabled:opacity-60">
                          {here ? "Current plan" : busy === `plan-${p.key}` ? "Please wait…" : down ? `Downgrade to ${p.name}` : subscribed ? `Switch to ${p.name}` : `Subscribe to ${p.name}`}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-ink/50">
                Upgrades start immediately. Downgrades take effect at the end of your current period. Prices in INR, inclusive of applicable taxes where stated.
              </p>
            </section>

            <section className="dk-auto-h rounded-3xl border border-ink/10 bg-white p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold">Invoices</h2>
              {data.invoices.length === 0 ? (
                <p className="mt-2 text-sm text-ink/60">No payments yet.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="text-ink/50"><tr><th className="py-2 font-medium">Date</th><th className="font-medium">Plan</th><th className="font-medium">Period</th><th className="text-right font-medium">Amount</th><th className="text-right font-medium">Status</th></tr></thead>
                    <tbody>
                      {data.invoices.map((i) => (
                        <tr key={i.id} className="border-t border-ink/5">
                          <td className="py-2">{fmtDate(i.paidAt)}</td>
                          <td>{PLAN_NAMES[i.planKey] || i.planKey} · {i.billingCycle}</td>
                          <td>{fmtDate(i.periodStart)} – {fmtDate(i.periodEnd)}</td>
                          <td className="text-right">{inr(i.amount)}</td>
                          <td className="text-right capitalize">{i.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AccountLayout>
  );
}

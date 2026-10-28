import React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { fadeUp } from "../../animations/variants.js";

export default function PricingCard({ plan, billingCycle }) {
  const price = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const isContactSales = price === 0;

  const monthlyEquivalent =
    billingCycle === "yearly" && plan.yearlyPrice > 0
      ? Math.round(plan.yearlyPrice / 12)
      : null;

  const savingsPct =
    plan.monthlyPrice > 0 && plan.yearlyPrice > 0
      ? Math.round(100 - (plan.yearlyPrice / (plan.monthlyPrice * 12)) * 100)
      : null;

  return (
    <motion.div
      variants={fadeUp}
      data-popular={plan.mostPopular ? "true" : undefined}
      className={`relative flex h-full min-w-0 flex-col rounded-3xl border p-6 sm:p-8 ${
        plan.mostPopular
          ? "border-amber bg-ink text-cream shadow-2xl"
          : "border-ink/10 bg-white text-ink"
      }`}
    >
      {plan.mostPopular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber px-4 py-1 text-[10px] font-bold uppercase tracking-wide text-ink">
          Most Popular
        </span>
      )}

      <p className="font-display text-xl font-bold">{plan.name}</p>
      <p className={`mt-1 text-sm ${plan.mostPopular ? "text-cream/60" : "text-ink/55"}`}>
        {plan.tagline}
      </p>

      <div className="mt-6">
        {isContactSales ? (
          <p className="font-display text-[clamp(1.6rem,6.5vw,1.875rem)] font-extrabold leading-tight">Custom Pricing</p>
        ) : (
          <>
            <p className="font-display text-[clamp(2rem,8vw,2.5rem)] font-extrabold leading-none">
              ₹{(monthlyEquivalent ?? price).toLocaleString("en-IN")}
              <span className="text-base font-medium opacity-60">/mo</span>
            </p>
            {billingCycle === "yearly" && savingsPct > 0 && (
              <p className="mt-1 text-xs font-semibold text-amber">
                Billed ₹{plan.yearlyPrice.toLocaleString("en-IN")}/yr · Save {savingsPct}%
              </p>
            )}
          </>
        )}
      </div>

      <ul className="mt-6 flex-1 space-y-3 sm:mt-7">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check size={16} className="mt-0.5 shrink-0 text-amber" />
            <span className={plan.mostPopular ? "text-cream/85" : "text-ink/75"}>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        to={isContactSales ? "/contact" : `/signup?plan=${plan.key || plan._id}&cycle=${billingCycle}`}
        className={`mt-7 inline-flex min-h-[48px] items-center justify-center rounded-full px-6 text-center text-sm font-semibold transition sm:mt-8 ${
          plan.mostPopular
            ? "bg-amber text-ink hover:bg-amberLight"
            : "bg-ink text-cream hover:bg-charcoal"
        }`}
      >
        {plan.ctaLabel}
      </Link>
    </motion.div>
  );
}

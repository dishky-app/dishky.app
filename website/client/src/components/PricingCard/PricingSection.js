import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import PricingCard from "./PricingCard.js";
import { getPlans } from "../../services/api.js";
import { useAppContext } from "../../context/AppContext.js";
import { gsap, ScrollTrigger } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";

// Fallback plans shown if the API/Atlas isn't reachable yet, so the
// pricing section never renders empty during local development before
// `npm run seed` has been run.
const fallbackPlans = [
  {
    _id: "starter",
    name: "Essential",
    tagline: "For smaller restaurants and cafés",
    monthlyPrice: 999,
    yearlyPrice: 9990,
    mostPopular: false,
    ctaLabel: "Get Started",
    features: ["Dishky User Panel", "QR ordering", "Digital menu", "Basic orders", "Single branch"],
  },
  {
    _id: "growth",
    name: "Professional",
    tagline: "For growing restaurants",
    monthlyPrice: 2999,
    yearlyPrice: 29990,
    mostPopular: true,
    ctaLabel: "Choose Professional",
    features: ["Everything in Essential", "Inventory", "Staff & reservations", "KMS · SMS · GMS", "Advanced analytics"],
  },
  {
    _id: "pro",
    name: "Premium",
    tagline: "For multi-outlet restaurants",
    monthlyPrice: 5999, // placeholder: keep in sync with server/utils/seedPlans.js
    yearlyPrice: 59990,
    mostPopular: false,
    ctaLabel: "Choose Premium",
    features: ["Everything in Professional", "Multi-branch management", "Advanced roles & permissions", "Offers & promotions", "Advanced analytics"],
  },
  {
    _id: "enterprise",
    name: "Custom",
    tagline: "Custom plan for restaurant groups and chains",
    monthlyPrice: 0,
    yearlyPrice: 0,
    mostPopular: false,
    ctaLabel: "Talk to Sales",
    features: ["Everything in Premium", "Centralized management", "Custom workflows", "Priority support", "Custom integrations"],
  },
];

export default function PricingSection() {
  const { billingCycle, setBillingCycle } = useAppContext();
  const [plans, setPlans] = useState(fallbackPlans);
  const [loading, setLoading] = useState(true);
  const sectionRef = useRef(null);
  const gridRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let mounted = true;
    getPlans()
      .then((res) => {
        if (mounted && res?.data?.length) setPlans(res.data);
      })
      .catch(() => {
        // Silently keep fallback plans — API/Atlas may not be running yet.
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  // On phones the plans sit in a swipeable rail. Open it centred on the
  // recommended plan so it is visible immediately with its neighbours
  // peeking in. Scrolls only the rail, never the page.
  const scrollIntoRail = () => {
    const grid = gridRef.current;
    if (!grid || grid.scrollWidth <= grid.clientWidth + 1) return;
    const popular = grid.querySelector("[data-popular]");
    if (!popular) return;
    grid.scrollLeft = popular.offsetLeft - (grid.clientWidth - popular.clientWidth) / 2;
  };
  useLayoutEffect(scrollIntoRail, [plans.length, loading]);

  // Cards lift in from below as the pricing grid scrolls into view,
  // staggered left to right. Re-runs after plans finish loading, since
  // the card count/content can change between the fallback and live data.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    const grid = gridRef.current;
    if (!section || !grid || reducedMotion) return;

    const ctx = gsap.context(() => {
      const cards = Array.from(grid.children);
      gsap.set(cards, { opacity: 0, y: 40 });

      gsap.to(cards, {
        opacity: 1,
        y: 0,
        stagger: 0.15,
        duration: 0.9,
        ease: "power2.out",
        scrollTrigger: {
          trigger: grid,
          start: "top 88%",
          toggleActions: "play none none none",
        },
      });
    }, section);

    // Layout may have shifted once real plan data replaces the fallback.
    ScrollTrigger.refresh();

    return () => ctx.revert();
  }, [reducedMotion, loading, plans.length]);

  return (
    <section ref={sectionRef} className="bg-beige" style={{ paddingBlock: "var(--section-space)" }} id="pricing">
      <div className="container-dishky">
        <SectionHeading
          title={"CHOOSE THE PLAN\nTHAT FITS YOUR RESTAURANT."}
          subtitle="Start with what you need today. Upgrade as your restaurant grows."
          align="center"
        />

        <div className="mt-8 flex items-center justify-center gap-1 md:mt-10" role="group" aria-label="Billing period">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            aria-pressed={billingCycle === "monthly"}
            className={`min-h-[44px] rounded-full px-4 text-sm font-medium transition-colors ${
              billingCycle === "monthly" ? "text-ink" : "text-ink/40 hover:text-ink/70"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={billingCycle === "yearly"}
            aria-label="Bill yearly"
            onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
            className="group flex h-11 w-[68px] items-center justify-center"
          >
            <span className="relative block h-7 w-14 rounded-full bg-ink/15 transition-colors group-hover:bg-ink/20">
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute top-1 block h-5 w-5 rounded-full bg-amber"
                style={{ left: billingCycle === "yearly" ? "calc(100% - 1.5rem)" : "0.25rem" }}
              />
            </span>
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            aria-pressed={billingCycle === "yearly"}
            className={`min-h-[44px] rounded-full px-4 text-sm font-medium transition-colors ${
              billingCycle === "yearly" ? "text-ink" : "text-ink/40 hover:text-ink/70"
            }`}
          >
            Yearly
          </button>
        </div>

        <div
          ref={gridRef}
          className={`pricing-rail mt-10 md:mt-14 ${loading ? "opacity-60" : ""}`}
        >
          {plans.map((plan) => (
            <PricingCard key={plan._id || plan.name} plan={plan} billingCycle={billingCycle} />
          ))}
        </div>
      </div>
    </section>
  );
}

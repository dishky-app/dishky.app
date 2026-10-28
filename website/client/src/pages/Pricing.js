import React, { useState } from "react";
import PageBackdrop from "../components/ReactBits/PageBackdrop.js";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import PricingSection from "../components/PricingCard/PricingSection.js";

const plans = [
  { name: "Essential", why: "One venue, a simple menu and a small team. Everything you need to start taking orders by QR." },
  { name: "Professional", why: "A growing restaurant that needs inventory, staff, reservations and kitchen tools in one place." },
  { name: "Premium", why: "More than one outlet, or a floor big enough to need roles, branch comparison and deeper reports." },
  { name: "Custom", why: "A group or chain. We shape a plan around your branches, teams and how you operate." },
];

function pick(branches, tables, staff) {
  if (branches >= 6) return 3;
  if (branches >= 2 || tables > 45) return 2;
  if (tables > 15 || staff > 10) return 1;
  return 0;
}

function Slider({ label, value, set, min, max, unit }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-cream/70">{label}</span>
        <span className="font-display text-3xl font-extrabold text-white">{value}<span className="ml-1 text-sm font-semibold text-cream/50">{unit}</span></span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => set(+e.target.value)} className="dk-range mt-3 w-full" style={{ "--p": `${pct}%` }} />
    </label>
  );
}

/** Pricing: the plans (unchanged) followed by a plan finder that reacts as you slide. */
export default function Pricing() {
  const [branches, setBranches] = useState(1);
  const [tables, setTables] = useState(12);
  const [staff, setStaff] = useState(6);
  const best = pick(branches, tables, staff);
  return (
    <>
      <div className="relative isolate min-h-screen-safe" style={{ paddingTop: "var(--header-clearance)" }}>
        <PageBackdrop tone="light" />
        <PricingSection />
      </div>
      <section data-nav-theme="dark" className="overflow-x-clip bg-ink text-cream" style={{ paddingBlock: "var(--section-space)" }}>
        <div className="container-dishky grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-amber">Plan finder</p>
            <h2 className="heading-lg mt-3">Tell us your size. We will point to a plan.</h2>
            <div className="mt-8 space-y-7">
              <Slider label="Branches" value={branches} set={setBranches} min={1} max={10} unit={branches === 1 ? "venue" : "venues"} />
              <Slider label="Tables" value={tables} set={setTables} min={4} max={100} unit="tables" />
              <Slider label="Team size" value={staff} set={setStaff} min={2} max={60} unit="people" />
            </div>
          </div>
          <div className="relative min-h-[22rem]">
            {plans.map((p, i) => {
              const on = i === best;
              return (
                <div key={p.name} className={`absolute inset-x-0 rounded-[2rem] border p-7 transition-all duration-700 md:p-9 ${on ? "z-10 translate-y-0 scale-100 border-amber bg-gradient-to-br from-amber to-[#e4290c] opacity-100 shadow-[0_30px_80px_-20px_rgba(243,55,22,0.6)]" : "pointer-events-none translate-y-6 scale-95 border-white/10 bg-white/5 opacity-0"}`} style={{ top: 0 }} aria-hidden={!on}>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">We would suggest</p>
                  <p className="mt-2 font-display font-extrabold text-white" style={{ fontSize: "clamp(3rem, 8vw, 5.5rem)", lineHeight: 1 }}>{p.name}</p>
                  <p className="mt-4 max-w-md text-white/85">{p.why}</p>
                  <div className="cta-row mt-6">
                    <Link to="/book-demo" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-ink">Book a demo <ArrowRight size={18} /></Link>
                  </div>
                </div>
              );
            })}
            <div className="invisible p-9" aria-hidden="true"><p className="text-xs">x</p><p style={{ fontSize: "5.5rem" }}>x</p><p className="mt-4">{plans[3].why}</p><div className="mt-6 h-12" /></div>
          </div>
        </div>
      </section>
    </>
  );
}

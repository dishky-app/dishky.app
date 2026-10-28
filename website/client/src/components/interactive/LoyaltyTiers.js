import React, { useState } from "react";
import { motion } from "framer-motion";
import { Gift, Crown, Star, Cake, Percent } from "lucide-react";
import Count from "../ui/Count.js";

const TIERS = [
  { name: "Bronze", from: 0, grad: ["#e4290c", "#f4492f"], perk: "Birthday dessert", icon: Cake },
  { name: "Silver", from: 8, grad: ["#767676", "#d6d6d6"], perk: "5% off every bill", icon: Percent },
  { name: "Gold", from: 18, grad: ["#e4290c", "#f66b56"], perk: "Free starter + priority", icon: Crown },
];

/** Drag the visits. The card, tier and perks change with them. */
export default function LoyaltyTiers() {
  const [v, setV] = useState(6);
  const ti = TIERS.reduce((a, t, i) => (v >= t.from ? i : a), 0);
  const t = TIERS[ti];
  const next = TIERS[ti + 1];
  return (
    <div className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-xl sm:p-7">
      <motion.div animate={{ background: `linear-gradient(135deg, ${t.grad[0]}, ${t.grad[1]})` }} transition={{ duration: 0.6 }} className="relative overflow-hidden rounded-3xl p-6 text-white shadow-lg">
        <Star aria-hidden="true" className="absolute -right-4 -top-4 opacity-20" size={120} />
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Dishky Rewards</p>
        <p className="mt-6 font-display text-3xl font-extrabold">{t.name}</p>
        <p className="mt-1 text-sm text-white/85"><Count value={v * 50} /> points</p>
      </motion.div>
      <label className="mt-6 block text-xs font-bold text-ink/55">Visits: <span className="text-ink">{v}</span>
        <input type="range" min="0" max="30" value={v} onChange={(e) => setV(Number(e.target.value))} className="mt-2 w-full accent-amber" style={{ minHeight: 0 }} />
      </label>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10"><motion.div className="h-full rounded-full bg-amber" animate={{ width: next ? `${((v - t.from) / (next.from - t.from)) * 100}%` : "100%" }} /></div>
      <p className="mt-2 text-[11px] text-ink/45">{next ? `${next.from - v} more visits to ${next.name}` : "Top tier reached"}</p>
      <ul className="mt-5 grid gap-2 sm:grid-cols-3">
        {TIERS.map((x, i) => { const I = x.icon; return (
          <li key={x.name} className={`flex items-center gap-2.5 rounded-2xl p-3 text-xs font-semibold transition ${i <= ti ? "bg-amber/10 text-ink" : "bg-ink/[0.04] text-ink/35"}`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${i <= ti ? "bg-amber text-white" : "bg-ink/10"}`}><I size={14} /></span>{x.perk}
          </li>); })}
      </ul>
    </div>
  );
}

import React, { useState } from "react";
import { motion } from "framer-motion";
import Window from "../ui/Window.js";
import Count from "../ui/Count.js";

const RANGES = {
  Today: { rev: 84240, orders: 426, guests: 284, pts: [8, 14, 30, 52, 44, 60, 78, 92, 70, 40], top: [["Butter Chicken", 92], ["Biryani", 80], ["Pasta", 55], ["Torte", 38]] },
  Week: { rev: 512400, orders: 2860, guests: 1930, pts: [40, 52, 48, 66, 60, 82, 90, 76, 88, 96], top: [["Biryani", 96], ["Butter Chicken", 88], ["Torte", 62], ["Pasta", 50]] },
  Month: { rev: 2185000, orders: 12140, guests: 8420, pts: [30, 44, 56, 52, 70, 78, 74, 90, 94, 100], top: [["Butter Chicken", 100], ["Biryani", 90], ["Pasta", 70], ["Torte", 58]] },
};

/** Switch the range, watch the numbers and the curve move. */
export default function AnalyticsDash() {
  const [r, setR] = useState("Today");
  const d = RANGES[r];
  const W = 300, H = 90;
  const pts = d.pts.map((v, i) => [(i / (d.pts.length - 1)) * W, H - (v / 100) * (H - 8) - 4]);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <Window title="Dashboard · analytics">
      <div className="mb-4 flex gap-2">
        {Object.keys(RANGES).map((k) => (<button key={k} type="button" onClick={() => setR(k)} style={{ minHeight: 34 }} className={`rounded-full px-4 text-xs font-bold transition ${r === k ? "bg-ink text-cream" : "bg-ink/[0.06] text-ink/55"}`}>{k}</button>))}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {[["Revenue", d.rev, "₹"], ["Orders", d.orders, ""], ["Guests", d.guests, ""]].map(([l, v, p]) => (
          <div key={l} className="min-w-0 rounded-2xl bg-ink/[0.04] p-3"><p className="text-[10px] font-semibold text-ink/45">{l}</p><p className="mt-1 truncate font-display text-[clamp(0.95rem,3.4vw,1.25rem)] font-extrabold"><Count value={v} prefix={p} /></p></div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-28 w-full" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="adg" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#f33716" stopOpacity="0.35" /><stop offset="100%" stopColor="#f33716" stopOpacity="0" /></linearGradient></defs>
        <motion.path key={`a${r}`} d={`${path} L${W},${H} L0,${H} Z`} fill="url(#adg)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
        <motion.path key={`l${r}`} d={path} fill="none" stroke="#f33716" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: "easeOut" }} />
      </svg>
      <ul className="mt-3 space-y-2">
        {d.top.map(([n, v]) => (
          <li key={n} className="flex items-center gap-3 text-xs"><span className="w-24 shrink-0 truncate font-semibold text-ink/70">{n}</span><span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.07]"><motion.span className="block h-full rounded-full bg-ink" animate={{ width: `${v}%` }} transition={{ type: "spring", stiffness: 100, damping: 18 }} /></span></li>
        ))}
      </ul>
    </Window>
  );
}

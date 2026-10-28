import React, { useState } from "react";
import { motion } from "framer-motion";
import Window from "../ui/Window.js";
import Count from "../ui/Count.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DATA = {
  Chennai: { rev: [52, 58, 61, 66, 84, 98, 90], orders: [160, 172, 181, 190, 240, 270, 255] },
  Madurai: { rev: [38, 41, 40, 47, 63, 72, 66], orders: [120, 128, 124, 140, 188, 205, 190] },
  Coimbatore: { rev: [30, 33, 35, 37, 52, 60, 55], orders: [96, 102, 108, 113, 150, 172, 158] },
};
const sum = (a) => a.reduce((x, y) => x + y, 0);

/** One login, every branch. Switch branch or metric and the board follows. */
export default function BranchCompare({ dark = false }) {
  const [branch, setBranch] = useState("All");
  const [metric, setMetric] = useState("rev");
  const series = branch === "All"
    ? DAYS.map((_, i) => sum(Object.values(DATA).map((d) => d[metric][i])))
    : DATA[branch][metric];
  const max = Math.max(...series);
  const total = sum(series);
  return (
    <Window dark={dark} title="All branches · this week">
      <div className="flex flex-wrap items-center gap-2">
        {["All", ...Object.keys(DATA)].map((b) => (
          <button key={b} type="button" onClick={() => setBranch(b)} style={{ minHeight: 36 }}
            className={`rounded-full px-3.5 text-xs font-bold transition ${branch === b ? "bg-amber text-ink" : dark ? "bg-cream/10 text-cream/70" : "bg-ink/[0.06] text-ink/60"}`}>{b}</button>
        ))}
        <div className={`ml-auto flex rounded-full p-1 ${dark ? "bg-cream/10" : "bg-ink/[0.06]"}`}>
          {[["rev", "Revenue"], ["orders", "Orders"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setMetric(k)} style={{ minHeight: 30 }} className={`rounded-full px-3 text-[11px] font-bold ${metric === k ? (dark ? "bg-cream text-ink" : "bg-ink text-cream") : dark ? "text-cream/60" : "text-ink/50"}`}>{l}</button>
          ))}
        </div>
      </div>
      <p className="mt-5 font-display text-4xl font-extrabold text-amber">
        <Count value={total} prefix={metric === "rev" ? "₹" : ""} suffix={metric === "rev" ? "k" : ""} />
      </p>
      <div className="mt-4 flex h-40 items-end gap-2 sm:gap-3">
        {series.map((v, i) => (
          <div key={DAYS[i]} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <motion.div className="w-full rounded-t-lg bg-gradient-to-t from-amber to-amberLight" animate={{ height: `${(v / max) * 100}%` }} transition={{ type: "spring", stiffness: 110, damping: 18 }} />
            <span className={`text-[10px] font-semibold ${dark ? "text-cream/50" : "text-ink/45"}`}>{DAYS[i]}</span>
          </div>
        ))}
      </div>
    </Window>
  );
}

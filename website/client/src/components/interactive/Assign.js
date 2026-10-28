import React, { useState } from "react";
import { motion } from "framer-motion";
import Window from "../ui/Window.js";

const PRESETS = {
  kitchen: { title: "Kitchen · station assigning", stations: ["Grill", "Fry", "Cold", "Pass"], staff: ["Arun", "Meena", "Ravi", "Suresh", "Nithya"] },
  service: { title: "Service · section assigning", stations: ["Section A", "Section B", "Bar", "Cashier"], staff: ["Farid", "Divya", "Karthik", "Lakshmi", "Anbu"] },
};
const COLORS = ["#f33716", "#f66a55", "#e4290c", "#ea2a0c", "#ed2b0d"];

/** Tap a person, tap a station. Duties are set in two taps. */
export default function Assign({ preset = "kitchen" }) {
  const p = PRESETS[preset] || PRESETS.kitchen;
  const [map, setMap] = useState(() => Object.fromEntries(p.staff.map((s, i) => [s, i < 4 ? p.stations[i] : null])));
  const [sel, setSel] = useState(null);
  const place = (st) => { if (!sel) return; setMap((m) => ({ ...m, [sel]: st })); setSel(null); };
  const chip = (s) => (
    <motion.button key={s} layout type="button" onClick={(e) => { e.stopPropagation(); setSel(sel === s ? null : s); }} style={{ minHeight: 0, background: COLORS[p.staff.indexOf(s)] }}
      className={`rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow ${sel === s ? "ring-4 ring-ink/25" : ""}`}>{s}</motion.button>
  );
  return (
    <Window title={p.title}>
      <div className="mb-4 flex min-h-[44px] flex-wrap items-center gap-2 rounded-2xl bg-ink/[0.04] p-2.5">
        <span className="text-[11px] font-bold text-ink/40">Unassigned</span>
        {p.staff.filter((s) => !map[s]).map(chip)}
        {p.staff.every((s) => map[s]) && <span className="text-[11px] text-ink/35">Everyone has a duty.</span>}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {p.stations.map((st) => (
          <div key={st} role="button" tabIndex={0} onClick={() => place(st)} onKeyDown={(e) => e.key === "Enter" && place(st)} className={`min-h-[96px] rounded-2xl border-2 border-dashed p-3 transition ${sel ? "cursor-pointer border-amber bg-amber/5" : "border-ink/15"}`}>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-ink/50">{st}</p>
            <div className="flex flex-wrap gap-1.5">{p.staff.filter((s) => map[s] === st).map(chip)}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-ink/40">{sel ? `Now tap a station for ${sel}.` : "Tap a person first."}</p>
    </Window>
  );
}

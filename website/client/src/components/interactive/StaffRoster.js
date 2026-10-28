import React, { useState } from "react";
import { motion } from "framer-motion";
import Window from "../ui/Window.js";
import Count from "../ui/Count.js";

const STATUS = [
  { key: "Present", cls: "bg-neutral-100 text-amber" },
  { key: "On break", cls: "bg-amber/15 text-amber" },
  { key: "Absent", cls: "bg-ink/10 text-ink/45" },
];
const TEAM = [
  { n: "Arun K", r: "Head chef", s: 0, c: "#f33716" },
  { n: "Meena R", r: "Sous chef", s: 0, c: "#f66a55" },
  { n: "Farid S", r: "Service lead", s: 1, c: "#e4290c" },
  { n: "Divya P", r: "Server", s: 0, c: "#ea2a0c" },
  { n: "Karthik M", r: "Server", s: 2, c: "#ed2b0d" },
  { n: "Lakshmi V", r: "Cashier", s: 0, c: "#f3391d" },
];

/** Tap a person to mark attendance. The head count updates itself. */
export default function StaffRoster() {
  const [team, setTeam] = useState(TEAM);
  const cycle = (i) => setTeam((t) => t.map((x, n) => (n === i ? { ...x, s: (x.s + 1) % 3 } : x)));
  const present = team.filter((x) => x.s === 0).length;
  return (
    <Window title="Staff · attendance today">
      <div className="mb-4 flex items-end justify-between">
        <p className="font-display text-4xl font-extrabold"><Count value={present} /><span className="text-lg text-ink/35"> / {team.length}</span></p>
        <p className="text-xs font-semibold text-ink/45">on shift</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {team.map((p, i) => (
          <li key={p.n}>
            <button type="button" onClick={() => cycle(i)} style={{ minHeight: 0 }} className="flex w-full items-center gap-3 rounded-2xl bg-ink/[0.04] p-2.5 text-left transition hover:bg-ink/[0.08]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-xs font-extrabold text-white" style={{ background: p.c }}>{p.n.split(" ").map((w) => w[0]).join("")}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{p.n}</span><span className="block truncate text-[11px] text-ink/45">{p.r}</span></span>
              <motion.span key={p.s} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS[p.s].cls}`}>{STATUS[p.s].key}</motion.span>
            </button>
          </li>
        ))}
      </ul>
    </Window>
  );
}

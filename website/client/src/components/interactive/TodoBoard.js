import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Window from "../ui/Window.js";

const PRESETS = {
  tasks: { title: "To-do · today", items: ["Review today's bookings", "Approve the weekend roster", "Call the dairy supplier", "Check the event menu", "Reply to catering request"] },
  mise: { title: "Mise en place · opening", items: ["Sanitise all stations", "Prep sauces and marinades", "Check fridge temperatures", "Stock the pass", "Brief the team"] },
  reorder: { title: "Reorder list", items: ["Paneer · 10 kg", "Fresh cream · 12 L", "Cooking oil · 20 L", "Basmati rice · 50 kg"] },
  service: { title: "Floor checklist · opening", items: ["Wipe and set every table", "Check the QR codes", "Fold napkins, fill water", "Test the printer", "Team grooming check"] },
};

/** A checklist that celebrates when it is done. */
export default function TodoBoard({ preset = "tasks" }) {
  const p = PRESETS[preset] || PRESETS.tasks;
  const [done, setDone] = useState(p.items.map((_, i) => i === 0));
  const pct = Math.round((done.filter(Boolean).length / done.length) * 100);
  return (
    <Window title={p.title} right={<span className="font-display text-xs font-extrabold text-amber">{pct}%</span>}>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-ink/10"><motion.div className="h-full rounded-full bg-amber" animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} /></div>
      <ul className="space-y-2">
        {p.items.map((it, i) => (
          <li key={it}>
            <button type="button" onClick={() => setDone((d) => d.map((v, n) => (n === i ? !v : v)))} style={{ minHeight: 0 }} className="flex w-full items-center gap-3 rounded-xl bg-ink/[0.04] px-3 py-2.5 text-left">
              <motion.span animate={{ scale: done[i] ? [1, 1.3, 1] : 1 }} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${done[i] ? "border-amber bg-amber text-white" : "border-ink/20"}`}>{done[i] && <Check size={13} strokeWidth={3} />}</motion.span>
              <span className={`text-xs font-semibold transition ${done[i] ? "text-ink/35 line-through" : "text-ink/80"}`}>{it}</span>
            </button>
          </li>
        ))}
      </ul>
      {pct === 100 && <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 text-center text-xs font-bold text-amber">All done.</motion.p>}
    </Window>
  );
}

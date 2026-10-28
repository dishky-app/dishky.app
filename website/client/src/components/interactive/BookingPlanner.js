import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Utensils, PartyPopper, ClipboardList } from "lucide-react";
import Window from "../ui/Window.js";

const TABLES = ["T1 · 2", "T2 · 4", "T3 · 4", "T4 · 6"];
const TIMES = ["12:30", "13:30", "19:00", "20:00", "21:00"];
const KINDS = [
  { key: "Reservation", icon: Utensils },
  { key: "Pre-booking", icon: ClipboardList },
  { key: "Celebration", icon: PartyPopper },
  { key: "Catering", icon: CalendarDays },
];

/** Tap a free slot to book it. Every booking type lands on one schedule. */
export default function BookingPlanner() {
  const [kind, setKind] = useState("Reservation");
  const [book, setBook] = useState({ "T2 · 4|13:30": "Reservation", "T4 · 6|20:00": "Celebration" });
  const toggle = (k) => setBook((b) => { const n = { ...b }; if (n[k]) delete n[k]; else n[k] = kind; return n; });
  const list = Object.entries(book).map(([k, v]) => ({ k, table: k.split("|")[0], time: k.split("|")[1], kind: v })).sort((a, b) => a.time.localeCompare(b.time));
  return (
    <Window title="Today · bookings">
      <div className="mb-4 flex flex-wrap gap-2">
        {KINDS.map(({ key, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setKind(key)} style={{ minHeight: 34 }} className={`inline-flex items-center gap-1.5 rounded-full px-3 text-xs font-bold transition ${kind === key ? "bg-amber text-ink" : "bg-ink/[0.06] text-ink/60"}`}><Icon size={13} />{key}</button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] border-separate border-spacing-1.5">
          <thead><tr><th />{TIMES.map((t) => <th key={t} className="text-[10px] font-bold text-ink/40">{t}</th>)}</tr></thead>
          <tbody>
            {TABLES.map((tb) => (
              <tr key={tb}>
                <th className="whitespace-nowrap pr-1 text-left text-[11px] font-bold text-ink/60">{tb}</th>
                {TIMES.map((tm) => {
                  const k = `${tb}|${tm}`; const v = book[k];
                  return (
                    <td key={k}>
                      <button type="button" onClick={() => toggle(k)} aria-label={`${tb} ${tm} ${v || "free"}`} style={{ minHeight: 0 }}
                        className={`h-9 w-full rounded-lg text-[10px] font-bold transition ${v ? "bg-ink text-cream" : "bg-ink/[0.05] text-transparent hover:bg-amber/20 hover:text-amber"}`}>{v ? v.slice(0, 3) : "+"}</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-4 divide-y divide-ink/[0.07]">
        <AnimatePresence initial={false}>
          {list.map((b) => (
            <motion.li key={b.k} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 overflow-hidden py-2 text-xs">
              <span className="w-11 font-display font-bold tabular-nums">{b.time}</span>
              <span className="flex-1 font-semibold text-ink/70">{b.table}</span>
              <span className="rounded-full bg-amber/10 px-2 py-0.5 text-[10px] font-bold text-amber">{b.kind}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Window>
  );
}

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Trash2, LogIn, Plus } from "lucide-react";
import Window from "../ui/Window.js";

const EVENTS = [
  { who: "Rahul (Manager)", what: "changed the price of Biryani", icon: Pencil },
  { who: "Anita (Admin)", what: "added a new staff account", icon: Plus },
  { who: "Farid (Service)", what: "signed in from Branch 2", icon: LogIn },
  { who: "Meena (Chef)", what: "updated the Butter Chicken recipe", icon: Pencil },
  { who: "Rahul (Manager)", what: "removed an expired offer", icon: Trash2 },
  { who: "Anita (Admin)", what: "changed role permissions", icon: Pencil },
];

/** Every change is recorded: who, what, when. */
export default function AuditFeed() {
  const [log, setLog] = useState([EVENTS[0], EVENTS[1]].map((e, i) => ({ ...e, id: i, t: `${i + 1}m ago` })));
  useEffect(() => {
    let n = 2;
    const id = setInterval(() => {
      setLog((l) => [{ ...EVENTS[n % EVENTS.length], id: Date.now(), t: "just now" }, ...l.map((x) => ({ ...x, t: x.t === "just now" ? "1m ago" : x.t }))].slice(0, 5));
      n += 1;
    }, 3200);
    return () => clearInterval(id);
  }, []);
  return (
    <Window title="Audit log · live">
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {log.map((e) => { const I = e.icon; return (
            <motion.li key={e.id} layout initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-xl bg-ink/[0.04] px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber/15 text-amber"><I size={14} /></span>
              <span className="min-w-0 flex-1 text-xs"><b className="font-bold">{e.who}</b> <span className="text-ink/60">{e.what}</span></span>
              <span className="shrink-0 text-[10px] font-semibold text-ink/35">{e.t}</span>
            </motion.li>); })}
        </AnimatePresence>
      </ul>
    </Window>
  );
}

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Pin } from "lucide-react";
import Window from "../ui/Window.js";

const NOTES = [
  { t: "Menu change from Monday", b: "Remove the heavy cream dishes.", c: "#e6e6e6" },
  { t: "Fire safety audit", b: "Thursday, 3 PM. Kitchen first.", c: "#eaeaea" },
  { t: "New hire briefing", b: "Orientation at 10 AM sharp.", c: "#eaeaea" },
  { t: "Supplier invoice", b: "Upload the signed copy to Documents.", c: "#f1f1f1" },
];

/** Pin what matters to the top. Notes, memos and documents stay in the panel. */
export default function Memos() {
  const [pins, setPins] = useState([1]);
  const order = [...NOTES.keys()].sort((a, b) => Number(pins.includes(b)) - Number(pins.includes(a)));
  const toggle = (i) => setPins((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  return (
    <Window title="Memos">
      <div className="grid gap-3 sm:grid-cols-2">
        {order.map((i) => (
          <motion.div key={i} layout transition={{ type: "spring", stiffness: 300, damping: 28 }} className="relative rounded-2xl p-4 text-ink shadow-sm" style={{ background: NOTES[i].c, rotate: i % 2 ? 1.2 : -1.2 }}>
            <button type="button" aria-label="Pin" onClick={() => toggle(i)} style={{ minHeight: 0 }} className="absolute right-2.5 top-2.5"><Pin size={16} className={pins.includes(i) ? "fill-amber text-amber" : "text-ink/35"} /></button>
            <p className="pr-6 font-display text-sm font-bold">{NOTES[i].t}</p>
            <p className="mt-1 text-xs text-ink/65">{NOTES[i].b}</p>
          </motion.div>
        ))}
      </div>
    </Window>
  );
}

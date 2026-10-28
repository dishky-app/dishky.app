import React, { useState } from "react";
import { motion } from "framer-motion";
import Window from "../ui/Window.js";

const ST = [
  { key: "Free", bg: "bg-neutral-100 text-amber border-red-300" },
  { key: "Occupied", bg: "bg-amber text-white border-amber" },
  { key: "Reserved", bg: "bg-ink text-cream border-ink" },
  { key: "Cleaning", bg: "bg-ink/10 text-ink/50 border-ink/20" },
];
const INIT = [
  [1, 0], [2, 1], [3, 2], [4, 0], [5, 1], [6, 1], [7, 3], [8, 0], [9, 2], [10, 0], [11, 1], [12, 0],
];

/** A live floor plan. Tap a table to change its state. */
export default function FloorPlan() {
  const [t, setT] = useState(INIT);
  const cyc = (i) => setT((cur) => cur.map((x, n) => (n === i ? [x[0], (x[1] + 1) % 4] : x)));
  return (
    <Window title="Tables · floor plan">
      <ul className="grid grid-cols-4 gap-2.5 sm:gap-3">
        {t.map(([id, s], i) => (
          <li key={id}>
            <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => cyc(i)} style={{ minHeight: 0 }}
              className={`flex aspect-square w-full flex-col items-center justify-center border-2 text-center transition-colors duration-300 ${[0, 5, 9].includes(i) ? "rounded-full" : "rounded-2xl"} ${ST[s].bg}`}>
              <span className="font-display text-base font-extrabold sm:text-lg">{id}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide opacity-80">{ST[s].key}</span>
            </motion.button>
          </li>
        ))}
      </ul>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
        {ST.map((s, n) => (<li key={s.key} className="flex items-center gap-1.5 text-[11px] font-semibold text-ink/55"><span className={`h-3 w-3 rounded-full border ${s.bg}`} />{s.key} {t.filter((x) => x[1] === n).length}</li>))}
      </ul>
    </Window>
  );
}

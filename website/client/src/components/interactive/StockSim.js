import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Window from "../ui/Window.js";
import Img from "../ui/Img.js";
import { images } from "../../assets/images/imageUrls.js";

const START = { Paneer: 80, Cream: 60, Rice: 90, Chicken: 70, Oil: 85 };
const DISHES = [
  { name: "Paneer Butter Masala", img: images.dishCurry, use: { Paneer: 22, Cream: 15, Oil: 4 } },
  { name: "Chicken Biryani", img: images.dishBiryani, use: { Chicken: 20, Rice: 18, Oil: 5 } },
  { name: "Creamy Pasta", img: images.dishPasta, use: { Cream: 20, Oil: 3 } },
];

/** Order a dish and watch the ingredients drain, then reorder before service. */
export default function StockSim() {
  const [lv, setLv] = useState(START);
  const [last, setLast] = useState(null);
  const order = (d) => {
    setLast(d.name);
    setLv((cur) => {
      const n = { ...cur };
      Object.entries(d.use).forEach(([k, v]) => { n[k] = Math.max(0, n[k] - v); });
      return n;
    });
  };
  const low = Object.entries(lv).filter(([, v]) => v < 25).map(([k]) => k);
  return (
    <Window title="Stock · live ingredient levels">
      <div className="grid gap-3 sm:grid-cols-3">
        {DISHES.map((d) => (
          <button key={d.name} type="button" onClick={() => order(d)} style={{ minHeight: 0 }} className="group relative overflow-hidden rounded-2xl text-left transition active:scale-95">
            <Img src={d.img} alt={d.name} className="aspect-[4/3] w-full" imgClassName="transition duration-700 group-hover:scale-110" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <span className="absolute inset-x-3 bottom-2.5 text-white">
              <span className="block font-display text-xs font-bold leading-tight">{d.name}</span>
              <span className="text-[10px] font-semibold text-white/70">Tap to order</span>
            </span>
          </button>
        ))}
      </div>
      <ul className="mt-5 space-y-3">
        {Object.entries(lv).map(([k, v]) => (
          <li key={k} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs font-semibold text-ink/75">{k}</span>
            <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
              <motion.span className={`absolute inset-y-0 left-0 rounded-full ${v < 25 ? "bg-amber" : "bg-ink"}`} animate={{ width: `${v}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
            </span>
            <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-ink/50">{v}%</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 min-h-[44px]">
        <AnimatePresence mode="wait">
          {low.length > 0 ? (
            <motion.div key="low" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber/10 px-3 py-2">
              <span className="flex items-center gap-2 text-xs font-bold text-amber"><AlertTriangle size={15} /> Low: {low.join(", ")}</span>
              <button type="button" onClick={() => setLv(START)} style={{ minHeight: 32 }} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-bold text-cream"><RefreshCw size={12} /> Reorder</button>
            </motion.div>
          ) : (
            <motion.p key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-1 py-2 text-xs text-ink/45">{last ? `${last}: ingredients deducted.` : "Every order deducts its ingredients automatically."}</motion.p>
          )}
        </AnimatePresence>
      </div>
    </Window>
  );
}

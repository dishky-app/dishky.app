import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Smartphone, ChefHat, Boxes, Wallet, LayoutDashboard, Check, Play } from "lucide-react";
import { EASE } from "../../animations/variants.js";

const NODES = [
  { icon: Smartphone, label: "Guest orders", sub: "Table 12" },
  { icon: ChefHat, label: "Kitchen ticket", sub: "Auto-created" },
  { icon: Boxes, label: "Stock adjusts", sub: "Ingredients out" },
  { icon: Wallet, label: "Payment", sub: "Recorded" },
  { icon: LayoutDashboard, label: "Dashboard", sub: "Live" },
];

/** One tap, five things happen. Place an order and watch it travel. */
export default function OrderFlow({ dark = false }) {
  const [step, setStep] = useState(-1);
  const [orders, setOrders] = useState(0);
  const timers = useRef([]);
  const run = () => {
    timers.current.forEach(clearTimeout);
    setStep(0);
    NODES.forEach((_, i) => {
      if (i === 0) return;
      timers.current.push(setTimeout(() => setStep(i), i * 750));
    });
    timers.current.push(setTimeout(() => setOrders((o) => o + 1), NODES.length * 750));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const tone = dark ? "text-cream" : "text-ink";
  return (
    <div className={`rounded-[1.75rem] border p-5 sm:p-7 ${dark ? "border-cream/10 bg-cream/[0.04]" : "border-ink/10 bg-white shadow-xl"}`}>
      <div className="relative">
        <div className={`absolute left-[10%] right-[10%] top-7 hidden h-[3px] rounded sm:block ${dark ? "bg-cream/10" : "bg-ink/10"}`} />
        <motion.div
          className="absolute left-[10%] top-7 hidden h-[3px] rounded bg-amber sm:block"
          animate={{ width: step < 0 ? "0%" : `${(step / (NODES.length - 1)) * 80}%` }}
          transition={{ duration: 0.6, ease: EASE }}
        />
        <ol className="relative grid grid-cols-2 gap-4 sm:grid-cols-5 sm:gap-2">
          {NODES.map(({ icon: Icon, label, sub }, i) => {
            const on = step >= i;
            return (
              <li key={label} className="flex flex-col items-center text-center">
                <motion.span
                  animate={{ scale: step === i ? 1.18 : 1 }}
                  className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-500 ${on ? "bg-amber text-ink shadow-lg" : dark ? "bg-cream/10 text-cream/50" : "bg-ink/[0.07] text-ink/40"}`}
                >
                  {on && step > i ? <Check size={22} strokeWidth={3} /> : <Icon size={22} />}
                </motion.span>
                <p className={`mt-3 font-display text-xs font-bold ${tone}`}>{label}</p>
                <p className={`text-[11px] ${dark ? "text-cream/45" : "text-ink/45"}`}>{sub}</p>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={run} className="btn-primary group">
          <Play size={16} /> Place an order
        </button>
        <p className={`text-sm font-semibold ${dark ? "text-cream/60" : "text-ink/55"}`}>
          Orders today <motion.b key={orders} initial={{ scale: 1.6, color: "#f33716" }} animate={{ scale: 1, color: dark ? "#ffffff" : "#000000" }} className="inline-block font-display text-lg tabular-nums">{426 + orders}</motion.b>
        </p>
      </div>
    </div>
  );
}

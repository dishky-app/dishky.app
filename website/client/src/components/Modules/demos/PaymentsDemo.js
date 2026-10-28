import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, animate, useMotionValue, useTransform, useReducedMotion } from "framer-motion";
import { Smartphone, CreditCard, Banknote, Minus, Plus, RotateCcw, Loader2 } from "lucide-react";
import { Segmented, Chip } from "../../Kit/Kit.js";

const LINES = [
  ["Dum Biryani", 2, 360],
  ["Butter Curry", 1, 320],
  ["Garlic Naan", 4, 60],
  ["Mint Cooler", 3, 120],
];
const METHODS = [
  { value: "UPI", label: "UPI", icon: Smartphone },
  { value: "Card", label: "Card", icon: CreditCard },
  { value: "Cash", label: "Cash", icon: Banknote },
];
const SUB = LINES.reduce((s, [, q, p]) => s + q * p, 0);
const GST = Math.round(SUB * 0.05);
const SERVICE = Math.round(SUB * 0.05);
const TOTAL = SUB + GST + SERVICE;

function Num({ value, className = "" }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => `₹${Math.round(v).toLocaleString("en-IN")}`);
  useEffect(() => {
    if (reduce) { mv.set(value); return undefined; }
    const c = animate(mv, value, { type: "spring", stiffness: 180, damping: 22 });
    return () => c.stop();
  }, [value, mv, reduce]);
  return <motion.span className={className}>{text}</motion.span>;
}

export default function PaymentsDemo({ dark = false }) {
  const [method, setMethod] = useState("UPI");
  const [split, setSplit] = useState(false);
  const [people, setPeople] = useState(3);
  const [phase, setPhase] = useState("idle"); // idle | processing | success | receipt

  useEffect(() => {
    if (phase === "processing") { const t = setTimeout(() => setPhase("success"), 1500); return () => clearTimeout(t); }
    if (phase === "success") { const t = setTimeout(() => setPhase("receipt"), 1100); return () => clearTimeout(t); }
    return undefined;
  }, [phase]);

  const per = Math.ceil(TOTAL / (split ? people : 1));
  const busy = phase !== "idle";
  const card = dark ? "bg-white/5 border-white/10 text-white" : "bg-white border-black/5 text-ink shadow-sm";
  const sub = dark ? "text-white/50" : "text-black/50";
  const reset = () => { setPhase("idle"); setSplit(false); setPeople(3); setMethod("UPI"); };
  const step = "min-h-[40px] min-w-[40px] rounded-full grid place-items-center disabled:opacity-30 " + (dark ? "bg-white/10" : "bg-black/5");

  return (
    <div className="w-full grid gap-4 md:grid-cols-2 items-stretch">
      <div className={`rounded-3xl border p-5 flex flex-col ${card}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="font-display font-semibold">Table 7</div>
          <Chip tone={phase === "receipt" ? "ok" : "warn"}>{phase === "receipt" ? "Paid" : "Open"}</Chip>
        </div>
        <div className="space-y-2 text-sm flex-1">
          {LINES.map(([n, q, p], i) => (
            <motion.div key={n} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="flex justify-between gap-2">
              <span className="truncate">{q} × {n}</span><span className="font-semibold">₹{(q * p).toLocaleString("en-IN")}</span>
            </motion.div>
          ))}
        </div>
        <div className={`mt-4 pt-3 border-t border-dashed text-sm space-y-1 ${dark ? "border-white/20" : "border-black/15"}`}>
          <div className={`flex justify-between ${sub}`}><span>Subtotal</span><span>₹{SUB}</span></div>
          <div className={`flex justify-between ${sub}`}><span>GST 5%</span><span>₹{GST}</span></div>
          <div className={`flex justify-between ${sub}`}><span>Service 5%</span><span>₹{SERVICE}</span></div>
          <div className="flex justify-between font-display font-semibold text-lg pt-1"><span>Total</span><span>₹{TOTAL.toLocaleString("en-IN")}</span></div>
        </div>
      </div>

      <div className={`rounded-3xl border p-5 relative overflow-hidden flex flex-col gap-4 min-h-[340px] ${card}`}>
        <Segmented options={METHODS} value={method} onChange={(v) => !busy && setMethod(v)} dark={dark} />

        <div className="flex items-center justify-between gap-3">
          <button type="button" role="switch" aria-checked={split} aria-label="Split bill" disabled={busy} onClick={() => setSplit((s) => !s)} className="min-h-[40px] flex items-center gap-2 text-sm font-semibold">
            <span className={`w-11 h-6 rounded-full p-0.5 flex transition-colors ${split ? "bg-amber justify-end" : dark ? "bg-white/20 justify-start" : "bg-black/15 justify-start"}`}>
              <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 30 }} className="w-5 h-5 rounded-full bg-white shadow" />
            </span>
            Split bill
          </button>
          <AnimatePresence>
            {split && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center gap-1">
                <button type="button" aria-label="Fewer people" disabled={busy || people <= 2} onClick={() => setPeople((p) => p - 1)} className={step}><Minus size={15} /></button>
                <span className="w-14 text-center text-sm font-semibold">{people} people</span>
                <button type="button" aria-label="More people" disabled={busy || people >= 6} onClick={() => setPeople((p) => p + 1)} className={step}><Plus size={15} /></button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={`rounded-2xl p-4 text-center ${dark ? "bg-white/5" : "bg-beige"}`}>
          <div className={`text-xs ${sub}`}>{split ? "Per person" : "Amount due"}</div>
          <Num value={per} className="font-display text-4xl font-semibold" />
          <AnimatePresence>
            {split && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex justify-center gap-1.5 mt-2 overflow-hidden">
                {Array.from({ length: people }, (_, i) => (
                  <motion.span key={i} layout initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-6 h-6 rounded-full bg-amber text-white text-[10px] font-bold grid place-items-center">{i + 1}</motion.span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button type="button" aria-label={`Pay with ${method}`} disabled={busy} whileTap={{ scale: 0.97 }} onClick={() => setPhase("processing")} className="mt-auto min-h-[48px] rounded-2xl bg-amber text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
          {phase === "processing" ? <Loader2 size={18} className="animate-spin" /> : null}
          {phase === "processing" ? "Processing" : `Pay ₹${per.toLocaleString("en-IN")} via ${method}`}
        </motion.button>

        <AnimatePresence>
          {phase === "success" && (
            <motion.div key="ok" className={`absolute inset-0 grid place-items-center ${dark ? "bg-[#121212]" : "bg-white"}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-label="Payment successful">
                <motion.circle cx="48" cy="48" r="40" stroke="#f33716" strokeWidth="6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
                <motion.path d="M30 50 L43 63 L67 36" stroke="#f33716" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.45, duration: 0.45 }} />
              </svg>
            </motion.div>
          )}
          {phase === "receipt" && (
            <motion.div key="rc" className={`absolute inset-0 p-5 flex flex-col ${dark ? "bg-[#121212]" : "bg-white"}`} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 220, damping: 28 }}>
              <div className="flex items-center justify-between">
                <span className="font-display font-semibold">Receipt</span>
                <Chip tone="ok">Settled</Chip>
              </div>
              <div className="mt-4 font-mono text-xs space-y-1.5 flex-1">
                <div className="flex justify-between"><span>Table 7</span><span>#22222288</span></div>
                <div className="flex justify-between"><span>Method</span><span>{method}</span></div>
                <div className="flex justify-between"><span>Bill total</span><span>₹{TOTAL.toLocaleString("en-IN")}</span></div>
                {split && <div className="flex justify-between"><span>Split</span><span>{people} × ₹{per.toLocaleString("en-IN")}</span></div>}
                <div className={`border-t border-dashed pt-2 flex justify-between font-bold text-sm ${dark ? "border-white/20" : "border-black/20"}`}><span>Paid</span><span>₹{(split ? per * people : TOTAL).toLocaleString("en-IN")}</span></div>
              </div>
              <button type="button" aria-label="Reset demo" onClick={reset} className={`min-h-[44px] rounded-2xl font-semibold flex items-center justify-center gap-2 ${dark ? "bg-white/10" : "bg-black/5"}`}><RotateCcw size={15} />Reset</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

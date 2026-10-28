import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, Plus, Check, ShoppingBag } from "lucide-react";
import Img from "../ui/Img.js";
import { images } from "../../assets/images/imageUrls.js";

const DISHES = [
  { id: 1, name: "Butter Chicken", price: 360, img: images.dishCurry },
  { id: 2, name: "Chicken Biryani", price: 320, img: images.dishBiryani },
  { id: 3, name: "Creamy Pasta", price: 280, img: images.dishPasta },
  { id: 4, name: "Chocolate Torte", price: 190, img: images.dishDessert },
];
const STEPS = ["Placed", "Preparing", "Ready"];

/** The guest side: scan, pick, order, watch it cook. A working phone you can tap. */
export default function QrPhone() {
  const [screen, setScreen] = useState("scan");
  const [cart, setCart] = useState({});
  const [step, setStep] = useState(0);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = DISHES.reduce((s, d) => s + (cart[d.id] || 0) * d.price, 0);
  useEffect(() => {
    if (screen !== "track") return undefined;
    setStep(0);
    const a = setTimeout(() => setStep(1), 1600);
    const b = setTimeout(() => setStep(2), 3600);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [screen]);
  const reset = () => { setCart({}); setScreen("scan"); };

  return (
    <div className="mx-auto w-[min(100%,300px)]">
      <div className="rounded-[2.6rem] bg-ink p-2.5 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]">
        <div className="relative h-[560px] overflow-hidden rounded-[2.1rem] bg-white text-ink">
          <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" />
          <AnimatePresence mode="wait">
            {screen === "scan" && (
              <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="flex h-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-white to-beige px-6 text-center">
                <div className="relative flex h-44 w-44 items-center justify-center rounded-3xl border-[6px] border-ink bg-white">
                  <QrCode size={110} strokeWidth={1.4} />
                  <motion.span className="absolute inset-x-2 h-0.5 bg-amber shadow-[0_0_14px_3px_rgba(243,55,22,0.7)]" animate={{ top: ["8%", "90%", "8%"] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
                </div>
                <p className="font-display text-lg font-extrabold">Table 12</p>
                <button type="button" onClick={() => setScreen("menu")} className="btn-primary">Scan to order</button>
              </motion.div>
            )}
            {screen === "menu" && (
              <motion.div key="menu" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex h-full flex-col px-4 pb-4 pt-9">
                <p className="font-display text-base font-extrabold">Menu</p>
                <ul className="mt-3 flex-1 space-y-2.5 overflow-y-auto pr-0.5">
                  {DISHES.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 rounded-2xl bg-beige p-2">
                      <Img src={d.img} alt={d.name} className="h-14 w-14 shrink-0 rounded-xl" />
                      <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{d.name}</p><p className="text-[11px] text-ink/50">₹{d.price}</p></div>
                      <button type="button" aria-label={`Add ${d.name}`} onClick={() => setCart((c) => ({ ...c, [d.id]: (c[d.id] || 0) + 1 }))} style={{ minHeight: 0 }} className="flex h-8 min-w-8 items-center justify-center rounded-full bg-ink px-2 text-xs font-bold text-cream">
                        {cart[d.id] ? cart[d.id] : <Plus size={14} />}
                      </button>
                    </li>
                  ))}
                </ul>
                <motion.button type="button" disabled={!count} onClick={() => setScreen("track")} animate={{ opacity: count ? 1 : 0.4 }} className="btn-primary mt-3 w-full">
                  <ShoppingBag size={16} /> {count ? `Order · ₹${total}` : "Add a dish"}
                </motion.button>
              </motion.div>
            )}
            {screen === "track" && (
              <motion.div key="track" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
                <motion.span key={step} initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 14 }} className="flex h-20 w-20 items-center justify-center rounded-full bg-amber text-white"><Check size={36} strokeWidth={3} /></motion.span>
                <p className="font-display text-lg font-extrabold">{STEPS[step]}</p>
                <ol className="flex w-full items-center gap-1.5">
                  {STEPS.map((s, i) => (<li key={s} className="flex-1"><span className={`block h-1.5 rounded-full transition-colors duration-500 ${i <= step ? "bg-amber" : "bg-ink/10"}`} /><span className="mt-1.5 block text-[10px] font-semibold text-ink/50">{s}</span></li>))}
                </ol>
                {step === 2 && <button type="button" onClick={reset} className="btn-dark">Order again</button>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

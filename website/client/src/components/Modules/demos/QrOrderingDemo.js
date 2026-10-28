import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Minus, ShoppingBag, Check, ScanLine, ChevronLeft, ChefHat, BellRing, ReceiptText } from "lucide-react";
import { PhoneFrame, CountUp } from "../../Kit/Kit.js";
import { images } from "../../../assets/images/imageUrls.js";

const CATS = ["Mains", "Rice", "Drinks", "Sweets"];
const DISHES = [
  { id: 1, cat: "Mains", name: "Butter Curry", price: 320, img: images.dishCurry },
  { id: 2, cat: "Mains", name: "Creamy Penne", price: 280, img: images.dishPasta },
  { id: 3, cat: "Rice", name: "Dum Biryani", price: 360, img: images.dishBiryani },
  { id: 4, cat: "Drinks", name: "Mint Cooler", price: 120, img: images.dishDrink },
  { id: 5, cat: "Sweets", name: "Choco Lava", price: 180, img: images.dishDessert },
  { id: 6, cat: "Rice", name: "Veg Pulao", price: 240, img: images.dishBiryani },
];
const STAGES = [
  { k: "Placed", icon: ReceiptText },
  { k: "Preparing", icon: ChefHat },
  { k: "Ready", icon: BellRing },
];
const GRID = 15;
const qrCells = Array.from({ length: GRID * GRID }, (_, i) => {
  const x = i % GRID, y = Math.floor(i / GRID);
  const corner = (cx, cy) => {
    const lx = x - cx, ly = y - cy;
    if (lx < 0 || ly < 0 || lx > 4 || ly > 4) return null;
    const ring = lx === 0 || ly === 0 || lx === 4 || ly === 4;
    return ring || (lx === 2 && ly === 2);
  };
  const c = corner(0, 0) ?? corner(GRID - 5, 0) ?? corner(0, GRID - 5);
  if (c !== null) return c;
  return ((x * 7 + y * 13 + x * y) % 5) < 2;
});

const inr = (n) => `₹${n.toLocaleString("en-IN")}`;

export default function QrOrderingDemo({ dark = false }) {
  const [screen, setScreen] = useState("splash"); // splash | menu | cart | status
  const [cat, setCat] = useState("Mains");
  const [cart, setCart] = useState({});
  const [stage, setStage] = useState(0);
  const [scanning, setScanning] = useState(false);

  const lines = useMemo(() => DISHES.filter((d) => cart[d.id]).map((d) => ({ ...d, qty: cart[d.id] })), [cart]);
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const add = (id, d = 1) => setCart((c) => { const q = Math.max(0, (c[id] || 0) + d); const n = { ...c }; if (q) n[id] = q; else delete n[id]; return n; });

  useEffect(() => {
    if (screen !== "status" || stage >= 2) return undefined;
    const t = setTimeout(() => setStage((s) => s + 1), 2200);
    return () => clearTimeout(t);
  }, [screen, stage]);

  const scan = () => {
    if (scanning) return;
    setScanning(true);
    setTimeout(() => { setScanning(false); setScreen("menu"); }, 1400);
  };
  const reset = () => { setCart({}); setStage(0); setScreen("splash"); setCat("Mains"); };

  const btn = "min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-full font-semibold";
  const muted = dark ? "text-white/60" : "text-black/50";

  return (
    <div className="w-full grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center justify-items-center">
      <div className="w-full max-w-[290px]">
        <PhoneFrame>
          <div className="h-full flex flex-col pt-9 text-ink font-body text-[13px]">
            <AnimatePresence mode="wait" initial={false}>
              {screen === "splash" && (
                <motion.div key="s" className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }}>
                  <div className="w-16 h-16 rounded-3xl bg-amber text-white grid place-items-center font-display text-2xl font-bold">D</div>
                  <div className="font-display font-semibold text-lg">Sam Cafe</div>
                  <div className="text-black/50 text-xs">Scan the code to start</div>
                </motion.div>
              )}
              {screen === "menu" && (
                <motion.div key="m" className="flex-1 min-h-0 flex flex-col" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="px-4 pb-2 flex items-center justify-between">
                    <div className="font-display font-semibold text-base">Table 7</div>
                    <span className="text-[11px] text-black/50">Dine-in</span>
                  </div>
                  <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                    {CATS.map((c) => (
                      <button key={c} type="button" aria-label={`Category ${c}`} onClick={() => setCat(c)} className={`${btn} px-3.5 text-xs shrink-0 transition-colors ${cat === c ? "bg-ink text-white" : "bg-black/5 text-black/70"}`}>{c}</button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto px-3 pb-20 space-y-2">
                    <AnimatePresence mode="popLayout">
                      {DISHES.filter((d) => d.cat === cat).map((d) => (
                        <motion.div layout key={d.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="flex items-center gap-2.5 bg-white rounded-2xl p-2 shadow-sm">
                          <img src={d.img} alt={d.name} className="w-14 h-14 rounded-xl object-cover" draggable="false" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">{d.name}</div>
                            <div className="text-black/50 text-xs">{inr(d.price)}</div>
                          </div>
                          <motion.button whileTap={{ scale: 0.88 }} type="button" aria-label={`Add ${d.name}`} onClick={() => add(d.id)} className={`${btn} bg-amber text-white relative`}>
                            <Plus size={18} />
                            {cart[d.id] > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-ink text-white text-[10px] grid place-items-center">{cart[d.id]}</span>}
                          </motion.button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                  <AnimatePresence>
                    {count > 0 && (
                      <motion.button type="button" aria-label="Open cart" onClick={() => setScreen("cart")} initial={{ y: 70, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 70, opacity: 0 }} transition={{ type: "spring", stiffness: 340, damping: 26 }} className="absolute left-3 right-3 bottom-3 min-h-[48px] rounded-2xl bg-ink text-white px-4 flex items-center justify-between shadow-xl">
                        <span className="flex items-center gap-2"><ShoppingBag size={16} />{count} item{count > 1 ? "s" : ""}</span>
                        <CountUp to={total} prefix="₹" duration={0.5} className="font-display font-semibold" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
              {screen === "cart" && (
                <motion.div key="c" className="flex-1 min-h-0 flex flex-col px-3 pb-3" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}>
                  <button type="button" aria-label="Back to menu" onClick={() => setScreen("menu")} className={`${btn} self-start gap-1 px-2 text-xs`}><ChevronLeft size={16} />Menu</button>
                  <div className="font-display font-semibold text-base px-1 pb-2">Your order</div>
                  <div className="flex-1 overflow-y-auto space-y-1.5">
                    <AnimatePresence initial={false}>
                      {lines.map((l) => (
                        <motion.div layout key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5">
                          <span className="flex-1 truncate font-semibold">{l.name}</span>
                          <button type="button" aria-label={`Remove one ${l.name}`} onClick={() => add(l.id, -1)} className={`${btn} bg-black/5`}><Minus size={14} /></button>
                          <span className="w-4 text-center">{l.qty}</span>
                          <button type="button" aria-label={`Add one ${l.name}`} onClick={() => add(l.id)} className={`${btn} bg-black/5`}><Plus size={14} /></button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {!lines.length && <div className="text-center text-black/40 pt-8">Cart is empty</div>}
                  </div>
                  <div className="flex justify-between py-2 px-1 font-semibold"><span>Total</span><CountUp to={total} prefix="₹" duration={0.4} /></div>
                  <button type="button" disabled={!count} aria-label="Place order" onClick={() => { setStage(0); setScreen("status"); }} className={`${btn} w-full rounded-2xl bg-amber text-white disabled:opacity-40`}>Place order</button>
                </motion.div>
              )}
              {screen === "status" && (
                <motion.div key="t" className="flex-1 flex flex-col items-center justify-center gap-5 px-5" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <div className="font-display font-semibold text-base">Order #22222288</div>
                  <div className="w-full space-y-3">
                    {STAGES.map((s, i) => {
                      const Icon = s.icon, done = i < stage, on = i === stage;
                      return (
                        <div key={s.k} className="flex items-center gap-3">
                          <motion.div animate={{ backgroundColor: done || on ? "#f33716" : "#e5e5e5", scale: on ? 1.12 : 1 }} className="w-10 h-10 rounded-full grid place-items-center text-white">
                            {done || (on && stage === 2) ? <Check size={18} /> : <Icon size={17} />}
                          </motion.div>
                          <span className={`font-semibold ${i <= stage ? "text-ink" : "text-black/30"}`}>{s.k}</span>
                          {on && stage < 2 && <motion.span className="ml-auto w-2 h-2 rounded-full bg-amber" animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} />}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-xs text-black/50">{stage === 2 ? "Enjoy your meal" : `${inr(total)} · ${count} items`}</div>
                  <button type="button" aria-label="Start over" onClick={reset} className={`${btn} px-5 bg-black/5 text-xs`}>New order</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </PhoneFrame>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className={`relative p-4 rounded-3xl shadow-xl ${dark ? "bg-white/10" : "bg-white"}`}>
          <div className="relative grid gap-[3px] w-[min(60vw,200px)] aspect-square" style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)` }}>
            {qrCells.map((on, i) => (
              <motion.span key={i} className="rounded-[2px]" style={{ background: on ? "#000000" : "transparent" }} animate={{ opacity: scanning && on ? [1, 0.4, 1] : 1 }} transition={{ delay: (i % GRID) * 0.01, duration: 0.5 }} />
            ))}
            <motion.div className="absolute left-[-6px] right-[-6px] h-[3px] rounded bg-amber shadow-[0_0_16px_4px_rgba(243,55,22,.6)]" initial={{ top: "0%" }} animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: scanning ? 0.7 : 3, repeat: Infinity, ease: "easeInOut" }} />
          </div>
        </div>
        <div className={`text-xs ${muted}`}>Table 7 · Scan to order</div>
        <button type="button" aria-label="Scan QR code" onClick={screen === "splash" ? scan : reset} className={`${btn} px-6 gap-2 bg-amber text-white shadow-lg`}>
          <ScanLine size={16} />{screen === "splash" ? (scanning ? "Scanning…" : "Scan") : "Scan again"}
        </button>
      </div>
    </div>
  );
}

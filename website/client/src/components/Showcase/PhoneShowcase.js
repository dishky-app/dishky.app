import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, ScanLine, Check } from "lucide-react";
import { Phone, Photo, useInterval } from "../ui/kit.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import { bySlug } from "../../data/modules.js";
import { MOTION } from "./motion.js";

const Row = ({ art, name, price }) => (
  <div className="flex items-center gap-3 rounded-2xl bg-cream p-2">
    <Photo art={art} artDark={false} className="h-12 w-12 shrink-0 rounded-xl" />
    <span className="flex-1 text-xs font-semibold">{name}</span>
    <span className="text-xs font-bold text-amber">{price}</span>
  </div>
);

// Illustrative guest screens. Nothing here orders or charges anything.
const stages = [
  {
    id: "qr", label: "Scan the table QR", pain: "Waiting for a menu", fix: "Scan and order",
    screen: () => (
      <div className="relative h-full">
        <Photo art="platform" className="absolute inset-0" />
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute left-1/2 top-[38%] h-40 w-40 -translate-x-1/2 -translate-y-1/2">
          {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl"].map((c) => (
            <span key={c} className={`absolute h-9 w-9 border-amber ${c}`} />
          ))}
          <motion.span className="absolute inset-x-2 h-0.5 bg-amber shadow-[0_0_14px_#f33716]" animate={{ top: ["8%", "92%", "8%"] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }} />
          <ScanLine className="absolute inset-0 m-auto text-white/70" size={44} />
        </div>
        <p className="absolute inset-x-0 bottom-10 text-center font-display text-sm font-bold text-white">Table 12 · Point at the code</p>
      </div>
    ),
  },
  {
    id: "menu", label: "Browse the menu", pain: "Printed, outdated menus", fix: "Always the live menu",
    screen: () => (
      <div className="h-full space-y-2.5 p-4 pt-9">
        <p className="font-display text-base font-bold">Mains</p>
        <div className="flex gap-1.5">{["Starters", "Mains", "Drinks", "Desserts"].map((c, i) => <span key={c} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${i === 1 ? "bg-ink text-cream" : "bg-cream"}`}>{c}</span>)}</div>
        <Row art="food-curry" name="Paneer Butter Masala" price="₹220" />
        <Row art="food-biryani" name="Chicken Biryani" price="₹260" />
        <Row art="food-pasta" name="Creamy Pasta" price="₹240" />
        <Row art="food-pizza" name="Margherita" price="₹280" />
      </div>
    ),
  },
  {
    id: "dish", label: "See the dish", pain: "What's in this dish?", fix: "Ingredients shown",
    screen: () => (
      <div className="flex h-full flex-col">
        <Photo art="food-biryani" artDark={false} className="h-48 w-full shrink-0" />
        <div className="flex flex-1 flex-col p-4">
          <p className="font-display text-base font-bold">Chicken Biryani</p>
          <p className="text-[11px] text-ink/50">Slow-cooked, served with raita</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{["Basmati rice", "Chicken", "Saffron", "Mint"].map((t) => <span key={t} className="rounded-full bg-cream px-2.5 py-1 text-[10px] font-medium">{t}</span>)}</div>
          <button type="button" tabIndex={-1} className="mt-auto rounded-full bg-ink py-2.5 text-xs font-semibold text-cream">Add to cart · ₹260</button>
        </div>
      </div>
    ),
  },
  {
    id: "cart", label: "Build the cart", pain: "Flagging down a waiter", fix: "Order from the table",
    screen: () => (
      <div className="flex h-full flex-col space-y-2.5 p-4 pt-9">
        <p className="font-display text-base font-bold">Your cart</p>
        <Row art="food-biryani" name="Chicken Biryani × 1" price="₹260" />
        <Row art="food-curry" name="Paneer Butter Masala × 1" price="₹220" />
        <Row art="food-drink" name="Cold Coffee × 2" price="₹180" />
        <div className="!mt-auto flex justify-between border-t border-ink/10 pt-3 text-sm font-bold"><span>Total</span><span>₹660</span></div>
      </div>
    ),
  },
  {
    id: "pay", label: "Pay from the phone", pain: "Waiting for the bill", fix: "Pay from the phone",
    screen: () => (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-ink/40">Amount due</p>
        <p className="font-display text-4xl font-extrabold">₹660</p>
        <div className="w-full space-y-2">{["Pay online", "Pay at the counter"].map((p, i) => <div key={p} className={`rounded-2xl border px-4 py-3 text-xs font-semibold ${i === 0 ? "border-amber bg-amber/10" : "border-ink/10"}`}>{p}</div>)}</div>
        <button type="button" tabIndex={-1} className="w-full rounded-full bg-amber py-2.5 text-xs font-bold text-white">Confirm</button>
      </div>
    ),
  },
  {
    id: "track", label: "Track the order", pain: "“Where's my food?”", fix: "Live tracking",
    screen: () => (
      <div className="h-full p-5 pt-10">
        <p className="font-display text-base font-bold">Order #22222222</p>
        <p className="text-[11px] text-ink/50">Table 12</p>
        <ol className="mt-6 space-y-5">
          {["Received", "Cooking", "Ready", "Served"].map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <motion.span className={`flex h-7 w-7 items-center justify-center rounded-full text-white ${i < 2 ? "bg-amber" : "bg-ink/15"}`} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ delay: 0.1 * i, type: "spring", stiffness: 260, damping: 16 }}>
                {i < 2 ? <Check size={14} /> : <span className="text-[10px]">{i + 1}</span>}
              </motion.span>
              <span className={`text-sm font-semibold ${i < 2 ? "" : "text-ink/35"}`}>{s}</span>
            </li>
          ))}
        </ol>
      </div>
    ),
  },
];

/**
 * Mobile-first guest showcase: one big phone, six stages. Pick a stage, use
 * the arrows, or let it advance on its own while it is on screen.
 */
export default function PhoneShowcase() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const box = useRef(null);
  const inView = useInView(box, { amount: 0.4 });
  const reduced = useReducedMotion();
  const n = stages.length;
  const s = stages[i];
  useInterval(() => setI((v) => (v + 1) % n), 4200, inView && !paused && !reduced);
  const pick = (v) => { setI((v + n) % n); setPaused(true); };

  return (
    <div
      ref={box}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      className="relative overflow-hidden rounded-[2.5rem] bg-ink p-5 text-cream md:p-10"
    >
      <Photo art="experience" className="absolute inset-0 opacity-35" />
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-black/80" />
      <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr] lg:gap-12">
        <div className="order-2 lg:order-1">
          <div role="tablist" aria-label="Guest journey" className="dk-noscroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible">
            {stages.map((st, k) => (
              <button
                key={st.id}
                type="button"
                role="tab"
                aria-selected={k === i}
                onClick={() => pick(k)}
                className={`flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-left text-sm font-semibold transition-all duration-500 lg:rounded-2xl lg:py-3 ${k === i ? "bg-amber text-white lg:translate-x-2" : "bg-white/10 text-cream/70 hover:bg-white/15"}`}
              >
                <span className="font-display text-xs opacity-70">{String(k + 1).padStart(2, "0")}</span>
                <span className="whitespace-nowrap">{st.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="relative mx-auto w-fit">
            <motion.span className="absolute -left-6 top-16 z-10 hidden rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-ink shadow-xl md:block" animate={reduced ? {} : { y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity }}>
              No app to install
            </motion.span>
            <motion.span className="absolute -right-8 bottom-24 z-10 hidden rounded-full bg-amber px-3 py-1.5 text-[11px] font-bold text-white shadow-xl md:block" animate={reduced ? {} : { y: [0, 8, 0] }} transition={{ duration: 5, repeat: Infinity }}>
              From the table
            </motion.span>
            <Phone>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={s.id}
                  className="absolute inset-0"
                  initial={{ opacity: 0, x: reduced ? 0 : 36 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reduced ? 0 : -36 }}
                  transition={{ duration: MOTION.durFast, ease: MOTION.ease }}
                >
                  {s.screen()}
                </motion.div>
              </AnimatePresence>
            </Phone>
          </div>
          <p className="mt-3 text-center text-[11px] text-cream/50">Illustrative screens</p>
        </div>

        <div className="order-3 text-center lg:text-left">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={s.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: MOTION.durFast, ease: MOTION.ease }}>
              <p className="font-display text-base font-bold text-cream/45 line-through decoration-amber decoration-2">{s.pain}</p>
              <h3 className="mt-1 font-display text-3xl font-extrabold leading-tight md:text-4xl" aria-live="polite">{s.fix}</h3>
            </motion.div>
          </AnimatePresence>
          <div className="mt-6 flex items-center justify-center gap-3 lg:justify-start">
            <button type="button" onClick={() => pick(i - 1)} aria-label="Previous stage" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 hover:bg-white/10"><ChevronLeft size={18} /></button>
            <button type="button" onClick={() => pick(i + 1)} aria-label="Next stage" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 hover:bg-white/10"><ChevronRight size={18} /></button>
            <Link to={bySlug["guest-app"].path} className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink">
              Explore the Guest App <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

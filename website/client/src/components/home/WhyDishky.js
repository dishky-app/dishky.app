import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Sunrise, UtensilsCrossed, Moon, Lock, ChefHat, Megaphone, CalendarHeart, Users, GitBranch, Boxes, ScanLine, Wallet, BellRing, AlertTriangle, BarChart3, ListChecks, TrendingUp, Heart } from "lucide-react";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import Reveal from "../ui/Reveal.js";
import Img from "../ui/Img.js";
import { images } from "../../assets/images/imageUrls.js";

/* ---- 1. Ten tools, or one ------------------------------------------- */
const TOOLS = ["Orders", "Menu", "Stock", "Staff", "Kitchen", "Bookings", "Guests", "Payments", "Reports", "Promotion"];
const SCATTER = [[8, 14, -8], [34, 6, 6], [62, 16, -5], [80, 4, 9], [16, 46, 7], [46, 40, -9], [74, 48, 5], [10, 78, -6], [40, 74, 8], [70, 80, -7]];

function Merge() {
  const [one, setOne] = useState(false);
  return (
    <div className="rounded-[2rem] border border-ink/10 bg-beige p-5 sm:p-8">
      <div className="relative h-72 sm:h-80">
        {TOOLS.map((t, i) => (
          <motion.span
            key={t}
            className="absolute rounded-full border border-ink/15 bg-white px-4 py-2 font-display text-sm font-bold shadow-sm"
            animate={one ? { left: "50%", top: "46%", x: "-50%", y: "-50%", rotate: 0, scale: 0.2, opacity: 0 } : { left: `${SCATTER[i][0]}%`, top: `${SCATTER[i][1]}%`, x: 0, y: 0, rotate: SCATTER[i][2], scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 70, damping: 15, delay: one ? i * 0.03 : 0 }}
          >{t}</motion.span>
        ))}
        <motion.div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-ink px-8 py-5 text-center shadow-2xl" animate={{ scale: one ? 1 : 0.4, opacity: one ? 1 : 0 }} transition={{ type: "spring", stiffness: 120, damping: 14, delay: one ? 0.35 : 0 }}>
          <p className="font-display text-3xl font-extrabold text-amber sm:text-5xl">DISHKY</p>
          <p className="mt-1 text-xs font-semibold text-cream/60">One platform</p>
        </motion.div>
      </div>
      <div className="mx-auto mt-2 flex w-fit rounded-full bg-ink/10 p-1">
        {[[false, "Ten tools"], [true, "With Dishky"]].map(([v, l]) => (
          <button key={l} type="button" onClick={() => setOne(v)} style={{ minHeight: 40 }} className={`rounded-full px-6 text-sm font-bold transition ${one === v ? "bg-ink text-cream" : "text-ink/55"}`}>{l}</button>
        ))}
      </div>
    </div>
  );
}

/* ---- 2. What others miss -------------------------------------------- */
const ROWS = [
  { icon: ScanLine, label: "QR ordering", other: true },
  { icon: Wallet, label: "Payment tracking", other: true },
  { icon: ChefHat, label: "Kitchen display & duties", other: false },
  { icon: Megaphone, label: "Promotion on a social platform", other: false },
  { icon: CalendarHeart, label: "Event collaboration", other: false },
  { icon: Users, label: "Staff, shifts & service", other: false },
  { icon: Boxes, label: "Auto stock deduction", other: false },
  { icon: GitBranch, label: "Multi-branch control", other: false },
];

function Compare() {
  const [only, setOnly] = useState(false);
  const rows = only ? ROWS.filter((r) => !r.other) : ROWS;
  return (
    <div className="rounded-[2rem] bg-ink p-5 text-cream sm:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-[1fr_72px_72px] items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-cream/45 sm:grid-cols-[1fr_96px_96px]">
          <span /><span className="text-center">Typical app</span><span className="text-center text-amber">Dishky</span>
        </div>
      </div>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {rows.map(({ icon: Icon, label, other }) => (
            <motion.li key={label} layout initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30, height: 0 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className={`grid grid-cols-[1fr_72px_72px] items-center gap-2 rounded-2xl px-3 py-3 sm:grid-cols-[1fr_96px_96px] ${other ? "bg-cream/[0.05]" : "bg-amber/10 ring-1 ring-amber/30"}`}>
              <span className="flex min-w-0 items-center gap-3 text-sm font-semibold"><Icon size={17} className="shrink-0 text-amber" /><span className="truncate">{label}</span></span>
              <span className="flex justify-center">{other ? <Check size={18} className="text-cream/50" /> : <X size={18} className="text-cream/25" />}</span>
              <span className="flex justify-center"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber text-ink"><Check size={15} strokeWidth={3} /></span></span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <button type="button" onClick={() => setOnly((o) => !o)} role="switch" aria-checked={only} style={{ minHeight: 44 }} className="mt-5 flex items-center gap-3 text-sm font-semibold text-cream/80">
        <span className={`relative h-6 w-11 rounded-full transition-colors ${only ? "bg-amber" : "bg-cream/20"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${only ? "left-[22px]" : "left-0.5"}`} /></span>
        Show only what others miss
      </button>
    </div>
  );
}

/* ---- 3. A day at the restaurant -------------------------------------- */
const DAY = [
  { t: "Opening", icon: Sunrise, img: images.cafeInterior, tone: "#ea2a0c", items: [[ListChecks, "Mise checklist ticked"], [Boxes, "Stock checked"], [Users, "Team marked in"]] },
  { t: "Lunch rush", icon: UtensilsCrossed, img: images.dishBiryani, tone: "#f33716", items: [[BellRing, "42 live tickets"], [ChefHat, "Stations balanced"], [AlertTriangle, "Paneer running low"]] },
  { t: "Evening", icon: Heart, img: images.dinnerEvent, tone: "#f66a55", items: [[Megaphone, "Offer featured"], [Heart, "Event night booked"], [TrendingUp, "Revenue climbing"]] },
  { t: "Closing", icon: Moon, img: images.restaurantWarm, tone: "#e4290c", items: [[Wallet, "Cash matches orders"], [BarChart3, "Day report ready"], [Lock, "Shift handed over"]] },
];

function Day() {
  const [i, setI] = useState(1);
  const d = DAY[i];
  return (
    <div className="overflow-hidden rounded-[2rem] bg-charcoal text-cream">
      <div className="relative h-72 sm:h-96">
        <AnimatePresence mode="wait">
          <motion.div key={i} className="absolute inset-0" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <Img src={d.img} tone={d.tone} className="h-full w-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-x-5 bottom-5 sm:inset-x-8 sm:bottom-8">
          <p className="font-display text-3xl font-extrabold sm:text-5xl">{d.t}</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {d.items.map(([Icon, text], n) => (
                <motion.li key={`${i}-${text}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.15 + n * 0.1 }} className="flex items-center gap-2.5 rounded-2xl bg-white/15 px-3.5 py-3 text-sm font-semibold backdrop-blur-md">
                  <Icon size={17} className="shrink-0 text-amber" /> {text}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </div>
      <div className="px-5 py-5 sm:px-8">
        <input type="range" min="0" max={DAY.length - 1} step="1" value={i} onChange={(e) => setI(Number(e.target.value))} aria-label="Time of day" className="w-full accent-amber" style={{ minHeight: 0 }} />
        <div className="mt-1 flex justify-between">
          {DAY.map((x, n) => { const I = x.icon; return (
            <button key={x.t} type="button" onClick={() => setI(n)} style={{ minHeight: 40 }} className={`flex items-center gap-1.5 text-xs font-bold transition ${n === i ? "text-amber" : "text-cream/45"}`}><I size={14} />{x.t}</button>); })}
        </div>
      </div>
    </div>
  );
}

export default function WhyDishky() {
  return (
    <section id="why-dishky" className="bg-cream" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="container-dishky">
        <SectionHeading title={"WHY\nDISHKY?"} subtitle="Because a restaurant day is long." size="xl" />
        <Reveal className="mt-10 md:mt-14"><Merge /></Reveal>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Reveal dir="left"><Compare /></Reveal>
          <Reveal dir="right"><Day /></Reveal>
        </div>
      </div>
    </section>
  );
}

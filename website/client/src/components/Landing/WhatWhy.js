import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Smartphone, ChefHat, LayoutDashboard, Zap, Megaphone, CalendarHeart, Link2 } from "lucide-react";
import { Photo, Reveal, CountUp, Marquee, useInterval } from "../ui/kit.js";
import { images } from "../../assets/images/imageUrls.js";

const NODES = [
  { k: "guest", icon: Smartphone, label: "Guest", photo: images.serviceOrder, line: "Scans the table QR. Orders. Pays. Tracks." },
  { k: "kitchen", icon: ChefHat, label: "Kitchen", photo: images.kitchenAction, line: "A live board. Tap to cook, tap to serve." },
  { k: "owner", icon: LayoutDashboard, label: "Owner", photo: images.restaurantInterior1, line: "Sales, stock, staff and branches, live." },
];

/** What is Dishky: three nodes joined by a live order moving between them. */
export function WhatSection() {
  const [a, setA] = useState(0);
  const [auto, setAuto] = useState(true);
  useInterval(() => setA((v) => (v + 1) % 3), 3200, auto);
  const N = NODES[a];
  return (
    <section id="what" className="relative overflow-hidden bg-cream" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="container-dishky">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="heading-lg text-ink">
            One platform. <span className="text-amber">Three screens.</span> Always in sync.
          </h2>
        </Reveal>

        <div className="mt-12 grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <div className="relative flex items-center justify-between px-2 py-6">
              <svg className="absolute inset-x-8 top-1/2 h-2 w-[calc(100%-4rem)] -translate-y-1/2" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 2">
                <line x1="0" y1="1" x2="100" y2="1" stroke="#f33716" strokeWidth="0.6" strokeDasharray="2 2" className="dk-dash" />
              </svg>
              <motion.span
                aria-hidden="true"
                className="absolute top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-amber dk-ping"
                animate={{ left: `${10 + a * 40}%` }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
              {NODES.map((n, i) => (
                <button
                  key={n.k}
                  type="button"
                  onClick={() => { setAuto(false); setA(i); }}
                  className="relative z-20 flex flex-col items-center gap-2"
                  aria-pressed={a === i}
                >
                  <span className={`flex h-20 w-20 items-center justify-center rounded-3xl border-2 transition-all duration-500 ${a === i ? "scale-110 border-amber bg-amber text-white shadow-[0_20px_40px_-12px_rgba(243,55,22,0.6)]" : "border-ink/10 bg-white text-ink/60 hover:border-amber/50"}`}>
                    <n.icon size={30} />
                  </span>
                  <span className="font-display text-sm font-bold">{n.label}</span>
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.p key={a} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 text-center font-display text-xl font-bold text-ink">
                {N.line}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="relative h-[340px] overflow-hidden rounded-3xl shadow-2xl sm:h-[420px]">
            <AnimatePresence mode="wait">
              <motion.div key={a} initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} className="absolute inset-0">
                <Photo src={N.photo} className="h-full w-full" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              </motion.div>
            </AnimatePresence>
            <div className="absolute bottom-5 left-5 flex items-center gap-3 rounded-full bg-white/95 px-4 py-2.5 shadow-xl">
              <N.icon size={18} className="text-amber" />
              <span className="font-display text-sm font-bold text-ink">{N.label} view</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Chaos vs order slider */
const NOTES = ["Table 4 wants the bill!", "Out of paneer??", "Who's on tonight?", "Order lost again", "Cash short ₹400", "Event poster?"];

function Chaos() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#262626]">
      <Photo src={images.kitchenAction} className="absolute inset-0 opacity-30" />
      {NOTES.map((t, i) => (
        <motion.div
          key={t}
          animate={{ rotate: [(i % 2 ? 4 : -4), (i % 2 ? -3 : 3), (i % 2 ? 4 : -4)] }}
          transition={{ duration: 3 + i * 0.4, repeat: Infinity }}
          className="absolute max-w-[9rem] rounded-sm bg-[#f9998a] p-3 font-body text-xs font-bold text-[#252525] shadow-lg"
          style={{ left: `${6 + (i % 3) * 30}%`, top: `${10 + Math.floor(i / 3) * 40 + (i % 2) * 8}%` }}
        >
          {t}
        </motion.div>
      ))}
      <p className="absolute bottom-4 left-5 font-display text-2xl font-extrabold text-white/80">Without Dishky</p>
    </div>
  );
}

function Order() {
  const rows = [["Orders", "live", Zap], ["Stock", "all good", Zap], ["Staff", "5 on shift", Zap], ["Events", "1 sold out", CalendarHeart], ["Promotion", "running", Megaphone]];
  return (
    <div className="absolute inset-0 bg-ink p-5 text-cream">
      <p className="font-display text-2xl font-extrabold text-amber">With Dishky</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {rows.map(([n, v, I]) => (
          <div key={n} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.07)" }}>
            <I size={16} className="text-amber" />
            <p className="mt-2 text-xs text-cream/50">{n}</p>
            <p className="font-display text-base font-bold">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const MISSED = ["Event collaboration", "Promotion by Dishky", "Kitchen display + discipline", "WhatsApp campaigns", "Staff attendance & salary", "Audit logs", "A link for every table", "Recipe-linked stock", "Mise & cleaning checks"];

export function WhySection() {
  const [pos, setPos] = useState(50);
  return (
    <section data-nav-theme="dark" className="relative overflow-hidden bg-ink text-cream" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="container-dishky">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="heading-lg">Why Dishky? <span className="text-amber">Drag to see.</span></h2>
        </Reveal>

        <Reveal className="mx-auto mt-10 max-w-4xl">
          <div className="relative h-[360px] select-none overflow-hidden rounded-3xl border border-white/10 shadow-2xl sm:h-[440px]">
            <Chaos />
            <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
              <Order />
            </div>
            <div className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white" style={{ left: `${pos}%` }}>
              <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-amber text-lg font-bold text-white shadow-xl dk-ping">⇆</span>
            </div>
            <input
              type="range" min={0} max={100} value={pos}
              onChange={(e) => setPos(+e.target.value)}
              aria-label="Compare without and with Dishky"
              className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
              style={{ minHeight: 0 }}
            />
          </div>
        </Reveal>

        <Reveal className="mt-14">
          <p className="mb-5 text-center font-display text-lg font-bold text-cream/80">What other apps miss</p>
          <Marquee speed={45}>
            {MISSED.map((t) => (
              <span key={t} className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-cream">
                <Link2 size={14} className="text-amber" /> {t}
              </span>
            ))}
          </Marquee>
        </Reveal>

        <div className="mt-14 grid gap-6 text-center sm:grid-cols-3">
          {[[15, "", "Modules in one platform"], [3, "", "Screens always in sync"], [1, "", "Account for every branch"]].map(([to, s, l]) => (
            <Reveal key={l}>
              <p className="font-display text-6xl font-extrabold text-amber"><CountUp to={to} suffix={s} /></p>
              <p className="mt-1 text-sm text-cream/60">{l}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

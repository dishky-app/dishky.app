import React, { useState } from "react";
import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const TRAYS = [["Starters tray", 10], ["Rice & breads tray", 12], ["Curries tray", 10], ["Dessert tray", 15]];
const KRAFT = { backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.04) 0 2px, transparent 2px 5px)" };

function Tray({ n, per, c, set }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-[#e4290c] bg-[#dedede] p-5 text-center">
      <div className="relative mb-3 flex h-20 w-full items-end justify-center gap-1">
        {Array.from({ length: Math.min(c, 6) }, (_, i) => <motion.span key={i} initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="h-12 w-10 rounded-md border-2 border-[#e4290c] bg-[#f66953]" />)}
        {c === 0 && <span className="text-xs text-[#e4290c]/60">empty</span>}
      </div>
      <p className="font-display text-base font-extrabold">{n}</p>
      <p className="text-[11px] text-[#e4290c]">serves about {per} each</p>
      <div className="mt-3 flex items-center gap-3">
        <button aria-label={`Fewer ${n}`} onClick={() => set(Math.max(0, c - 1))} className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#262626]"><Minus size={16} /></button>
        <span className="w-6 font-display text-xl font-bold">{c}</span>
        <button aria-label={`More ${n}`} onClick={() => set(c + 1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#262626] text-white"><Plus size={16} /></button>
      </div>
    </div>
  );
}

export default function CateringPage({ m }) {
  const kraft = mk({ bg: "#ffffff", ink: "#1c1c1c", card: "#dedede", accent: "#e4290c" });
  const cream = mk({ bg: "#f6f6f6", ink: "#1c1c1c", card: "#ffffff", accent: "#e6290c" });
  const dark = mk({ dark: true, bg: "#121212", card: "rgba(255,255,255,0.06)", accent: "#f55e47", onAccent: "#121212" });
  const [q, setQ] = useState([1, 1, 2, 0]);
  const trays = q.reduce((a, b) => a + b, 0);
  const guests = q.reduce((a, c, i) => a + c * TRAYS[i][1], 0);
  return (
    <>
      <Sec t={kraft} style={{ ...heroPad, ...KRAFT }}>
        <HeroText m={m} t={kraft} tryLabel="Build an order" />
        <Reveal className="mt-8"><div className="rounded-[2rem] bg-[#f6f6f6] p-5 shadow-2xl md:p-8" style={{ border: "3px solid #1c1c1c" }}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="font-display text-xl font-extrabold">Build a catering order</p><span className="rounded-full bg-[#1c1c1c] px-4 py-2 text-sm font-bold text-white">{trays} trays · feeds about {guests}</span></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{TRAYS.map(([n, p], i) => <Tray key={n} n={n} per={p} c={q[i]} set={(v) => setQ((a) => a.map((x, k) => (k === i ? v : x)))} />)}</div>
          <p className="mt-4 text-xs" style={{ color: mute(kraft, 0.55) }}>Sample packages for illustration. Your own menu and pack sizes are set up with our team.</p>
        </div></Reveal>
      </Sec>
      <Block t={cream} left eyebrow="In the box" title="What catering orders include."><Features v="grid" m={m} t={cream} /></Block>
      <Block t={dark} title="The catering demo." eyebrow="Interactive"><TryDemo m={m} t={dark} /></Block>
      <Block t={cream} eyebrow="Enquiry to delivery" title="Order of events."><Journey v="timeline" m={m} t={cream} /></Block>
      <Sec t={kraft} style={KRAFT}><Stats v="big" m={m} t={kraft} /></Sec>
      <Block t={cream} eyebrow="The gap" title="Phone calls vs. a builder."><Gaps v="table" m={m} t={cream} /></Block>
      {m.extra && <Block t={dark} title="Another routine."><TryDemo m={m} t={dark} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={cream} left title="Who orders in bulk." eyebrow="Real moments"><Uses v="list" m={m} t={cream} /></Block>
      <Block t={dark} title="Live in three steps."><Steps v="big" m={m} t={dark} /></Block>
      <Block t={cream} title="Questions, answered."><Faq m={m} t={cream} /></Block>
    </>
  );
}

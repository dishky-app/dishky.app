import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const MAG = "#f33214", YEL = "#f56049", COL = [MAG, YEL, "#f55941", "#f88776", "#f55e47"];
const BAL = [[8, "#f55e47", 5.5], [20, MAG, 7], [74, "#f55941", 6.2], [88, YEL, 8]];

function Cake() {
  const [lit, setLit] = useState([true, true, true, true, true]);
  const out = lit.every((x) => !x);
  const [burst, setBurst] = useState(0);
  const blow = (i) => { const n = lit.map((x, k) => (k === i ? false : x)); setLit(n); if (n.every((x) => !x)) setBurst((b) => b + 1); };
  return (
    <div className="relative mx-auto w-64 text-center">
      <div className="flex justify-center gap-3">{lit.map((on, i) => (
        <button key={i} onClick={() => blow(i)} aria-label="Blow out candle" className="flex h-14 w-6 flex-col items-center justify-end">
          <AnimatePresence>{on && <motion.span key="f" initial={{ scale: 0 }} animate={{ scale: [1, 1.2, 1] }} exit={{ scale: 0, opacity: 0 }} transition={{ repeat: Infinity, duration: 0.7 }} className="mb-0.5 block h-4 w-3 rounded-full bg-gradient-to-t from-red-500 to-red-300" />}</AnimatePresence>
          <span className="h-7 w-2 rounded-sm" style={{ background: COL[i] }} />
        </button>
      ))}</div>
      <div className="mt-0 h-10 rounded-t-2xl" style={{ background: MAG }} /><div className="h-14 rounded-b-2xl" style={{ background: "#ffffff", border: `4px solid ${MAG}` }} />
      <p className="mt-3 font-display font-extrabold text-white">{out ? "🎉 Happy celebration!" : "Blow out the candles"}</p>
      <AnimatePresence>{burst > 0 && Array.from({ length: 26 }, (_, i) => <motion.span key={burst + "-" + i} initial={{ x: 0, y: 40, opacity: 1, scale: 1 }} animate={{ x: Math.cos(i * 0.9) * (90 + (i % 5) * 28), y: -Math.abs(Math.sin(i * 1.3)) * 190 + 40, opacity: 0, rotate: i * 80 }} transition={{ duration: 1.4 }} className="pointer-events-none absolute left-1/2 top-10 h-3 w-2" style={{ background: COL[i % 5] }} />)}</AnimatePresence>
    </div>
  );
}

export default function CelebrationsPage({ m }) {
  const party = mk({ dark: true, bg: "#0a0a0a", ink: "#ffffff", card: "#ffffff", accent: YEL, onAccent: "#121212" });
  const cream = mk({ bg: "#fafafa", card: "#ffffff", accent: MAG });
  const dusk = mk({ dark: true, bg: "#151515", card: "rgba(255,255,255,0.07)", accent: YEL, onAccent: "#151515" });
  const rot = [-3, 2, -1.5, 3, -2.5];
  return (
    <>
      <Sec t={party} style={heroPad} className="overflow-hidden">
        {BAL.map(([x, c, d], i) => <motion.span key={i} aria-hidden="true" className="absolute bottom-[-40px] hidden h-24 w-20 rounded-[50%] opacity-90 md:block" style={{ left: `${x}%`, background: c }} animate={{ y: [0, -700] }} transition={{ duration: d * 1.6, repeat: Infinity, ease: "linear", delay: i }} />)}
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <HeroText m={m} t={party} h1Class="heading-hero" h1Style={{ textShadow: "4px 4px 0 rgba(0,0,0,0.25)" }} tryLabel="Plan a party" />
          <Cake />
        </div>
      </Sec>
      <Sec t={cream}>
        <Title eyebrow="The sticker sheet" sub="Everything for the big day, stuck on the table.">Make it a moment.</Title>
        <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-5">
          {m.features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.07}><motion.div whileHover={{ rotate: 0, scale: 1.06 }} className="w-[250px] rounded-[2rem] border-4 border-ink p-5 shadow-[5px_5px_0_0_#0a0a0a]" style={{ background: COL[i % 5], color: i % 5 === 1 ? "#0a0a0a" : "#ffffff", rotate: rot[i % 5] }}>
              <f.icon size={32} /><p className="mt-2 font-display text-2xl font-extrabold leading-tight">{f.title}</p><p className="mt-1 text-sm font-semibold opacity-90">{f.tip}</p></motion.div></Reveal>
          ))}
        </div>
      </Sec>
      <Block t={dusk} title="Book a celebration." eyebrow="Interactive"><TryDemo m={m} t={dusk} /></Block>
      <Block t={cream} left eyebrow="Party timeline" title="From booking to dessert."><Journey v="steps" m={m} t={cream} /></Block>
      <Sec t={party}><Stats v="big" m={m} t={{ ...party, accent: YEL }} /></Sec>
      <Block t={cream} eyebrow="The gap" title="Group chats vs. one booking."><Gaps v="strike" m={m} t={cream} /></Block>
      {m.extra && <Block t={dusk} title="Another routine."><TryDemo m={m} t={dusk} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={cream} title="Whose day it is." eyebrow="Real moments"><Uses v="tabs" m={m} t={cream} /></Block>
      <Block t={dusk} title="Live in three steps."><Steps v="row" m={m} t={dusk} /></Block>
      <Block t={cream} title="Questions, answered."><Faq m={m} t={cream} /></Block>
    </>
  );
}

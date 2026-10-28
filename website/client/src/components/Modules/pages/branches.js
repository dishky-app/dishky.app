import React, { useState } from "react";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const PINS = [["Chennai", 76, 30, 82], ["Madurai", 52, 74, 64], ["Coimbatore", 22, 52, 71], ["Trichy", 56, 48, 58], ["Salem", 40, 34, 49]];

export default function BranchesPage({ m }) {
  const indigo = mk({ dark: true, bg: "#232323", card: "rgba(255,255,255,0.06)", accent: "#f99f91", onAccent: "#232323" });
  const paper = mk({ bg: "#f4f4f4", card: "#ffffff", accent: "#f45037" });
  const [sel, setSel] = useState(0);
  const p = PINS[sel];
  return (
    <>
      <Sec t={indigo} style={heroPad} className="overflow-hidden">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
          <HeroText m={m} t={indigo} tryLabel="Open the network" />
          <div>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border" style={{ borderColor: line(indigo), background: "radial-gradient(circle at 60% 40%, #3a3a3a, #232323 70%)" }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                {PINS.map(([n, x, y], i) => i !== sel && <motion.line key={sel + n} x1={PINS[sel][1]} y1={PINS[sel][2]} x2={x} y2={y} stroke="#f99f91" strokeOpacity="0.5" strokeWidth="0.4" strokeDasharray="1.5 1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />)}
              </svg>
              {PINS.map(([n, x, y], i) => (
                <button key={n} onClick={() => setSel(i)} aria-pressed={sel === i} aria-label={`${n} branch`} className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center" style={{ left: `${x}%`, top: `${y}%` }}>
                  {sel === i && <motion.span layoutId="pulse" className="absolute -bottom-1 h-8 w-8 animate-ping rounded-full bg-[#f99f91]/50" />}
                  <MapPin size={sel === i ? 34 : 26} fill={sel === i ? "#f99f91" : "#d7260b"} color="#ffffff" /><span className="mt-0.5 rounded bg-black/50 px-1.5 text-[10px] font-bold">{n}</span>
                </button>
              ))}
              <span className="absolute bottom-2 right-3 text-[10px]" style={{ color: mute(indigo, 0.45) }}>Illustrative map</span>
            </div>
          </div>
        </div>
      </Sec>
      <Sec t={paper}>
        <Title eyebrow="Compare branches" sub="Pick a pin above, or tap a row. Sample figures.">One login, every outlet.</Title>
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[0.9fr_1.1fr]">
          <motion.div key={sel} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl p-6 text-white shadow-xl" style={{ background: paper.accent }}>
            <MapPin size={26} /><p className="mt-2 font-display text-3xl font-extrabold">{p[0]}</p><p className="text-sm opacity-80">Branch · selected</p>
            <p className="mt-5 font-display text-6xl font-extrabold">{p[3]}<span className="text-2xl">%</span></p><p className="text-sm opacity-80">of the busiest branch (sample)</p>
          </motion.div>
          <ul className="space-y-2">{PINS.map(([n, , , v], i) => (
            <li key={n}><button onClick={() => setSel(i)} className="block min-h-[48px] w-full rounded-xl border bg-white px-4 py-2 text-left" style={{ borderColor: sel === i ? paper.accent : line(paper) }}>
              <span className="flex justify-between text-sm font-bold"><span>{n}</span><span>{v}%</span></span>
              <span className="mt-1 block h-2 rounded-full bg-black/10"><motion.span className="block h-full rounded-full" style={{ background: paper.accent }} initial={{ width: 0 }} whileInView={{ width: `${v}%` }} viewport={{ once: true }} /></span></button></li>
          ))}</ul>
        </div>
      </Sec>
      <Block t={indigo} left eyebrow="Across the network" title="What multi-branch covers."><Features v="cols" m={m} t={indigo} /></Block>
      <Block t={paper} title="Try the branch view." eyebrow="Interactive"><TryDemo m={m} t={paper} /></Block>
      <Block t={indigo} eyebrow="One to many" title="Growing past the first outlet."><Journey v="strip" m={m} t={indigo} /></Block>
      <Sec t={paper}><Stats v="big" m={m} t={paper} /></Sec>
      <Block t={indigo} eyebrow="The gap" title="Separate logins vs. one network."><Gaps v="strike" m={m} t={indigo} /></Block>
      {m.extra && <Block t={paper} title="Another routine."><TryDemo m={m} t={paper} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={indigo} left title="Who runs the group." eyebrow="Real moments"><Uses v="tabs" m={m} t={indigo} /></Block>
      <Block t={paper} title="Live in three steps."><Steps v="row" m={m} t={paper} /></Block>
      <Block t={indigo} title="Questions, answered."><Faq m={m} t={indigo} /></Block>
    </>
  );
}

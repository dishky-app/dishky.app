import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check, Flame, Snowflake, Utensils, Salad } from "lucide-react";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const ST = [
  ["Grill", Flame, ["Charcoal lit and ready", "Marinades labelled", "Grill cleaned and signed off"]],
  ["Fry", Utensils, ["Oil checked", "Batters ready", "Fryer cleaned and signed off"]],
  ["Cold", Snowflake, ["Fridge temperatures logged", "Salads and chutneys prepped", "Station cleaned and signed off"]],
  ["Pass", Salad, ["Plates warmed", "Garnish ready", "Pass wiped and signed off"]],
];
const GRID = { backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "28px 28px" };

export default function KitchenManagementPage({ m }) {
  const bp = mk({ dark: true, bg: "#2a2a2a", card: "rgba(255,255,255,0.06)", accent: "#f88573", onAccent: "#181818" });
  const steel = mk({ bg: "#efefef", card: "#ffffff", accent: "#e23a14" });
  const [on, setOn] = useState(0);
  const [done, setDone] = useState(() => ST.map(() => [false, false, false]));
  const flip = (s, i) => setDone((d) => d.map((r, k) => (k === s ? r.map((v, j) => (j === i ? !v : v)) : r)));
  const pct = (s) => Math.round((done[s].filter(Boolean).length / 3) * 100);
  return (
    <>
      <Sec t={bp} style={{ ...heroPad, ...GRID }}>
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
          <HeroText m={m} t={bp} h1Class="heading-hero font-display" tryLabel="Open the blueprint" />
          <div className="relative mx-auto aspect-square w-full max-w-md rounded-2xl border-2 border-dashed p-3" style={{ borderColor: "#f8857388" }}>
            <span className="absolute -top-3 left-4 bg-[#2a2a2a] px-2 font-display text-[11px] tracking-widest text-[#f88573]">KITCHEN · PLAN VIEW</span>
            <div className="grid h-full grid-cols-2 gap-3">
              {ST.map(([n, Icon], s) => (
                <button key={n} onClick={() => setOn(s)} className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 transition-colors" style={{ borderColor: on === s ? "#f88573" : "#f8857344", background: on === s ? "#f8857322" : "transparent" }}>
                  <Icon size={30} className="text-[#f88573]" /><span className="font-display text-sm font-bold">{n}</span>
                  <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="#f8857333" strokeWidth="4" /><motion.circle cx="18" cy="18" r="15" fill="none" stroke="#f88573" strokeWidth="4" strokeDasharray="94" animate={{ strokeDashoffset: 94 - (94 * pct(s)) / 100 }} /></svg>
                  <span className="font-display text-[11px] text-[#f88573]">{pct(s)}%</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Sec>

      <Sec t={steel}>
        <Title eyebrow="Station checklist" sub="Tick the items. Each station's progress updates on the plan.">Close a station, sign it off.</Title>
        <div className="mx-auto max-w-2xl rounded-3xl border bg-white p-6 shadow-xl" style={{ borderColor: line(steel) }}>
          <div className="mb-4 flex flex-wrap gap-2">{ST.map(([n], s) => <button key={n} onClick={() => setOn(s)} aria-pressed={on === s} className="min-h-[44px] rounded-full border px-5 text-sm font-bold" style={on === s ? { background: steel.accent, color: "#ffffff", borderColor: steel.accent } : { borderColor: line(steel, 0.25) }}>{n}</button>)}</div>
          <ul className="space-y-2">{ST[on][2].map((x, i) => (
            <li key={x}><button onClick={() => flip(on, i)} className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border px-4 text-left" style={{ borderColor: line(steel), background: done[on][i] ? "#f0f0f0" : "#ffffff" }}>
              <span className="flex h-6 w-6 items-center justify-center rounded-md border-2" style={{ borderColor: done[on][i] ? "#e4290c" : line(steel, 0.35), background: done[on][i] ? "#e4290c" : "transparent", color: "#ffffff" }}>{done[on][i] && <Check size={14} strokeWidth={3} />}</span>
              <span className={`text-sm font-semibold ${done[on][i] ? "line-through opacity-50" : ""}`}>{x}</span></button></li>
          ))}</ul>
          <div className="mt-5 h-2 rounded-full bg-black/10"><motion.div className="h-full rounded-full" style={{ background: steel.accent }} animate={{ width: `${pct(on)}%` }} /></div>
        </div>
      </Sec>

      <Block t={bp} style={GRID} left eyebrow="Spec" title="What the kitchen module covers."><Features v="rows" m={m} t={bp} /></Block>
      <Block t={steel} title="Try it on your own station." eyebrow="Interactive"><TryDemo m={m} t={steel} /></Block>
      <Block t={steel} eyebrow="Service flow" title="Mise to cleanup."><Journey v="timeline" m={m} t={steel} /></Block>
      <Sec t={bp}><Stats v="ring" m={m} t={bp} /></Sec>
      <Block t={steel} eyebrow="The gap" title="Clipboards vs. this."><Gaps v="table" m={m} t={steel} /></Block>
      {m.extra && <Block t={bp} title="Another routine."><TryDemo m={m} t={bp} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={steel} title="Who runs the pass." eyebrow="Real moments"><Uses v="list" m={m} t={steel} /></Block>
      <Block t={bp} title="Live in three steps."><Steps v="row" m={m} t={bp} /></Block>
      <Block t={steel} title="Questions, answered."><Faq m={m} t={steel} /></Block>
    </>
  );
}

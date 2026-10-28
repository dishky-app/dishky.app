import React, { useState } from "react";
import { motion } from "framer-motion";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const HL = "linear-gradient(transparent 55%, #f56049 55% 92%, transparent 92%)";
const TABS = ["All", "Documents", "Notes"];
const SPAN = ["md:col-span-4 md:row-span-2", "md:col-span-2", "md:col-span-2", "md:col-span-3", "md:col-span-3", "md:col-span-2", "md:col-span-4"];

export default function BackOfficePage({ m }) {
  const paper = mk({ bg: "#f1f1f1", card: "#fbfbfb", accent: "#d4260b" });
  const dark = mk({ dark: true, bg: "#101010", card: "rgba(255,255,255,0.06)", accent: "#f4462b", onAccent: "#101010" });
  const [tab, setTab] = useState(0);
  return (
    <>
      <Sec t={paper} style={heroPad}>
        <div className="mb-6 flex gap-1">{TABS.map((x, i) => <button key={x} onClick={() => setTab(i)} aria-pressed={tab === i} className="min-h-[44px] rounded-t-xl border border-b-0 px-5 text-sm font-bold" style={tab === i ? { background: "#fbfbfb", borderColor: line(paper, 0.3), marginBottom: -1 } : { background: "#dedede", borderColor: "transparent", color: mute(paper) }}>{x}</button>)}</div>
        <HeroText m={m} t={paper} h1Class="heading-hero" h1Style={{ backgroundImage: HL, backgroundRepeat: "no-repeat", backgroundSize: "100% 100%", display: "inline", WebkitBoxDecorationBreak: "clone" }} tryLabel="Open the desk" />
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {[["Documents", "Files and records in one place"], ["Notes", "Notes and tasks for the team"], ["Everything", "Searchable from one screen"]].map(([a, b], i) => (
            <motion.div key={a} initial={{ opacity: 0, y: 20 }} animate={{ opacity: tab === 0 || tab === i ? 1 : 0.3, y: 0 }} className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: line(paper), rotate: `${[-1.5, 1, -0.5][i]}deg` }}><p className="font-display text-lg font-extrabold">{a}</p><p className="text-xs" style={{ color: mute(paper) }}>{b}</p></motion.div>
          ))}
        </div>
      </Sec>
      <Sec t={dark}>
        <Title dark left eyebrow="The desk, tile by tile">Everything within reach.</Title>
        <div className="grid auto-rows-[minmax(150px,auto)] gap-3 md:grid-cols-6">
          {m.features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06} className={SPAN[i % SPAN.length]}>
              <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border p-6 transition-colors" style={{ borderColor: line(dark), background: i === 0 ? dark.accent : dark.card, color: i === 0 ? dark.onAccent : undefined }}>
                <f.icon size={i === 0 ? 40 : 26} className="transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110" />
                <div><p className="mt-6 font-display text-xl font-extrabold md:text-2xl">{f.title}</p><p className="mt-1 text-sm opacity-75">{f.tip}</p></div>
                <span className="absolute right-4 top-3 font-display text-xs opacity-40">{pad(i)}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </Sec>
      <Block t={paper} title="Try the back office." eyebrow="Interactive"><TryDemo m={m} t={paper} /></Block>
      <Block t={paper} left eyebrow="File to find" title="How things get filed."><Journey v="cards" m={m} t={paper} /></Block>
      <Sec t={dark}><Stats v="line" m={m} t={dark} /></Sec>
      <Block t={paper} eyebrow="The gap" title="Drawers and drives vs. one desk."><Gaps v="table" m={m} t={paper} /></Block>
      {m.extra && <Block t={dark} title="Another routine."><TryDemo m={m} t={dark} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={paper} left title="Who keeps the records." eyebrow="Real moments"><Uses v="cards" m={m} t={paper} /></Block>
      <Block t={dark} title="Live in three steps."><Steps v="big" m={m} t={dark} /></Block>
      <Block t={paper} title="Questions, answered."><Faq m={m} t={paper} /></Block>
    </>
  );
}

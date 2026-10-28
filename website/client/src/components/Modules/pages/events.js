import React, { useState } from "react";
import { motion } from "framer-motion";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const NIGHT = [["Doors", "6:30"], ["Welcome", "7:00"], ["Course one", "7:30"], ["Main", "8:30"], ["Dessert", "9:30"], ["Close", "10:30"]];

export default function EventsPage({ m }) {
  const stage = mk({ dark: true, bg: "#1a1a1a", card: "rgba(255,255,255,0.06)", accent: "#f5563d", onAccent: "#1a1a1a" });
  const poster = mk({ bg: "#eaeaea", card: "#f8f8f8", accent: "#f66a55" });
  const [on, setOn] = useState(2);
  return (
    <>
      <Sec t={stage} style={heroPad} className="overflow-hidden text-center">
        <div aria-hidden="true" className="absolute left-1/2 top-0 h-full w-[70%] -translate-x-1/2" style={{ background: "conic-gradient(from 180deg at 50% -10%, transparent 150deg, rgba(245.0,86.0,61.0,0.35) 180deg, transparent 210deg)", filter: "blur(8px)" }} />
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }} className="relative mx-auto max-w-4xl">
          <p className="mb-4 font-display text-sm font-extrabold uppercase tracking-[0.5em]" style={{ color: stage.accent }}>★ One night only ★</p>
          <HeroText m={m} t={stage} align="center" h1Class="text-[clamp(2.4rem,8.5vw,7rem)] font-extrabold uppercase leading-[0.92] tracking-tight font-display" h1Style={{ textShadow: "0 0 40px #f66a55aa" }} tryLabel="Plan the night" />
        </motion.div>
        <div className="dk-marquee relative mt-12 overflow-hidden border-y py-3" style={{ borderColor: line(stage), margin: "0 calc(50% - 50vw)" }}>
          <ul className="dk-marquee__track flex w-max gap-10 pr-10 font-display text-lg font-extrabold uppercase tracking-widest">
            {Array.from({ length: 2 }).flatMap((_, k) => m.features.concat(m.features).map((f, i) => <li key={k + "-" + i} className="whitespace-nowrap" style={{ color: i % 2 ? stage.accent : undefined }}>★ {f.title}</li>))}
          </ul>
        </div>
      </Sec>
      <Sec t={poster}>
        <Title eyebrow="Run of show" sub="Tap a moment in the evening.">Plan the night, minute by minute.</Title>
        <div className="mx-auto max-w-4xl">
          <div className="relative flex items-start justify-between">
            <span className="absolute left-0 right-0 top-[22px] h-0.5 bg-ink/15" /><motion.span className="absolute left-0 top-[22px] h-0.5" style={{ background: poster.accent }} animate={{ width: `${(on / (NIGHT.length - 1)) * 100}%` }} />
            {NIGHT.map(([n, tm], i) => (
              <button key={n} onClick={() => setOn(i)} aria-pressed={on === i} className="relative flex min-w-[44px] flex-col items-center text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-[#eaeaea] font-display text-xs font-bold" style={{ background: i <= on ? poster.accent : "#faa89b", color: i <= on ? "#ffffff" : "#e4290c" }}>{tm}</span>
                <span className="mt-2 hidden text-xs font-bold md:block">{n}</span>
              </button>
            ))}
          </div>
          <motion.div key={on} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 rounded-3xl border-2 border-ink bg-white p-7 text-center shadow-[6px_6px_0_0_#0a0a0a]">
            <p className="font-display text-3xl font-extrabold">{NIGHT[on][0]} · {NIGHT[on][1]}</p>
            <p className="mt-2" style={{ color: mute(poster) }}>{m.features[on % m.features.length].title}: {m.features[on % m.features.length].tip}</p>
          </motion.div>
        </div>
      </Sec>
      <Block t={stage} left eyebrow="The lineup" title="What we do together."><Features v="words" m={m} t={stage} /></Block>
      <Block t={poster} title="Plan an event." eyebrow="Interactive"><TryDemo m={m} t={poster} /></Block>
      <Block t={stage} eyebrow="Idea to recap" title="Five acts."><Journey v="timeline" m={m} t={stage} /></Block>
      <Sec t={poster}><Stats v="ring" m={m} t={poster} /></Sec>
      <Block t={poster} eyebrow="The gap" title="Posters and DMs vs. one planner."><Gaps v="toggle" m={m} t={poster} /></Block>
      {m.extra && <Block t={stage} title="Another routine."><TryDemo m={m} t={stage} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={poster} left title="Nights that work." eyebrow="Real moments"><Uses v="cards" m={m} t={poster} /></Block>
      <Block t={stage} title="Live in three steps."><Steps v="list" m={m} t={stage} /></Block>
      <Block t={poster} title="Questions, answered."><Faq m={m} t={poster} /></Block>
    </>
  );
}

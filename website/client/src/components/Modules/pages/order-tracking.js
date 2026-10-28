import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useInterval } from "../../ui/kit.js";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const STAGES = [["Received", "Your order is in."], ["Cooking", "The kitchen has it."], ["Ready", "Coming to your table."], ["Served", "Enjoy your meal."]];

function Rail({ t, i }) {
  const pct = (i / (STAGES.length - 1)) * 100;
  return (
    <div className="relative px-3 pb-2 pt-10">
      <div className="absolute left-3 right-3 top-[3.2rem] h-1.5 rounded-full" style={{ background: line(t, 0.15) }} />
      <motion.div className="absolute left-3 top-[3.2rem] h-1.5 rounded-full" style={{ background: t.accent, boxShadow: `0 0 20px ${t.accent}` }} animate={{ width: `calc((100% - 1.5rem) * ${pct / 100})` }} transition={{ duration: 0.9, ease: "easeInOut" }} />
      <ol className="relative grid grid-cols-4">
        {STAGES.map(([n, d], k) => (
          <li key={n} className="flex flex-col items-center text-center">
            <motion.span animate={{ scale: k === i ? 1.25 : 1 }} className="flex h-9 w-9 items-center justify-center rounded-full border-4 text-sm font-extrabold" style={{ borderColor: k <= i ? t.accent : line(t, 0.2), background: k < i ? t.accent : t.bg, color: k < i ? t.onAccent : t.ink }}>{k < i ? <Check size={16} /> : k + 1}</motion.span>
            <p className="mt-3 font-display text-sm font-extrabold md:text-lg" style={{ opacity: k <= i ? 1 : 0.4 }}>{n}</p>
            <p className="hidden text-xs md:block" style={{ color: mute(t, 0.6), opacity: k === i ? 1 : 0.4 }}>{d}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function OrderTrackingPage({ m }) {
  const navy = mk({ dark: true, bg: "#181818", card: "rgba(255,255,255,0.05)", accent: "#ff4d3a" });
  const light = mk({ bg: "#f6f6f6", card: "#ffffff", accent: "#e23a28" });
  const [i, setI] = useState(0);
  useInterval(() => setI((v) => (v + 1) % STAGES.length), 2300, true);
  return (
    <>
      <Sec t={navy} style={heroPad} className="overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 0%, #f44f3655, transparent 50%), radial-gradient(circle at 90% 100%, #ff4d3a44, transparent 50%)" }} />
        <div className="relative">
          <HeroText m={m} t={navy} align="center" h1Class="heading-hero uppercase tracking-tight" tryLabel="Watch it move" />
          <Reveal className="mx-auto mt-10 max-w-4xl rounded-3xl border p-5 md:p-8" ><div className="rounded-3xl" style={{ borderColor: line(navy) }}>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest" style={{ color: mute(navy, 0.55) }}><span>Order #22222222 · Table 7</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 animate-pulse rounded-full bg-[#e4290c]" />Live</span></div>
            <Rail t={navy} i={i} />
            <motion.p key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 text-center font-display text-xl font-bold md:text-2xl">{STAGES[i][1]}</motion.p>
          </div></Reveal>
        </div>
      </Sec>

      <Block t={light} title="What the guest sees on their phone." eyebrow="Features" left><Features v="rows" m={m} t={light} /></Block>

      <Sec t={navy}>
        <Title dark eyebrow="Behind the rail" left>Every status is a real event.</Title>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          <Journey v="steps" m={m} t={navy} />
          <div className="rounded-3xl border p-5" style={{ borderColor: line(navy), background: navy.card }}>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: mute(navy, 0.5) }}>Status feed</p>
            <ul className="space-y-2">
              {[3, 2, 1, 0].map((k) => (
                <motion.li key={k} animate={{ opacity: k <= i ? 1 : 0.25, x: k <= i ? 0 : 10 }} className="flex items-center justify-between rounded-xl px-4 py-3 text-sm" style={{ background: k === i ? navy.accent : "rgba(255,255,255,0.05)", color: k === i ? "#ffffff" : undefined }}>
                  <span className="font-bold">{STAGES[k][0]}</span><span className="opacity-70">{STAGES[k][1]}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </Sec>

      <Block t={light} title="Try the live tracker." eyebrow="Interactive"><TryDemo m={m} t={light} /></Block>
      <Sec t={navy}><Stats v="ring" m={m} t={navy} /></Sec>
      <Block t={light} left eyebrow="The gap" title="Where else guests wait."><Gaps v="strike" m={m} t={light} /></Block>
      {m.extra && <Block t={navy} title="One more routine."><TryDemo m={m} t={navy} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={light} title="Who it helps." eyebrow="Real moments"><Uses v="tabs" m={m} t={light} /></Block>
      <Block t={navy} title="Live in three steps."><Steps v="big" m={m} t={navy} /></Block>
      <Block t={light} title="Questions, answered."><Faq m={m} t={light} /></Block>
    </>
  );
}

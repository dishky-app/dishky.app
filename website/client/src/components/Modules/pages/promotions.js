import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Send, Play } from "lucide-react";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, Photo, pad } from "./parts/kit.js";
import { journeyScenes } from "../ModuleBlocks.js";

export default function PromotionsPage({ m }) {
  const coral = mk({ bg: "#ffffff", ink: "#101010", card: "#f6f6f6", accent: "#101010", onAccent: "#ffffff" });
  const cream = mk({ bg: "#f8f8f8", card: "#ffffff", accent: "#e8431f" });
  const ink = mk({ dark: true, bg: "#0e0e0e", card: "rgba(255,255,255,0.06)", accent: "#ff6a4d", onAccent: "#0e0e0e" });
  const [s, setS] = useState(0);
  const [liked, setLiked] = useState(false);
  const sc = journeyScenes(m.slug);
  const f = m.features[s];
  return (
    <>
      <Sec t={coral} style={heroPad} className="overflow-hidden">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <HeroText m={m} t={coral} h1Class="text-[clamp(2.6rem,8vw,6.5rem)] font-extrabold leading-[0.92] tracking-tighter font-display" tryLabel="See a feature" />
          </div>
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
              {m.features.map((x, i) => (
                <button key={x.title} onClick={() => { setS(i); setLiked(false); }} aria-label={x.title} aria-pressed={s === i} className="shrink-0 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full p-[3px]" style={{ background: "linear-gradient(45deg,#f56049,#f55e47,#f44d33)", opacity: s === i ? 1 : 0.6 }}><span className="flex h-full w-full items-center justify-center rounded-full border-2 border-white bg-white text-ink"><x.icon size={22} /></span></span>
                  <span className="mt-1 block max-w-[64px] truncate text-[10px] font-bold">{x.title.split(" ")[0]}</span>
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={s} initial={{ opacity: 0, y: 24, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: 1.5 }} exit={{ opacity: 0, y: -16 }} className="overflow-hidden rounded-3xl bg-white text-ink shadow-2xl">
                <div className="flex items-center gap-2 px-4 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">D</span><div><p className="text-xs font-bold">dishky</p><p className="text-[10px] text-ink/50">sample post</p></div></div>
                <div className="relative aspect-square"><Photo src={m.journey[s % m.journey.length].photo} art={sc[s % sc.length]} className="absolute inset-0" /><span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white"><Play size={16} /></span></div>
                <div className="space-y-1.5 px-4 py-3"><div className="flex gap-4"><button onClick={() => setLiked((v) => !v)} aria-pressed={liked} aria-label="Like" className="min-h-[36px]"><Heart size={22} fill={liked ? "#f55e47" : "none"} color={liked ? "#f55e47" : "#0a0a0a"} /></button><MessageCircle size={22} className="mt-1.5" /><Send size={22} className="mt-1.5" /></div>
                  <p className="text-sm"><b>{f.title}</b> · {f.tip}</p></div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Sec>
      <Sec t={cream}>
        <Title left eyebrow="The playbook">Four ways we put you in front of new guests.</Title>
        <div className="space-y-0">{m.features.map((x, i) => (
          <Reveal key={x.title} delay={i * 0.05} y={20}><div className="grid items-center gap-x-8 border-t-2 border-ink py-6 md:grid-cols-[6rem_1.2fr_1fr]">
            <span className="font-display text-6xl font-extrabold leading-none text-[#e8431f]">{pad(i)}</span>
            <p className="font-display text-[clamp(1.8rem,4.5vw,3.4rem)] font-extrabold leading-none tracking-tight">{x.title}</p>
            <p className="mt-2 md:mt-0" style={{ color: mute(cream) }}>{x.tip}</p></div></Reveal>
        ))}</div>
      </Sec>
      <Block t={ink} title="Try the promotion planner." eyebrow="Interactive"><TryDemo m={m} t={ink} /></Block>
      <Block t={cream} left eyebrow="From story to table" title="How a post becomes an order."><Journey v="strip" m={m} t={cream} /></Block>
      <Sec t={coral}><Stats v="big" m={m} t={{ ...coral, accent: "#101010" }} /></Sec>
      <Block t={cream} eyebrow="The gap" title="Posting alone vs. with us."><Gaps v="cards" m={m} t={cream} /></Block>
      {m.extra && <Block t={ink} title="Another routine."><TryDemo m={m} t={ink} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={cream} left title="Who it's for." eyebrow="Real moments"><Uses v="list" m={m} t={cream} /></Block>
      <Block t={ink} title="Live in three steps."><Steps v="big" m={m} t={ink} /></Block>
      <Block t={cream} title="Questions, answered."><Faq m={m} t={cream} /></Block>
    </>
  );
}

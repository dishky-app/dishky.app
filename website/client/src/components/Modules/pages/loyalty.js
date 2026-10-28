import React, { useState } from "react";
import { motion } from "framer-motion";
import { Crown, Check } from "lucide-react";
import { useInterval } from "../../ui/kit.js";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const GOLD = "#f5573e";
const TIERS = [["Regular", "Starts at the first visit."], ["Favourite", "Unlocked as visits add up."], ["Insider", "The top level, with the best offers."]];

function Stamp({ on, i, t }) {
  return (
    <motion.span animate={{ scale: on ? [1.5, 1] : 1, rotate: on ? [-30, 0] : 0 }} transition={{ type: "spring", stiffness: 300, damping: 14 }} className="flex aspect-square items-center justify-center rounded-full border-2 border-dashed" style={{ borderColor: on ? t.accent : line(t, 0.3), background: on ? t.accent : "transparent", color: t.onAccent }}>
      {on ? <Check size={20} strokeWidth={3} /> : <span className="text-xs" style={{ color: mute(t, 0.4) }}>{i + 1}</span>}
    </motion.span>
  );
}

export default function LoyaltyPage({ m }) {
  const black = mk({ dark: true, bg: "#0a0a0a", card: "rgba(255,255,255,0.05)", accent: GOLD, onAccent: "#0a0a0a" });
  const ivory = mk({ bg: "#efefef", card: "#fbfbfb", accent: "#e4290c" });
  const [n, setN] = useState(3);
  const [tier, setTier] = useState(1);
  useInterval(() => setN((v) => (v >= 10 ? 0 : v + 1)), 900, true);
  return (
    <>
      <Sec t={black} style={heroPad} className="overflow-hidden">
        <div aria-hidden="true" className="absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 rounded-full opacity-25 blur-3xl" style={{ background: `radial-gradient(${GOLD}, transparent 70%)` }} />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
          <HeroText m={m} t={black} tryLabel="Earn a stamp" h1Style={{ backgroundImage: `linear-gradient(120deg,#ffffff,${GOLD})`, WebkitBackgroundClip: "text", color: "transparent" }} />
          <motion.div initial={{ opacity: 0, rotateX: 40, y: 40 }} animate={{ opacity: 1, rotateX: 0, y: 0 }} transition={{ duration: 1 }} className="rounded-[2rem] border p-6 shadow-2xl md:p-8" style={{ borderColor: `${GOLD}66`, background: "linear-gradient(145deg,#151515,#0a0a0a)", boxShadow: `0 40px 80px -30px ${GOLD}55` }}>
            <div className="mb-5 flex items-center justify-between"><p className="flex items-center gap-2 font-display text-lg font-extrabold" style={{ color: GOLD }}><Crown size={20} />Dining card</p><span className="text-xs font-bold uppercase tracking-widest" style={{ color: mute(black, 0.5) }}>{n}/10 visits</span></div>
            <div className="grid grid-cols-5 gap-3">{Array.from({ length: 10 }, (_, i) => <Stamp key={i} i={i} on={i < n} t={black} />)}</div>
            <p className="mt-5 text-sm" style={{ color: mute(black, 0.6) }}>{n >= 10 ? "Tier up. A new offer unlocks." : "Every visit adds a stamp."}</p>
          </motion.div>
        </div>
      </Sec>

      <Sec t={ivory}>
        <Title eyebrow="Levels" sub="Guests move up as they visit; each level unlocks offers.">The ladder.</Title>
        <div className="mx-auto flex max-w-4xl items-end gap-3 md:gap-5">
          {TIERS.map(([nm, d], i) => (
            <button key={nm} onClick={() => setTier(i)} aria-pressed={tier === i} className="group min-w-0 flex-1 break-words text-left">
              <motion.div animate={{ height: 120 + i * 70 }} className="relative flex flex-col justify-end overflow-hidden rounded-t-3xl p-4 md:p-6" style={{ background: tier === i ? `linear-gradient(180deg,${GOLD},#e4290c)` : "#d7d7d7", color: tier === i ? "#0a0a0a" : "#303030" }}>
                <Crown size={22 + i * 4} className="absolute right-4 top-4 opacity-60" />
                <p className="font-display text-base font-extrabold sm:text-xl md:text-3xl">{nm}</p>
                <p className="text-xs font-semibold opacity-80 md:text-sm">{d}</p>
              </motion.div>
            </button>
          ))}
        </div>
        <div className="mx-auto h-2 max-w-4xl rounded-b-full" style={{ background: "#303030" }} />
        <motion.p key={tier} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5 text-center font-display text-lg font-bold">{TIERS[tier][0]}: {m.features[tier % m.features.length].title}. <span className="font-normal" style={{ color: mute(ivory) }}>{m.features[tier % m.features.length].tip}</span></motion.p>
      </Sec>

      <Block t={black} left eyebrow="What's inside" title="Reasons to come back."><Features v="rows" m={m} t={black} /></Block>
      <Block t={ivory} title="Try the loyalty tools." eyebrow="Interactive"><TryDemo m={m} t={ivory} /></Block>
      <Block t={black} title="One guest, one story." eyebrow="The journey"><Journey v="steps" m={m} t={black} /></Block>
      <Sec t={ivory}><Stats v="cards" m={m} t={ivory} /></Sec>
      <Block t={black} title="Points apps vs. this." eyebrow="The gap"><Gaps v="table" m={m} t={black} /></Block>
      {m.extra && <Block t={ivory} title="Another routine."><TryDemo m={m} t={ivory} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={black} left title="Who it keeps coming back." eyebrow="Real moments"><Uses v="list" m={m} t={black} /></Block>
      <Block t={ivory} title="Live in three steps."><Steps v="row" m={m} t={ivory} /></Block>
      <Block t={black} title="Questions, answered."><Faq m={m} t={black} /></Block>
    </>
  );
}

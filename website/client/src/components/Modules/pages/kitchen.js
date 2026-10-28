import React, { useState } from "react";
import { motion } from "framer-motion";
import { useInterval } from "../../ui/kit.js";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const TICKETS = [["T4", ["Butter chicken", "Garlic naan"], 0], ["T9", ["Paneer tikka", "Mint lemonade"], 14], ["T2", ["Margherita"], 31], ["T6", ["Veg biryani", "Raita"], 7], ["T11", ["Pasta arrabbiata", "Garlic bread"], 22], ["TA", ["Cold coffee"], 41]];
const heat = (s) => (s < 20 ? ["#db270c", "On pace"] : s < 40 ? ["#f22c0e", "Slow"] : ["#ef4444", "Late"]);
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function Rail() {
  const [tick, setTick] = useState(0);
  useInterval(() => setTick((v) => v + 1), 1000, true);
  return (
    <div className="-mx-[var(--page-gutter)] flex gap-4 overflow-x-auto px-[var(--page-gutter)] pb-4 pt-2 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      {TICKETS.map(([tb, items, off], i) => {
        const s = (off + tick) % 70;
        const [c, lb] = heat(s);
        return (
          <motion.div key={tb} initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="w-[210px] shrink-0 rounded-2xl bg-[#f2f2f2] text-ink shadow-xl" style={{ borderTop: `8px solid ${c}` }}>
            <div className="flex items-center justify-between px-4 pt-3"><span className="font-display text-2xl font-extrabold">{tb}</span><span className="font-display text-xl font-bold" style={{ color: c }}>{mmss(s)}</span></div>
            <ul className="space-y-1 px-4 py-3 font-display text-xs">{items.map((x) => <li key={x}>1× {x}</li>)}</ul>
            <p className="px-4 pb-6 text-[10px] font-bold uppercase tracking-widest" style={{ color: c }}>● {lb}</p>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function KitchenPage({ m }) {
  const ember = mk({ dark: true, bg: "#080808", card: "rgba(255,255,255,0.05)", accent: "#f44327" });
  const steel = mk({ bg: "#e6e6e6", card: "#ffffff", accent: "#e23a14" });
  return (
    <>
      <Sec t={ember} style={heroPad} className="overflow-hidden">
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3" style={{ background: "radial-gradient(ellipse at 50% 120%, #f4432788, transparent 65%)" }} />
        <div className="relative">
          <HeroText m={m} t={ember} h1Class="text-[clamp(2.8rem,10vw,8rem)] font-extrabold uppercase leading-[0.9] tracking-tighter font-display" tryLabel="Run the board" />
          <div className="mt-10"><Rail /></div>
        </div>
      </Sec>
      <Block t={steel} left eyebrow="On the pass" title="What the board does."><Features v="cols" m={m} t={steel} /></Block>
      <Sec t={ember}>
        <Title dark left eyebrow="Live demo" sub="Tap a ticket to move it along.">Cooking, ready, served.</Title>
        <TryDemo m={m} t={ember} />
      </Sec>
      <Block t={steel} eyebrow="A ticket's life" title="Fire to pass."><Journey v="cards" m={m} t={steel} /></Block>
      <Sec t={ember}><Stats v="big" m={m} t={ember} /></Sec>
      <Block t={steel} eyebrow="The gap" title="Printers jam. Screens don't."><Gaps v="toggle" m={m} t={steel} /></Block>
      {m.extra && <Block t={ember} title="The closing routine."><TryDemo m={m} t={ember} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={steel} title="On the line." eyebrow="Real moments"><Uses v="quotes" m={m} t={steel} /></Block>
      <Block t={ember} title="Live in three steps."><Steps v="big" m={m} t={ember} /></Block>
      <Block t={steel} title="Questions, answered."><Faq m={m} t={steel} /></Block>
    </>
  );
}

import React, { useState } from "react";
import { motion } from "framer-motion";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const STATUS = [["Free", "#d6d6d6", "#0a0a0a"], ["Seated", "#f5553c", "#ffffff"], ["Ordered", "#f22c0e", "#0a0a0a"], ["Bill", "#e4290c", "#ffffff"]];
const TABLES = [
  [1, 8, 12, "c", "Window"], [2, 8, 38, "c", "Window"], [3, 8, 64, "c", "Window"],
  [4, 36, 14, "r", "Main"], [5, 36, 44, "r", "Main"], [6, 58, 14, "r", "Main"], [7, 58, 44, "r", "Main"],
  [8, 82, 14, "c", "Patio"], [9, 82, 42, "c", "Patio"], [10, 82, 70, "c", "Patio"], [11, 36, 72, "r", "Main"],
];

function Floor({ t }) {
  const [st, setSt] = useState(() => TABLES.map((_, i) => [0, 1, 2, 3, 0, 1, 0, 2, 0, 1, 3][i]));
  const adv = (i) => setSt((s) => s.map((v, k) => (k === i ? (v + 1) % 4 : v)));
  const count = (n) => st.filter((v) => v === n).length;
  return (
    <div>
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl border-2 md:aspect-[16/8]" style={{ borderColor: "#0a0a0a", background: "#fafafa", backgroundImage: "linear-gradient(rgba(10,10,10,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(10,10,10,0.06) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
        <span className="absolute left-[3%] top-2 font-display text-[10px] font-bold tracking-widest text-ink/40">WINDOW</span>
        <span className="absolute left-[40%] top-2 font-display text-[10px] font-bold tracking-widest text-ink/40">MAIN FLOOR</span>
        <span className="absolute left-[80%] top-2 font-display text-[10px] font-bold tracking-widest text-ink/40">PATIO</span>
        <span className="absolute bottom-0 left-[44%] h-3 w-24 rounded-t-lg bg-ink/70" />
        {TABLES.map(([n, x, y, shape], i) => {
          const [, bg, fg] = STATUS[st[i]];
          return (
            <motion.button key={n} onClick={() => adv(i)} aria-label={`Table ${n}: ${STATUS[st[i]][0]}. Tap to change`} whileTap={{ scale: 0.9 }} animate={{ backgroundColor: bg, color: fg }} className={`absolute flex flex-col items-center justify-center text-xs font-extrabold shadow-md ${shape === "c" ? "h-[13%] w-[8%] min-h-[40px] min-w-[40px] rounded-full" : "h-[16%] w-[15%] min-h-[40px] min-w-[52px] rounded-xl"}`} style={{ left: `${x}%`, top: `${y + 6}%` }}>
              T{n}<span className="text-[9px] font-semibold opacity-80">{STATUS[st[i]][0]}</span>
            </motion.button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        {STATUS.map(([n, bg], i) => <span key={n} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: line(t, 0.2) }}><i className="h-3 w-3 rounded-full" style={{ background: bg }} />{n} · {count(i)}</span>)}
        <span className="text-xs" style={{ color: mute(t, 0.55) }}>Tap a table to change its status.</span>
      </div>
    </div>
  );
}

export default function ServicePage({ m }) {
  const plan = mk({ bg: "#f3f3f3", card: "#ffffff", accent: "#f45037" });
  const ink = mk({ dark: true, bg: "#171717", card: "rgba(255,255,255,0.06)", accent: "#f99f91", onAccent: "#171717" });
  return (
    <>
      <Sec t={plan} style={heroPad}>
        <div className="mb-8 grid items-end gap-6 lg:grid-cols-[1fr_auto]"><HeroText m={m} t={plan} tryLabel="Walk the floor" /></div>
        <Reveal><Floor t={plan} /></Reveal>
      </Sec>
      <Block t={ink} left eyebrow="Floor tools" title="What the floor map keeps track of."><Features v="grid" m={m} t={ink} /></Block>
      <Block t={plan} title="The full table view." eyebrow="Interactive"><TryDemo m={m} t={plan} /></Block>
      <Block t={plan} left eyebrow="A table's night" title="Seat, serve, close."><Journey v="strip" m={m} t={ink} /></Block>
      <Sec t={ink}><Stats v="big" m={m} t={ink} /></Sec>
      <Block t={plan} eyebrow="The gap" title="Sticky notes vs. a live map."><Gaps v="cards" m={m} t={plan} /></Block>
      {m.extra && <Block t={ink} title="Another routine."><TryDemo m={m} t={ink} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={plan} left title="Who runs the floor." eyebrow="Real moments"><Uses v="list" m={m} t={plan} /></Block>
      <Block t={plan} title="Live in three steps."><Steps v="row" m={m} t={plan} /></Block>
      <Block t={ink} title="Questions, answered."><Faq m={m} t={ink} /></Block>
    </>
  );
}

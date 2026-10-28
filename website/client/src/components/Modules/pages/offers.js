import React, { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad, onColor } from "./parts/kit.js";

const PINK = "#f33214", YEL = "#f56049";
const COLS = 6, ROWS = 3;

function Scratch({ m }) {
  const [gone, setGone] = useState(() => new Set());
  const total = COLS * ROWS;
  const open = gone.size >= total * 0.45;
  const f = m.features[0];
  const peel = (i) => setGone((s) => new Set(s).add(i));
  return (
    <div className="relative mx-auto aspect-[2/1] w-full max-w-xl overflow-hidden rounded-[2rem] border-4 border-ink shadow-[8px_8px_0_0_#0a0a0a]" style={{ background: YEL }}>
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
        <Sparkles className="text-ink" />
        <p className="mt-1 font-display text-3xl font-extrabold text-ink md:text-5xl">{f.title}</p>
        <p className="mt-1 max-w-xs text-sm font-semibold text-ink/70">{f.tip}</p>
      </div>
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${COLS},1fr)`, gridTemplateRows: `repeat(${ROWS},1fr)`, pointerEvents: open ? "none" : "auto" }}>
        {Array.from({ length: total }, (_, i) => (
          <button key={i} aria-label="Scratch" onPointerEnter={(e) => e.buttons === 1 && peel(i)} onClick={() => peel(i)} className="border border-white/20 transition-opacity duration-500" style={{ background: "repeating-linear-gradient(45deg,#c9c9c9 0 6px,#b4b4b4 6px 12px)", opacity: gone.has(i) || open ? 0 : 1 }} />
        ))}
      </div>
      {!open && <p className="pointer-events-none absolute bottom-2 right-3 rounded-full bg-ink px-3 py-1 text-[11px] font-bold text-white">Scratch me</p>}
    </div>
  );
}

export default function OffersPage({ m }) {
  const pop = mk({ dark: true, bg: "#111111", ink: "#ffffff", card: "#ffffff", accent: YEL, onAccent: "#0a0a0a" });
  const cream = mk({ bg: "#f0f0f0", card: "#ffffff", accent: PINK });
  const ink = mk({ dark: true, bg: "#0d0d0d", card: "rgba(255,255,255,0.06)", accent: YEL, onAccent: "#0a0a0a" });
  const tilt = [-4, 3, -2, 5, -3, 2];
  return (
    <>
      <Sec t={pop} style={heroPad} className="overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(#ffffff 2px, transparent 2px)", backgroundSize: "22px 22px" }} />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
          <HeroText m={m} t={pop} h1Class="heading-hero uppercase" h1Style={{ textShadow: "4px 4px 0 #0a0a0a" }} tryLabel="Scratch one" />
          <div className="relative h-[320px] md:h-[400px]">
            {m.features.slice(0, 4).map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 40, rotate: 0 }} animate={{ opacity: 1, y: 0, rotate: tilt[i] * 1.5 }} transition={{ delay: 0.1 * i, type: "spring" }} whileHover={{ rotate: 0, scale: 1.05, zIndex: 20 }} className="absolute w-[62%] rounded-2xl border-4 border-ink bg-white p-4 text-ink shadow-[6px_6px_0_0_#0a0a0a]" style={{ left: `${(i % 2) * 34}%`, top: `${i * 21}%`, zIndex: i }}>
                <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink" style={{ background: YEL }}><f.icon size={20} /></span><p className="font-display text-lg font-extrabold leading-tight">{f.title}</p></div>
                <div className="mt-3 border-t-2 border-dashed border-ink/30 pt-2 text-[11px] font-bold uppercase tracking-widest text-ink/50">Offer · {pad(i)}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </Sec>

      <Sec t={cream}>
        <Title eyebrow="Tap to reveal" sub="Drag across the card, or tap the squares.">Scratch for today's offer.</Title>
        <Scratch m={m} />
      </Sec>

      <Sec t={ink}>
        <Title dark left eyebrow="The wall">Every kind of offer, pinned up.</Title>
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
          {m.features.concat(m.features).slice(0, Math.max(6, m.features.length)).map((f, i) => (
            <Reveal key={i} delay={i * 0.05} className="mb-5 break-inside-avoid">
              <div className="rounded-2xl border-2 p-5" style={{ background: i % 3 === 0 ? PINK : i % 3 === 1 ? YEL : "#ffffff", color: i % 3 === 0 ? "#ffffff" : "#0a0a0a", borderColor: "#ffffff", transform: `rotate(${tilt[i % 6] / 2}deg)`, paddingBottom: 20 + (i % 3) * 14 }}>
                <f.icon size={26} /><p className="mt-2 font-display text-xl font-extrabold">{f.title}</p><p className="mt-1 text-sm opacity-80">{f.tip}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Sec>

      <Block t={cream} title="Try the offers builder." eyebrow="Interactive"><TryDemo m={m} t={cream} /></Block>
      <Block t={pop} title="From idea to redeemed." eyebrow="The journey"><Journey v="timeline" m={m} t={pop} /></Block>
      <Sec t={ink}><Stats v="big" m={m} t={ink} /></Sec>
      <Block t={cream} title="Discounts, done differently." eyebrow="The gap"><Gaps v="toggle" m={m} t={cream} /></Block>
      {m.extra && <Block t={ink} title="One more routine."><TryDemo m={m} t={ink} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={pop} title="Where it works hardest."><Uses v="cards" m={m} t={pop} /></Block>
      <Block t={cream} title="Live in three steps."><Steps v="big" m={m} t={cream} /></Block>
      <Block t={ink} title="Questions, answered."><Faq m={m} t={ink} /></Block>
    </>
  );
}

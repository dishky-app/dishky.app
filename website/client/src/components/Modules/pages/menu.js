import React, { useState } from "react";
import { motion } from "framer-motion";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, Photo, pad } from "./parts/kit.js";
import { journeyScenes } from "../ModuleBlocks.js";

function Rule({ t }) {
  return <div className="my-5 flex items-center gap-3" style={{ color: mute(t, 0.4) }}><span className="h-px flex-1" style={{ background: "currentColor" }} /><span className="text-xs">✦</span><span className="h-px flex-1" style={{ background: "currentColor" }} /></div>;
}

export default function MenuPage({ m }) {
  const paper = mk({ bg: "#e6e6e6", ink: "#1e1e1e", card: "#f0f0f0", accent: "#b4412a" });
  const board = mk({ dark: true, bg: "#202020", ink: "#ececec", card: "rgba(255,255,255,0.05)", accent: "#f77763", onAccent: "#202020" });
  const cream = mk({ bg: "#f8f8f8", ink: "#1e1e1e", card: "#ffffff", accent: "#b4412a" });
  const [on, setOn] = useState(0);
  const sc = journeyScenes(m.slug);
  const f = m.features[on];
  return (
    <>
      <Sec t={paper} style={heroPad} className="overflow-hidden">
        <div className="mx-auto max-w-3xl rounded-[2rem] border-2 p-2" style={{ borderColor: "#1e1e1e" }}>
          <div className="rounded-[1.6rem] border px-6 py-10 text-center md:px-14 md:py-14" style={{ borderColor: line(paper, 0.4), background: paper.card }}>
            <HeroText m={m} t={paper} align="center" h1Class="font-serif text-[clamp(2.6rem,7vw,5.5rem)] font-semibold leading-[1.02]" tryLabel="Taste the editor" />
            <Rule t={paper} />
            <p className="font-serif text-sm uppercase tracking-[0.3em]" style={{ color: mute(paper, 0.55) }}>Starters · Mains · Desserts · Combos</p>
          </div>
        </div>
      </Sec>

      <Sec t={cream}>
        <Title eyebrow="À la carte" sub="Tap a line to see it plated.">Everything on the menu editor.</Title>
        <div className="mx-auto grid max-w-5xl items-start gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <ul>
            {m.features.map((x, i) => (
              <li key={x.title}>
                <button onClick={() => setOn(i)} onMouseEnter={() => setOn(i)} className="group w-full py-4 text-left">
                  <span className="flex items-baseline gap-3 font-serif text-xl font-semibold md:text-2xl" style={{ color: on === i ? cream.accent : undefined }}>
                    {x.title}<span className="mb-1 flex-1 border-b-2 border-dotted" style={{ borderColor: line(cream, 0.35) }} /><span className="font-display text-sm">{pad(i)}</span>
                  </span>
                  <span className="mt-1 block text-sm" style={{ color: mute(cream) }}>{x.tip}</span>
                </button>
              </li>
            ))}
          </ul>
          <motion.div key={on} initial={{ opacity: 0, rotate: -3, y: 16 }} animate={{ opacity: 1, rotate: 2, y: 0 }} className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border-8 border-white shadow-2xl lg:sticky lg:top-28">
            <Photo src={m.journey[on % m.journey.length].photo} art={sc[on % sc.length]} className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <p className="absolute bottom-5 left-5 right-5 flex items-center gap-2 font-serif text-2xl font-semibold text-white"><f.icon size={22} />{f.title}</p>
          </motion.div>
        </div>
      </Sec>

      <Sec t={board} className="overflow-hidden">
        <div aria-hidden="true" className="absolute inset-3 rounded-2xl border-2 border-dashed" style={{ borderColor: "rgba(255,255,255,0.12)" }} />
        <Title dark eyebrow="Today's specials" sub="How a dish gets from your edit to the guest's phone.">Chalk it up.</Title>
        <ol className="relative mx-auto grid max-w-5xl gap-x-10 gap-y-8 md:grid-cols-2">
          {m.journey.map((s, k) => (
            <Reveal as="li" key={s.title} delay={k * 0.08} x={k % 2 ? 24 : -24} y={0}>
              <p className="flex items-baseline gap-3 font-display text-lg font-bold" style={{ color: board.accent }}>{k + 1}. {s.title}<span className="flex-1 border-b border-dotted border-white/30" /></p>
              <p className="mt-1 text-sm" style={{ color: mute(board, 0.6) }}>{m.short}</p>
            </Reveal>
          ))}
        </ol>
      </Sec>

      <Block t={paper} title="Try the editor." eyebrow="Interactive"><TryDemo m={m} t={paper} /></Block>
      <Sec t={cream} tight><Stats v="line" m={m} t={cream} /></Sec>
      <Block t={cream} title="Menu apps vs. this one." eyebrow="The gap"><Gaps v="table" m={m} t={cream} /></Block>
      {m.extra && <Block t={paper} title="Build a combo."><TryDemo m={m} t={paper} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={board} left eyebrow="Who orders this" title="Chefs, owners, counters."><Uses v="list" m={m} t={board} /></Block>
      <Block t={cream} title="Publish in three steps."><Steps v="list" m={m} t={cream} /></Block>
      <Block t={paper} title="Questions, answered."><Faq m={m} t={paper} /></Block>
    </>
  );
}

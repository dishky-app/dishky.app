import React, { useState } from "react";
import { motion } from "framer-motion";
import { useInterval } from "../../ui/kit.js";
import { Check } from "lucide-react";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const PREP = [["Table held", 0], ["Pre-order received", 120], ["Kitchen prepped", 240], ["Starters timed", 330], ["Guests arrive", 420]];
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function PrebookingsPage({ m }) {
  const mint = mk({ bg: "#efefef", card: "#ffffff", accent: "#e4290c" });
  const deep = mk({ dark: true, bg: "#181818", card: "rgba(255,255,255,0.06)", accent: "#f55239", onAccent: "#181818" });
  const [left, setLeft] = useState(420);
  useInterval(() => setLeft((v) => (v <= 0 ? 420 : v - 3)), 120, true);
  const done = 420 - left;
  return (
    <>
      <Sec t={mint} style={heroPad}>
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
          <HeroText m={m} t={mint} tryLabel="Start the clock" />
          <div className="mx-auto w-full max-w-md rounded-[2rem] bg-white p-7 text-center shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: mute(mint, 0.5) }}>Guests arrive in</p>
            <p className="my-2 font-display text-[clamp(3.2rem,12vw,5.5rem)] font-bold leading-none tabular-nums" style={{ color: mint.accent }}>{mmss(Math.max(0, left))}</p>
            <div className="h-2 overflow-hidden rounded-full bg-black/10"><motion.div className="h-full rounded-full" style={{ background: mint.accent }} animate={{ width: `${(done / 420) * 100}%` }} transition={{ ease: "linear", duration: 0.12 }} /></div>
            <p className="mt-3 text-sm" style={{ color: mute(mint, 0.65) }}>Sample countdown. Everything is ready before the table fills.</p>
          </div>
        </div>
      </Sec>
      <Sec t={deep}>
        <Title dark left eyebrow="Before they walk in" sub="Scroll sideways along the evening.">The prep timeline.</Title>
        <div className="-mx-[var(--page-gutter)] overflow-x-auto px-[var(--page-gutter)] pb-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          <ol className="relative flex min-w-[760px] items-start justify-between pt-2">
            <span className="absolute left-4 right-4 top-[26px] h-0.5 bg-white/15" /><motion.span className="absolute left-4 top-[26px] h-0.5" style={{ background: deep.accent }} animate={{ width: `calc((100% - 2rem) * ${done / 420})` }} transition={{ ease: "linear", duration: 0.12 }} />
            {PREP.map(([n, s]) => { const ok = done >= s; return (
              <li key={n} className="relative flex w-36 flex-col items-center text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border-4 font-bold" style={{ borderColor: ok ? deep.accent : "rgba(255,255,255,0.2)", background: ok ? deep.accent : deep.bg, color: ok ? deep.onAccent : "#ffffff" }}>{ok ? <Check size={20} strokeWidth={3} /> : "·"}</span>
                <p className="mt-3 text-sm font-bold">{n}</p><p className="font-display text-[11px]" style={{ color: mute(deep, 0.5) }}>T–{mmss(420 - s)}</p>
              </li>
            ); })}
          </ol>
        </div>
      </Sec>
      <Block t={mint} left eyebrow="Reserve ahead" title="What pre-booking adds."><Features v="rows" m={m} t={mint} /></Block>
      <Block t={deep} title="Try a pre-booking." eyebrow="Interactive"><TryDemo m={m} t={deep} /></Block>
      <Block t={mint} eyebrow="Booked to seated" title="The calm version of a rush."><Journey v="strip" m={m} t={mint} /></Block>
      <Sec t={deep}><Stats v="ring" m={m} t={deep} /></Sec>
      <Block t={mint} eyebrow="The gap" title="Waiting vs. already waiting for them."><Gaps v="cards" m={m} t={mint} /></Block>
      {m.extra && <Block t={deep} title="Another routine."><TryDemo m={m} t={deep} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={mint} title="Who plans ahead." eyebrow="Real moments"><Uses v="quotes" m={m} t={mint} /></Block>
      <Block t={deep} title="Live in three steps."><Steps v="list" m={m} t={deep} /></Block>
      <Block t={mint} title="Questions, answered."><Faq m={m} t={mint} /></Block>
    </>
  );
}

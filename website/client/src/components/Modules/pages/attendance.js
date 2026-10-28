import React, { useState } from "react";
import { motion } from "framer-motion";
import { useInterval } from "../../ui/kit.js";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const DAYS = [["Mon", 8], ["Tue", 7.5], ["Wed", 8.5], ["Thu", 8], ["Fri", 9]];
const two = (n) => String(n).padStart(2, "0");

function Clock({ t }) {
  const [now, setNow] = useState(() => new Date());
  const [on, setOn] = useState(false);
  const [since, setSince] = useState(null);
  useInterval(() => setNow(new Date()), 1000, true);
  const sec = now.getSeconds(), min = now.getMinutes(), hr = now.getHours() % 12;
  const el = on && since ? Math.max(0, Math.floor((now - since) / 1000)) : 0;
  return (
    <div className="mx-auto w-full max-w-sm text-center">
      <svg viewBox="0 0 200 200" className="mx-auto w-64 drop-shadow-xl">
        <circle cx="100" cy="100" r="94" fill="#f6f6f6" stroke="#e4290c" strokeWidth="6" />
        {Array.from({ length: 12 }, (_, i) => <line key={i} x1="100" y1="14" x2="100" y2={i % 3 ? 22 : 28} stroke="#e4290c" strokeWidth={i % 3 ? 2 : 4} transform={`rotate(${i * 30} 100 100)`} />)}
        <line x1="100" y1="100" x2="100" y2="54" stroke="#e4290c" strokeWidth="6" strokeLinecap="round" transform={`rotate(${hr * 30 + min / 2} 100 100)`} />
        <line x1="100" y1="100" x2="100" y2="34" stroke="#e4290c" strokeWidth="4" strokeLinecap="round" transform={`rotate(${min * 6} 100 100)`} />
        <line x1="100" y1="112" x2="100" y2="26" stroke="#f66b56" strokeWidth="2" transform={`rotate(${sec * 6} 100 100)`} />
        <circle cx="100" cy="100" r="6" fill="#f66b56" />
      </svg>
      <p className="mt-3 font-display text-3xl font-bold tabular-nums">{two(now.getHours())}:{two(min)}:{two(sec)}</p>
      <motion.button whileTap={{ scale: 0.94 }} onClick={() => { setOn((v) => !v); setSince(on ? null : new Date()); }} className="mt-4 min-h-[56px] w-full rounded-2xl font-display text-lg font-extrabold shadow-xl" style={{ background: on ? "#ef4444" : t.accent, color: "#ffffff" }}>{on ? "Clock out" : "Clock in"}</motion.button>
      <p className="mt-2 text-sm" style={{ color: mute(t, 0.65) }}>{on ? `On shift · ${two(Math.floor(el / 60))}:${two(el % 60)} (sample)` : "Tap to punch in. Sample only."}</p>
    </div>
  );
}

export default function AttendancePage({ m }) {
  const paper = mk({ bg: "#f0f0f0", card: "#ffffff", accent: "#f66b56" });
  const dark = mk({ dark: true, bg: "#1e1e1e", card: "rgba(255,255,255,0.06)", accent: "#f99f91", onAccent: "#1e1e1e" });
  return (
    <>
      <Sec t={paper} style={heroPad}>
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.9fr]"><HeroText m={m} t={paper} tryLabel="Punch in" /><Clock t={paper} /></div>
      </Sec>
      <Sec t={dark}>
        <Title dark left eyebrow="This week's time card" sub="Hours worked, one bar per day. Sample data.">Every shift, on the card.</Title>
        <div className="mx-auto max-w-3xl rounded-2xl border-2 p-5 md:p-8" style={{ borderColor: line(dark, 0.3), background: dark.card }}>
          {DAYS.map(([d, h], i) => (
            <div key={d} className="flex items-center gap-4 border-b border-dashed py-3 last:border-0" style={{ borderColor: line(dark) }}>
              <span className="w-10 font-display text-sm font-bold">{d}</span>
              <div className="h-5 flex-1 rounded bg-white/10"><motion.div initial={{ width: 0 }} whileInView={{ width: `${(h / 10) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: i * 0.1 }} className="h-full rounded" style={{ background: dark.accent }} /></div>
              <span className="w-12 text-right font-display text-sm">{h}h</span>
            </div>
          ))}
          <p className="mt-3 text-right font-display text-xs" style={{ color: mute(dark, 0.5) }}>total {DAYS.reduce((a, b) => a + b[1], 0)}h</p>
        </div>
      </Sec>
      <Block t={paper} left eyebrow="On the clock" title="What attendance tracks."><Features v="pills" m={m} t={paper} /></Block>
      <Block t={dark} title="Try the attendance panel." eyebrow="Interactive"><TryDemo m={m} t={dark} /></Block>
      <Block t={paper} eyebrow="Shift in, shift out" title="The day's records."><Journey v="timeline" m={m} t={paper} /></Block>
      <Sec t={dark}><Stats v="line" m={m} t={dark} /></Sec>
      <Block t={paper} eyebrow="The gap" title="Paper registers vs. the clock."><Gaps v="table" m={m} t={paper} /></Block>
      {m.extra && <Block t={dark} title="Another routine."><TryDemo m={m} t={dark} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={paper} title="Who checks the hours." eyebrow="Real moments"><Uses v="cards" m={m} t={paper} /></Block>
      <Block t={dark} title="Live in three steps."><Steps v="big" m={m} t={dark} /></Block>
      <Block t={paper} title="Questions, answered."><Faq m={m} t={paper} /></Block>
    </>
  );
}

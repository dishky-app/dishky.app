import React, { useState } from "react";
import { motion } from "framer-motion";
import { useInterval } from "../../ui/kit.js";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const R = [["Opening", 10, 11, "#f77763"], ["Mise en place", 11, 12, "#f99b8c"], ["Lunch service", 12, 16, "#f33214"], ["Cleaning", 16, 18, "#f4462b"], ["Dinner service", 18, 22, "#f7816f"], ["Closing", 22, 24, "#f66b56"]];
const H0 = 10, H1 = 24;
const ang = (h) => ((h - H0) / (H1 - H0)) * 360 - 90;
const pt = (a, r) => [150 + r * Math.cos((a * Math.PI) / 180), 150 + r * Math.sin((a * Math.PI) / 180)];
const arc = (a, b, r) => { const [x1, y1] = pt(a, r), [x2, y2] = pt(b, r); return `M${x1} ${y1} A${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x2} ${y2}`; };
const fmt = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

function Dial({ h }) {
  const cur = R.find((r) => h >= r[1] && h < r[2]) || R[5];
  const a = ang(h);
  const [nx, ny] = pt(a, 104);
  return (
    <div className="mx-auto w-full max-w-[420px]">
      <svg viewBox="0 0 300 300" className="w-full">
        <circle cx="150" cy="150" r="118" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="26" />
        {R.map(([n, s, e, c]) => <path key={n} d={arc(ang(s) + 1, ang(e) - 1, 118)} fill="none" stroke={c} strokeWidth="26" opacity={cur[0] === n ? 1 : 0.35} />)}
        {[10, 12, 14, 16, 18, 20, 22].map((hh) => { const [x, y] = pt(ang(hh), 142); return <text key={hh} x={x} y={y} fontSize="9" fill="rgba(255,255,255,0.5)" textAnchor="middle" dominantBaseline="middle" fontFamily="Sora, sans-serif">{hh}</text>; })}
        <line x1="150" y1="150" x2={nx} y2={ny} stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
        <circle cx="150" cy="150" r="7" fill="#ffffff" />
        <text x="150" y="196" textAnchor="middle" fontSize="22" fontWeight="800" fill="#ffffff" fontFamily="Sora, sans-serif">{fmt(h)}</text>
      </svg>
    </div>
  );
}

export default function ServiceManagementPage({ m }) {
  const night = mk({ dark: true, bg: "#1e1e1e", card: "rgba(255,255,255,0.06)", accent: "#f9a093", onAccent: "#1e1e1e" });
  const pale = mk({ bg: "#f4f4f4", card: "#ffffff", accent: "#f44429" });
  const [h, setH] = useState(10);
  const [auto, setAuto] = useState(true);
  useInterval(() => setH((v) => (v >= 23.9 ? 10 : v + 0.25)), 220, auto);
  const cur = R.find((r) => h >= r[1] && h < r[2]) || R[5];
  return (
    <>
      <Sec t={night} style={heroPad} className="overflow-hidden">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1fr]">
          <HeroText m={m} t={night} tryLabel="Run the day" />
          <div>
            <Dial h={h} />
            <div className="mx-auto mt-2 max-w-sm text-center"><p className="font-display text-xl font-extrabold" style={{ color: cur[3] }}>{cur[0]}</p>
              <input type="range" min={10} max={23.75} step={0.25} value={h} onChange={(e) => { setAuto(false); setH(+e.target.value); }} aria-label="Time of day" className="dk-range mt-3 w-full" />
              <button onClick={() => setAuto((v) => !v)} className="mt-2 min-h-[44px] text-xs font-bold underline">{auto ? "Pause" : "Play"}</button></div>
          </div>
        </div>
      </Sec>
      <Sec t={pale}>
        <Title eyebrow="Routine by routine" left>One day, six routines.</Title>
        <ol className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {R.map(([n, s, e, c], i) => (
            <Reveal as="li" key={n} delay={i * 0.05} y={14}>
              <div className="flex items-center gap-4 rounded-2xl border bg-white p-4" style={{ borderColor: cur[0] === n ? c : line(pale), boxShadow: cur[0] === n ? `0 0 0 3px ${c}44` : "none" }}>
                <span className="h-10 w-1.5 rounded-full" style={{ background: c }} /><div><p className="font-display text-lg font-extrabold">{n}</p><p className="font-display text-xs" style={{ color: mute(pale) }}>{fmt(s)} – {fmt(e % 24)}</p></div>
              </div>
            </Reveal>
          ))}
        </ol>
      </Sec>
      <Block t={night} left eyebrow="Inside" title="What each routine can hold."><Features v="rows" m={m} t={night} /></Block>
      <Block t={pale} title="Try the routines." eyebrow="Interactive"><TryDemo m={m} t={pale} /></Block>
      <Block t={pale} eyebrow="Open to close" title="The shift, step by step."><Journey v="steps" m={m} t={pale} /></Block>
      <Sec t={night}><Stats v="ring" m={m} t={night} /></Sec>
      <Block t={pale} eyebrow="The gap" title="Memory vs. a checklist."><Gaps v="table" m={m} t={pale} /></Block>
      {m.extra && <Block t={night} title="Another routine."><TryDemo m={m} t={night} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={pale} title="Who signs off." eyebrow="Real moments"><Uses v="cards" m={m} t={pale} /></Block>
      <Block t={night} title="Live in three steps."><Steps v="big" m={m} t={night} /></Block>
      <Block t={pale} title="Questions, answered."><Faq m={m} t={pale} /></Block>
    </>
  );
}

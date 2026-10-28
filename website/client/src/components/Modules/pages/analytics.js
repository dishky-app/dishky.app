import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const DATA = {
  Today: [["10", 8], ["12", 22], ["14", 15], ["16", 9], ["18", 24], ["20", 38], ["22", 18]],
  Week: [["Mon", 18], ["Tue", 22], ["Wed", 20], ["Thu", 27], ["Fri", 36], ["Sat", 44], ["Sun", 33]],
  Month: [["W1", 120], ["W2", 138], ["W3", 131], ["W4", 162]],
};
const W = 800, H = 300, PX = 28;

function Chart({ t, range }) {
  const d = DATA[range];
  const max = Math.max(...d.map((x) => x[1])) * 1.15;
  const pts = d.map(([, v], i) => [PX + (i / (d.length - 1)) * (W - PX * 2), H - 30 - (v / max) * (H - 60)]);
  const path = pts.map((p, i) => (i ? `L${p[0]} ${p[1]}` : `M${p[0]} ${p[1]}`)).join(" ");
  const [hov, setHov] = useState(d.length - 1);
  const ref = useRef(null);
  const idx = Math.min(hov, d.length - 1);
  const move = (e) => { const r = ref.current.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W; setHov(Math.max(0, Math.min(d.length - 1, Math.round(((x - PX) / (W - PX * 2)) * (d.length - 1))))); };
  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" onPointerMove={move} onPointerDown={move}>
        <defs><linearGradient id="ag" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={t.accent} stopOpacity="0.45" /><stop offset="1" stopColor={t.accent} stopOpacity="0" /></linearGradient></defs>
        {[0, 1, 2, 3].map((g) => <line key={g} x1={PX} x2={W - PX} y1={30 + g * 70} y2={30 + g * 70} stroke="rgba(255,255,255,0.07)" />)}
        <motion.path key={range} d={`${path} L${pts[pts.length - 1][0]} ${H - 30} L${pts[0][0]} ${H - 30} Z`} fill="url(#ag)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
        <motion.path key={range + "l"} d={path} fill="none" stroke={t.accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
        <line x1={pts[idx][0]} x2={pts[idx][0]} y1="10" y2={H - 30} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" />
        <circle cx={pts[idx][0]} cy={pts[idx][1]} r="8" fill={t.accent} stroke="#ffffff" strokeWidth="3" />
        {d.map(([l], i) => <text key={l} x={pts[i][0]} y={H - 8} fill="rgba(255,255,255,0.5)" fontSize="13" textAnchor="middle">{l}</text>)}
      </svg>
      <div className="pointer-events-none absolute left-3 top-1 rounded-xl bg-white px-3 py-2 text-ink shadow-xl"><p className="text-[10px] font-bold uppercase tracking-widest text-ink/50">{d[idx][0]} · sample</p><p className="font-display text-2xl font-extrabold">{d[idx][1]} <span className="text-xs font-semibold text-ink/50">orders</span></p></div>
    </div>
  );
}

function HeatStrip({ t }) {
  const v = [1, 1, 2, 3, 2, 2, 3, 4, 5, 4, 2, 1];
  return (
    <div>
      <div className="grid grid-cols-12 gap-1.5">{v.map((x, i) => <motion.div key={i} initial={{ opacity: 0, scaleY: 0.2 }} whileInView={{ opacity: 1, scaleY: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }} className="h-14 rounded-md" style={{ background: `${t.accent}${Math.round(255 * (0.12 + x * 0.17)).toString(16).padStart(2, "0")}` }} />)}</div>
      <div className="mt-1 grid grid-cols-12 text-center font-display text-[10px]" style={{ color: mute(t, 0.5) }}>{["11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22"].map((h) => <span key={h}>{h}</span>)}</div>
    </div>
  );
}

export default function AnalyticsPage({ m }) {
  const data = mk({ dark: true, bg: "#0d0d0d", card: "rgba(255,255,255,0.05)", accent: "#ff5a36" });
  const light = mk({ bg: "#f6f6f6", card: "#ffffff", accent: "#e8431f" });
  const [range, setRange] = useState("Week");
  return (
    <>
      <Sec t={data} style={heroPad}>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6"><HeroText m={m} t={data} tryLabel="Open the dashboard" /></div>
        <Reveal><div className="rounded-3xl border p-4 md:p-7" style={{ borderColor: line(data), background: data.card }}>
          <div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-widest" style={{ color: mute(data, 0.5) }}>Orders · drag across the chart</p>
            <div className="flex gap-1 rounded-full border p-1" style={{ borderColor: line(data, 0.25) }}>{Object.keys(DATA).map((r) => <button key={r} onClick={() => setRange(r)} aria-pressed={range === r} className="min-h-[40px] rounded-full px-4 text-xs font-bold" style={range === r ? { background: data.accent, color: "#ffffff" } : { color: mute(data, 0.6) }}>{r}</button>)}</div></div>
          <Chart key={range} t={data} range={range} />
        </div></Reveal>
      </Sec>
      <Sec t={light}>
        <Title left eyebrow="Peak hours" sub="Darker means busier. Sample day.">When the room fills up.</Title>
        <HeatStrip t={light} />
        <div className="mt-10"><Features v="grid" m={m} t={light} /></div>
      </Sec>
      <Block t={data} title="The live dashboard." eyebrow="Interactive"><TryDemo m={m} t={data} /></Block>
      <Block t={light} left eyebrow="From order to insight" title="How numbers get made."><Journey v="steps" m={m} t={light} /></Block>
      <Sec t={data}><Stats v="big" m={m} t={data} /></Sec>
      <Block t={light} eyebrow="The gap" title="Spreadsheets vs. this."><Gaps v="strike" m={m} t={light} /></Block>
      {m.extra && <Block t={data} title="Another view."><TryDemo m={m} t={data} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={light} title="Who reads the numbers." eyebrow="Real moments"><Uses v="quotes" m={m} t={light} /></Block>
      <Block t={data} title="Live in three steps."><Steps v="row" m={m} t={data} /></Block>
      <Block t={light} title="Questions, answered."><Faq m={m} t={light} /></Block>
    </>
  );
}

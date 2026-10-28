import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Check, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { Reveal, CountUp, Segmented, BrowserFrame, Chip } from "../../Kit/Kit.js";

const RANGES = [
  { value: "today", label: "Today", n: 12, base: 3200, orders: 148, avg: 412, chg: 8.4, unit: "h", labels: (i) => `${8 + i * 1}:00` },
  { value: "week", label: "Week", n: 7, base: 21500, orders: 986, avg: 438, chg: 12.1, labels: (i) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i] },
  { value: "month", label: "Month", n: 15, base: 20800, orders: 4120, avg: 451, chg: 5.6, labels: (i) => `${i * 2 + 1} Oct` },
  { value: "last", label: "Last month", n: 15, base: 19800, orders: 3940, avg: 429, chg: -3.2, labels: (i) => `${i * 2 + 1} Sep` },
];
const CATS = [
  { name: "Biryani", p: 34 }, { name: "Curries", p: 24 }, { name: "Starters", p: 17 },
  { name: "Breads", p: 11 }, { name: "Beverages", p: 8 }, { name: "Desserts", p: 6 },
];
const HEAT = [2, 1, 0, 0, 0, 1, 3, 8, 14, 22, 38, 62, 88, 94, 70, 44, 36, 48, 70, 92, 100, 84, 52, 22];
const W = 600, H = 190, PAD = 14;

const series = (r) => Array.from({ length: r.n }, (_, i) => {
  const wob = Math.sin(i * 1.7 + r.n) * 0.18 + Math.cos(i * 0.9) * 0.12;
  const peak = r.value === "today" ? 0.6 + Math.sin((i / (r.n - 1)) * Math.PI) * 0.9 : 1;
  const wk = r.value === "week" && i >= 4 ? 1.3 : 1;
  return Math.round(r.base * (1 + wob) * peak * wk);
});
const inr = (v) => `₹${Math.round(v).toLocaleString("en-IN")}`;

export default function AnalyticsDemo({ dark = false }) {
  const [range, setRange] = useState("week");
  const [hover, setHover] = useState(null);
  const [heat, setHeat] = useState(null);
  const [exp, setExp] = useState("idle");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const r = RANGES.find((x) => x.value === range);
  const data = useMemo(() => series(r), [r]);
  const total = data.reduce((a, b) => a + b, 0);
  const max = Math.max(...data) * 1.15;
  const pts = data.map((v, i) => [PAD + (i / (data.length - 1)) * (W - PAD * 2), H - PAD - (v / max) * (H - PAD * 2)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]} ${H} L${pts[0][0]} ${H} Z`;
  const up = r.chg >= 0;

  const onMove = (e) => {
    const b = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * W;
    const i = Math.round(((x - PAD) / (W - PAD * 2)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  const doExport = () => {
    if (exp !== "idle") return;
    setExp("busy");
    timer.current = setTimeout(() => { setExp("done"); timer.current = setTimeout(() => setExp("idle"), 2200); }, 900);
  };

  const card = dark ? "bg-white/5 border-white/10" : "bg-white border-ink/10";
  const sub = dark ? "text-white/55" : "text-ink/50";
  const txt = dark ? "text-white" : "text-ink";
  const kpis = [
    { label: "Total sales", node: <CountUp to={total} prefix="₹" duration={0.9} /> },
    { label: "Orders", node: <CountUp to={r.orders} duration={0.9} /> },
    { label: "Avg order", node: <CountUp to={r.avg} prefix="₹" duration={0.9} /> },
    { label: "Change", node: <span className={`inline-flex items-center gap-1 ${up ? "text-red-500" : "text-red-500"}`}>{up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}<CountUp to={Math.abs(r.chg)} decimals={1} suffix="%" duration={0.9} /></span> },
  ];

  return (
    <Reveal className="w-full">
      <div className="mx-auto w-full max-w-[980px]">
        <BrowserFrame title="admin.dishky.com/reports" dark={dark}>
          <div className={`min-w-0 space-y-4 ${txt}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Segmented options={RANGES.map(({ value, label }) => ({ value, label }))} value={range} onChange={(v) => { setRange(v); setHover(null); }} dark={dark} />
              <button type="button" onClick={doExport} aria-label="Export report to Excel" className={`inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-[13px] font-bold transition ${exp === "done" ? "bg-red-500 text-white" : "bg-amber text-white shadow-lg hover:brightness-110"}`}>
                {exp === "busy" ? <Loader2 size={15} className="animate-spin" /> : exp === "done" ? <Check size={15} /> : <Download size={15} />}
                {exp === "done" ? "Excel ready" : "Export"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {kpis.map((k) => (
                <div key={k.label} className={`rounded-2xl border p-3 ${card}`}>
                  <p className={`text-[11px] font-semibold ${sub}`}>{k.label}</p>
                  <p className="mt-1 font-display text-lg font-extrabold sm:text-xl">{k.node}</p>
                </div>
              ))}
            </div>

            <section className={`rounded-3xl border p-3 sm:p-4 ${card}`}>
              <div className="relative">
                <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-pan-y select-none" role="img" aria-label="Sales chart" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
                  <defs>
                    <linearGradient id="an-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f33716" stopOpacity=".32" /><stop offset="1" stopColor="#f33716" stopOpacity="0" /></linearGradient>
                  </defs>
                  {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="currentColor" strokeOpacity=".08" strokeDasharray="4 6" />)}
                  <motion.path key={`a${range}`} d={area} fill="url(#an-fill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.3 }} />
                  <motion.path key={`l${range}`} d={line} fill="none" stroke="#f33716" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: "easeOut" }} />
                  {hover !== null && (
                    <g>
                      <line x1={pts[hover][0]} x2={pts[hover][0]} y1="0" y2={H} stroke="#f33716" strokeOpacity=".4" strokeDasharray="3 4" />
                      <circle cx={pts[hover][0]} cy={pts[hover][1]} r="6" fill="#f33716" stroke="#ffffff" strokeWidth="3" />
                    </g>
                  )}
                </svg>
                <AnimatePresence>
                  {hover !== null && (
                    <motion.div key="tip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl bg-charcoal px-2.5 py-1.5 text-center text-[11px] font-semibold text-white shadow-xl" style={{ left: `${Math.min(86, Math.max(14, (pts[hover][0] / W) * 100))}%` }}>
                      <span className="block opacity-60">{r.labels(hover)}</span>{inr(data[hover])}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className={`mt-1 flex justify-between text-[10px] font-medium ${sub}`}><span>{r.labels(0)}</span><span>{r.labels(data.length - 1)}</span></div>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <section className={`rounded-3xl border p-4 ${card}`}>
                <p className={`mb-3 text-[11px] font-bold uppercase tracking-wider ${sub}`}>By category</p>
                <ul className="space-y-2.5">
                  {CATS.map((c, i) => (
                    <li key={c.name} className="flex items-center gap-2 text-[12px] font-semibold">
                      <span className="w-[68px] shrink-0 truncate">{c.name}</span>
                      <div className={`h-3 flex-1 overflow-hidden rounded-full ${dark ? "bg-white/10" : "bg-beige"}`}>
                        <motion.div key={range} className="h-full rounded-full bg-amber" style={{ opacity: 1 - i * 0.11 }} initial={{ width: 0 }} animate={{ width: `${c.p * 2.7}%` }} transition={{ duration: 0.8, delay: i * 0.06 }} />
                      </div>
                      <span className={`w-[58px] shrink-0 text-right ${sub}`}>{inr((total * c.p) / 100 / 1000 * 1000)}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className={`rounded-3xl border p-4 ${card}`}>
                <div className="mb-3 flex items-center justify-between">
                  <p className={`text-[11px] font-bold uppercase tracking-wider ${sub}`}>Peak hours</p>
                  <Chip tone={heat !== null ? "brand" : "mute"}>{heat !== null ? `${String(heat).padStart(2, "0")}:00 · ${Math.round(HEAT[heat] * r.orders / 400)} orders` : "Tap a cell"}</Chip>
                </div>
                <div className="grid grid-cols-12 gap-1">
                  {HEAT.map((v, h) => (
                    <button key={h} type="button" aria-label={`${h}:00, ${v}% busy`} onMouseEnter={() => setHeat(h)} onFocus={() => setHeat(h)} onClick={() => setHeat(h)} onMouseLeave={() => setHeat(null)}
                      className={`h-10 rounded-md transition ${heat === h ? "ring-2 ring-charcoal ring-offset-1" : ""}`} style={{ background: `rgba(243,55,22,${0.08 + (v / 100) * 0.92})` }} />
                  ))}
                </div>
                <div className={`mt-2 flex justify-between text-[10px] font-medium ${sub}`}><span>12 am</span><span>12 pm</span><span>11 pm</span></div>
              </section>
            </div>
          </div>
        </BrowserFrame>
      </div>
    </Reveal>
  );
}

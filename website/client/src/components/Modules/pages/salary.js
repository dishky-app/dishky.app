import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const WORK = new Set([1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 28, 29, 30]);

export default function SalaryPage({ m }) {
  const paper = mk({ bg: "#eaeaea", card: "#ffffff", accent: "#e4290c" });
  const dark = mk({ dark: true, bg: "#151515", card: "rgba(255,255,255,0.06)", accent: "#f44d34", onAccent: "#151515" });
  const [paid, setPaid] = useState(false);
  const days = [...WORK].length;
  return (
    <>
      <Sec t={paper} style={heroPad}>
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
          <HeroText m={m} t={paper} tryLabel="Run a pay cycle" />
          <motion.div initial={{ opacity: 0, y: 40, rotate: 2 }} animate={{ opacity: 1, y: 0, rotate: -1.5 }} transition={{ duration: 0.9 }} className="relative mx-auto w-full max-w-md rounded-sm bg-white p-6 shadow-2xl" style={{ borderTop: `8px solid ${paper.accent}` }}>
            <div className="flex items-start justify-between"><div><p className="font-display text-lg font-extrabold">Payslip</p><p className="text-xs text-ink/50">Sample · this month</p></div><span className="font-display text-[11px] text-ink/40">#PS-0001</span></div>
            <dl className="mt-5 space-y-2 font-display text-sm">
              {[["Employee", "Staff member"], ["Days worked", `${days} of 30`], ["Attendance", "From the clock"], ["Status", paid ? "Paid" : "Pending"]].map(([k, v]) => <div key={k} className="flex items-baseline gap-2"><dt className="text-ink/55">{k}</dt><span className="flex-1 border-b border-dotted border-ink/25" /><dd className="font-bold" style={k === "Status" ? { color: paid ? paper.accent : "#e4290c" } : undefined}>{v}</dd></div>)}
            </dl>
            <AnimatePresence>{paid && <motion.div initial={{ scale: 2.4, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: -14 }} className="absolute bottom-16 right-6 rounded-md border-4 px-4 py-1 font-display text-3xl font-extrabold tracking-widest" style={{ borderColor: paper.accent, color: paper.accent }}>PAID</motion.div>}</AnimatePresence>
            <button onClick={() => setPaid((v) => !v)} className="mt-8 min-h-[48px] w-full rounded-xl font-bold text-white" style={{ background: paper.accent }}>{paid ? "Mark as pending" : "Mark as paid"}</button>
          </motion.div>
        </div>
      </Sec>
      <Sec t={dark}>
        <Title dark left eyebrow="The month" sub="Days present feed the pay view. Sample month.">Attendance in, salary status out.</Title>
        <div className="mx-auto max-w-md rounded-3xl border p-5" style={{ borderColor: line(dark), background: dark.card }}>
          <div className="grid grid-cols-7 gap-1.5 text-center font-display text-[10px]" style={{ color: mute(dark, 0.5) }}>{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="mt-1.5 grid grid-cols-7 gap-1.5">{Array.from({ length: 30 }, (_, i) => { const d = i + 1; const w = WORK.has(d); return <motion.span key={d} initial={{ opacity: 0, scale: 0.6 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.015 }} className="flex aspect-square items-center justify-center rounded-lg text-xs font-bold" style={w ? { background: dark.accent, color: dark.onAccent } : { background: "rgba(255,255,255,0.06)", color: mute(dark, 0.4) }}>{d}</motion.span>; })}</div>
          <p className="mt-4 text-center text-sm" style={{ color: mute(dark, 0.65) }}>{days} days present · pay is <b style={{ color: dark.accent }}>{paid ? "paid" : "pending"}</b></p>
        </div>
      </Sec>
      <Block t={paper} left eyebrow="On the payslip" title="What the salary module covers."><Features v="rows" m={m} t={paper} /></Block>
      <Block t={dark} title="Open the pay view." eyebrow="Interactive"><TryDemo m={m} t={dark} /></Block>
      <Block t={paper} eyebrow="Pay day" title="From hours to paid."><Journey v="steps" m={m} t={paper} /></Block>
      <Sec t={dark}><Stats v="cards" m={m} t={dark} /></Sec>
      <Block t={paper} eyebrow="The gap" title="Notebook sums vs. a pay view."><Gaps v="strike" m={m} t={paper} /></Block>
      {m.extra && <Block t={dark} title="Another routine."><TryDemo m={m} t={dark} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={paper} title="Who settles pay." eyebrow="Real moments"><Uses v="tabs" m={m} t={paper} /></Block>
      <Block t={dark} title="Live in three steps."><Steps v="list" m={m} t={dark} /></Block>
      <Block t={paper} title="Questions, answered."><Faq m={m} t={paper} /></Block>
    </>
  );
}

import React, { useState } from "react";
import { motion } from "framer-motion";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const TIMES = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];
const TABS = [["T1", 2], ["T2", 2], ["T3", 4], ["T4", 4], ["T5", 6]];
const TAKEN = new Set(["0-2", "1-4", "2-1", "2-5", "3-0", "3-3", "4-4"]);

function Grid({ t }) {
  const [pick, setPick] = useState(new Set());
  const toggle = (k) => setPick((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border-2" style={{ borderColor: "#383838", background: "#ffffff" }}>
        <table className="w-full min-w-[640px] border-collapse text-center text-xs">
          <thead><tr style={{ background: "#383838", color: "#ffffff" }}><th className="px-3 py-3 text-left font-display">TABLE</th>{TIMES.map((x) => <th key={x} className="px-2 py-3 font-display">{x}</th>)}</tr></thead>
          <tbody>
            {TABS.map(([n, seats], r) => (
              <tr key={n} className="border-t" style={{ borderColor: "#e9e9e9" }}>
                <th className="px-3 py-1 text-left font-display text-sm font-extrabold">{n} <span className="font-display text-[10px] font-normal text-ink/50">{seats} seats</span></th>
                {TIMES.map((_, c) => { const k = `${r}-${c}`; const taken = TAKEN.has(k); const on = pick.has(k); return (
                  <td key={k} className="p-1"><button disabled={taken} onClick={() => toggle(k)} aria-pressed={on} aria-label={`${n} ${TIMES[c]} ${taken ? "booked" : on ? "selected" : "open"}`} className="h-11 w-full min-w-[52px] rounded-lg text-[11px] font-bold transition-all" style={taken ? { background: "#eaeaea", color: "#f77460", textDecoration: "line-through" } : on ? { background: t.accent, color: "#ffffff", transform: "scale(0.95)" } : { background: "#f4f4f4", color: "#e4290c" }}>{taken ? "booked" : on ? "yours" : "open"}</button></td>
                ); })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-center text-sm font-semibold" style={{ color: mute(t) }}>{pick.size ? `${pick.size} slot${pick.size > 1 ? "s" : ""} selected` : "Tap an open slot to book it."} <span className="text-xs font-normal">Sample data only.</span></p>
    </div>
  );
}

export default function ReservationsPage({ m }) {
  const sheet = mk({ bg: "#f9f9f9", card: "#ffffff", accent: "#f44328" });
  const navy = mk({ dark: true, bg: "#222222", card: "rgba(255,255,255,0.06)", accent: "#f77662", onAccent: "#222222" });
  return (
    <>
      <Sec t={sheet} style={heroPad}>
        <HeroText m={m} t={sheet} h1Class="heading-hero tracking-tight" tryLabel="Book a slot" />
        <Reveal className="mt-8"><Grid t={sheet} /></Reveal>
      </Sec>
      <Sec t={navy}>
        <Title dark left eyebrow="Reading the grid">Every part of the sheet does a job.</Title>
        <div className="grid gap-4 md:grid-cols-2">{m.features.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.06}><div className="flex gap-4 rounded-2xl border p-5" style={{ borderColor: line(navy), background: navy.card }}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold" style={{ background: navy.accent, color: navy.onAccent }}>{"ABCDEFG"[i]}{i + 1}</span>
            <div><p className="font-display text-lg font-extrabold">{f.title}</p><p className="mt-1 text-sm" style={{ color: mute(navy) }}>{f.tip}</p></div></div></Reveal>
        ))}</div>
      </Sec>
      <Block t={sheet} title="The full booking view." eyebrow="Interactive"><TryDemo m={m} t={sheet} /></Block>
      <Block t={sheet} left eyebrow="Request to seated" title="A booking's path."><Journey v="cards" m={m} t={sheet} /></Block>
      <Sec t={navy}><Stats v="cards" m={m} t={navy} /></Sec>
      <Block t={sheet} eyebrow="The gap" title="Notebooks vs. a slot grid."><Gaps v="table" m={m} t={sheet} /></Block>
      {m.extra && <Block t={navy} title="Another routine."><TryDemo m={m} t={navy} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={sheet} left title="Who takes bookings." eyebrow="Real moments"><Uses v="quotes" m={m} t={sheet} /></Block>
      <Block t={navy} title="Live in three steps."><Steps v="big" m={m} t={navy} /></Block>
      <Block t={sheet} title="Questions, answered."><Faq m={m} t={sheet} /></Block>
    </>
  );
}

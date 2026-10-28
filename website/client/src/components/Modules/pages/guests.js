import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCheck, Send, Users } from "lucide-react";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const SEG = [["All guests", 5], ["Regulars", 3], ["New this month", 2], ["Haven't visited lately", 4]];
const MSG = ["New menu this weekend. Tap to order.", "Thanks for visiting. Your next visit has an offer.", "We miss you. Here's a table on us tonight."];

function Bubble({ children, out, status }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow ${out ? "ml-auto rounded-tr-sm bg-[#e8e8e8] text-ink" : "rounded-tl-sm bg-white text-ink"}`}>
      {children}
      {status && <span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-ink/45">now <CheckCheck size={14} className={status === "read" ? "text-[#f44b31]" : ""} /></span>}
    </motion.div>
  );
}

export default function GuestsPage({ m }) {
  const wa = mk({ dark: true, bg: "#121212", card: "rgba(255,255,255,0.06)", accent: "#ec2a0c", onAccent: "#121212" });
  const paper = mk({ bg: "#e8e8e8", card: "#ffffff", accent: "#e4290c" });
  const white = mk({ bg: "#ffffff", card: "#f7f7f7", accent: "#e4290c" });
  const [seg, setSeg] = useState(1);
  const [msg, setMsg] = useState(0);
  const [sent, setSent] = useState(false);
  const pick = (fn) => (v) => { fn(v); setSent(false); };
  return (
    <>
      <Sec t={wa} style={heroPad} className="overflow-hidden">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <HeroText m={m} t={wa} tryLabel="Send a campaign" />
          <div className="mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border-[6px] border-black shadow-2xl">
            <div className="flex items-center gap-3 bg-[#2a2a2a] px-4 py-3 text-white"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ec2a0c] text-ink"><Users size={18} /></span><div><p className="text-sm font-bold">Your restaurant</p><p className="text-[11px] text-white/50">campaign · sample</p></div></div>
            <div className="flex min-h-[320px] flex-col gap-3 p-4" style={{ background: "#121212 url()", backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "14px 14px" }}>
              <Bubble>{MSG[0]}</Bubble>
              <Bubble out status="read">Order now →</Bubble>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}><Bubble>Table for two tonight?</Bubble></motion.div>
            </div>
          </div>
        </div>
      </Sec>

      <Sec t={paper}>
        <Title eyebrow="Campaign composer" sub="Pick who, pick what. Sample guests only.">Write once, reach the right guests.</Title>
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-5 rounded-3xl bg-white p-6 shadow-xl">
            <div><p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink/45">1 · Audience</p><div className="flex flex-wrap gap-2">{SEG.map(([n, c], i) => <button key={n} onClick={() => pick(setSeg)(i)} aria-pressed={seg === i} className="min-h-[44px] rounded-full border px-4 text-sm font-bold" style={seg === i ? { background: paper.accent, color: "#ffffff", borderColor: paper.accent } : { borderColor: line(paper, 0.2) }}>{n} <span className="opacity-60">· {c}</span></button>)}</div></div>
            <div><p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink/45">2 · Message</p><div className="space-y-2">{MSG.map((x, i) => <button key={x} onClick={() => pick(setMsg)(i)} aria-pressed={msg === i} className="block min-h-[44px] w-full rounded-2xl border px-4 py-2 text-left text-sm" style={msg === i ? { borderColor: paper.accent, background: "#efefef" } : { borderColor: line(paper, 0.15) }}>{x}</button>)}</div></div>
            <button onClick={() => setSent(true)} className="btn-primary w-full justify-center" style={{ background: paper.accent }}>{sent ? "Sent" : "Send campaign"} <Send size={16} /></button>
          </div>
          <div className="rounded-3xl p-5 shadow-xl" style={{ background: "#121212" }}>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/50">Preview · {SEG[seg][0]} ({SEG[seg][1]} guests)</p>
            <div className="flex min-h-[200px] flex-col gap-3"><Bubble out status={sent ? "read" : "sent"} key={msg}>{MSG[msg]}</Bubble>
              <AnimatePresence>{sent && SEG.slice(0, SEG[seg][1] > 3 ? 3 : SEG[seg][1]).map(([, c], i) => <motion.p key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.3 }} className="rounded-xl bg-white/10 px-3 py-2 text-xs text-white/80">✓ Delivered to guest {i + 1}</motion.p>)}</AnimatePresence></div>
          </div>
        </div>
      </Sec>

      <Block t={white} title="What the guest list can do." eyebrow="Features"><Features v="pills" m={m} t={white} /></Block>
      <Block t={wa} title="Try guest management." eyebrow="Interactive"><TryDemo m={m} t={wa} /></Block>
      <Block t={paper} left title="From a first visit to a regular." eyebrow="The journey"><Journey v="timeline" m={m} t={paper} /></Block>
      <Sec t={wa}><Stats v="line" m={m} t={wa} /></Sec>
      <Block t={white} title="Mass texts vs. a guest list." eyebrow="The gap"><Gaps v="cards" m={m} t={white} /></Block>
      {m.extra && <Block t={paper} title="Another routine."><TryDemo m={m} t={paper} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={wa} left title="Who reaches out." eyebrow="Real moments"><Uses v="quotes" m={m} t={wa} /></Block>
      <Block t={white} title="Live in three steps."><Steps v="list" m={m} t={white} /></Block>
      <Block t={paper} title="Questions, answered."><Faq m={m} t={paper} /></Block>
    </>
  );
}

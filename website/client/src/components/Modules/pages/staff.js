import React, { useState } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const TEAM = [["Asha", "Floor manager", "#f22c0e"], ["Ravi", "Head chef", "#ef4444"], ["Mina", "Server", "#f5553c"], ["Dev", "Cashier", "#f6705c"], ["Priya", "Line cook", "#e4290c"], ["Sam", "Host", "#f5573f"]];
const COLS = [["Owner plan", ["Review monthly view", "Approve new menu"]], ["Today", ["Open at 10:00", "Staff briefing", "Evening reservations"]], ["Training", ["Allergen basics", "Table service steps"]]];
const BOARD = { backgroundColor: "#f4f4f4", backgroundImage: "radial-gradient(rgba(35,35,35,0.18) 1.5px, transparent 1.5px)", backgroundSize: "14px 14px" };

export default function StaffPage({ m }) {
  const cork = mk({ bg: "#f4f4f4", ink: "#191919", card: "#f4f4f4", accent: "#e4290c" });
  const green = mk({ bg: "#f4f4f4", card: "#ffffff", accent: "#e4290c" });
  const dark = mk({ dark: true, bg: "#131313", card: "rgba(255,255,255,0.06)", accent: "#f44d34", onAccent: "#131313" });
  const [msgs, setMsgs] = useState([["Asha", "Briefing at 9:45, please."], ["Ravi", "Specials are on the board."]]);
  const [v, setV] = useState("");
  const send = (e) => { e.preventDefault(); if (!v.trim()) return; setMsgs((x) => [...x.slice(-4), ["You", v.trim()]]); setV(""); };
  const rot = [-2, 1.5, -1, 2, -1.5, 1];
  return (
    <>
      <Sec t={cork} style={{ ...heroPad, ...BOARD }}>
        <HeroText m={m} t={cork} tryLabel="Meet the team" />
        <div className="mt-8 grid gap-5 sm:grid-cols-3 lg:grid-cols-6">
          {TEAM.map(([n, r, c], i) => (
            <Reveal key={n} delay={i * 0.06}><motion.div whileHover={{ rotate: 0, y: -6 }} className="relative rounded-md bg-[#f4f4f4] p-4 text-center text-ink shadow-xl" style={{ rotate: rot[i] }}>
              <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-amber shadow" />
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full font-display text-xl font-extrabold text-white" style={{ background: c }}>{n[0]}</span>
              <p className="mt-2 font-display font-extrabold">{n}</p><p className="text-[11px] text-ink/55">{r}</p><p className="mt-1 text-[10px] font-bold text-[#e4290c]">● on shift</p></motion.div></Reveal>
          ))}
        </div>
        <p className="mt-3 text-xs" style={{ color: "rgba(25,25,25,0.7)" }}>Illustrative team.</p>
      </Sec>
      <Sec t={green}>
        <Title eyebrow="Work plan" sub="The owner's plan, today's jobs and training, side by side.">One board for the whole team.</Title>
        <div className="grid gap-4 md:grid-cols-3">{COLS.map(([h, items], c) => (
          <div key={h} className="rounded-3xl bg-white p-4 shadow-lg"><p className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold"><span className="h-3 w-3 rounded-full" style={{ background: ["#f22c0e", "#e4290c", "#f5553c"][c] }} />{h}</p>
            <ul className="space-y-2">{items.map((x, i) => <Reveal key={x} delay={i * 0.06 + c * 0.05} y={10} as="li"><div className="rounded-xl border p-3 text-sm font-semibold" style={{ borderColor: line(green) }}>{x}</div></Reveal>)}</ul></div>
        ))}</div>
        <div className="mx-auto mt-8 max-w-md overflow-hidden rounded-3xl bg-white shadow-xl">
          <p className="border-b px-5 py-3 font-display font-extrabold" style={{ borderColor: line(green) }}>Staff chat <span className="text-xs font-normal text-ink/45">· sample</span></p>
          <ul className="min-h-[150px] space-y-2 p-4">{msgs.map(([n, t], i) => <motion.li key={i + t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${n === "You" ? "ml-auto bg-[#e4290c] text-white" : "bg-black/5"}`}><b className="block text-[10px] opacity-60">{n}</b>{t}</motion.li>)}</ul>
          <form onSubmit={send} className="flex gap-2 border-t p-3" style={{ borderColor: line(green) }}><input value={v} onChange={(e) => setV(e.target.value)} aria-label="Message" placeholder="Message the team" className="min-h-[44px] flex-1 rounded-full border px-4 text-sm" style={{ borderColor: line(green, 0.25) }} /><button aria-label="Send" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e4290c] text-white"><Send size={16} /></button></form>
        </div>
      </Sec>
      <Block t={dark} left eyebrow="Everything" title="Run the team from one place."><Features v="cols" m={m} t={dark} /></Block>
      <Block t={green} title="Try the staff panel." eyebrow="Interactive"><TryDemo m={m} t={green} /></Block>
      <Block t={green} eyebrow="Hire to habit" title="A staff member's path."><Journey v="cards" m={m} t={green} /></Block>
      <Sec t={dark}><Stats v="big" m={m} t={dark} /></Sec>
      <Block t={green} eyebrow="The gap" title="Group chats and registers vs. this."><Gaps v="toggle" m={m} t={green} /></Block>
      {m.extra && <Block t={dark} title="Another routine."><TryDemo m={m} t={dark} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={green} left title="Who it helps." eyebrow="Real moments"><Uses v="list" m={m} t={green} /></Block>
      <Block t={dark} title="Live in three steps."><Steps v="row" m={m} t={dark} /></Block>
      <Block t={green} title="Questions, answered."><Faq m={m} t={green} /></Block>
    </>
  );
}

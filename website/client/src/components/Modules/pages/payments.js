import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check, Clock } from "lucide-react";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const ROWS = [["Table 4", "UPI", "Paid"], ["Table 9", "Cash", "Paid"], ["Takeaway", "Card", "Pending"], ["Table 2", "UPI", "Paid"], ["Table 6", "Cash", "Pending"], ["Table 11", "Card", "Paid"]];
const METHODS = ["All", "Cash", "UPI", "Card"];

export default function PaymentsPage({ m }) {
  const paper = mk({ bg: "#dadada", ink: "#242424", card: "#f4f4f4", accent: "#e4290c" });
  const green = mk({ dark: true, bg: "#1c1c1c", card: "rgba(255,255,255,0.06)", accent: "#f56049", onAccent: "#1c1c1c" });
  const [meth, setMeth] = useState("All");
  const [split, setSplit] = useState(false);
  const shown = ROWS.filter((r) => meth === "All" || r[1] === meth);
  return (
    <>
      <Sec t={paper} style={heroPad}>
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_380px]">
          <HeroText m={m} t={paper} h1Class="heading-hero font-display tracking-tight" tryLabel="Settle a bill" />
          <motion.div initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }} className="mx-auto w-full max-w-sm rounded-3xl bg-[#fafafa] px-6 pb-10 pt-6 font-display text-sm text-ink shadow-2xl">
            <p className="text-center text-xs font-bold tracking-[0.3em]">DISHKY · PAYMENTS</p>
            <p className="mt-1 text-center text-[11px] text-ink/50">sample receipt · today</p>
            <div className="my-3 border-t-2 border-dashed border-ink/30" />
            <div className="mb-3 flex flex-wrap gap-1.5">{METHODS.map((x) => <button key={x} onClick={() => setMeth(x)} aria-pressed={meth === x} className="min-h-[36px] rounded border px-2.5 text-[11px] font-bold" style={meth === x ? { background: "#242424", color: "#ffffff" } : { borderColor: "#24242455" }}>{x}</button>)}</div>
            <ul className="min-h-[190px] space-y-1.5">
              {shown.map(([w, mt, s], i) => (
                <motion.li key={w + mt} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-baseline gap-2">
                  <span>{w}</span><span className="flex-1 border-b border-dotted border-ink/30" /><span className="text-[11px] text-ink/60">{mt}</span>
                  <span className="flex items-center gap-0.5 font-bold" style={{ color: s === "Paid" ? "#e4290c" : "#e4290c" }}>{s === "Paid" ? <Check size={12} /> : <Clock size={12} />}{s}</span>
                </motion.li>
              ))}
            </ul>
            <div className="my-3 border-t-2 border-dashed border-ink/30" />
            <button onClick={() => setSplit((v) => !v)} className="min-h-[40px] w-full rounded border-2 border-ink text-xs font-bold hover:bg-ink hover:text-white">{split ? "Split bill: 2 ways ✓" : "Split the bill"}</button>
            <p className="mt-3 text-center text-[10px] text-ink/45">*** thank you ***</p>
          </motion.div>
        </div>
      </Sec>
      <Block t={green} left eyebrow="On the ledger" title="Every way a guest can pay."><Features v="rows" m={m} t={green} /></Block>
      <Block t={paper} title="Open the payment log." eyebrow="Interactive"><TryDemo m={m} t={paper} /></Block>
      <Block t={green} eyebrow="Order to settled" title="A bill's life."><Journey v="cards" m={m} t={green} /></Block>
      <Sec t={paper}><Stats v="line" m={m} t={paper} /></Sec>
      <Block t={paper} eyebrow="The gap" title="Guessing vs. knowing."><Gaps v="table" m={m} t={paper} /></Block>
      {m.extra && <Block t={green} title="Another routine."><TryDemo m={m} t={green} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={paper} left title="Who reconciles." eyebrow="Real moments"><Uses v="list" m={m} t={paper} /></Block>
      <Block t={green} title="Live in three steps."><Steps v="big" m={m} t={green} /></Block>
      <Block t={paper} title="Questions, answered."><Faq m={m} t={paper} /></Block>
    </>
  );
}

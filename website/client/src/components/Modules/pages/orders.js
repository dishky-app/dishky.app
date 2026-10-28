import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInterval } from "../../ui/kit.js";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const ST = ["New", "Cooking", "Ready", "Served"];
const WHO = ["Table 4 · 2 items", "Table 9 · 3 items", "Takeaway · 1 item", "Table 2 · 4 items", "Table 6 · 2 items", "Table 11 · 3 items"];
let uid = 100;

function Inbox({ t }) {
  const [rows, setRows] = useState(() => [0, 1, 2].map((i) => ({ id: uid++, who: WHO[i], st: 2 - i > 0 ? 2 - i : 0 })));
  const [sel, setSel] = useState(null);
  useInterval(() => setRows((r) => [{ id: uid++, who: WHO[uid % WHO.length], st: 0 }, ...r.map((x, i) => (i % 2 === 0 && x.st < 3 ? { ...x, st: x.st + 1 } : x))].slice(0, 6)), 2200, true);
  const cur = rows.find((r) => r.id === sel) || rows[0];
  return (
    <div className="grid overflow-hidden rounded-2xl border text-left md:grid-cols-[1.1fr_0.9fr]" style={{ borderColor: line(t, 0.25), background: t.card }}>
      <ul className="max-h-[360px] overflow-hidden border-b md:border-b-0 md:border-r" style={{ borderColor: line(t) }}>
        <AnimatePresence initial={false}>
          {rows.map((r) => (
            <motion.li key={r.id} layout initial={{ opacity: 0, x: -40, height: 0 }} animate={{ opacity: 1, x: 0, height: "auto" }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              <button onClick={() => setSel(r.id)} className="flex min-h-[56px] w-full items-center justify-between gap-3 border-b px-4 py-3 text-left" style={{ borderColor: line(t), background: cur && cur.id === r.id ? line(t, 0.08) : "transparent" }}>
                <span><span className="block font-display text-[11px]" style={{ color: mute(t, 0.5) }}>#{r.id}</span><span className="text-sm font-bold">{r.who}</span></span>
                <span className="rounded-full px-3 py-1 text-xs font-bold" style={r.st === 0 ? { background: t.accent, color: t.onAccent } : { border: `1px solid ${line(t, 0.3)}` }}>{ST[r.st]}</span>
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {cur && (
        <div className="p-5">
          <p className="font-display text-xs" style={{ color: mute(t, 0.5) }}>ORDER #{cur.id}</p>
          <p className="font-display text-2xl font-extrabold">{cur.who}</p>
          <div className="mt-5 space-y-2">
            {ST.map((s, i) => <div key={s} className="flex items-center gap-3 text-sm"><span className="h-3 w-3 rounded-full" style={{ background: i <= cur.st ? t.accent : line(t, 0.2) }} /><span style={{ opacity: i <= cur.st ? 1 : 0.4 }}>{s}</span></div>)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage({ m }) {
  const mono = mk({ bg: "#f3f3f3", card: "#ffffff", accent: "#ff3b1f" });
  const blk = mk({ dark: true, bg: "#0a0a0a", card: "rgba(255,255,255,0.05)", accent: "#ff3b1f" });
  return (
    <>
      <Sec t={mono} style={heroPad}>
        <HeroText m={m} t={mono} h1Class="heading-hero tracking-tighter" tryLabel="Watch it flow" />
        <Reveal className="mt-10"><Inbox t={mono} /></Reveal>
      </Sec>
      <Block t={blk} left eyebrow="In the inbox" title="Everything an order needs."><Features v="rows" m={m} t={blk} /></Block>
      <Block t={mono} title="Run the real thing." eyebrow="Interactive"><TryDemo m={m} t={mono} /></Block>
      <Block t={blk} eyebrow="Order to table" title="One line, four moves."><Journey v="steps" m={m} t={blk} /></Block>
      <Sec t={mono} tight><Stats v="line" m={m} t={mono} /></Sec>
      <Block t={mono} left eyebrow="The gap" title="Paper chits, meet live status."><Gaps v="strike" m={m} t={mono} /></Block>
      {m.extra && <Block t={blk} title="Another routine."><TryDemo m={m} t={blk} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={mono} title="Who lives in it." eyebrow="Real moments"><Uses v="tabs" m={m} t={mono} /></Block>
      <Block t={blk} title="Live in three steps."><Steps v="list" m={m} t={blk} /></Block>
      <Block t={mono} title="Questions, answered."><Faq m={m} t={mono} /></Block>
    </>
  );
}

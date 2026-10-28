import React, { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const ITEMS = [["Tomatoes", "#e5482d"], ["Rice", "#d8d8d8"], ["Paneer", "#eaeaea"], ["Oil", "#f33417"], ["Flour", "#ececec"], ["Spices", "#e4290c"]];
const DISHES = { "Margherita": [30, 0, 0, 5, 25, 0], "Veg biryani": [10, 30, 15, 8, 0, 20], "Paneer tikka": [5, 0, 25, 6, 0, 18] };
const MIN = 22;

function Jar({ name, color, v }) {
  const low = v < MIN;
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-32 w-16 overflow-hidden rounded-b-2xl rounded-t-lg border-4 border-[#e4290c] bg-white/60 md:h-40 md:w-20">
        <motion.div className="absolute inset-x-0 bottom-0" style={{ background: color }} animate={{ height: `${v}%` }} transition={{ type: "spring", stiffness: 80, damping: 14 }} />
        {low && <motion.span animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="absolute inset-0 flex items-center justify-center bg-red-500/20 text-amber"><AlertTriangle size={24} /></motion.span>}
      </div>
      <p className="mt-2 text-xs font-bold text-[#282828]">{name}</p>
      <p className="font-display text-[10px] font-bold" style={{ color: low ? "#dc2626" : "#e4290c" }}>{low ? "LOW STOCK" : `${Math.round(v)}%`}</p>
    </div>
  );
}

export default function InventoryPage({ m }) {
  const kraft = mk({ bg: "#d7d7d7", card: "#eeeeee", accent: "#e4290c" });
  const dark = mk({ dark: true, bg: "#111111", card: "rgba(255,255,255,0.05)", accent: "#f44125", onAccent: "#111111" });
  const [lv, setLv] = useState([80, 70, 85, 60, 75, 90]);
  const [last, setLast] = useState(null);
  const sell = (d) => { setLast(d); setLv((a) => a.map((x, i) => Math.max(0, x - DISHES[d][i] * 0.6))); };
  return (
    <>
      <Sec t={kraft} style={heroPad}>
        <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <HeroText m={m} t={kraft} tryLabel="Run the pantry" h1Class="heading-hero" />
          <div>
            <div className="rounded-3xl p-5 shadow-xl" style={{ background: "#e3e3e3" }}>
              <div className="grid grid-cols-3 gap-y-0 md:grid-cols-6">
                {ITEMS.map(([n, c], i) => (
                  <div key={n} className="border-b-[10px] border-[#e4290c] pb-1">
                    <Jar name={n} color={c} v={lv[i]} />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: mute(kraft) }}>Sell a dish:</span>
              {Object.keys(DISHES).map((d) => <button key={d} onClick={() => sell(d)} className="min-h-[44px] rounded-full border-2 px-4 text-sm font-bold transition-colors hover:bg-ink hover:text-white" style={{ borderColor: "#282828" }}>{d}</button>)}
              <button onClick={() => { setLv([80, 70, 85, 60, 75, 90]); setLast(null); }} className="min-h-[44px] px-3 text-xs font-bold underline">Restock</button>
            </div>
            <p className="mt-2 text-sm" style={{ color: mute(kraft, 0.7) }}>{last ? `Selling "${last}" uses its recipe ingredients, so stock drops on its own.` : "Each dish remembers its ingredients."}</p>
          </div>
        </div>
      </Sec>
      <Block t={dark} left eyebrow="On the shelf" title="What stock tracking covers."><Features v="cols" m={m} t={dark} /></Block>
      <Block t={kraft} title="Count the pantry." eyebrow="Interactive"><TryDemo m={m} t={kraft} /></Block>
      <Block t={dark} eyebrow="Delivery to dish" title="Stock's journey."><Journey v="timeline" m={m} t={dark} /></Block>
      <Sec t={kraft}><Stats v="cards" m={m} t={kraft} /></Sec>
      <Block t={kraft} eyebrow="The gap" title="Guesswork vs. alerts."><Gaps v="strike" m={m} t={kraft} /></Block>
      {m.extra && <Block t={dark} title="Another routine."><TryDemo m={m} t={dark} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={kraft} title="Who counts the shelves." eyebrow="Real moments"><Uses v="tabs" m={m} t={kraft} /></Block>
      <Block t={dark} title="Live in three steps."><Steps v="list" m={m} t={dark} /></Block>
      <Block t={kraft} title="Questions, answered."><Faq m={m} t={kraft} /></Block>
    </>
  );
}

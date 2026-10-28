import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, CalendarCheck, PartyPopper, Camera, Play, Pause, MapPin } from "lucide-react";
import Img from "../ui/Img.js";
import Count from "../ui/Count.js";
import { images } from "../../assets/images/imageUrls.js";

const TYPES = [
  { key: "tasting", label: "Tasting night", title: "Tasting Night", img: images.dishDessert, tone: "#f66a55" },
  { key: "chef", label: "Chef's table", title: "Chef's Table", img: images.chefPlating, tone: "#f33716" },
  { key: "festive", label: "Festive menu", title: "Festive Feast", img: images.foodSpread, tone: "#ea2a0c" },
  { key: "popup", label: "Pop-up", title: "Pop-up Kitchen", img: images.grill, tone: "#e4290c" },
  { key: "launch", label: "Launch", title: "Launch Party", img: images.dinnerEvent, tone: "#ed2b0d" },
];
const STAGES = [
  { icon: Megaphone, label: "Announced" },
  { icon: CalendarCheck, label: "Booked" },
  { icon: PartyPopper, label: "Event night" },
  { icon: Camera, label: "Recap" },
];

/** Choose an event, then play it from announcement to recap. */
export default function EventBuilder() {
  const [t, setT] = useState(0);
  const [stage, setStage] = useState(0);
  const [play, setPlay] = useState(true);
  useEffect(() => {
    if (!play) return undefined;
    const id = setInterval(() => setStage((s) => (s + 1) % STAGES.length), 2200);
    return () => clearInterval(id);
  }, [play]);
  const ev = TYPES[t];
  const booked = [0, 38, 96, 96][stage];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div className="overflow-hidden rounded-[1.75rem] border border-ink/10 bg-white shadow-xl">
        <AnimatePresence mode="wait">
          <motion.div key={ev.key} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <Img src={ev.img} alt={ev.title} tone={ev.tone} className="aspect-[4/3] w-full">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute inset-x-5 bottom-5 text-white">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Dishky × Your Restaurant</p>
                <p className="mt-1 font-display text-3xl font-extrabold leading-none">{ev.title}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-white/80"><MapPin size={13} /> Your Restaurant</p>
              </div>
            </Img>
          </motion.div>
        </AnimatePresence>
        <div className="flex flex-wrap gap-2 p-4">
          {TYPES.map((x, n) => (
            <button key={x.key} type="button" onClick={() => { setT(n); setStage(0); }} style={{ minHeight: 34 }} className={`rounded-full px-3.5 text-xs font-bold transition ${n === t ? "bg-ink text-cream" : "bg-ink/[0.06] text-ink/60 hover:bg-ink/10"}`}>{x.label}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-col justify-between rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-xl sm:p-7">
        <ol className="relative space-y-1">
          <span aria-hidden="true" className="absolute bottom-6 left-[21px] top-6 w-[3px] rounded bg-ink/10" />
          <motion.span aria-hidden="true" className="absolute left-[21px] top-6 w-[3px] origin-top rounded bg-amber" animate={{ height: `${(stage / (STAGES.length - 1)) * 78}%` }} transition={{ duration: 0.6 }} />
          {STAGES.map(({ icon: Icon, label }, i) => (
            <li key={label}>
              <button type="button" onClick={() => { setStage(i); setPlay(false); }} style={{ minHeight: 0 }} className="relative flex w-full items-center gap-4 rounded-2xl p-2 text-left">
                <motion.span animate={{ scale: stage === i ? 1.15 : 1 }} className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-500 ${stage >= i ? "bg-amber text-white" : "bg-ink/10 text-ink/40"}`}><Icon size={18} /></motion.span>
                <span className={`font-display text-sm font-bold ${stage >= i ? "text-ink" : "text-ink/40"}`}>{label}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex items-end justify-between gap-4 border-t border-ink/10 pt-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink/40">Guests booked</p>
            <p className="font-display text-4xl font-extrabold text-ink"><Count value={booked} /></p>
          </div>
          <button type="button" onClick={() => setPlay((p) => !p)} aria-label={play ? "Pause" : "Play"} className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-cream">{play ? <Pause size={16} /> : <Play size={16} />}</button>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ClipboardList, ChefHat, Minus, Plus, Check, PartyPopper } from "lucide-react";
import { Reveal, Segmented, CountUp, BrowserFrame } from "../../Kit/Kit.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHIFTS = ["Morning", "Evening"];
const COOKS = [
  { id: "A", name: "Arjun", color: "#f33716" },
  { id: "M", name: "Meera", color: "#f66a55" },
  { id: "R", name: "Ravi", color: "#e4290c" },
  { id: "S", name: "Sana", color: "#f44125" },
];
const INIT_ROTA = {
  "0-0": "A", "0-1": "M", "1-0": "R", "1-1": "A", "2-0": "M", "2-1": null, "3-0": "S", "3-1": "R",
  "4-0": "A", "4-1": "S", "5-0": null, "5-1": "M", "6-0": "R", "6-1": null,
};
const STATIONS = [
  { id: "tandoor", name: "Tandoor", tasks: ["Light coals", "Marinate tikka", "Knead dough"] },
  { id: "curry", name: "Curry", tasks: ["Fry onion base", "Simmer gravy", "Prep tadka"] },
  { id: "cold", name: "Cold", tasks: ["Cut salads", "Whisk raita", "Chill desserts"] },
];
const DISHES = [
  { id: "biryani", name: "Chicken biryani", base: 4, rows: [["Basmati rice", 400, "g", 9], ["Chicken", 500, "g", 14], ["Curd", 120, "g", 3], ["Biryani masala", 20, "g", 5], ["Ghee", 40, "ml", 8]] },
  { id: "butter", name: "Butter chicken", base: 4, rows: [["Chicken", 600, "g", 14], ["Tomato", 400, "g", 4], ["Butter", 60, "g", 7], ["Cream", 100, "ml", 6], ["Kasuri methi", 5, "g", 12]] },
  { id: "paneer", name: "Paneer tikka", base: 4, rows: [["Paneer", 400, "g", 9], ["Capsicum", 150, "g", 3], ["Hung curd", 150, "g", 4], ["Tikka masala", 25, "g", 6]] },
];

function Avatar({ cook, size = 32 }) {
  return (
    <motion.span key={cook ? cook.id : "none"} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 420, damping: 20 }}
      className="flex items-center justify-center rounded-full font-display text-[12px] font-bold text-white"
      style={{ width: size, height: size, background: cook ? cook.color : "transparent", border: cook ? "none" : "1.5px dashed rgba(128,128,128,.5)", color: cook ? "#ffffff" : "rgba(128,128,128,.7)" }}>
      {cook ? cook.id : "+"}
    </motion.span>
  );
}

function Ring({ pct, done }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" role="img" aria-label={`Progress ${Math.round(pct)}%`}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="8" />
        <motion.circle cx="40" cy="40" r={r} fill="none" stroke={done ? "#e4290c" : "#f33716"} strokeWidth="8" strokeLinecap="round" strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }} transition={{ duration: 0.6, ease: "easeOut" }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-extrabold">{done ? <PartyPopper size={26} className="text-amber" /> : <CountUp to={pct} suffix="%" duration={0.5} />}</span>
    </div>
  );
}

export default function KitchenManagementDemo({ dark = false }) {
  const [tab, setTab] = useState("rota");
  const [rota, setRota] = useState(INIT_ROTA);
  const [checked, setChecked] = useState({ "tandoor-0": true });
  const [dishId, setDishId] = useState("biryani");
  const [servings, setServings] = useState(4);
  const [burst, setBurst] = useState(false);

  const cycle = (key) => setRota((r) => {
    const i = COOKS.findIndex((c) => c.id === r[key]);
    return { ...r, [key]: i + 1 >= COOKS.length ? null : COOKS[i + 1].id };
  });
  const filled = Object.values(rota).filter(Boolean).length;
  const coverage = Math.round((filled / 14) * 100);

  const total = STATIONS.reduce((n, s) => n + s.tasks.length, 0);
  const doneCount = Object.values(checked).filter(Boolean).length;
  const pct = (doneCount / total) * 100;
  const allDone = doneCount === total;
  useEffect(() => {
    if (!allDone) { setBurst(false); return undefined; }
    setBurst(true);
    const t = setTimeout(() => setBurst(false), 1800);
    return () => clearTimeout(t);
  }, [allDone]);

  const dish = DISHES.find((d) => d.id === dishId);
  const scale = servings / dish.base;
  const cost = dish.rows.reduce((n, r) => n + (r[1] * scale * r[3]) / (r[2] === "g" || r[2] === "ml" ? 100 : 1), 0) / servings;

  const sub = dark ? "text-white/55" : "text-ink/50";
  const card = dark ? "bg-white/5 border-white/10" : "bg-beige border-ink/10";
  const text = dark ? "text-white" : "text-ink";

  return (
    <Reveal className="w-full">
      <div className="mx-auto w-full max-w-[980px]">
        <BrowserFrame title="admin.dishky.com/kitchen" dark={dark}>
          <div className={`min-w-0 ${text}`}>
            <div className="mb-4 flex justify-center">
              <Segmented dark={dark} value={tab} onChange={setTab} options={[
                { value: "rota", label: "Rota", icon: CalendarDays }, { value: "prep", label: "Prep list", icon: ClipboardList }, { value: "recipe", label: "Recipe", icon: ChefHat }]} />
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                {tab === "rota" && (
                  <div>
                    <div className={`mb-3 flex items-center gap-3 rounded-2xl border p-3 ${card}`}>
                      <span className="font-display text-xl font-extrabold"><CountUp to={coverage} suffix="%" duration={0.5} /></span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/10">
                        <motion.div className="h-full rounded-full" animate={{ width: `${coverage}%`, background: coverage === 100 ? "#e4290c" : "#f33716" }} transition={{ duration: 0.5 }} />
                      </div>
                      <span className={`text-[11px] font-semibold ${sub}`}>Coverage</span>
                    </div>
                    <div className="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-1 sm:gap-2">
                      <span />
                      {DAYS.map((d) => <span key={d} className={`text-center text-[10px] font-bold uppercase sm:text-[11px] ${sub}`}>{d}</span>)}
                      {SHIFTS.map((s, si) => (
                        <React.Fragment key={s}>
                          <span className={`flex items-center pr-1 text-[10px] font-semibold sm:text-[11px] ${sub}`}>{s.slice(0, 3)}</span>
                          {DAYS.map((d, di) => {
                            const key = `${di}-${si}`;
                            const cook = COOKS.find((c) => c.id === rota[key]);
                            return (
                              <button key={key} type="button" aria-label={`${d} ${s}: ${cook ? cook.name : "unassigned"}. Tap to change`} onClick={() => cycle(key)}
                                className={`flex min-h-[44px] items-center justify-center rounded-xl border transition hover:scale-105 active:scale-95 ${card}`}>
                                <Avatar cook={cook} size={30} />
                              </button>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {COOKS.map((c) => <span key={c.id} className={`flex items-center gap-1.5 text-[11px] font-semibold ${sub}`}><Avatar cook={c} size={20} />{c.name}</span>)}
                      <span className={`ml-auto text-[11px] ${sub}`}>Tap a cell to cycle</span>
                    </div>
                  </div>
                )}
                {tab === "prep" && (
                  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="relative flex items-center gap-4 sm:flex-col">
                      <Ring pct={pct} done={allDone} />
                      <p className={`text-[12px] font-semibold ${sub}`}>{doneCount}/{total} done</p>
                      <AnimatePresence>
                        {burst && [...Array(10)].map((_, i) => (
                          <motion.span key={i} className="absolute left-12 top-12 h-2 w-2 rounded-full" style={{ background: COOKS[i % 4].color }}
                            initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos(i * 0.63) * 70, y: Math.sin(i * 0.63) * 70, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.1 }} />
                        ))}
                      </AnimatePresence>
                    </div>
                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-3">
                      {STATIONS.map((s) => (
                        <div key={s.id} className={`rounded-2xl border p-3 ${card}`}>
                          <p className="mb-1 font-display text-[13px] font-bold">{s.name}</p>
                          {s.tasks.map((t, i) => {
                            const k = `${s.id}-${i}`; const on = !!checked[k];
                            return (
                              <button key={k} type="button" aria-label={`${t}: ${on ? "done" : "to do"}`} aria-pressed={on} onClick={() => setChecked((c) => ({ ...c, [k]: !c[k] }))}
                                className="flex min-h-[40px] w-full items-center gap-2.5 text-left text-[13px]">
                                <motion.span animate={{ background: on ? "#f33716" : "rgba(128,128,128,0)", borderColor: on ? "#f33716" : "rgba(128,128,128,.5)" }}
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2">
                                  <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check size={13} className="text-white" strokeWidth={3} /></motion.span>}</AnimatePresence>
                                </motion.span>
                                <span className={`transition ${on ? "line-through opacity-45" : ""}`}>{t}</span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {tab === "recipe" && (
                  <div>
                    <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                      {DISHES.map((d) => (
                        <button key={d.id} type="button" aria-label={`Recipe: ${d.name}`} aria-pressed={d.id === dishId} onClick={() => setDishId(d.id)}
                          className={`min-h-[40px] shrink-0 rounded-full border px-4 text-[12px] font-semibold transition ${d.id === dishId ? "border-amber bg-amber text-white shadow-lg" : card}`}>{d.name}</button>
                      ))}
                    </div>
                    <div className={`rounded-2xl border p-3 sm:p-4 ${card}`}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${sub}`}>Servings</span>
                        <div className="flex items-center gap-2">
                          <button type="button" aria-label="Fewer servings" onClick={() => setServings((s) => Math.max(1, s - 1))} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/10 active:scale-90"><Minus size={16} /></button>
                          <span className="w-8 text-center font-display text-lg font-extrabold">{servings}</span>
                          <button type="button" aria-label="More servings" onClick={() => setServings((s) => Math.min(40, s + 1))} className="flex h-10 w-10 items-center justify-center rounded-full bg-amber text-white active:scale-90"><Plus size={16} /></button>
                        </div>
                      </div>
                      <AnimatePresence mode="popLayout">
                        {dish.rows.map((r) => (
                          <motion.div key={dish.id + r[0]} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                            className="flex items-center justify-between border-t border-black/5 py-2 text-[13px]">
                            <span className="min-w-0 truncate">{r[0]}</span>
                            <span className="font-display font-bold tabular-nums"><CountUp to={r[1] * scale} duration={0.4} /> <span className={`text-[11px] font-medium ${sub}`}>{r[2]}</span></span>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      <div className="mt-2 flex items-center justify-between rounded-xl bg-amber px-3 py-2.5 text-white">
                        <span className="text-[12px] font-semibold">Cost per plate</span>
                        <span className="font-display text-lg font-extrabold"><CountUp to={cost} prefix="₹" decimals={1} duration={0.4} /></span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </BrowserFrame>
      </div>
    </Reveal>
  );
}

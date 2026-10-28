import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, PartyPopper, Crown, Minus, Plus, Cake, Gift, Music, Briefcase, Heart, Sparkles, Check, Ticket, Gem } from "lucide-react";
import { Reveal, CountUp, Segmented, Chip } from "../../Kit/Kit.js";

const SLOTS = ["6:00", "6:30", "7:00", "7:30", "8:00", "8:30", "9:00", "9:30", "10:00"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const OCCASIONS = [
  { id: "bday", label: "Birthday", Icon: Cake, base: 2500 },
  { id: "anni", label: "Anniversary", Icon: Heart, base: 3200 },
  { id: "corp", label: "Corporate", Icon: Briefcase, base: 6000 },
];
const ADDONS = [
  { id: "cake", label: "Cake", Icon: Cake, price: 800 },
  { id: "decor", label: "Decor", Icon: Gift, price: 1500 },
  { id: "music", label: "Live music", Icon: Music, price: 2200 },
];
const TIERS = [
  { name: "Silver", at: 0, color: "#a0a0a0" },
  { name: "Gold", at: 500, color: "#f33113" },
  { name: "Platinum", at: 1200, color: "#f66a55" },
];
const ORDERS = [450, 900, 1800];

const isBooked = (d, s) => (d * 5 + s * 3 + 2) % 4 === 0;

export default function GuestManagementDemo({ dark = false }) {
  const [tab, setTab] = useState("res");
  const card = dark ? "bg-white/5 border-white/10 text-white" : "bg-white border-ink/10 text-ink";
  const sub = dark ? "text-white/55" : "text-ink/50";
  const soft = dark ? "bg-white/5" : "bg-beige";

  /* reservations */
  const [day, setDay] = useState(0);
  const [pick, setPick] = useState(null);
  const [party, setParty] = useState(2);
  const [extra, setExtra] = useState({});
  const [ticket, setTicket] = useState(null);
  const [taken, setTaken] = useState(null);
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(2026, 9, 9 + i); return { n: d.getDate(), w: DOW[d.getDay()] }; });
  const booked = (d, s) => isBooked(d, s) || !!extra[`${d}-${s}`];
  const tap = (s) => {
    if (booked(day, s)) { setTaken({ s, k: Date.now() }); later(() => setTaken(null), 1200); return; }
    setPick(s);
  };
  const book = () => {
    if (pick == null) return;
    setTicket({ id: Date.now(), table: `T${((day * 3 + pick * 2) % 14) + 1}`, slot: SLOTS[pick], day: days[day], party });
    setExtra((e) => ({ ...e, [`${day}-${pick}`]: true }));
    setPick(null);
  };

  /* celebrations */
  const [occ, setOcc] = useState("bday");
  const [adds, setAdds] = useState({ cake: true });
  const price = OCCASIONS.find((o) => o.id === occ).base + ADDONS.reduce((a, x) => a + (adds[x.id] ? x.price : 0), 0);

  /* loyalty */
  const [earned, setEarned] = useState(380);
  const [spent, setSpent] = useState(0);
  const [burst, setBurst] = useState([]);
  const pts = earned - spent;
  const ti = TIERS.reduce((a, t, i) => (earned >= t.at ? i : a), 0);
  const tier = TIERS[ti], next = TIERS[ti + 1];
  const pct = next ? ((earned - tier.at) / (next.at - tier.at)) * 100 : 100;
  const order = (amt) => {
    setEarned((e) => e + Math.round(amt / 10));
    const id = Date.now();
    setBurst((b) => [...b, ...Array.from({ length: 12 }, (_, i) => ({ id: `${id}-${i}`, a: (i / 12) * Math.PI * 2, r: 38 + Math.random() * 30 }))]);
    later(() => setBurst((b) => b.filter((p) => !String(p.id).startsWith(String(id)))), 900);
  };
  const redeem = () => pts >= 200 && setSpent((s) => s + 200);

  return (
    <Reveal className="w-full">
      <div className="mx-auto w-full max-w-[980px]">
        <div className="mb-4 flex justify-center">
          <Segmented dark={dark} value={tab} onChange={setTab} options={[{ value: "res", label: "Reservations", icon: CalendarCheck }, { value: "cel", label: "Celebrations", icon: PartyPopper }, { value: "loy", label: "Loyalty", icon: Crown }]} />
        </div>
        <AnimatePresence mode="wait">
          {tab === "res" && (
            <motion.section key="res" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`grid gap-4 rounded-3xl border p-4 shadow-sm sm:p-5 md:grid-cols-[1.4fr_1fr] ${card}`}>
              <div className="min-w-0">
                <div className="flex gap-1.5 overflow-x-auto pb-2">
                  {days.map((d, i) => (
                    <button key={i} type="button" aria-label={`Day ${d.w} ${d.n}`} aria-pressed={i === day} onClick={() => { setDay(i); setPick(null); }}
                      className={`flex min-h-[56px] min-w-[46px] flex-1 flex-col items-center justify-center rounded-2xl text-[11px] font-semibold transition ${i === day ? "bg-amber text-white shadow-lg" : soft}`}>
                      <span className="opacity-70">{d.w}</span><span className="font-display text-base font-extrabold">{d.n}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {SLOTS.map((s, i) => {
                    const b = booked(day, i), on = pick === i, t = taken?.s === i;
                    return (
                      <motion.button key={`${day}-${i}-${t ? taken.k : 0}`} type="button" aria-label={`${s} ${b ? "booked" : "free"}`} onClick={() => tap(i)}
                        animate={t ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }} transition={{ duration: 0.4 }}
                        className={`relative min-h-[44px] overflow-hidden rounded-xl border text-[12px] font-bold transition ${b ? "cursor-not-allowed border-transparent text-ink/35" : on ? "border-amber bg-amber text-white shadow-lg" : dark ? "border-white/15 hover:bg-white/10" : "border-ink/15 hover:bg-beige"}`}
                        style={b ? { backgroundImage: "repeating-linear-gradient(135deg, rgba(120,120,120,.18) 0 5px, transparent 5px 10px)" } : undefined}>
                        {t ? <span className="text-amber">Taken</span> : s}
                      </motion.button>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className={`flex items-center gap-1 rounded-full p-1 ${soft}`}>
                    <button type="button" aria-label="Fewer guests" onClick={() => setParty((p) => Math.max(1, p - 1))} className="flex h-10 w-10 items-center justify-center rounded-full"><Minus size={15} /></button>
                    <span className="w-12 text-center font-display text-sm font-bold">{party} guests</span>
                    <button type="button" aria-label="More guests" onClick={() => setParty((p) => Math.min(10, p + 1))} className="flex h-10 w-10 items-center justify-center rounded-full"><Plus size={15} /></button>
                  </div>
                  <button type="button" aria-label="Book table" disabled={pick == null} onClick={book}
                    className="kit-sheen flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl bg-amber px-5 font-display text-sm font-bold text-white shadow-lg transition hover:bg-amberLight disabled:opacity-40"><Ticket size={16} />Book table</button>
                </div>
              </div>
              <div className="flex min-h-[200px] items-center justify-center">
                <AnimatePresence mode="wait">
                  {ticket ? (
                    <motion.div key={ticket.id} initial={{ scale: 0.7, rotate: -6, opacity: 0 }} animate={{ scale: 1, rotate: -2, opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", stiffness: 220, damping: 15 }}
                      className="w-full max-w-[260px] overflow-hidden rounded-3xl bg-ink text-white shadow-2xl">
                      <div className="flex items-center justify-between bg-amber px-4 py-2 text-[11px] font-bold"><span>Confirmed</span><Check size={14} /></div>
                      <div className="p-4 text-center">
                        <p className="text-[10px] uppercase tracking-widest text-white/50">Table</p>
                        <p className="font-display text-5xl font-extrabold">{ticket.table}</p>
                        <p className="mt-2 text-sm font-semibold">{ticket.day.w} {ticket.day.n} · {ticket.slot} pm</p>
                        <p className="text-xs text-white/60">{ticket.party} guests</p>
                      </div>
                      <div className="border-t border-dashed border-white/20 px-4 py-2 text-center text-[10px] tracking-[0.3em] text-white/40">|| ||| | |||| ||</div>
                    </motion.div>
                  ) : (
                    <motion.p key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`text-center text-xs ${sub}`}>Pick a free slot</motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.section>
          )}

          {tab === "cel" && (
            <motion.section key="cel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${card}`}>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {OCCASIONS.map((o) => (
                  <button key={o.id} type="button" aria-label={o.label} aria-pressed={occ === o.id} onClick={() => setOcc(o.id)}
                    className={`flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border text-[12px] font-bold transition ${occ === o.id ? "border-amber bg-amber text-white shadow-lg" : dark ? "border-white/10" : `border-ink/10 ${soft}`}`}>
                    <motion.span animate={occ === o.id ? { rotate: [0, -12, 12, 0], scale: 1.15 } : { scale: 1 }}><o.Icon size={26} /></motion.span>{o.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {ADDONS.map((a) => {
                  const on = !!adds[a.id];
                  return (
                    <button key={a.id} type="button" role="switch" aria-checked={on} aria-label={`${a.label} add-on`} onClick={() => setAdds((s) => ({ ...s, [a.id]: !s[a.id] }))}
                      className={`flex min-h-[48px] items-center gap-3 rounded-2xl border px-3 text-left text-[13px] font-semibold transition ${dark ? "border-white/10" : "border-ink/10"}`}>
                      <a.Icon size={16} className="text-amber" /><span className="flex-1">{a.label}<span className={`block text-[10px] font-medium ${sub}`}>+₹{a.price.toLocaleString("en-IN")}</span></span>
                      <span className={`relative h-6 w-10 rounded-full transition ${on ? "bg-amber" : dark ? "bg-white/20" : "bg-ink/15"}`}>
                        <motion.span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" animate={{ left: on ? 18 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-ink px-5 py-4 text-white">
                <span className="flex items-center gap-2 text-xs text-white/60"><Sparkles size={14} className="text-amber" />Package</span>
                <span className="font-display text-3xl font-extrabold"><CountUp to={price} prefix="₹" duration={0.6} /></span>
              </div>
            </motion.section>
          )}

          {tab === "loy" && (
            <motion.section key="loy" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`grid gap-4 rounded-3xl border p-4 shadow-sm sm:p-5 md:grid-cols-2 ${card}`}>
              <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl" style={{ background: `linear-gradient(140deg, #1a1a1a, ${tier.color})`, transition: "background .6s" }}>
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0">
                    <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden="true">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="7" />
                      <motion.circle cx="40" cy="40" r="34" fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" strokeDasharray={213.6} animate={{ strokeDashoffset: 213.6 * (1 - pct / 100) }} transition={{ duration: 0.8 }} />
                    </svg>
                    <Gem size={24} className="absolute inset-0 m-auto" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-extrabold">Aarav Menon</p>
                    <Chip tone="brand">{tier.name}</Chip>
                    <p className="mt-1 font-display text-3xl font-extrabold leading-none"><CountUp to={pts} duration={0.6} /> <span className="text-xs font-semibold opacity-70">pts</span></p>
                  </div>
                </div>
                <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">
                  <motion.div className="h-full rounded-full bg-white" animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
                </div>
                <div className="mt-1 flex justify-between text-[10px] font-semibold text-white/70">{TIERS.map((t) => <span key={t.name}>{t.name}</span>)}</div>
                <div className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden="true">
                  {burst.map((p) => (
                    <motion.span key={p.id} className="absolute h-2 w-2 rounded-full bg-amberLight" initial={{ x: 0, y: 0, opacity: 1, scale: 1 }} animate={{ x: Math.cos(p.a) * p.r * 2, y: Math.sin(p.a) * p.r * 2, opacity: 0, scale: 0.3 }} transition={{ duration: 0.8 }} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col justify-center gap-2">
                {ORDERS.map((a) => (
                  <button key={a} type="button" aria-label={`Place ₹${a} order`} onClick={() => order(a)}
                    className={`flex min-h-[48px] items-center justify-between rounded-2xl border px-4 text-sm font-bold transition active:scale-[.98] ${dark ? "border-white/10 hover:bg-white/10" : `border-ink/10 hover:bg-beige`}`}>
                    <span>Place ₹{a.toLocaleString("en-IN")} order</span><span className="text-amber">+{a / 10}</span>
                  </button>
                ))}
                <button type="button" aria-label="Redeem 200 points" disabled={pts < 200} onClick={redeem}
                  className="min-h-[48px] rounded-2xl bg-amber font-display text-sm font-bold text-white shadow-lg transition hover:bg-amberLight disabled:opacity-40">Redeem 200 pts</button>
                <p className={`text-center text-[11px] ${sub}`}>{next ? `${next.at - earned} pts to ${next.name}` : "Top tier reached"}</p>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </Reveal>
  );
}

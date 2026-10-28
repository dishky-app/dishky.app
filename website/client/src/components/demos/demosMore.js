import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, Minus, Plus, Clock, Heart, Star, UserCheck, ArrowRight, Truck } from "lucide-react";
import { Window, Pill, Phone, useInterval } from "../ui/kit.js";
import { images } from "../../assets/images/imageUrls.js";
import { Photo } from "../ui/kit.js";

const soft = { background: "rgba(255,255,255,0.05)" };

function Tag({ children, tone = "amber" }) {
  const c = tone === "green" ? "text-[#f77a67] bg-[#f77a67]/10" : tone === "grey" ? "text-cream/50 bg-white/5" : "text-amberLight bg-amber/15";
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${c}`}>{children}</span>;
}

/* ------------------------------------------------------------ Reservations */
const SLOTS = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"];
const TABLES = ["T1 · 2 seats", "T2 · 2 seats", "T3 · 4 seats", "T4 · 4 seats", "T5 · 6 seats"];
export function ReservationsDemo() {
  const days = ["Fri", "Sat", "Sun"];
  const [day, setDay] = useState(0);
  const [taken, setTaken] = useState({ "0-T1 · 2 seats-19:00": 1, "0-T3 · 4 seats-20:00": 1, "1-T4 · 4 seats-19:30": 1 });
  const [mine, setMine] = useState([]);
  const toggle = (k) => {
    if (taken[k]) return;
    setMine((m) => (m.includes(k) ? m.filter((x) => x !== k) : [...m, k]));
  };
  return (
    <Window title="Reservations · illustrative demo">
      <div className="p-4 md:p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {days.map((d, i) => <Pill key={d} active={day === i} onClick={() => setDay(i)}>{d}</Pill>)}
          <span className="ml-auto self-center text-xs text-cream/50">{mine.length} selected</span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[560px] space-y-1.5">
            {TABLES.map((t) => (
              <div key={t} className="grid grid-cols-[96px_repeat(8,1fr)] items-center gap-1.5">
                <span className="text-[11px] text-cream/60">{t}</span>
                {SLOTS.map((s) => {
                  const k = `${day}-${t}-${s}`;
                  const isT = taken[k], isM = mine.includes(k);
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={!!isT}
                      aria-label={`${t} at ${s}`}
                      aria-pressed={isM}
                      onClick={() => toggle(k)}
                      className={`h-9 rounded-lg text-[10px] font-semibold transition-all duration-300 ${isT ? "cursor-not-allowed bg-white/5 text-cream/25 line-through" : isM ? "scale-105 bg-amber text-white" : "bg-white/10 text-cream/70 hover:bg-white/20"}`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[11px] text-cream/40">Sample slots only. Nothing is booked.</p>
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------ Celebrations */
const OCCASIONS = {
  Birthday: ["Cake & candle moment", "Balloon corner", "Photo wall", "Kids' menu"],
  Anniversary: ["Candle-lit table", "Flower arrangement", "Dessert on the house", "Live music"],
  Corporate: ["Private room", "Projector", "Set menu", "Name cards"],
};
export function CelebrationsDemo() {
  const [occ, setOcc] = useState("Birthday");
  const [picked, setPicked] = useState({});
  const [guests, setGuests] = useState(12);
  const sel = OCCASIONS[occ].filter((x) => picked[occ + x]);
  return (
    <Window title="Celebrations · illustrative demo">
      <div className="grid gap-5 p-4 md:grid-cols-[1.2fr_1fr] md:p-5">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">{Object.keys(OCCASIONS).map((o) => <Pill key={o} active={occ === o} onClick={() => setOcc(o)}>{o}</Pill>)}</div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {OCCASIONS[occ].map((x) => {
              const on = picked[occ + x];
              return (
                <li key={x}>
                  <button type="button" aria-pressed={!!on} onClick={() => setPicked((p) => ({ ...p, [occ + x]: !on }))}
                    className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl p-3 text-left text-sm transition-all ${on ? "ring-2 ring-amber" : ""}`} style={soft}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${on ? "border-amber bg-amber" : "border-white/25"}`}>{on && <Check size={12} />}</span>
                    {x}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="rounded-2xl p-4" style={soft}>
          <p className="text-xs font-bold uppercase tracking-wider text-cream/50">Request summary</p>
          <p className="mt-2 font-display text-lg font-extrabold">{occ} for {guests}</p>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" aria-label="Fewer guests" onClick={() => setGuests((g) => Math.max(2, g - 1))} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><Minus size={14} /></button>
            <span className="w-8 text-center font-bold">{guests}</span>
            <button type="button" aria-label="More guests" onClick={() => setGuests((g) => g + 1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><Plus size={14} /></button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">{sel.length ? sel.map((s) => <Tag key={s}>{s}</Tag>) : <span className="text-xs text-cream/40">Pick what you need</span>}</div>
        </div>
      </div>
    </Window>
  );
}

/* ----------------------------------------------------------------- Catering */
const TRAYS = ["Veg starters", "Biryani", "Grilled platter", "Breads", "Desserts"];
export function CateringDemo() {
  const [heads, setHeads] = useState(40);
  const [on, setOn] = useState(["Biryani", "Desserts"]);
  return (
    <Window title="Catering · illustrative demo">
      <div className="p-4 md:p-5">
        <label className="mb-1 flex items-center justify-between text-xs font-semibold text-cream/60" htmlFor="heads">
          Guests <span className="text-base font-extrabold text-cream">{heads}</span>
        </label>
        <input id="heads" type="range" min={10} max={200} step={5} value={heads} onChange={(e) => setHeads(+e.target.value)} className="w-full accent-[#f33716]" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ul className="space-y-2">
            {TRAYS.map((t) => {
              const a = on.includes(t);
              return (
                <li key={t}>
                  <button type="button" aria-pressed={a} onClick={() => setOn((o) => (a ? o.filter((x) => x !== t) : [...o, t]))}
                    className={`flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 text-sm transition-all ${a ? "ring-2 ring-amber" : ""}`} style={soft}>
                    {t}{a && <Check size={14} className="text-amber" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="rounded-2xl p-4" style={soft}>
            <p className="text-xs font-bold uppercase tracking-wider text-cream/50">Order sheet</p>
            <AnimatePresence initial={false}>
              {on.map((t) => (
                <motion.p key={t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="mt-2 flex justify-between text-sm">
                  <span>{t}</span><span className="text-cream/60">{Math.ceil(heads / 10)} trays</span>
                </motion.p>
              ))}
            </AnimatePresence>
            {!on.length && <p className="mt-2 text-xs text-cream/40">Choose items</p>}
            <p className="mt-4 flex items-center gap-2 text-xs text-cream/50"><Truck size={14} /> Pickup or delivery</p>
          </div>
        </div>
      </div>
    </Window>
  );
}

/* --------------------------------------------------------------- Pre-bookings */
const PRE = [["Butter chicken", 1], ["Garlic naan", 4], ["Mango lassi", 2], ["Gulab jamun", 3]];
export function PreBookDemo() {
  const [qty, setQty] = useState({});
  const [time, setTime] = useState("19:30");
  const items = PRE.filter(([n]) => qty[n] > 0);
  return (
    <Window title="Pre-bookings · illustrative demo">
      <div className="grid gap-5 p-4 md:grid-cols-[1.2fr_1fr] md:p-5">
        <ul className="space-y-2">
          {PRE.map(([n]) => (
            <li key={n} className="flex min-h-[48px] items-center justify-between rounded-xl px-3" style={soft}>
              <span className="text-sm">{n}</span>
              <span className="flex items-center gap-2">
                <button type="button" aria-label={`Remove ${n}`} onClick={() => setQty((q) => ({ ...q, [n]: Math.max(0, (q[n] || 0) - 1) }))} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><Minus size={14} /></button>
                <span className="w-5 text-center text-sm font-bold">{qty[n] || 0}</span>
                <button type="button" aria-label={`Add ${n}`} onClick={() => setQty((q) => ({ ...q, [n]: (q[n] || 0) + 1 }))} className="flex h-9 w-9 items-center justify-center rounded-full bg-amber"><Plus size={14} /></button>
              </span>
            </li>
          ))}
        </ul>
        <div className="rounded-2xl p-4" style={soft}>
          <p className="text-xs font-bold uppercase tracking-wider text-cream/50">Waiting when you arrive</p>
          <div className="mt-3 flex flex-wrap gap-2">{["19:00", "19:30", "20:00"].map((t) => <Pill key={t} active={time === t} onClick={() => setTime(t)}>{t}</Pill>)}</div>
          <p className="mt-4 text-sm">{items.length ? items.map(([n]) => `${qty[n]}× ${n}`).join(", ") : "Add dishes to pre-order"}</p>
          {items.length > 0 && <p className="dk-pop mt-3 flex items-center gap-2 text-xs font-bold text-[#f77a67]"><Clock size={13} /> Kitchen starts for {time}</p>}
        </div>
      </div>
    </Window>
  );
}

/* --------------------------------------------------------------- Attendance */
const CREW = [["Asha", "Chef"], ["Ravi", "Server"], ["Meera", "Cashier"], ["Kiran", "Server"], ["Dev", "Kitchen"]];
export function AttendanceDemo() {
  const [state, setState] = useState({ Asha: 1, Ravi: 1 });
  const [mins, setMins] = useState(0);
  useInterval(() => setMins((m) => m + 5), 1200);
  const present = Object.values(state).filter((v) => v === 1).length;
  return (
    <Window title="Attendance · illustrative demo">
      <div className="p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold">Today</p><Tag tone="green">{present} on shift</Tag>
        </div>
        <ul className="space-y-2">
          {CREW.map(([n, r]) => {
            const s = state[n];
            return (
              <li key={n} className="flex min-h-[52px] items-center gap-3 rounded-xl px-3" style={soft}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber/20 text-sm font-bold text-amberLight">{n[0]}</span>
                <span className="flex-1"><span className="block text-sm font-semibold">{n}</span><span className="text-[11px] text-cream/50">{r}</span></span>
                {s === 1 && <span className="hidden text-xs tabular-nums text-cream/60 sm:block">{Math.floor(mins / 60)}h {String(mins % 60).padStart(2, "0")}m</span>}
                <button type="button" onClick={() => setState((x) => ({ ...x, [n]: s === 1 ? 2 : 1 }))}
                  className={`min-h-[40px] rounded-full px-4 text-xs font-bold transition-colors ${s === 1 ? "bg-white/10 text-cream" : s === 2 ? "bg-white/5 text-cream/40" : "bg-amber text-white"}`}>
                  {s === 1 ? "Clock out" : s === 2 ? "Done" : "Clock in"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------------ Salary */
export function SalaryDemo() {
  const months = ["Aug", "Sep", "Oct"];
  const [m, setM] = useState(2);
  const [paid, setPaid] = useState({ "0-0": 1, "0-1": 1, "0-2": 1, "0-3": 1, "0-4": 1, "1-0": 1, "1-1": 1, "1-2": 1, "1-3": 1, "1-4": 1, "2-0": 1 });
  const pct = Math.round((CREW.filter((_, i) => paid[`${m}-${i}`]).length / CREW.length) * 100);
  return (
    <Window title="Salary · illustrative demo">
      <div className="p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {months.map((x, i) => <Pill key={x} active={m === i} onClick={() => setM(i)}>{x}</Pill>)}
          <div className="ml-auto flex min-w-[140px] flex-1 items-center gap-2 sm:flex-none">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full bg-amber" animate={{ width: `${pct}%` }} /></div>
            <span className="text-xs font-bold">{pct}% paid</span>
          </div>
        </div>
        <ul className="space-y-2">
          {CREW.map(([n, r], i) => {
            const k = `${m}-${i}`, p = paid[k];
            return (
              <li key={n} className="flex min-h-[48px] items-center gap-3 rounded-xl px-3" style={soft}>
                <span className="flex-1 text-sm">{n} <span className="text-[11px] text-cream/40">· {r}</span></span>
                <span className="hidden text-xs text-cream/50 sm:inline">{24 + (i % 3)} days present</span>
                <button type="button" onClick={() => setPaid((x) => ({ ...x, [k]: p ? 0 : 1 }))} className={`min-h-[40px] rounded-full px-4 text-xs font-bold ${p ? "bg-[#f77a67]/15 text-[#f77a67]" : "bg-amber text-white"}`}>
                  {p ? "Paid" : "Mark paid"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Window>
  );
}

/* ----------------------------------------------------------------- Careers */
export function CareersDemo() {
  const cols = ["Applied", "Interview", "Hired"];
  const [cards, setCards] = useState([["Nisha · Server", 0], ["Arun · Line cook", 0], ["Tara · Host", 1], ["Imran · Barista", 2]]);
  const [tab, setTab] = useState("Hiring");
  const [train, setTrain] = useState([["Food safety", 60], ["Service basics", 30], ["POS & orders", 85]]);
  return (
    <Window title="Careers & Training · illustrative demo">
      <div className="p-4 md:p-5">
        <div className="mb-4 flex gap-2">{["Hiring", "Training"].map((t) => <Pill key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Pill>)}</div>
        {tab === "Hiring" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {cols.map((c, ci) => (
              <div key={c} className="rounded-2xl p-3" style={soft}>
                <p className="mb-2 text-xs font-bold text-cream/50">{c}</p>
                <div className="space-y-2">
                  {cards.filter(([, s]) => s === ci).map(([n]) => (
                    <button key={n} type="button" disabled={ci === 2} onClick={() => setCards((cs) => cs.map(([x, s]) => (x === n ? [x, s + 1] : [x, s])))}
                      className="flex min-h-[44px] w-full items-center justify-between rounded-xl bg-white/10 px-3 text-left text-xs hover:bg-white/15">
                      {n}{ci < 2 && <ChevronRight size={14} className="text-amber" />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-3">
            {train.map(([n, p], i) => (
              <li key={n} className="rounded-xl p-3" style={soft}>
                <div className="mb-2 flex justify-between text-sm"><span>{n}</span><span className="text-cream/60">{p}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full bg-amber" animate={{ width: `${p}%` }} /></div>
                <button type="button" onClick={() => setTrain((t) => t.map(([a, b], j) => (j === i ? [a, Math.min(100, b + 10)] : [a, b])))} className="mt-2 min-h-[36px] text-xs font-bold text-amberLight">Complete a module +10%</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------------ Offers */
const OFFERS = [["Lunch combo", "Weekdays 12–3"], ["Happy hour drinks", "Daily 5–7"], ["Family Sunday", "Sundays"]];
export function OffersDemo() {
  const [on, setOn] = useState([0, 2]);
  return (
    <Window title="Offers · illustrative demo">
      <div className="grid items-center gap-6 p-4 md:grid-cols-[1.2fr_auto] md:p-5">
        <ul className="space-y-2">
          {OFFERS.map(([n, d], i) => {
            const a = on.includes(i);
            return (
              <li key={n} className="flex min-h-[56px] items-center gap-3 rounded-xl px-3" style={soft}>
                <span className="flex-1"><span className="block text-sm font-semibold">{n}</span><span className="text-[11px] text-cream/50">{d}</span></span>
                <button type="button" role="switch" aria-checked={a} aria-label={`${n} active`} onClick={() => setOn((o) => (a ? o.filter((x) => x !== i) : [...o, i]))}
                  className={`relative h-7 w-12 rounded-full transition-colors ${a ? "bg-amber" : "bg-white/15"}`}>
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${a ? "left-6" : "left-1"}`} />
                </button>
              </li>
            );
          })}
        </ul>
        <Phone className="!w-[220px]">
          <div className="h-full bg-beige p-3 pt-8">
            <p className="mb-2 text-xs font-extrabold">Offers for you</p>
            <AnimatePresence>
              {on.length ? on.map((i) => (
                <motion.div key={i} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="mb-2 overflow-hidden rounded-xl bg-white shadow">
                  <Photo src={[images.dishCurry, images.dishDrink, images.dishBiryani][i]} art={["food-curry", "food-drink", "food-biryani"][i]} className="h-16" />
                  <p className="p-2 text-[11px] font-bold">{OFFERS[i][0]}</p>
                </motion.div>
              )) : <p className="text-[11px] text-ink/50">No active offers</p>}
            </AnimatePresence>
          </div>
        </Phone>
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------------ Guests */
const GUESTS = [["Priya S.", "Gold", 14, ["Paneer tikka", "Mango lassi"]], ["Mark T.", "Silver", 6, ["Margherita"]], ["Zoya K.", "Member", 2, ["Veg biryani", "Falooda"]]];
export function GuestsDemo() {
  const [i, setI] = useState(0);
  const g = GUESTS[i];
  return (
    <Window title="Guests · illustrative demo">
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.2fr] md:p-5">
        <ul className="space-y-2">
          {GUESTS.map(([n, t], k) => (
            <li key={n}>
              <button type="button" aria-pressed={k === i} onClick={() => setI(k)} className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left transition-all ${k === i ? "ring-2 ring-amber" : ""}`} style={soft}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber/20 font-bold text-amberLight">{n[0]}</span>
                <span className="flex-1 text-sm font-semibold">{n}</span><Tag tone="grey">{t}</Tag>
              </button>
            </li>
          ))}
        </ul>
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl p-4" style={soft}>
            <p className="font-display text-xl font-extrabold">{g[0]}</p>
            <p className="mt-1 flex items-center gap-2 text-xs text-cream/60"><Star size={13} className="text-amber" /> {g[1]} · {g[2]} visits</p>
            <p className="mb-2 mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cream/50"><Heart size={13} /> Favourites</p>
            <div className="flex flex-wrap gap-1.5">{g[3].map((f) => <Tag key={f}>{f}</Tag>)}</div>
          </motion.div>
        </AnimatePresence>
      </div>
    </Window>
  );
}

/* ---------------------------------------------------------- Order tracking */
const STEPS = ["Order placed", "Accepted", "Preparing", "Ready", "Served"];
export function TrackingDemo() {
  const [s, setS] = useState(1);
  const [auto, setAuto] = useState(true);
  useInterval(() => setS((x) => (x >= STEPS.length - 1 ? 0 : x + 1)), 1800, auto);
  return (
    <Window title="Order tracking · illustrative demo">
      <div className="grid items-center gap-6 p-4 md:grid-cols-2 md:p-5">
        <ol className="space-y-3">
          {STEPS.map((t, i) => (
            <li key={t} className="flex items-center gap-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-500 ${i < s ? "bg-[#f77a67] text-ink" : i === s ? "scale-110 bg-amber text-white" : "bg-white/10 text-cream/40"}`}>{i < s ? <Check size={14} /> : i + 1}</span>
              <span className={`text-sm transition-colors ${i <= s ? "text-cream" : "text-cream/40"}`}>{t}</span>
            </li>
          ))}
        </ol>
        <div className="rounded-2xl p-4" style={soft}>
          <p className="text-xs text-cream/50">Table 7 · Order #22222222</p>
          <p className="mt-1 font-display text-2xl font-extrabold">{STEPS[s]}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full bg-amber" animate={{ width: `${((s + 1) / STEPS.length) * 100}%` }} /></div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => { setAuto(false); setS((x) => Math.min(STEPS.length - 1, x + 1)); }} className="flex min-h-[40px] items-center gap-1 rounded-full bg-amber px-4 text-xs font-bold">Next step <ArrowRight size={13} /></button>
            <button type="button" onClick={() => setAuto((a) => !a)} className="min-h-[40px] rounded-full bg-white/10 px-4 text-xs font-bold">{auto ? "Pause" : "Auto play"}</button>
          </div>
        </div>
      </div>
    </Window>
  );
}

/* --------------------------------------------------- KMS / SMS (tabbed) */
function Roster({ rows }) {
  const [a, setA] = useState({});
  return (
    <ul className="space-y-2">
      {rows.map(([who, what]) => (
        <li key={who} className="flex min-h-[48px] items-center gap-3 rounded-xl px-3" style={soft}>
          <UserCheck size={16} className="text-amber" />
          <span className="flex-1 text-sm">{what}<span className="block text-[11px] text-cream/45">{a[who] ? "Assigned to " + a[who] : "Unassigned"}</span></span>
          <button type="button" onClick={() => setA((x) => ({ ...x, [who]: x[who] === "Asha" ? "Ravi" : "Asha" }))} className="min-h-[40px] rounded-full bg-white/10 px-3 text-xs font-bold">{a[who] ? "Reassign" : "Assign"}</button>
        </li>
      ))}
    </ul>
  );
}
function Steps({ title, steps }) {
  const [n, setN] = useState(0);
  return (
    <div className="rounded-2xl p-4" style={soft}>
      <p className="font-display text-lg font-extrabold">{title}</p>
      <ol className="mt-3 space-y-2">
        {steps.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => setN(i + 1 === n ? i : i + 1)} className="flex min-h-[40px] w-full items-center gap-3 text-left text-sm">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${i < n ? "bg-amber text-white" : "bg-white/10"}`}>{i < n ? <Check size={12} /> : i + 1}</span>
              <span className={i < n ? "text-cream/40 line-through" : ""}>{s}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
function Tabbed({ title, tabs }) {
  const keys = Object.keys(tabs);
  const [t, setT] = useState(keys[0]);
  return (
    <Window title={title + " · illustrative demo"}>
      <div className="p-4 md:p-5">
        <div className="mb-4 flex flex-wrap gap-2">{keys.map((k) => <Pill key={k} active={t === k} onClick={() => setT(k)}>{k}</Pill>)}</div>
        <AnimatePresence mode="wait">
          <motion.div key={t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{tabs[t]}</motion.div>
        </AnimatePresence>
      </div>
    </Window>
  );
}
export function KmsDemo() {
  return (
    <Tabbed title="Kitchen management" tabs={{
      Assign: <Roster rows={[["a", "Grill station"], ["b", "Cold section"], ["c", "Dessert counter"]]} />,
      "Mise en place": <Steps title="Morning prep" steps={["Stocks simmering", "Veg chopped", "Sauces portioned", "Stations stocked"]} />,
      Recipe: <Steps title="Butter chicken" steps={["Marinate 2 hours", "Grill the chicken", "Simmer the gravy", "Finish with butter"]} />,
      Grooming: <Steps title="Grooming check" steps={["Uniform clean", "Hair covered", "Nails trimmed", "Hands washed"]} />,
    }} />
  );
}
export function SmsDemo() {
  return (
    <Tabbed title="Service management" tabs={{
      Sections: <Roster rows={[["a", "Window tables"], ["b", "Bar & lounge"], ["c", "Patio"]]} />,
      Opening: <Steps title="Opening routine" steps={["Tables laid", "QR codes checked", "Menus wiped", "Briefing done"]} />,
      Grooming: <Steps title="Grooming check" steps={["Uniform clean", "Name badge on", "Shoes polished"]} />,
      Closing: <Steps title="Closing routine" steps={["Tables reset", "Floors done", "Cash counted", "Lights off"]} />,
    }} />
  );
}

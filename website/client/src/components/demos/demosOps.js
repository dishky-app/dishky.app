import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Flame, Check, ChefHat, Clock, QrCode, Bell, Utensils, Wallet, CreditCard, Banknote, Smartphone,
  Receipt, Printer, AlertTriangle, Package, ArrowRight, RotateCcw, Plus, Users,
} from "lucide-react";
import { Window, Pill, useInterval } from "../ui/kit.js";

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const DISHES = [
  ["Butter Chicken", "Garlic Naan x2"], ["Margherita Pizza"], ["Paneer Tikka", "Mint Lemonade"],
  ["Veg Biryani", "Raita"], ["Pasta Alfredo", "Tiramisu"], ["Caesar Salad", "Cold Coffee"],
];
const COLS = [
  { key: "new", label: "New", color: "#f6644d" },
  { key: "cooking", label: "Cooking", color: "#f33716" },
  { key: "ready", label: "Ready", color: "#e4290c" },
];

/** Kitchen display: tickets arrive, timers run, tap to advance. */
export function KdsDemo() {
  const [tickets, setTickets] = useState(() => [
    { id: 41, table: "T3", items: DISHES[0], status: "cooking", t: 96 },
    { id: 42, table: "T7", items: DISHES[1], status: "new", t: 12 },
    { id: 40, table: "T1", items: DISHES[2], status: "ready", t: 210 },
  ]);
  const [next, setNext] = useState(43);
  const [served, setServed] = useState(0);

  useInterval(() => setTickets((ts) => ts.map((t) => (t.status === "ready" ? t : { ...t, t: t.t + 1 }))), 1000);
  useInterval(() => {
    setTickets((ts) => {
      if (ts.filter((t) => t.status === "new").length >= 3) return ts;
      return [...ts, { id: next, table: `T${1 + ((next * 5) % 12)}`, items: DISHES[next % DISHES.length], status: "new", t: 0 }];
    });
    setNext((n) => n + 1);
  }, 7000);

  const advance = (id) =>
    setTickets((ts) => {
      const t = ts.find((x) => x.id === id);
      if (t.status === "ready") {
        setServed((s) => s + 1);
        return ts.filter((x) => x.id !== id);
      }
      return ts.map((x) => (x.id === id ? { ...x, status: x.status === "new" ? "cooking" : "ready" } : x));
    });

  return (
    <Window title="Kitchen Display · Live">
      <div className="flex items-center justify-between px-4 pt-4 text-xs text-cream/60">
        <span className="flex items-center gap-2"><span className="dk-ping h-2 w-2 rounded-full bg-amber" /> Tap a ticket to move it along</span>
        <span>Served today: <b className="text-cream">{served + 38}</b></span>
      </div>
      <div className="grid grid-cols-3 gap-3 p-4">
        {COLS.map((c) => (
          <div key={c.key} className="min-h-[260px] rounded-xl bg-white/[0.04] p-2.5">
            <p className="mb-2 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: c.color }}>
              {c.label}
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-cream/70">{tickets.filter((t) => t.status === c.key).length}</span>
            </p>
            <AnimatePresence initial={false}>
              {tickets.filter((t) => t.status === c.key).map((t) => (
                <motion.button
                  layout
                  key={t.id}
                  type="button"
                  onClick={() => advance(t.id)}
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 40 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="mb-2 block w-full rounded-lg border border-white/10 bg-[#1a1a1a] p-2.5 text-left transition-colors hover:border-amber/60"
                  style={{ borderLeft: `3px solid ${t.t > 120 && t.status !== "ready" ? "#ff3b30" : c.color}` }}
                >
                  <span className="flex flex-wrap items-center justify-between gap-x-2 text-[11px] font-bold text-cream">
                    #{t.id} · {t.table}
                    <span className={`flex items-center gap-1 font-display ${t.t > 120 && t.status !== "ready" ? "text-[#ff6a4d]" : "text-cream/50"}`}>
                      <Clock size={10} /> {fmt(t.t)}
                    </span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-cream/60">{t.items.join(" · ")}</span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </Window>
  );
}

const STAGES = [
  { icon: QrCode, label: "Scan", note: "Guest scans the table QR" },
  { icon: Utensils, label: "Order", note: "Order lands in the kitchen instantly" },
  { icon: ChefHat, label: "Cook", note: "Chef taps: cooking → ready" },
  { icon: Bell, label: "Serve", note: "Floor staff get the ping" },
  { icon: Wallet, label: "Pay", note: "Paid on the phone, bill closed" },
];
const FEED = ["Order #e4290c placed · Table 4", "Kitchen accepted #e4290c", "#e4290c ready · calling server", "Served to Table 4", "Payment received · ₹1,240"];

/** The whole order journey, auto-playing, clickable. */
export function LiveOrderDemo() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  useInterval(() => setI((v) => (v + 1) % STAGES.length), 2200, auto);
  const S = STAGES[i];
  return (
    <Window title="Order #e4290c · Table 4 · live">
      <div className="p-5 sm:p-7">
        <div className="relative flex items-start justify-between">
          <div className="absolute left-[10%] right-[10%] top-6 h-0.5 bg-white/10" />
          <motion.div
            className="absolute left-[10%] top-6 h-0.5 bg-amber"
            animate={{ width: `${(i / (STAGES.length - 1)) * 80}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
          {STAGES.map((s, k) => (
            <button
              key={s.label}
              type="button"
              onClick={() => { setAuto(false); setI(k); }}
              className="relative z-10 flex w-1/5 flex-col items-center gap-2"
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-500 ${
                  k <= i ? "border-amber bg-amber text-white" : "border-white/15 bg-[#161616] text-cream/50"
                } ${k === i ? "scale-110 dk-ping" : ""}`}
              >
                {k < i ? <Check size={20} /> : <s.icon size={20} />}
              </span>
              <span className={`text-[11px] font-semibold ${k <= i ? "text-cream" : "text-cream/40"}`}>{s.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="rounded-xl bg-white/[0.05] p-4"
            >
              <S.icon className="text-amber" size={22} />
              <p className="mt-3 font-display text-lg font-bold">{S.label}</p>
              <p className="text-sm text-cream/60">{S.note}</p>
            </motion.div>
          </AnimatePresence>
          <div className="rounded-xl bg-white/[0.05] p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-cream/40">Live feed</p>
            <ul className="space-y-1.5">
              {FEED.slice(0, i + 1).slice(-3).map((f) => (
                <li key={f} className="dk-slide-in flex items-center gap-2 text-xs text-cream/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber" /> {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <button type="button" onClick={() => { setI(0); setAuto(true); }} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-cream/50 hover:text-cream">
          <RotateCcw size={12} /> Replay
        </button>
      </div>
    </Window>
  );
}

const T_STATES = [
  { key: "free", label: "Free", c: "#e4290c" },
  { key: "busy", label: "Dining", c: "#f33716" },
  { key: "booked", label: "Reserved", c: "#f66a55" },
  { key: "bill", label: "Bill due", c: "#f6644d" },
];
/** Floor map: tap a table to change its status. */
export function TablesDemo() {
  const [tb, setTb] = useState(() => Array.from({ length: 12 }, (_, i) => ["busy", "free", "booked", "bill", "free", "busy"][i % 6]));
  const cycle = (i) => setTb((t) => t.map((s, k) => (k === i ? T_STATES[(T_STATES.findIndex((x) => x.key === s) + 1) % 4].key : s)));
  return (
    <Window title="Service · Floor">
      <div className="p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {T_STATES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[11px] text-cream/70">
              <span className="h-2 w-2 rounded-full" style={{ background: s.c }} /> {s.label} · <b className="text-cream">{tb.filter((x) => x === s.key).length}</b>
            </span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {tb.map((s, i) => {
            const st = T_STATES.find((x) => x.key === s);
            return (
              <motion.button
                key={i}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => cycle(i)}
                className="relative flex aspect-square flex-col items-center justify-center rounded-2xl border text-cream transition-colors duration-500"
                style={{ borderColor: st.c + "88", background: st.c + "22" }}
              >
                <span className="font-display text-lg font-extrabold">T{i + 1}</span>
                <span className="text-[10px]" style={{ color: st.c }}>{st.label}</span>
              </motion.button>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-cream/40">Tap any table to change its status.</p>
      </div>
    </Window>
  );
}

const ING = [
  { n: "Pizza dough", u: 40 }, { n: "Mozzarella", u: 30 }, { n: "Tomato base", u: 35 }, { n: "Basil", u: 60 },
];
const RECIPES = { Margherita: [4, 6, 5, 3], "Cheese Pizza": [4, 9, 5, 0] };
/** Selling dishes drains stock; low stock raises an alert. */
export function InventoryDemo() {
  const [lv, setLv] = useState([100, 100, 100, 100]);
  const sell = (r) => setLv((l) => l.map((v, i) => Math.max(0, v - RECIPES[r][i])));
  const low = lv.some((v) => v < 25);
  return (
    <Window title="Inventory · Stocks">
      <div className="p-5">
        <div className="flex flex-wrap gap-2">
          {Object.keys(RECIPES).map((r) => (
            <Pill key={r} onClick={() => sell(r)}><Plus size={12} className="mr-1 inline" /> Sell {r}</Pill>
          ))}
          <Pill onClick={() => setLv([100, 100, 100, 100])}><RotateCcw size={12} className="mr-1 inline" /> Restock</Pill>
        </div>
        <div className="mt-5 space-y-4">
          {ING.map((g, i) => (
            <div key={g.n}>
              <div className="mb-1.5 flex justify-between text-xs"><span className="text-cream/80">{g.n}</span><span className={lv[i] < 25 ? "font-bold text-[#ff6a4d]" : "text-cream/50"}>{Math.round(lv[i])}%</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <motion.div className="h-full rounded-full" animate={{ width: `${lv[i]}%`, background: lv[i] < 25 ? "#ff3b30" : lv[i] < 55 ? "#f6644d" : "#e4290c" }} transition={{ duration: 0.6 }} />
              </div>
            </div>
          ))}
        </div>
        <AnimatePresence>
          {low && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#ff3b30]/40 bg-[#ff3b30]/10 p-3 text-xs text-[#ffb3a8]">
                <AlertTriangle size={16} /> Running low. Reorder before the dinner rush.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Window>
  );
}

const BILL = [["Butter Chicken", 420], ["Garlic Naan x2", 120], ["Paneer Tikka", 340], ["Mint Lemonade x2", 180]];
/** Split a bill, pick a method, pay, watch the receipt print. */
export function PaymentsDemo() {
  const [method, setMethod] = useState("UPI");
  const [people, setPeople] = useState(1);
  const [paid, setPaid] = useState(false);
  const total = BILL.reduce((a, b) => a + b[1], 0);
  const gst = Math.round(total * 0.05);
  const M = { UPI: Smartphone, Card: CreditCard, Cash: Banknote };
  return (
    <Window title="Payments · Table 4">
      <div className="grid gap-5 p-5 sm:grid-cols-2">
        <div>
          <ul className="space-y-2 text-sm">
            {BILL.map(([n, p]) => (<li key={n} className="flex justify-between text-cream/75"><span>{n}</span><span>₹{p}</span></li>))}
            <li className="flex justify-between text-cream/45"><span>GST 5%</span><span>₹{gst}</span></li>
            <li className="flex justify-between border-t border-white/10 pt-2 font-display text-lg font-bold"><span>Total</span><span>₹{total + gst}</span></li>
          </ul>
          <div className="mt-4 flex items-center gap-3 text-xs text-cream/60">
            <Users size={14} /> Split between
            {[1, 2, 3, 4].map((n) => (<Pill key={n} active={people === n} onClick={() => setPeople(n)} className="!min-h-[32px] !px-3">{n}</Pill>))}
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.05] p-4">
          <div className="flex gap-2">
            {Object.keys(M).map((k) => { const I = M[k]; return (<Pill key={k} active={method === k} onClick={() => { setMethod(k); setPaid(false); }}><I size={12} className="mr-1 inline" />{k}</Pill>); })}
          </div>
          <p className="mt-4 text-xs text-cream/50">Each pays</p>
          <p className="font-display text-3xl font-extrabold">₹{Math.ceil((total + gst) / people)}</p>
          <button type="button" onClick={() => setPaid(true)} className="btn-primary mt-4 w-full !min-h-[42px] !py-2 text-sm">{paid ? "Paid" : `Pay with ${method}`}</button>
          <AnimatePresence>
            {paid && (
              <motion.div initial={{ opacity: 0, y: -16, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} className="overflow-hidden">
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#e4290c]/15 p-3 text-xs text-[#f77a67]">
                  <Printer size={14} /> <Receipt size={14} /> Receipt printed in the kitchen & at the counter.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Window>
  );
}

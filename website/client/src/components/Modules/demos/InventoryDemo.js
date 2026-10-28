import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, RefreshCw, Package, AlertTriangle, Ban } from "lucide-react";
import { Reveal, CountUp, BrowserFrame, Chip } from "../../Kit/Kit.js";

const INGS = [
  { id: "rice", name: "Basmati rice", unit: "g", max: 5000, low: 1000, qty: 2200 },
  { id: "chicken", name: "Chicken", unit: "g", max: 6000, low: 1200, qty: 3000 },
  { id: "paneer", name: "Paneer", unit: "g", max: 3000, low: 600, qty: 1200 },
  { id: "tomato", name: "Tomato", unit: "g", max: 4000, low: 800, qty: 2400 },
  { id: "oil", name: "Cooking oil", unit: "ml", max: 3000, low: 500, qty: 1400 },
  { id: "milk", name: "Milk", unit: "ml", max: 5000, low: 1000, qty: 1800 },
  { id: "batter", name: "Dosa batter", unit: "g", max: 4000, low: 700, qty: 1500 },
];
const DISHES = [
  { id: "biryani", name: "Biryani", price: 320, use: { rice: 250, chicken: 200, oil: 30 } },
  { id: "butter", name: "Butter chicken", price: 380, use: { chicken: 250, tomato: 200, milk: 100 } },
  { id: "tikka", name: "Paneer tikka", price: 290, use: { paneer: 250, oil: 20, tomato: 60 } },
  { id: "dosa", name: "Masala dosa", price: 140, use: { batter: 180, oil: 25, tomato: 40 } },
];
const byId = Object.fromEntries(INGS.map((i) => [i.id, i]));
const tone = (i, q) => (q <= i.low * 0.5 ? "#dc2626" : q <= i.low ? "#f22c0e" : "#e4290c");

export default function InventoryDemo({ dark = false }) {
  const [stock, setStock] = useState(() => Object.fromEntries(INGS.map((i) => [i.id, i.qty])));
  const [deltas, setDeltas] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const [served, setServed] = useState({ n: 0, rev: 0 });

  const soldOut = (d) => Object.entries(d.use).some(([k, v]) => stock[k] < v);
  const lowCount = INGS.filter((i) => stock[i.id] <= i.low).length;
  const hidden = DISHES.filter(soldOut).length;

  const serve = (d) => {
    if (soldOut(d)) return;
    const next = { ...stock }; const newDeltas = []; const newAlerts = [];
    Object.entries(d.use).forEach(([k, v]) => {
      const before = stock[k]; next[k] = before - v;
      newDeltas.push({ id: `${Date.now()}${k}${Math.random()}`, ing: k, text: `-${v} ${byId[k].unit}` });
      if (before > byId[k].low && next[k] <= byId[k].low) newAlerts.push({ id: `${Date.now()}${k}`, text: `${byId[k].name} low` });
    });
    setStock(next);
    setDeltas((x) => [...x, ...newDeltas]);
    setAlerts((a) => [...newAlerts, ...a].slice(0, 6));
    setServed((s) => ({ n: s.n + 1, rev: s.rev + d.price }));
    const ids = newDeltas.map((x) => x.id);
    setTimeout(() => setDeltas((x) => x.filter((y) => !ids.includes(y.id))), 1200);
  };
  const restock = (i) => { setStock((s) => ({ ...s, [i.id]: i.max })); setAlerts((a) => a.filter((x) => x.text !== `${i.name} low`)); };

  const text = dark ? "text-white" : "text-ink";
  const sub = dark ? "text-white/55" : "text-ink/50";
  const card = dark ? "bg-white/5 border-white/10" : "bg-beige border-ink/10";
  const tiles = [
    { l: "Served", Icon: Package, v: served.n, p: "" },
    { l: "Revenue", Icon: Package, v: served.rev, p: "₹" },
    { l: "Low stock", Icon: AlertTriangle, v: lowCount, p: "" },
    { l: "Hidden dishes", Icon: Ban, v: hidden, p: "" },
  ];

  return (
    <Reveal className="w-full">
      <div className="mx-auto w-full max-w-[980px]">
        <BrowserFrame title="admin.dishky.com/inventory" dark={dark}>
          <div className={`min-w-0 ${text}`}>
            <div className="mb-3 flex items-start gap-2">
              <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                {tiles.map((t) => (
                  <div key={t.l} className={`rounded-2xl border px-3 py-2 ${card}`}>
                    <p className="font-display text-xl font-extrabold tabular-nums"><CountUp to={t.v} prefix={t.p} duration={0.5} /></p>
                    <p className={`text-[11px] font-semibold ${sub}`}>{t.l}</p>
                  </div>
                ))}
              </div>
              <div className="relative">
                <button type="button" aria-label={`Alerts, ${alerts.length}`} aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`relative flex h-11 w-11 items-center justify-center rounded-full border ${card}`}>
                  <Bell size={18} />
                  <AnimatePresence>{alerts.length > 0 && <motion.span key={alerts.length} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber px-1 text-[11px] font-bold text-white">{alerts.length}</motion.span>}</AnimatePresence>
                </button>
                <AnimatePresence>
                  {open && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`absolute right-0 top-12 z-20 w-48 rounded-2xl border p-2 shadow-xl ${dark ? "bg-charcoal border-white/10" : "bg-white border-ink/10"}`}>
                      {alerts.length ? alerts.map((a) => <p key={a.id} className="flex items-center gap-2 px-2 py-1.5 text-[12px] font-semibold"><AlertTriangle size={13} className="text-amber" />{a.text}</p>) : <p className={`px-2 py-2 text-[12px] ${sub}`}>No alerts</p>}
                      {alerts.length > 0 && <button type="button" aria-label="Clear alerts" onClick={() => setAlerts([])} className="mt-1 min-h-[40px] w-full rounded-xl bg-black/10 text-[12px] font-bold">Clear</button>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.25fr_1fr]">
              <div className={`min-w-0 rounded-2xl border p-2 sm:p-3 ${card}`}>
                {INGS.map((i) => {
                  const q = stock[i.id]; const c = tone(i, q);
                  return (
                    <div key={i.id} className="relative flex items-center gap-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                          <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold">{i.name}{q <= i.low && <Chip tone={q === 0 ? "bad" : "warn"}>{q === 0 ? "Empty" : "Low stock"}</Chip>}</span>
                          <span className="shrink-0 font-display font-bold tabular-nums"><CountUp to={q} duration={0.4} /> <span className={`font-medium ${sub}`}>{i.unit}</span></span>
                        </div>
                        <div className="relative h-2.5 rounded-full bg-black/10">
                          <motion.div className="h-full rounded-full" animate={{ width: `${(q / i.max) * 100}%`, background: c }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                          <span className="absolute -top-0.5 h-3.5 w-0.5 bg-current opacity-50" style={{ left: `${(i.low / i.max) * 100}%` }} />
                        </div>
                        <AnimatePresence>
                          {deltas.filter((d) => d.ing === i.id).map((d) => (
                            <motion.span key={d.id} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -22 }} exit={{ opacity: 0 }} transition={{ duration: 1.1 }} className="pointer-events-none absolute right-12 top-0 font-display text-[12px] font-extrabold text-amber">{d.text}</motion.span>
                          ))}
                        </AnimatePresence>
                      </div>
                      <button type="button" aria-label={`Restock ${i.name}`} onClick={() => restock(i)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/10 transition hover:bg-amber hover:text-white active:rotate-180"><RefreshCw size={15} /></button>
                    </div>
                  );
                })}
              </div>

              <div className="min-w-0">
                <p className={`mb-2 text-[11px] font-bold uppercase tracking-wider ${sub}`}>Serve order</p>
                <div className="grid grid-cols-2 gap-2">
                  {DISHES.map((d) => {
                    const out = soldOut(d);
                    return (
                      <motion.button key={d.id} type="button" whileTap={out ? {} : { scale: 0.94 }} disabled={out} aria-label={out ? `${d.name} sold out` : `Serve ${d.name}`} onClick={() => serve(d)}
                        className={`flex min-h-[64px] flex-col items-start justify-center rounded-2xl border px-3 text-left transition ${out ? "cursor-not-allowed opacity-50" : "hover:border-amber"} ${card}`}>
                        <span className="text-[13px] font-bold leading-tight">{d.name}</span>
                        {out ? <Chip tone="bad" className="mt-1">Sold out</Chip> : <span className={`text-[11px] font-semibold ${sub}`}>₹{d.price}</span>}
                      </motion.button>
                    );
                  })}
                </div>
                <p className={`mt-3 text-[11px] ${sub}`}>Sold-out dishes vanish from the guest menu.</p>
              </div>
            </div>
          </div>
        </BrowserFrame>
      </div>
    </Reveal>
  );
}

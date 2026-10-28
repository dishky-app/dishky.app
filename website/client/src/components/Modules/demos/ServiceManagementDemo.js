import React, { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BellRing, X, Check } from "lucide-react";
import { Reveal, useTicker, BrowserFrame, Chip } from "../../Kit/Kit.js";

const STATUS = {
  free: { label: "Free", bg: "#e8e8e8", fg: "#e4290c" },
  seated: { label: "Seated", bg: "#f5553c", fg: "#ffffff" },
  ordered: { label: "Ordered", bg: "#f22c0e", fg: "#ffffff" },
  help: { label: "Needs help", bg: "#f33716", fg: "#ffffff" },
  bill: { label: "Bill", bg: "#e4290c", fg: "#ffffff" },
};
const WAITERS = [
  { id: "n", name: "Nisha", color: "#f66a55" },
  { id: "k", name: "Karan", color: "#e4290c" },
  { id: "p", name: "Pooja", color: "#f44125" },
];
const SEATS = [2, 4, 2, 4, 6, 2, 4, 4, 2, 6, 4, 2];
const INIT = SEATS.map((seats, i) => ({
  n: i + 1, seats,
  status: ["seated", "free", "ordered", "free", "bill", "seated", "free", "ordered", "free", "seated", "free", "free"][i],
  waiter: [WAITERS[0].id, null, WAITERS[1].id, null, WAITERS[2].id, WAITERS[0].id, null, WAITERS[1].id, null, WAITERS[2].id, null, null][i],
}));

export default function ServiceManagementDemo({ dark = false }) {
  const [tables, setTables] = useState(INIT);
  const [sel, setSel] = useState(null);
  const [calls, setCalls] = useState([]);

  const patch = (n, p) => setTables((ts) => ts.map((t) => (t.n === n ? { ...t, ...p } : t)));
  const callIds = calls.map((c) => c.n);

  const tick = useCallback(() => {
    const pool = tables.filter((t) => t.status !== "free" && !callIds.includes(t.n));
    if (!pool.length || calls.length >= 3) return;
    const t = pool[Math.floor(Math.random() * pool.length)];
    setCalls((c) => [...c, { n: t.n, id: Date.now() }]);
  }, [tables, calls, callIds]);
  useTicker(tick, 3500);

  const answer = (n) => setCalls((c) => c.filter((x) => x.n !== n));
  const load = (id) => tables.filter((t) => t.waiter === id && t.status !== "free").length;
  const selected = tables.find((t) => t.n === sel);

  const text = dark ? "text-white" : "text-ink";
  const sub = dark ? "text-white/55" : "text-ink/50";
  const card = dark ? "bg-white/5 border-white/10" : "bg-beige border-ink/10";

  return (
    <Reveal className="w-full">
      <div className="mx-auto w-full max-w-[980px]">
        <BrowserFrame title="admin.dishky.com/service" dark={dark}>
          <div className={`min-w-0 ${text}`}>
            <div className="mb-3 flex min-h-[32px] flex-wrap gap-2" aria-live="polite">
              <AnimatePresence>
                {calls.map((c) => (
                  <motion.div key={c.id} layout initial={{ opacity: 0, scale: 0.7, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.7 }}
                    className="flex items-center gap-2 rounded-full bg-amber py-1 pl-3 pr-1 text-[12px] font-bold text-white shadow-lg">
                    <BellRing size={14} /> Table {c.n}
                    <button type="button" aria-label={`Answer call from table ${c.n}`} onClick={() => answer(c.n)} className="flex min-h-[40px] items-center gap-1 rounded-full bg-white px-3 text-[12px] font-bold text-amber">
                      <Check size={13} /> Answer
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {!calls.length && <span className={`self-center text-[11px] ${sub}`}>Guest calls appear here</span>}
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_260px]">
              <div className="min-w-0">
                <div className={`grid grid-cols-3 gap-2 rounded-2xl border p-3 sm:grid-cols-4 sm:gap-3 ${card}`}>
                  {tables.map((t) => {
                    const s = STATUS[t.status];
                    const w = WAITERS.find((x) => x.id === t.waiter);
                    const ringing = callIds.includes(t.n);
                    return (
                      <motion.button key={t.n} type="button" whileTap={{ scale: 0.92 }} aria-label={`Table ${t.n}, ${s.label}${w ? `, ${w.name}` : ""}`} aria-pressed={sel === t.n} onClick={() => setSel(t.n)}
                        animate={{ background: s.bg, color: s.fg }}
                        className={`relative flex min-h-[64px] flex-col items-center justify-center rounded-2xl font-display ${ringing ? "kit-pulse" : ""} ${t.seats > 4 ? "sm:col-span-1" : ""}`}
                        style={{ boxShadow: w ? `0 0 0 3px ${w.color}` : "none", outline: sel === t.n ? "2px solid currentColor" : "none", outlineOffset: 3 }}>
                        <span className="text-lg font-extrabold leading-none">{t.n}</span>
                        <span className="mt-1 text-[10px] font-semibold opacity-80">{t.seats} seats</span>
                        {ringing && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-amber shadow"><BellRing size={13} /></motion.span>}
                      </motion.button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
                  {Object.entries(STATUS).map(([k, s]) => <span key={k} className={`flex items-center gap-1.5 text-[11px] font-semibold ${sub}`}><i className="h-2.5 w-2.5 rounded-full" style={{ background: s.bg }} />{s.label}</span>)}
                </div>
              </div>

              <aside className="min-w-0 space-y-3">
                <div className={`rounded-2xl border p-3 ${card}`}>
                  <AnimatePresence mode="wait">
                    {selected ? (
                      <motion.div key={selected.n} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="font-display text-[15px] font-extrabold">Table {selected.n}</p>
                          <button type="button" aria-label="Close panel" onClick={() => setSel(null)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/10"><X size={16} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {Object.entries(STATUS).map(([k, s]) => (
                            <button key={k} type="button" aria-label={`Set status ${s.label}`} aria-pressed={selected.status === k} onClick={() => patch(selected.n, { status: k, waiter: k === "free" ? null : selected.waiter })}
                              className="min-h-[40px] rounded-xl border-2 text-[12px] font-bold transition" style={{ background: selected.status === k ? s.bg : "transparent", color: selected.status === k ? s.fg : "inherit", borderColor: selected.status === k ? s.bg : "rgba(128,128,128,.25)" }}>{s.label}</button>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          {WAITERS.map((w) => (
                            <button key={w.id} type="button" aria-label={`Assign ${w.name}`} aria-pressed={selected.waiter === w.id} onClick={() => patch(selected.n, { waiter: selected.waiter === w.id ? null : w.id })}
                              className="flex min-h-[48px] flex-1 flex-col items-center justify-center rounded-xl text-[11px] font-bold text-white transition active:scale-95" style={{ background: w.color, opacity: selected.waiter && selected.waiter !== w.id ? 0.4 : 1, boxShadow: selected.waiter === w.id ? `0 0 0 3px ${dark ? "#121212" : "#ffffff"}, 0 0 0 5px ${w.color}` : "none" }}>{w.name}</button>
                          ))}
                        </div>
                      </motion.div>
                    ) : (
                      <motion.p key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`py-6 text-center text-[12px] ${sub}`}>Tap a table</motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <div className={`rounded-2xl border p-3 ${card}`}>
                  {WAITERS.map((w) => (
                    <div key={w.id} className="flex items-center gap-2 py-1.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: w.color }}>{w.name[0]}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/10">
                        <motion.div className="h-full rounded-full" style={{ background: w.color }} animate={{ width: `${Math.min(100, (load(w.id) / 5) * 100)}%` }} transition={{ type: "spring", stiffness: 160, damping: 20 }} />
                      </div>
                      <Chip tone={load(w.id) >= 4 ? "bad" : "mute"}>{load(w.id)}</Chip>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </BrowserFrame>
      </div>
    </Reveal>
  );
}

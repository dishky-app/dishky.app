import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, Snowflake, UtensilsCrossed, Pause, Play } from "lucide-react";
import Window from "../ui/Window.js";

const MENU = [
  { name: "Butter Chicken", station: "Grill" },
  { name: "Paneer Tikka", station: "Grill" },
  { name: "Chicken 65", station: "Fry" },
  { name: "French Fries", station: "Fry" },
  { name: "Greek Salad", station: "Cold" },
  { name: "Tiramisu", station: "Cold" },
  { name: "Lamb Chops", station: "Grill" },
  { name: "Onion Rings", station: "Fry" },
];
const STATIONS = ["All", "Grill", "Fry", "Cold"];
const STATION_ICON = { Grill: Flame, Fry: UtensilsCrossed, Cold: Snowflake };
const COLS = [
  { key: "new", title: "New" },
  { key: "cooking", title: "Cooking" },
  { key: "ready", title: "Ready" },
];

let uid = 4820;
const makeTicket = (i) => {
  const d = MENU[i % MENU.length];
  const d2 = MENU[(i * 3 + 2) % MENU.length];
  return {
    id: ++uid,
    table: 1 + ((i * 5) % 14),
    items: [d, d2],
    status: "new",
    at: Date.now(),
  };
};
const fmt = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Kitchen display demo: tap a ticket to move it along. New orders keep arriving. */
export default function KdsBoard() {
  const [tickets, setTickets] = useState(() => [makeTicket(0), makeTicket(1), makeTicket(2)].map((t, i) => ({ ...t, status: i === 2 ? "cooking" : "new", at: Date.now() - i * 20000 })));
  const [station, setStation] = useState("All");
  const [auto, setAuto] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [served, setServed] = useState(0);
  const counter = useRef(3);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!auto) return undefined;
    const t = setInterval(() => {
      setTickets((cur) => (cur.length >= 7 ? cur : [...cur, makeTicket(counter.current++)]));
    }, 5500);
    return () => clearInterval(t);
  }, [auto]);

  const advance = (id) =>
    setTickets((cur) => {
      const t = cur.find((x) => x.id === id);
      if (!t) return cur;
      if (t.status === "ready") {
        setServed((n) => n + 1);
        return cur.filter((x) => x.id !== id);
      }
      return cur.map((x) => (x.id === id ? { ...x, status: x.status === "new" ? "cooking" : "ready", at: x.status === "new" ? Date.now() : x.at } : x));
    });

  const visible = (t) => station === "All" || t.items.some((i) => i.station === station);

  return (
    <Window
      dark
      title="Kitchen Display · Live"
      right={
        <button type="button" onClick={() => setAuto((a) => !a)} aria-label={auto ? "Pause new orders" : "Resume new orders"} className="flex h-8 w-8 items-center justify-center rounded-full bg-cream/10 text-cream hover:bg-cream/20" style={{ minHeight: 0 }}>
          {auto ? <Pause size={14} /> : <Play size={14} />}
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATIONS.map((s) => (
          <button key={s} type="button" onClick={() => setStation(s)} style={{ minHeight: 36 }}
            className={`rounded-full px-3.5 text-xs font-bold transition ${station === s ? "bg-amber text-ink" : "bg-cream/10 text-cream/70 hover:bg-cream/15"}`}>
            {s}
          </button>
        ))}
        <span className="ml-auto text-xs font-semibold text-cream/50">Served <b className="text-amber">{served}</b></span>
      </div>
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {COLS.map((col) => (
          <div key={col.key} className="min-h-[260px] min-w-0 rounded-2xl bg-cream/[0.04] p-2 sm:p-2.5">
            <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-cream/50">
              {col.title} <span className="text-amber">{tickets.filter((t) => t.status === col.key && visible(t)).length}</span>
            </p>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout" initial={false}>
                {tickets.filter((t) => t.status === col.key && visible(t)).map((t) => {
                  const el = now - t.at;
                  const late = t.status !== "ready" && el > 45000;
                  const warn = t.status !== "ready" && el > 25000;
                  return (
                    <motion.button
                      key={t.id}
                      layout
                      initial={{ opacity: 0, scale: 0.85, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, x: 40 }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      onClick={() => advance(t.id)}
                      type="button"
                      style={{ minHeight: 0 }}
                      className={`block w-full rounded-xl border p-2.5 text-left transition-colors ${
                        late ? "border-amber bg-amber/20" : warn ? "border-red-400/60 bg-red-400/10" : t.status === "ready" ? "border-red-400/50 bg-red-400/10" : "border-cream/10 bg-cream/[0.06] hover:border-cream/30"
                      }`}
                    >
                      <span className="flex items-center justify-between">
                        <span className="font-display text-xs font-extrabold">#{t.id}</span>
                        <span className="font-mono text-[11px] tabular-nums text-cream/60">{t.status === "ready" ? "Ready" : fmt(el)}</span>
                      </span>
                      <span className="mt-0.5 block text-[10px] text-cream/50">Table {t.table}</span>
                      <span className="mt-2 block space-y-1">
                        {t.items.map((it) => {
                          const I = STATION_ICON[it.station];
                          return (
                            <span key={it.name} className="flex items-center gap-1.5 text-[11px] font-semibold text-cream/85">
                              <I size={11} className="shrink-0 text-amber" />
                              <span className="truncate">{it.name}</span>
                            </span>
                          );
                        })}
                      </span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-cream/40">Tap a ticket to move it along.</p>
    </Window>
  );
}

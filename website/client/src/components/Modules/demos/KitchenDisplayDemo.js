import React, { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellRing, Volume2, VolumeX, ChefHat, Flame, CheckCircle2, Tv } from "lucide-react";
import { Reveal, useTicker, BrowserFrame, Chip } from "../../Kit/Kit.js";

const MENU = ["Chicken biryani", "Butter chicken", "Paneer tikka", "Masala dosa", "Garlic naan", "Dal makhani", "Veg pulao", "Mango lassi", "Tandoori roti", "Chole bhature"];
const COLS = [
  { id: "placed", label: "Placed", Icon: Flame },
  { id: "preparing", label: "Preparing", Icon: ChefHat },
  { id: "ready", label: "Ready", Icon: CheckCircle2 },
];
const NEXT = { placed: "preparing", preparing: "ready" };
const SPEED = 15; // simulated seconds per real second
const MAX_ACTIVE = 6;

let seq = 40;
const makeTicket = (col = "placed", t = 0) => {
  const n = 1 + Math.floor(Math.random() * 3);
  const pool = [...MENU].sort(() => Math.random() - 0.5).slice(0, n);
  seq += 1;
  return { id: `o${seq}`, no: seq, table: 1 + Math.floor(Math.random() * 12), col, t, items: pool.map((name) => ({ name, q: 1 + Math.floor(Math.random() * 3) })) };
};

const tone = (t) => (t < 180 ? { c: "#f44d34", bg: "rgba(244.0,77.0,52.0,.14)" } : t < 300 ? { c: "#f4462b", bg: "rgba(244.0,70.0,43.0,.14)" } : { c: "#f87171", bg: "rgba(248.0,113.0,113.0,.18)" });
const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

function Ticket({ o, onAdvance, onPing, pinged }) {
  const k = tone(o.t);
  const ready = o.col === "ready";
  return (
    <motion.div layout layoutId={o.id} initial={{ opacity: 0, y: -40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className={`relative rounded-2xl border p-3 ${ready ? "border-[#f44d34]/60 bg-[#1d1d1d]" : "border-white/10 bg-white/[0.06]"}`}>
      {ready && <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl" animate={{ opacity: [0, 0.5, 0] }} transition={{ duration: 1.4, repeat: Infinity }} style={{ boxShadow: "0 0 0 2px #f44d34" }} />}
      <button type="button" aria-label={`Move order ${o.no} forward`} onClick={() => onAdvance(o.id)} className="block w-full min-h-[40px] text-left">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-2xl font-extrabold leading-none">T{o.table}<span className="ml-2 text-xs font-semibold text-white/40">#{o.no}</span></p>
          <span className="rounded-full px-2.5 py-1 font-display text-sm font-bold tabular-nums" style={{ color: k.c, background: k.bg }}>{fmt(o.t)}</span>
        </div>
        <ul className="mt-2 space-y-1">
          {o.items.map((i) => (
            <li key={i.name} className="flex items-center gap-2 text-[13px] text-white/85"><b className="w-6 font-display text-amber">{i.q}×</b><span className="truncate">{i.name}</span></li>
          ))}
        </ul>
      </button>
      {ready && (
        <button type="button" aria-label={`Notify service for order ${o.no}`} onClick={() => onPing(o.id)}
          className={`mt-2 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl text-xs font-bold ${pinged ? "bg-[#f44d34] text-ink" : "bg-white/10 text-white hover:bg-white/20"}`}>
          {pinged ? <BellRing size={15} /> : <Bell size={15} />}{pinged ? "Service pinged" : "Notify service"}
        </button>
      )}
    </motion.div>
  );
}

export default function KitchenDisplayDemo({ dark = false }) {
  const [tickets, setTickets] = useState(() => [makeTicket("preparing", 150), makeTicket("placed", 40), makeTicket("ready", 60)]);
  const [sound, setSound] = useState(true);
  const [pinged, setPinged] = useState({});
  const [toast, setToast] = useState(null);
  const toastT = useRef(null);

  const tick = useCallback(() => setTickets((ts) => ts.map((o) => (o.col === "ready" ? o : { ...o, t: o.t + SPEED / 2 }))), []);
  useTicker(tick, 500);
  const drop = useCallback(() => setTickets((ts) => (ts.length >= MAX_ACTIVE ? ts : [...ts, makeTicket()])), []);
  useTicker(drop, 5000);

  const advance = (id) => setTickets((ts) => (ts.flatMap((o) => (o.id !== id ? [o] : o.col === "ready" ? [] : [{ ...o, col: NEXT[o.col] }]))));
  const ping = (id) => {
    setPinged((p) => ({ ...p, [id]: true }));
    const o = tickets.find((x) => x.id === id);
    setToast(`Service notified: table ${o ? o.table : ""}`);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 1800);
  };
  React.useEffect(() => () => clearTimeout(toastT.current), []);

  const by = (c) => tickets.filter((o) => o.col === c);
  const cooking = tickets.filter((o) => o.col !== "ready");

  return (
    <Reveal className="w-full">
      <div className="mx-auto w-full max-w-[980px]">
        <BrowserFrame dark title="kitchen.dishky.com">
          <div className="relative">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="mr-auto font-display text-lg font-extrabold">Kitchen</p>
              {COLS.map((c) => <Chip key={c.id} tone={c.id === "ready" ? "ok" : c.id === "preparing" ? "warn" : "brand"}>{c.label} {by(c.id).length}</Chip>)}
              <button type="button" aria-label={sound ? "Mute sound" : "Unmute sound"} aria-pressed={sound} onClick={() => setSound((s) => !s)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">{sound ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {COLS.map(({ id, label, Icon }) => (
                <section key={id} aria-label={label} className="min-h-[120px] rounded-2xl bg-black/40 p-2.5 md:min-h-[300px]">
                  <p className="mb-2 flex items-center gap-2 px-1 font-display text-xs font-bold uppercase tracking-widest text-white/50"><Icon size={14} className={id === "ready" ? "text-[#f44d34]" : "text-amber"} />{label}</p>
                  <div className="relative space-y-2">
                    <AnimatePresence initial={false}>
                      {by(id).map((o) => <div key={o.id} className="relative"><Ticket o={o} onAdvance={advance} onPing={ping} pinged={pinged[o.id]} /></div>)}
                    </AnimatePresence>
                  </div>
                </section>
              ))}
            </div>
            <p className="mt-2 text-center text-[11px] text-white/40">Tap a ticket to move it on</p>
            <AnimatePresence>
              {toast && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" className="absolute inset-x-0 bottom-8 mx-auto flex w-fit items-center gap-2 rounded-full bg-[#f44d34] px-4 py-2 text-xs font-bold text-ink shadow-xl"><BellRing size={14} />{toast}</motion.div>}
            </AnimatePresence>
          </div>
        </BrowserFrame>

        <div className="mt-4 rounded-3xl bg-ink p-4 text-white shadow-xl sm:p-5">
          <p className="mb-3 flex items-center gap-2 font-display text-sm font-bold"><Tv size={16} className="text-amber" />Guest status board</p>
          <div className="grid grid-cols-2 gap-3">
            {[{ l: "Cooking", list: cooking, c: "text-amber" }, { l: "Ready", list: by("ready"), c: "text-[#f44d34]" }].map((b) => (
              <div key={b.l} className="min-h-[88px] rounded-2xl bg-white/[0.06] p-3">
                <p className={`text-[11px] font-bold uppercase tracking-widest ${b.c}`}>{b.l}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <AnimatePresence>
                    {b.list.map((o) => <motion.span key={o.id} layout initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className={`rounded-lg bg-white/10 px-2.5 py-1 font-display text-lg font-extrabold ${b.c}`}>{o.no}</motion.span>)}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

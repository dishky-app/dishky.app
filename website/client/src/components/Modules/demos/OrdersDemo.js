import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Printer, X } from "lucide-react";
import { BrowserFrame, Segmented, Chip, CountUp, useTicker } from "../../Kit/Kit.js";

const TYPES = [
  { value: "all", label: "All" },
  { value: "dine", label: "Dine-in" },
  { value: "take", label: "Take-away" },
  { value: "pick", label: "Pickup" },
];
const STATUSES = ["Placed", "Preparing", "Ready", "Completed"];
const TONE = { Placed: "info", Preparing: "warn", Ready: "ok", Completed: "mute" };
const ITEMS = [
  ["Dum Biryani", 360], ["Butter Curry", 320], ["Garlic Naan", 60], ["Paneer Tikka", 290],
  ["Mint Cooler", 120], ["Choco Lava", 180], ["Veg Pulao", 240], ["Masala Dosa", 150],
];
const WHERE = { dine: (n) => `Table ${(n % 12) + 1}`, take: () => "Take-away", pick: (n) => `Pickup · ${["Asha", "Ravi", "Meera", "Imran"][n % 4]}` };

let seq = 1040;
function makeOrder(n, ageSec = 0) {
  const type = ["dine", "dine", "take", "pick"][n % 4];
  const count = 2 + (n % 3);
  const list = Array.from({ length: count }, (_, i) => ITEMS[(n * 3 + i * 2) % ITEMS.length]);
  return {
    id: ++seq, type, where: WHERE[type](n * 5 + 2),
    items: list.map((l) => l[0]), lines: list,
    total: list.reduce((s, l) => s + l[1], 0), status: "Placed", born: Date.now() - ageSec * 1000,
  };
}
const seed = () => [makeOrder(1, 340), makeOrder(2, 200), makeOrder(3, 95)].map((o, i) => ({ ...o, status: STATUSES[Math.min(2, 2 - i)] })).reverse();
const age = (o, now) => { const s = Math.max(0, Math.floor((now - o.born) / 1000)); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`; };
const inr = (n) => `₹${n.toLocaleString("en-IN")}`;

export default function OrdersDemo({ dark = false }) {
  const [orders, setOrders] = useState(seed);
  const [type, setType] = useState("all");
  const [bill, setBill] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [n, setN] = useState(4);

  useTicker(() => {
    setOrders((o) => [makeOrder(n), ...o].slice(0, 7));
    setN((x) => x + 1);
  }, 4000);
  useTicker(() => setNow(Date.now()), 1000);

  const advance = (id) => setOrders((os) => os.map((o) => (o.id === id && o.status !== "Completed" ? { ...o, status: STATUSES[STATUSES.indexOf(o.status) + 1] } : o)));
  const shown = orders.filter((o) => type === "all" || o.type === type);
  const billOrder = orders.find((o) => o.id === bill);
  const sub = dark ? "text-white/50" : "text-black/50";

  return (
    <div className="w-full relative">
      <BrowserFrame title="admin.dishky.com/orders" dark={dark}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STATUSES.map((s) => (
              <div key={s} className={`rounded-2xl p-3 ${dark ? "bg-white/5" : "bg-beige"}`}>
                <div className={`text-[11px] font-semibold uppercase tracking-wide ${sub}`}>{s}</div>
                <CountUp to={orders.filter((o) => o.status === s).length} duration={0.5} className="font-display text-2xl font-semibold" />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Segmented options={TYPES} value={type} onChange={setType} dark={dark} />
            <span className={`text-xs ${sub}`}><span className="inline-block w-2 h-2 rounded-full bg-amber mr-1.5 kit-pulse" />Live · tap a status</span>
          </div>

          <div className="relative min-h-[200px] space-y-2">
            <AnimatePresence initial={false} mode="popLayout">
              {shown.map((o) => (
                <motion.div
                  layout key={o.id}
                  initial={{ opacity: 0, y: -24, scale: 0.97 }}
                  animate={{ opacity: o.status === "Completed" ? 0.55 : 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className={`flex items-center gap-2 sm:gap-3 rounded-2xl px-3 py-2 min-h-[56px] border ${dark ? "border-white/10 bg-white/5" : "border-black/5 bg-white shadow-sm"}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span className="truncate">{o.where}</span>
                      <span className={`text-[11px] font-normal ${sub}`}>#{o.id}</span>
                    </div>
                    <div className={`text-xs truncate ${sub}`}>{o.items.join(", ")}</div>
                  </div>
                  <div className="text-sm font-display font-semibold">{inr(o.total)}</div>
                  <span className={`text-xs w-8 text-right ${sub}`}>{age(o, now)}</span>
                  <button type="button" aria-label={`Advance order ${o.id} from ${o.status}`} onClick={() => advance(o.id)} className="min-h-[40px] min-w-[84px] flex items-center justify-center">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span key={o.status} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ duration: 0.15 }}>
                        <Chip tone={TONE[o.status]}>{o.status}</Chip>
                      </motion.span>
                    </AnimatePresence>
                  </button>
                  <button type="button" aria-label={`Print bill for order ${o.id}`} onClick={() => setBill(o.id)} className={`min-h-[40px] min-w-[40px] rounded-full grid place-items-center ${dark ? "bg-white/10" : "bg-black/5"}`}>
                    <Printer size={16} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {!shown.length && <div className={`text-center py-10 text-sm ${sub}`}>No orders yet</div>}
          </div>
        </div>

        <AnimatePresence>
          {billOrder && (
            <motion.div className="absolute inset-0 z-50 grid place-items-center p-4 bg-black/40 rounded-2xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBill(null)}>
              <motion.div
                role="dialog" aria-label="Bill receipt" onClick={(e) => e.stopPropagation()}
                initial={{ y: 40, opacity: 0, rotate: -2 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: 40, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className="w-full max-w-[280px] bg-white text-ink rounded-2xl p-5 shadow-2xl font-mono text-xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display font-semibold text-sm">Sam Cafe</span>
                  <button type="button" aria-label="Close bill" onClick={() => setBill(null)} className="min-h-[40px] min-w-[40px] grid place-items-center -mr-2"><X size={16} /></button>
                </div>
                <div className="text-black/50 mb-2">{billOrder.where} · #{billOrder.id}</div>
                <div className="border-t border-dashed border-black/20 py-2 space-y-1">
                  {billOrder.lines.map(([name, p], i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.07 }} className="flex justify-between"><span>{name}</span><span>{inr(p)}</span></motion.div>
                  ))}
                </div>
                <div className="border-t border-dashed border-black/20 pt-2 flex justify-between font-bold text-sm"><span>Total</span><span>{inr(billOrder.total)}</span></div>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: "spring" }} className="mt-3 text-center"><Chip tone="ok">Printed</Chip></motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </BrowserFrame>
    </div>
  );
}

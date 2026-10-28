import React from "react";
import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";
import { EASE } from "../../animations/variants.js";

/* Illustrative screens for the Admin Panel showcase. Static mock data: these
   show what each problem looks like once Dishky is handling it. */

const rise = (i = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: EASE, delay: 0.05 + i * 0.06 },
});

function Chip({ tone = "neutral", children }) {
  const tones = {
    neutral: "bg-ink/[0.06] text-ink/60",
    live: "bg-amber/10 text-amber",
    ok: "bg-neutral-50 text-amber",
    warn: "bg-neutral-50 text-amber",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ---- Orders: one live board ------------------------------------------- */
const orderCols = [
  {
    title: "New",
    tone: "live",
    cards: [
      { id: "#e4290c44", table: "Table 12", items: "3 items", t: "0:12", fresh: true },
      { id: "#e4290c33", table: "Table 4", items: "2 items", t: "0:48" },
    ],
  },
  {
    title: "Preparing",
    tone: "warn",
    cards: [
      { id: "#e4290c11", table: "Table 7", items: "4 items", t: "6:30" },
      { id: "#e4290c00", table: "Takeaway", items: "1 item", t: "8:05" },
    ],
  },
  {
    title: "Ready",
    tone: "ok",
    cards: [{ id: "#e4290c88", table: "Table 2", items: "2 items", t: "Ready" }],
  },
];

export function OrdersView() {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
      {orderCols.map((col, ci) => (
        <div key={col.title} className="min-w-0 rounded-xl bg-ink/[0.04] p-2 sm:p-2.5">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-ink/70">{col.title}</span>
            <Chip tone={col.tone}>{col.cards.length}</Chip>
          </div>
          <div className="space-y-2">
            {col.cards.map((c, i) => (
              <motion.div
                key={c.id}
                {...rise(ci * 2 + i)}
                className={`relative rounded-lg bg-white p-2.5 shadow-sm ring-1 ${c.fresh ? "ring-amber/50" : "ring-ink/5"}`}
              >
                {c.fresh && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-ping rounded-full bg-amber" aria-hidden="true" />}
                <p className="font-display text-xs font-bold text-ink">{c.id}</p>
                <p className="mt-0.5 truncate text-[11px] text-ink/55">{c.table}</p>
                <div className="mt-2 flex items-center justify-between text-[10px] text-ink/45">
                  <span>{c.items}</span>
                  <span className="font-semibold tabular-nums text-ink/60">{c.t}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- Stock: warn before it runs out ----------------------------------- */
const stock = [
  { name: "Basmati rice", pct: 82, qty: "41 kg" },
  { name: "Chicken", pct: 58, qty: "17 kg" },
  { name: "Paneer", pct: 24, qty: "3 kg", low: true },
  { name: "Cooking oil", pct: 67, qty: "20 L" },
  { name: "Fresh cream", pct: 14, qty: "2 L", low: true },
];

export function StockView() {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-[11px] font-semibold text-amber">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
        2 ingredients are running low. Reorder before service.
      </div>
      <ul className="space-y-3">
        {stock.map((s, i) => (
          <motion.li key={s.name} {...rise(i)} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs font-semibold text-ink/80 sm:w-28">{s.name}</span>
            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
              <motion.span
                className={`absolute inset-y-0 left-0 rounded-full ${s.low ? "bg-red-500" : "bg-ink"}`}
                initial={{ width: 0 }}
                animate={{ width: `${s.pct}%` }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.15 + i * 0.07 }}
              />
            </span>
            <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-ink/50">{s.qty}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/* ---- Bookings: one schedule ------------------------------------------- */
const bookings = [
  { time: "12:30", name: "Rao family", meta: "Table 6 · 5 guests", kind: "Reservation", tone: "ok" },
  { time: "13:00", name: "Office lunch", meta: "Catering · 24 portions", kind: "Catering", tone: "live" },
  { time: "19:30", name: "Meera S.", meta: "Table 3 · 2 guests", kind: "Pre-booking", tone: "neutral" },
  { time: "20:00", name: "Anniversary dinner", meta: "Table 9 · 4 guests", kind: "Event", tone: "warn" },
];

export function BookingsView() {
  return (
    <ul className="divide-y divide-ink/[0.07]">
      {bookings.map((b, i) => (
        <motion.li key={b.time} {...rise(i)} className="flex items-center gap-3 py-2.5 first:pt-0">
          <span className="w-12 shrink-0 font-display text-sm font-bold tabular-nums text-ink">{b.time}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-ink/85">{b.name}</span>
            <span className="block truncate text-[11px] text-ink/50">{b.meta}</span>
          </span>
          <Chip tone={b.tone}>{b.kind}</Chip>
        </motion.li>
      ))}
    </ul>
  );
}

/* ---- Team: who can do what -------------------------------------------- */
const roles = ["Admin", "Manager", "Chef", "Staff"];
const perms = [
  { module: "Orders", v: [1, 1, 1, 1] },
  { module: "Kitchen", v: [1, 1, 1, 0] },
  { module: "Stock", v: [1, 1, 1, 0] },
  { module: "Payments", v: [1, 1, 0, 0] },
  { module: "Roles", v: [1, 0, 0, 0] },
];

export function TeamView() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[300px] border-separate border-spacing-y-1.5 text-left">
        <thead>
          <tr>
            <th className="pb-1 text-[10px] font-bold uppercase tracking-wide text-ink/40">Module</th>
            {roles.map((r) => (
              <th key={r} className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-ink/40">
                {r}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {perms.map((p, i) => (
            <motion.tr key={p.module} {...rise(i)} className="bg-ink/[0.04]">
              <td className="rounded-l-lg px-3 py-2 text-xs font-semibold text-ink/80">{p.module}</td>
              {p.v.map((on, j) => (
                <td key={j} className={`px-2 py-2 text-center ${j === p.v.length - 1 ? "rounded-r-lg" : ""}`}>
                  {on ? (
                    <Check size={15} className="mx-auto text-amber" aria-label="Allowed" />
                  ) : (
                    <Minus size={15} className="mx-auto text-ink/25" aria-label="Not allowed" />
                  )}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- Payments: every order accounted for ------------------------------ */
const payments = [
  { id: "#e4290c44", amt: "₹1,240", paid: false },
  { id: "#e4290c33", amt: "₹680", paid: true },
  { id: "#e4290c11", amt: "₹2,150", paid: true },
  { id: "#e4290c88", amt: "₹920", paid: true },
];

export function PaymentsView() {
  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <motion.div {...rise(0)} className="rounded-xl bg-ink p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-cream/50">Paid today</p>
          <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-cream">₹48,360</p>
        </motion.div>
        <motion.div {...rise(1)} className="rounded-xl bg-ink/[0.05] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink/45">Pending</p>
          <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-ink">₹1,240</p>
        </motion.div>
      </div>
      <ul className="divide-y divide-ink/[0.07]">
        {payments.map((p, i) => (
          <motion.li key={p.id} {...rise(i + 2)} className="flex items-center justify-between py-2.5">
            <span className="font-display text-xs font-bold text-ink">{p.id}</span>
            <span className="text-xs tabular-nums text-ink/60">{p.amt}</span>
            <Chip tone={p.paid ? "ok" : "warn"}>{p.paid ? "Paid" : "Pending"}</Chip>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/* ---- Branches: compare from one login --------------------------------- */
const branches = [
  { city: "Chennai", rev: "₹4.2L", pct: 100 },
  { city: "Madurai", rev: "₹3.1L", pct: 74 },
  { city: "Coimbatore", rev: "₹2.8L", pct: 67 },
];

export function BranchesView() {
  return (
    <div>
      <p className="mb-3 text-[11px] font-semibold text-ink/50">Revenue this month · all branches</p>
      <ul className="space-y-3.5">
        {branches.map((b, i) => (
          <motion.li key={b.city} {...rise(i)}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-ink/85">{b.city}</span>
              <span className="font-display font-bold tabular-nums text-ink">{b.rev}</span>
            </div>
            <span className="relative block h-2.5 overflow-hidden rounded-full bg-ink/[0.07]">
              <motion.span
                className={`absolute inset-y-0 left-0 rounded-full ${i === 0 ? "bg-amber" : "bg-ink"}`}
                initial={{ width: 0 }}
                animate={{ width: `${b.pct}%` }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.15 + i * 0.1 }}
              />
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

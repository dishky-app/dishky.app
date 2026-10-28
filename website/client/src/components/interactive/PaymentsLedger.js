import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check, Smartphone, CreditCard, Banknote } from "lucide-react";
import Window from "../ui/Window.js";
import Count from "../ui/Count.js";

const METHODS = [["UPI", Smartphone], ["Card", CreditCard], ["Cash", Banknote]];
const START = [
  { id: 4824, table: "Table 12", amt: 1240, m: null },
  { id: 4823, table: "Table 4", amt: 680, m: 0 },
  { id: 4822, table: "Takeaway", amt: 420, m: null },
  { id: 4821, table: "Table 7", amt: 2150, m: 1 },
  { id: 4820, table: "Table 2", amt: 920, m: 2 },
];

/** Every order carries its payment. Collect the pending ones and the totals follow. */
export default function PaymentsLedger() {
  const [rows, setRows] = useState(START);
  const collect = (id) => setRows((r) => r.map((x) => (x.id === id ? { ...x, m: x.m === null ? Math.floor(Math.random() * 3) : null } : x)));
  const paid = rows.filter((r) => r.m !== null).reduce((s, r) => s + r.amt, 0);
  const pend = rows.filter((r) => r.m === null).reduce((s, r) => s + r.amt, 0);
  return (
    <Window title="Payments · today">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-ink p-4 text-cream"><p className="text-[10px] font-bold uppercase tracking-wide text-cream/50">Paid</p><p className="mt-1 font-display text-2xl font-extrabold"><Count value={paid} prefix="₹" /></p></div>
        <div className="rounded-2xl bg-amber/10 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-amber">Pending</p><p className="mt-1 font-display text-2xl font-extrabold text-ink"><Count value={pend} prefix="₹" /></p></div>
      </div>
      <ul className="mt-4 space-y-2">
        {rows.map((r) => {
          const M = r.m === null ? null : METHODS[r.m][1];
          return (
            <li key={r.id} className="flex items-center gap-3 rounded-xl bg-ink/[0.04] px-3 py-2.5">
              <span className="font-display text-xs font-bold">#{r.id}</span>
              <span className="flex-1 truncate text-xs text-ink/55">{r.table}</span>
              <span className="text-xs font-semibold tabular-nums">₹{r.amt.toLocaleString("en-IN")}</span>
              <button type="button" onClick={() => collect(r.id)} style={{ minHeight: 30 }}
                className={`inline-flex w-[84px] items-center justify-center gap-1 rounded-full text-[11px] font-bold transition ${r.m === null ? "bg-amber text-ink" : "bg-neutral-100 text-amber"}`}>
                {r.m === null ? "Collect" : (<motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="inline-flex items-center gap-1"><Check size={12} strokeWidth={3} /><M size={12} />{METHODS[r.m][0]}</motion.span>)}
              </button>
            </li>
          );
        })}
      </ul>
    </Window>
  );
}

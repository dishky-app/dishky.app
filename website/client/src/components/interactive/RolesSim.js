import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, ChefHat, Boxes, Wallet, Users, BarChart3, Shield, Check } from "lucide-react";
import Window from "../ui/Window.js";

const MODULES = [
  { key: "orders", label: "Orders", icon: ShoppingBag },
  { key: "kitchen", label: "Kitchen", icon: ChefHat },
  { key: "stock", label: "Stock", icon: Boxes },
  { key: "payments", label: "Payments", icon: Wallet },
  { key: "staff", label: "Staff", icon: Users },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "roles", label: "Roles", icon: Shield },
];
const ROLES = {
  Admin: ["orders", "kitchen", "stock", "payments", "staff", "reports", "roles"],
  Manager: ["orders", "kitchen", "stock", "payments", "staff", "reports"],
  Chef: ["orders", "kitchen", "stock"],
  Service: ["orders", "staff"],
};

/** Pick a role, flip modules on and off, watch that person's menu change. */
export default function RolesSim() {
  const [perm, setPerm] = useState(ROLES);
  const [role, setRole] = useState("Chef");
  const on = perm[role];
  const toggle = (k) => setPerm((p) => ({ ...p, [role]: p[role].includes(k) ? p[role].filter((x) => x !== k) : [...p[role], k] }));
  return (
    <Window title="Roles & permissions">
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.keys(ROLES).map((r) => (
          <button key={r} type="button" onClick={() => setRole(r)} style={{ minHeight: 36 }} className={`rounded-full px-4 text-xs font-bold transition ${role === r ? "bg-ink text-cream" : "bg-ink/[0.06] text-ink/60 hover:bg-ink/10"}`}>{r}</button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
        <ul className="grid grid-cols-2 gap-2">
          {MODULES.map(({ key, label, icon: Icon }) => {
            const a = on.includes(key);
            return (
              <li key={key}>
                <button type="button" onClick={() => toggle(key)} style={{ minHeight: 0 }} className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${a ? "border-amber/60 bg-amber/10 text-ink" : "border-ink/10 text-ink/40"}`}>
                  <Icon size={15} className={a ? "text-amber" : ""} />
                  <span className="flex-1">{label}</span>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full ${a ? "bg-amber text-white" : "bg-ink/10"}`}>{a && <Check size={12} strokeWidth={3} />}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="rounded-2xl bg-ink p-3 text-cream">
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-cream/40">{role} sees</p>
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {MODULES.filter((m) => on.includes(m.key)).map(({ key, label, icon: Icon }) => (
                <motion.li key={key} layout initial={{ opacity: 0, x: -16, height: 0 }} animate={{ opacity: 1, x: 0, height: "auto" }} exit={{ opacity: 0, x: 16, height: 0 }} className="flex items-center gap-2 rounded-lg bg-cream/[0.07] px-2.5 py-2 text-xs font-semibold">
                  <Icon size={14} className="text-amber" /> {label}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {on.length === 0 && <p className="px-2 py-4 text-xs text-cream/40">Nothing yet.</p>}
        </div>
      </div>
    </Window>
  );
}

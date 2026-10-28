import React, { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutDashboard, ClipboardList, UtensilsCrossed, Boxes, CreditCard, Users, BarChart3, Settings, Lock, Check, X, Play, Square, ScrollText } from "lucide-react";
import { Reveal, useTicker, BrowserFrame, Chip } from "../../Kit/Kit.js";

const MODS = [
  { id: "Dashboard", Icon: LayoutDashboard }, { id: "Orders", Icon: ClipboardList }, { id: "Menu", Icon: UtensilsCrossed }, { id: "Inventory", Icon: Boxes },
  { id: "Payments", Icon: CreditCard }, { id: "Staff", Icon: Users }, { id: "Reports", Icon: BarChart3 }, { id: "Settings", Icon: Settings },
];
const ACTS = ["view", "add", "edit", "delete"];
const ROLES = [
  { id: "Owner", name: "Arjun Mehta", ini: "AM", color: "#f33716" },
  { id: "Manager", name: "Priya Nair", ini: "PN", color: "#f66a55" },
  { id: "Chef", name: "Karthik Rao", ini: "KR", color: "#f22c0e" },
  { id: "Waiter", name: "Imran Sheikh", ini: "IS", color: "#e4290c" },
  { id: "Cashier", name: "Divya Menon", ini: "DM", color: "#f5573f" },
];
const mk = (spec) => Object.fromEntries(MODS.map((m) => [m.id, Object.fromEntries(ACTS.map((a, i) => [a, (spec[m.id] || "")[i] === "1"]))]));
const INITIAL = {
  Owner: mk(Object.fromEntries(MODS.map((m) => [m.id, "1111"]))),
  Manager: mk({ Dashboard: "1000", Orders: "1110", Menu: "1110", Inventory: "1110", Payments: "1000", Staff: "1100", Reports: "1000", Settings: "0000" }),
  Chef: mk({ Dashboard: "0000", Orders: "1010", Menu: "1100", Inventory: "1110", Payments: "0000", Staff: "0000", Reports: "0000", Settings: "0000" }),
  Waiter: mk({ Dashboard: "0000", Orders: "1100", Menu: "1000", Inventory: "0000", Payments: "0000", Staff: "0000", Reports: "0000", Settings: "0000" }),
  Cashier: mk({ Dashboard: "1000", Orders: "1010", Menu: "1000", Inventory: "0000", Payments: "1110", Staff: "0000", Reports: "1000", Settings: "0000" }),
};
const stamp = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
const clock = (s) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, "0")).join(":");

export default function StaffRolesDemo({ dark = false }) {
  const [role, setRole] = useState("Manager");
  const [perms, setPerms] = useState(INITIAL);
  const [log, setLog] = useState([{ id: 0, t: "09:00:00 am", text: "Priya Nair signed in" }]);
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(false);

  const r = ROLES.find((x) => x.id === role);
  const mine = perms[role];
  const pushLog = (text) => setLog((l) => [{ id: Date.now() + Math.random(), t: stamp(), text }, ...l].slice(0, 6));

  const toggle = (mod, act) => {
    const next = !mine[mod][act];
    setPerms((p) => {
      const m = { ...p[role][mod], [act]: next };
      if (act === "view" && !next) ACTS.forEach((a) => { m[a] = false; });
      if (act !== "view" && next) m.view = true;
      return { ...p, [role]: { ...p[role], [mod]: m } };
    });
    pushLog(`${role}: ${next ? "granted" : "revoked"} ${act} on ${mod}`);
  };
  const tick = useCallback(() => setSecs((s) => s + 1), []);
  useTicker(tick, 1000, running);
  const toggleClock = () => {
    pushLog(`${r.name} clocked ${running ? "out" : "in"}`);
    if (running) setRunning(false); else { setSecs(0); setRunning(true); }
  };

  const card = dark ? "bg-white/5 border-white/10" : "bg-white border-ink/10";
  const sub = dark ? "text-white/55" : "text-ink/50";
  const txt = dark ? "text-white" : "text-ink";
  const allowed = MODS.filter((m) => mine[m.id].view).length;

  return (
    <Reveal className="w-full">
      <div className="mx-auto w-full max-w-[980px]">
        <BrowserFrame title="admin.dishky.com/staff/roles" dark={dark}>
          <div className={`min-w-0 space-y-4 ${txt}`}>
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Choose a role">
              {ROLES.map((x) => {
                const on = x.id === role;
                return (
                  <button key={x.id} type="button" role="radio" aria-checked={on} aria-label={`Role: ${x.id}`} onClick={() => setRole(x.id)}
                    className={`relative flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 transition ${on ? "border-amber shadow-lg" : `${card} hover:-translate-y-0.5`}`}>
                    {on && <motion.span layoutId="sr-role" className="absolute inset-0 rounded-2xl bg-amber/10" />}
                    <span className="relative flex h-9 w-9 items-center justify-center rounded-full font-display text-[12px] font-extrabold text-white" style={{ background: x.color }}>{x.ini}</span>
                    <span className="relative text-[10px] font-bold sm:text-[12px]">{x.id}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 md:grid-cols-[210px_1fr]">
              <aside className={`rounded-3xl border p-2.5 ${card}`}>
                <ul className="grid grid-cols-2 gap-1 md:grid-cols-1" aria-label="Admin sidebar preview">
                  {MODS.map((m, i) => {
                    const ok = mine[m.id].view;
                    return (
                      <motion.li key={m.id} layout animate={{ opacity: ok ? 1 : 0.4 }} transition={{ duration: 0.3, delay: i * 0.02 }}
                        className={`flex min-h-[40px] items-center gap-2.5 rounded-xl px-3 text-[13px] font-semibold ${ok ? "bg-amber/10 text-amber" : sub}`}>
                        <m.Icon size={16} />
                        <span className="flex-1 truncate">{m.id}</span>
                        <AnimatePresence>{!ok && <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}><Lock size={13} /></motion.span>}</AnimatePresence>
                      </motion.li>
                    );
                  })}
                </ul>
                <p className={`mt-2 px-2 text-[11px] font-medium ${sub}`}>{allowed} of {MODS.length} modules</p>
              </aside>

              <section className={`min-w-0 rounded-3xl border p-3 sm:p-4 ${card}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className={`text-[11px] font-bold uppercase tracking-wider ${sub}`}>Permissions · {role}</p>
                  <Chip tone="brand">Live</Chip>
                </div>
                <div className="grid grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(40px,1fr))] items-center gap-1 text-center">
                  <span />
                  {ACTS.map((a) => <span key={a} className={`text-[10px] font-bold capitalize ${sub}`}>{a}</span>)}
                  {MODS.map((m) => (
                    <React.Fragment key={m.id}>
                      <span className="truncate text-left text-[12px] font-semibold">{m.id}</span>
                      {ACTS.map((a) => {
                        const on = mine[m.id][a];
                        return (
                          <button key={a} type="button" aria-pressed={on} aria-label={`${on ? "Revoke" : "Grant"} ${a} on ${m.id} for ${role}`} onClick={() => toggle(m.id, a)}
                            className={`mx-auto flex h-10 w-full max-w-[52px] items-center justify-center rounded-xl transition ${on ? "bg-amber text-white shadow-md" : dark ? "bg-white/10 text-white/40" : "bg-beige text-ink/30"}`}>
                            <motion.span key={String(on)} initial={{ scale: 0.4, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 420, damping: 18 }}>{on ? <Check size={16} /> : <X size={14} />}</motion.span>
                          </button>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_260px]">
              <section className={`rounded-3xl border p-4 ${card}`}>
                <p className={`mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${sub}`}><ScrollText size={13} />Audit log</p>
                <ul className="min-h-[120px] space-y-1.5">
                  <AnimatePresence initial={false}>
                    {log.map((e) => (
                      <motion.li key={e.id} layout initial={{ opacity: 0, x: -16, height: 0 }} animate={{ opacity: 1, x: 0, height: "auto" }} exit={{ opacity: 0 }} className="flex gap-2 text-[12px]">
                        <span className={`shrink-0 tabular-nums ${sub}`}>{e.t}</span><span className="min-w-0 flex-1 font-medium">{e.text}</span>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
              <section className={`flex flex-col items-center justify-center gap-3 rounded-3xl border p-4 ${card}`}>
                <span className="flex h-12 w-12 items-center justify-center rounded-full font-display text-sm font-extrabold text-white" style={{ background: r.color }}>{r.ini}</span>
                <p className="font-display text-3xl font-extrabold tabular-nums" aria-live="off">{clock(secs)}</p>
                <button type="button" onClick={toggleClock} aria-label={running ? "Clock out" : "Clock in"} className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-6 text-[13px] font-bold text-white shadow-lg transition ${running ? "bg-charcoal" : "bg-amber kit-pulse"}`}>
                  {running ? <Square size={14} /> : <Play size={14} />}{running ? "Clock out" : "Clock in"}
                </button>
              </section>
            </div>
          </div>
        </BrowserFrame>
      </div>
    </Reveal>
  );
}

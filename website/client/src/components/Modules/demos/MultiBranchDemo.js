import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Copy, Check, IndianRupee, ShoppingBag, Flame, Users, Layers } from "lucide-react";
import { Reveal, CountUp, useTicker, BrowserFrame, Chip } from "../../Kit/Kit.js";

const BRANCHES = [
  { id: "indiranagar", n: 1, label: "Indiranagar", color: "#f33716", sales: 148600, orders: 342, dish: "Hyderabadi Dum Biryani", staff: 14, x: 190, y: 70 },
  { id: "koramangala", n: 2, label: "Koramangala", color: "#f66a55", sales: 172300, orders: 398, dish: "Butter Chicken", staff: 17, x: 150, y: 125 },
  { id: "whitefield", n: 3, label: "Whitefield", color: "#e4290c", sales: 96400, orders: 226, dish: "Masala Dosa", staff: 11, x: 262, y: 100 },
  { id: "hsr", n: 4, label: "HSR Layout", color: "#f22c0e", sales: 121800, orders: 287, dish: "Paneer Tikka", staff: 12, x: 175, y: 168 },
];
const ALL = { id: "all", label: "All branches", color: "#1a1a1a" };
const TOTAL = BRANCHES.reduce((a, b) => ({ sales: a.sales + b.sales, orders: a.orders + b.orders, staff: a.staff + b.staff }), { sales: 0, orders: 0, staff: 0 });
const ITEMS = ["Chicken Biryani", "Filter Coffee", "Paneer Tikka", "Masala Dosa", "Butter Naan", "Gulab Jamun", "Veg Thali"];
const glyph = (seed) => Array.from({ length: 49 }, (_, i) => {
  const x = i % 7, y = Math.floor(i / 7);
  if ((x < 3 && y < 3) || (x > 3 && y < 3) || (x < 3 && y > 3)) return (x % 6 === 0 || y % 6 === 0 || (x === 1 && y === 1) || (x === 5 && y === 1) || (x === 1 && y === 5)) ? 1 : 0;
  return ((i * 7 + seed * 13 + x * y) % 5) < 2 ? 1 : 0;
});

export default function MultiBranchDemo({ dark = false }) {
  const [sel, setSel] = useState("indiranagar");
  const [feed, setFeed] = useState([]);
  const [extra, setExtra] = useState({});
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const isAll = sel === "all";
  const b = BRANCHES.find((x) => x.id === sel);
  const link = b ? `dishky.com/yourplace/${b.id}/${b.n}` : "dishky.com/yourplace";

  const tick = useCallback(() => {
    const br = BRANCHES[Math.floor(Math.random() * BRANCHES.length)];
    const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
    setFeed((f) => [{ id: Date.now() + Math.random(), br, item, amt: 180 + Math.floor(Math.random() * 14) * 40 }, ...f].slice(0, 4));
    setExtra((e) => ({ ...e, [br.id]: (e[br.id] || 0) + 1 }));
  }, []);
  useTicker(tick, 1800);

  const copy = async () => {
    try { await navigator.clipboard?.writeText(`https://${link}`); } catch (e) { /* demo only */ }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  };

  const ordersOf = (x) => x.orders + (extra[x.id] || 0);
  const extraAll = Object.values(extra).reduce((a, c) => a + c, 0);
  const stats = isAll
    ? { sales: TOTAL.sales, orders: TOTAL.orders + extraAll, dish: "Biryani (all outlets)", staff: TOTAL.staff }
    : { sales: b.sales + (extra[b.id] || 0) * 420, orders: ordersOf(b), dish: b.dish, staff: b.staff };
  const maxSales = Math.max(...BRANCHES.map((x) => x.sales));
  const accent = isAll ? "#f33716" : b.color;

  const card = dark ? "bg-white/5 border-white/10" : "bg-white border-ink/10";
  const sub = dark ? "text-white/55" : "text-ink/50";
  const txt = dark ? "text-white" : "text-ink";
  const tabs = [...BRANCHES, ALL];
  const kpi = [
    { Icon: IndianRupee, label: "Sales", node: <CountUp to={stats.sales} prefix="₹" duration={0.8} /> },
    { Icon: ShoppingBag, label: "Orders", node: <CountUp to={stats.orders} duration={0.8} /> },
    { Icon: Flame, label: "Top dish", node: <span className="block truncate text-[13px] sm:text-sm">{stats.dish}</span> },
    { Icon: Users, label: "On shift", node: <CountUp to={stats.staff} duration={0.8} /> },
  ];

  return (
    <Reveal className="w-full">
      <div className="mx-auto w-full max-w-[980px]">
        <BrowserFrame title="admin.dishky.com/branches" dark={dark}>
          <div className={`min-w-0 space-y-4 ${txt}`}>
            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Branches" style={{ scrollbarWidth: "none" }}>
              {tabs.map((t) => {
                const on = t.id === sel;
                return (
                  <button key={t.id} type="button" role="tab" aria-selected={on} aria-label={`Branch: ${t.label}`} onClick={() => setSel(t.id)}
                    className={`relative inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-bold transition ${on ? "border-transparent text-white" : `${card} hover:-translate-y-0.5`}`}>
                    {on && <motion.span layoutId="mb-tab" className="absolute inset-0 rounded-full shadow-lg" style={{ background: t.color }} transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                    <span className="relative flex items-center gap-2">{t.id === "all" ? <Layers size={14} /> : <span className="h-2 w-2 rounded-full" style={{ background: on ? "#ffffff" : t.color }} />}{t.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
              <section className={`relative overflow-hidden rounded-3xl border ${card}`}>
                <svg viewBox="0 0 320 210" className="h-auto w-full" role="img" aria-label="Stylised city map">
                  <rect width="320" height="210" fill={dark ? "#1b1b1b" : "#f2f2f2"} />
                  <path d="M-10 150 C60 120 90 170 160 140 S280 90 330 120" fill="none" stroke={dark ? "#e4290c" : "#e0e0e0"} strokeWidth="14" strokeLinecap="round" />
                  <ellipse cx="70" cy="60" rx="46" ry="30" fill={dark ? "#292929" : "#e4e4e4"} />
                  <ellipse cx="270" cy="175" rx="38" ry="22" fill={dark ? "#292929" : "#e4e4e4"} />
                  <path d="M20 30 L300 190 M120 0 L200 210 M0 110 L320 70" stroke={dark ? "#333333" : "#dcdcdc"} strokeWidth="5" strokeLinecap="round" />
                  <g stroke={dark ? "#2d2d2d" : "#e4e4e4"} strokeWidth="2"><path d="M40 190 L110 90 M230 20 L300 150 M80 20 L60 130" /></g>
                  {BRANCHES.map((x) => {
                    const on = sel === x.id || isAll;
                    return (
                      <g key={x.id} onClick={() => setSel(x.id)} style={{ cursor: "pointer" }}>
                        {on && <motion.circle cx={x.x} cy={x.y} r="8" fill={x.color} initial={{ opacity: 0.5, r: 8 }} animate={{ opacity: 0, r: 26 }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }} />}
                        <motion.circle cx={x.x} cy={x.y} r="6" fill={x.color} stroke="#ffffff" strokeWidth="3" initial={{ r: 6 }} animate={{ r: sel === x.id ? 10 : 6, opacity: on ? 1 : 0.45 }} />
                        <text x={x.x} y={x.y - 15} textAnchor="middle" fontSize="9" fontWeight="700" fill={dark ? "#ffffff" : "#1a1a1a"} opacity={on ? 1 : 0.4}>{x.label}</text>
                      </g>
                    );
                  })}
                </svg>
                <span className="absolute left-3 top-3"><Chip tone="mute"><MapPin size={11} />Bengaluru</Chip></span>
              </section>

              <div className="min-w-0 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  {kpi.map((k) => (
                    <motion.div key={k.label} layout className={`rounded-2xl border p-3 ${card}`}>
                      <p className={`flex items-center gap-1.5 text-[11px] font-semibold ${sub}`}><k.Icon size={12} style={{ color: accent }} />{k.label}</p>
                      <p className="mt-1 min-h-[28px] font-display text-lg font-extrabold">{k.node}</p>
                    </motion.div>
                  ))}
                </div>

                <section className={`rounded-3xl border p-4 ${card}`}>
                  <AnimatePresence mode="wait" initial={false}>
                    {isAll ? (
                      <motion.ul key="all" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2.5" aria-label="Branch comparison">
                        {BRANCHES.map((x, i) => (
                          <li key={x.id} className="flex items-center gap-2 text-[12px] font-semibold">
                            <span className="w-[84px] shrink-0 truncate">{x.label}</span>
                            <div className={`h-3.5 flex-1 overflow-hidden rounded-full ${dark ? "bg-white/10" : "bg-beige"}`}>
                              <motion.div className="h-full rounded-full" style={{ background: x.color }} initial={{ width: 0 }} animate={{ width: `${(x.sales / maxSales) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.08 }} />
                            </div>
                            <span className={`w-[50px] shrink-0 text-right ${sub}`}>₹{Math.round(x.sales / 1000)}k</span>
                          </li>
                        ))}
                      </motion.ul>
                    ) : (
                      <motion.div key={sel} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
                        <div className="grid h-[56px] w-[56px] shrink-0 grid-cols-7 gap-px rounded-lg bg-white p-1.5 shadow" aria-hidden="true">
                          {glyph(b.n).map((v, i) => <span key={i} style={{ background: v ? "#1a1a1a" : "transparent" }} />)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-[11px] font-semibold ${sub}`}>Branch link</p>
                          <p className="truncate font-mono text-[12px] font-semibold" title={link}>{link}</p>
                        </div>
                        <button type="button" onClick={copy} aria-label="Copy branch link" className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-bold text-white transition ${copied ? "bg-red-500" : ""}`} style={copied ? undefined : { background: b.color }}>
                          {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              </div>
            </div>

            <section className={`rounded-3xl border p-3 ${card}`} aria-label="Live orders">
              <p className={`mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-wider ${sub}`}><span className="kit-pulse h-2 w-2 rounded-full bg-amber" />Live orders</p>
              <ul className="min-h-[148px] space-y-1.5">
                <AnimatePresence initial={false}>
                  {feed.map((f) => (
                    <motion.li key={f.id} layout initial={{ opacity: 0, y: -14 }} animate={{ opacity: sel === "all" || sel === f.br.id ? 1 : 0.4, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold" style={{ background: `${f.br.color}${dark ? "26" : "14"}`, borderLeft: `3px solid ${f.br.color}` }}>
                      <span className="shrink-0" style={{ color: f.br.color }}>{f.br.label}</span>
                      <span className="min-w-0 flex-1 truncate font-medium opacity-75">{f.item}</span>
                      <span className="shrink-0">₹{f.amt}</span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          </div>
        </BrowserFrame>
      </div>
    </Reveal>
  );
}

import React, { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Heart, MessageCircle, Send, Sparkles, Handshake, BadgePercent, Rocket, Ticket, CalendarHeart, Megaphone,
  Camera, MapPin, Check, Lock, ShieldCheck, Store, TrendingUp, Gift, Crown, Star, UserCheck, Clock,
  QrCode, ShoppingBag, Plus, FileText, ListTodo, StickyNote, ScrollText, MessageSquare,
} from "lucide-react";
import { Window, Phone, Pill, CountUp, Photo, useInterval } from "../ui/kit.js";
import { BrandMark } from "../Brand/Brand.js";
import { images } from "../../assets/images/imageUrls.js";

/* ------------------------------------------------------------ Promotions */
const POSTS = [
  { k: "Spotlight", Icon: Sparkles, img: images.dishCurry, art: "post-spotlight", name: "Your Restaurant", line: "Come for the signature dish. Stay for the room." },
  { k: "Collab", Icon: Handshake, img: images.chefPlating, art: "post-collab", name: "Dishky × Your Restaurant", line: "Made together. Served at your table." },
  { k: "Offer", Icon: BadgePercent, img: images.dishDessert, art: "post-offer", name: "Weekend special", line: "Limited-time. Live this week." },
  { k: "Launch", Icon: Rocket, img: images.restaurantInterior2, art: "post-launch", name: "Now open", line: "Our new branch, first look." },
];

export function PromoDemo() {
  const [k, setK] = useState(0);
  const [likes, setLikes] = useState([0, 0, 0, 0]);
  const [hearts, setHearts] = useState([]);
  const [reach, setReach] = useState(3);
  const id = useRef(0);
  const P = POSTS[k];
  const like = () => {
    setLikes((l) => l.map((v, i) => (i === k ? v + 1 : v)));
    const h = ++id.current;
    setHearts((x) => [...x, h]);
    setTimeout(() => setHearts((x) => x.filter((y) => y !== h)), 1200);
  };
  const people = Math.round(reach * 4200);
  return (
    <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
      <Phone>
        <div className="flex items-center gap-2 border-b border-ink/5 px-3 pb-2 pt-7">
          <BrandMark className="h-6" />
          <div className="leading-tight">
            <p className="font-display text-xs font-bold">dishky</p>
            <p className="text-[10px] text-ink/50">{P.k}</p>
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={k}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35 }}
            className="relative"
          >
            <Photo src={P.img} art={P.art} className="aspect-[4/4.4] w-full" />
            <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/75 via-transparent to-transparent p-4 text-white">
              <div>
                <P.Icon size={16} />
                <p className="mt-1 font-display text-sm font-extrabold">{P.name}</p>
                <p className="text-[11px] text-white/80">{P.line}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="relative flex items-center gap-4 px-4 py-3">
          <button type="button" onClick={like} aria-label="Like" className="relative">
            <Heart size={22} className={likes[k] ? "fill-amber text-amber" : "text-ink/70"} />
            {hearts.map((h) => (
              <motion.span
                key={h}
                initial={{ y: 0, opacity: 1, scale: 1 }}
                animate={{ y: -90, opacity: 0, scale: 1.8 }}
                transition={{ duration: 1.1 }}
                className="pointer-events-none absolute -top-1 left-0 text-amber"
              >
                <Heart size={18} className="fill-amber" />
              </motion.span>
            ))}
          </button>
          <MessageCircle size={22} className="text-ink/70" />
          <Send size={22} className="text-ink/70" />
          <span className="ml-auto text-[11px] font-semibold text-ink/50">{128 + likes[k]} likes</span>
        </div>
      </Phone>
      <div>
        <div className="flex flex-wrap gap-2">
          {POSTS.map((p, i) => (
            <Pill key={p.k} active={k === i} onClick={() => setK(i)}>
              <p.Icon size={12} className="mr-1 inline" />
              {p.k}
            </Pill>
          ))}
        </div>
        <div className="mt-8 rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.06)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-cream/45">
            Campaign length: {reach} week{reach > 1 ? "s" : ""}
          </p>
          <input
            type="range"
            min={1}
            max={8}
            value={reach}
            onChange={(e) => setReach(+e.target.value)}
            aria-label="Campaign length in weeks"
            className="mt-3 w-full accent-[#f33716]"
            style={{ minHeight: 0 }}
          />
          <p className="mt-4 font-display text-4xl font-extrabold text-cream">{people.toLocaleString()}+</p>
          <p className="text-xs text-cream/50">people who could discover you (illustrative)</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Events */
const EVT = [
  { k: "Tasting night", Icon: Sparkles, c1: "#f66a55", seats: 40 },
  { k: "Chef's table", Icon: Store, c1: "#f33716", seats: 12 },
  { k: "Festive menu", Icon: Gift, c1: "#f44125", seats: 80 },
  { k: "Pop-up", Icon: Megaphone, c1: "#e4290c", seats: 120 },
];
const STG = [
  ["Announce", Megaphone],
  ["Book", Ticket],
  ["Event night", CalendarHeart],
  ["Recap", Camera],
];

export function EventsDemo() {
  const [k, setK] = useState(0);
  const [sold, setSold] = useState(0.35);
  const [stage, setStage] = useState(0);
  const E = EVT[k];
  useInterval(() => setStage((s) => (s + 1) % 4), 2600);
  return (
    <Window title="Event Collaboration · Planner">
      <div className="p-5">
        <div className="flex flex-wrap gap-2">
          {EVT.map((e, i) => (
            <Pill key={e.k} active={k === i} onClick={() => { setK(i); setSold(0.35); }}>
              <e.Icon size={12} className="mr-1 inline" />
              {e.k}
            </Pill>
          ))}
        </div>
        <motion.div
          key={k}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 overflow-hidden rounded-2xl text-white"
          style={{ background: `linear-gradient(150deg, ${E.c1}, #f33716)` }}
        >
          <div className="p-5">
            <div className="flex items-center gap-2">
              <BrandMark className="h-5" />
              <span className="text-xs font-bold">Dishky × Your Restaurant</span>
            </div>
            <p className="mt-6 font-display text-2xl font-extrabold">{E.k}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/80">
              <MapPin size={12} /> Your Restaurant · Fri 8 PM
            </p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/25">
              <motion.div className="h-full bg-white" animate={{ width: `${sold * 100}%` }} />
            </div>
            <p className="mt-1.5 flex justify-between text-[11px] text-white/85">
              <span>{Math.round(sold * E.seats)} / {E.seats} seats booked</span>
              <span>{Math.round(sold * 100)}%</span>
            </p>
          </div>
        </motion.div>
        <div className="mt-3 flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => setSold((s) => Math.min(1, s + 0.15))}
            className="rounded-full px-3 py-2 font-semibold text-cream hover:bg-white/20"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <Plus size={12} className="mr-1 inline" />
            Guests book
          </button>
          {sold >= 1 && <span className="dk-pop font-bold text-amber">Sold out!</span>}
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2">
          {STG.map(([n, I], i) => (
            <button key={n} type="button" onClick={() => setStage(i)} className="text-center">
              <span
                className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full transition-all duration-500 ${
                  i <= stage ? "bg-amber text-white" : "text-cream/40"
                } ${i === stage ? "dk-ping" : ""}`}
                style={i > stage ? { background: "rgba(255,255,255,0.1)" } : undefined}
              >
                <I size={16} />
              </span>
              <span className={`mt-1.5 block text-[10px] font-semibold ${i <= stage ? "text-cream" : "text-cream/40"}`}>{n}</span>
            </button>
          ))}
        </div>
      </div>
    </Window>
  );
}

/* ----------------------------------------------------------------- Staff */
const STAFF = [
  ["Aarav", "Chef", "#f33716"],
  ["Meera", "Server", "#f66a55"],
  ["Rohan", "Cashier", "#e4290c"],
  ["Isha", "Server", "#f44125"],
  ["Kabir", "Barista", "#f5533a"],
];
const SHIFTS = ["Off", "Morning", "Evening"];

export function StaffDemo() {
  const [st, setSt] = useState(STAFF.map(() => ({ shift: 1, in: false })));
  const set = (i, p) => setSt((s) => s.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const on = st.filter((x) => x.in).length;
  const circ = 2 * Math.PI * 22;
  return (
    <Window title="Staff · Attendance & shifts">
      <div className="p-5">
        <div className="mb-4 flex items-center gap-4">
          <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
            <circle cx="28" cy="28" r="22" stroke="rgba(255,255,255,.1)" strokeWidth="6" fill="none" />
            <motion.circle
              cx="28" cy="28" r="22" stroke="#f33716" strokeWidth="6" fill="none" strokeLinecap="round"
              strokeDasharray={circ}
              initial={false}
              animate={{ strokeDashoffset: circ * (1 - on / STAFF.length) }}
              transform="rotate(-90 28 28)"
            />
          </svg>
          <div>
            <p className="font-display text-xl font-bold">{on} / {STAFF.length} clocked in</p>
            <p className="text-xs text-cream/50">Tap shift to change · tap clock to check in</p>
          </div>
        </div>
        <ul className="space-y-2">
          {STAFF.map(([n, r, c], i) => (
            <li key={n} className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.05)" }}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: c }}>{n[0]}</span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-sm font-semibold">{n}</span>
                <span className="text-[11px] text-cream/50">{r}</span>
              </span>
              <button type="button" onClick={() => set(i, { shift: (st[i].shift + 1) % 3 })} className="rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.1)" }}>
                {SHIFTS[st[i].shift]}
              </button>
              <button
                type="button"
                onClick={() => set(i, { in: !st[i].in })}
                aria-label={`Clock ${n} in`}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${st[i].in ? "bg-[#e4290c] text-white" : "text-cream/60"}`}
                style={!st[i].in ? { background: "rgba(255,255,255,0.1)" } : undefined}
              >
                {st[i].in ? <Check size={16} /> : <Clock size={16} />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Window>
  );
}

/* --------------------------------------------------------------- Loyalty */
const TIERS = [["Bronze", 0, Star], ["Silver", 200, Gift], ["Gold", 500, Crown]];

export function LoyaltyDemo() {
  const [pts, setPts] = useState(120);
  const [sent, setSent] = useState(false);
  const tier = [...TIERS].reverse().find((t) => pts >= t[1]);
  const box = { background: "rgba(255,255,255,0.05)" };
  return (
    <Window title="Guests · Loyalty & campaigns">
      <div className="grid gap-5 p-5 sm:grid-cols-2">
        <div className="rounded-xl p-4" style={box}>
          <p className="text-xs text-cream/50">Guest points</p>
          <p className="font-display text-4xl font-extrabold"><CountUp to={pts} duration={0.6} key={pts} /></p>
          <div className="mt-4 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
            <motion.div className="h-full rounded-full bg-gradient-to-r from-amber to-[#f77864]" animate={{ width: `${Math.min(100, (pts / 600) * 100)}%` }} />
          </div>
          <div className="mt-3 flex justify-between">
            {TIERS.map(([n, , I]) => (
              <span key={n} className={`flex flex-col items-center text-[10px] ${tier[0] === n ? "text-amber" : "text-cream/40"}`}>
                <I size={16} />
                {n}
              </span>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Pill onClick={() => setPts((p) => Math.min(650, p + 60))}>+ Dine-in order</Pill>
            <Pill onClick={() => setPts(120)}>Reset</Pill>
          </div>
        </div>
        <div className="rounded-xl p-4" style={box}>
          <p className="flex items-center gap-2 text-xs text-cream/50"><MessageSquare size={14} /> WhatsApp campaign</p>
          <div className="mt-3 rounded-lg rounded-tl-none bg-[#242424] p-3 text-xs leading-snug text-[#e6e6e6]">
            Hi! This weekend: free dessert with any main. Show this message at the table.
          </div>
          <button type="button" onClick={() => setSent(true)} className="btn-primary mt-4 w-full !min-h-[40px] !py-2 text-sm">
            {sent ? "Sent" : "Send to 248 guests"}
          </button>
          {sent && (
            <p className="dk-pop mt-2 flex items-center gap-1.5 text-xs text-[#f77a67]">
              <Check size={14} /> Delivered to your guest list
            </p>
          )}
        </div>
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------- Analytics */
const RANGES = {
  Today: [30, 55, 80, 62, 95, 70, 40],
  Week: [60, 72, 55, 88, 100, 92, 70],
  Month: [48, 62, 70, 66, 82, 90, 98],
};
const LABELS = {
  Today: ["9a", "11a", "1p", "3p", "5p", "7p", "9p"],
  Week: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  Month: ["W1", "W2", "W3", "W4", "W5", "W6", "W7"],
};
const MULT = { Today: 1, Week: 7, Month: 30 };

/** Smooth area chart with a hover crosshair, replacing the old bar chart. */
function AreaChart({ values, labels, rev, h, setH }) {
  const W = 600, H = 190, top = 14, bot = 18;
  const xs = values.map((_, i) => 20 + (i * (W - 40)) / (values.length - 1));
  const ys = values.map((v) => top + (1 - v / 110) * (H - top - bot));
  const d = xs.reduce((acc, x, i) => {
    if (i === 0) return `M${x},${ys[i]}`;
    const cx = (xs[i - 1] + x) / 2;
    return `${acc} C${cx},${ys[i - 1]} ${cx},${ys[i]} ${x},${ys[i]}`;
  }, "");
  const idx = h ?? values.length - 1;
  return (
    <div className="mt-6">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" preserveAspectRatio="none" onMouseLeave={() => setH(null)}>
          <defs>
            <linearGradient id="dk-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f33716" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#f33716" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1="0" x2={W} y1={top + g * (H - top - bot)} y2={top + g * (H - top - bot)} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={`${d} L${xs[xs.length - 1]},${H - bot} L${xs[0]},${H - bot} Z`} fill="url(#dk-area)" />
          <path d={d} fill="none" stroke="#ff6a4d" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <line x1={xs[idx]} x2={xs[idx]} y1={top} y2={H - bot} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          {xs.map((x, i) => (
            <rect key={i} x={x - (W - 40) / (values.length - 1) / 2} y="0" width={(W - 40) / (values.length - 1)} height={H} fill="transparent" onMouseEnter={() => setH(i)} />
          ))}
        </svg>
        {/* the point marker is HTML so it stays round when the svg stretches */}
        <span
          className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-amber bg-white shadow-[0_0_12px_#f33716]"
          style={{ left: `${(xs[idx] / W) * 100}%`, top: `${(ys[idx] / H) * 100}%`, transition: "left .25s, top .25s" }}
        />
        <span
          className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded bg-white px-2 py-0.5 text-[10px] font-bold text-ink"
          style={{ left: `${Math.min(88, Math.max(12, (xs[idx] / W) * 100))}%`, top: `calc(${(ys[idx] / H) * 100}% - 30px)`, transition: "left .25s, top .25s" }}
        >
          ₹{Math.round((values[idx] * rev) / 560).toLocaleString()}
        </span>
      </div>
      <div className="mt-1 flex">
        {labels.map((l, i) => (
          <span key={l} className={`flex-1 text-center text-[10px] ${i === idx ? "font-bold text-cream" : "text-cream/40"}`}>{l}</span>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsDemo() {
  const [r, setR] = useState("Week");
  const [h, setH] = useState(null);
  const rev = 38400 * MULT[r];
  return (
    <Window title="Dashboard · Sales">
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-cream/50">Revenue</p>
            <p className="font-display text-3xl font-extrabold">₹<CountUp key={r} to={rev} duration={0.8} /></p>
          </div>
          <div className="flex gap-2">
            {Object.keys(RANGES).map((k) => (
              <Pill key={k} active={r === k} onClick={() => setR(k)}>{k}</Pill>
            ))}
          </div>
        </div>
        <AreaChart values={RANGES[r]} labels={LABELS[r]} rev={rev} h={h} setH={setH} />
        <p className="mt-4 flex items-center gap-2 text-xs text-[#f77a67]">
          <TrendingUp size={14} /> Best seller: Butter Chicken · Peak hour 7 PM
        </p>
      </div>
    </Window>
  );
}

/* --------------------------------------------------------------- Branches */
const BR = [
  ["Indiranagar", "indiranagar", 62, 18],
  ["Koramangala", "koramangala", 48, 14],
  ["Whitefield", "whitefield", 35, 11],
];

export function BranchDemo() {
  const [b, setB] = useState(0);
  const [t, setT] = useState(5);
  const B = BR[b];
  const box = { background: "rgba(255,255,255,0.05)" };
  return (
    <Window title="Venues · All branches">
      <div className="grid gap-5 p-5 sm:grid-cols-[1fr_1.2fr]">
        <ul className="space-y-2">
          {BR.map(([n], i) => (
            <li key={n}>
              <button
                type="button"
                onClick={() => setB(i)}
                className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${b === i ? "bg-amber text-white" : "hover:bg-white/10"}`}
                style={b !== i ? box : undefined}
              >
                <Store size={16} />
                <span className="text-sm font-semibold">{n}</span>
              </button>
            </li>
          ))}
        </ul>
        <div>
          <div className="relative h-32 overflow-hidden rounded-xl" style={box}>
            {BR.map((_, i) => (
              <motion.span
                key={i}
                className={`absolute h-3.5 w-3.5 rounded-full ${b === i ? "bg-amber dk-ping" : "bg-white/30"}`}
                style={{ left: `${18 + i * 30}%`, top: `${25 + ((i * 37) % 50)}%` }}
                animate={{ scale: b === i ? 1.5 : 1 }}
              />
            ))}
            <svg className="absolute inset-0 h-full w-full opacity-30" aria-hidden="true">
              <path d="M30 40 Q 120 90 190 60 T 330 100" stroke="#ffffff" strokeDasharray="4 6" fill="none" className="dk-dash" />
            </svg>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3" style={box}>
              <p className="text-[11px] text-cream/50">Orders today</p>
              <p className="font-display text-2xl font-extrabold"><CountUp key={b} to={B[2]} duration={0.6} /></p>
            </div>
            <div className="rounded-xl p-3" style={box}>
              <p className="text-[11px] text-cream/50">Staff on shift</p>
              <p className="font-display text-2xl font-extrabold"><CountUp key={b + "s"} to={B[3]} duration={0.6} /></p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2 font-display text-[11px] text-cream/70">
            <QrCode size={14} className="shrink-0 text-amber" />
            <span className="min-w-0 truncate">dishky.com/<span className="text-amber">your-restaurant</span>/{B[1]}/table-{t}</span>
            <button type="button" onClick={() => setT((x) => (x % 12) + 1)} className="ml-auto shrink-0 rounded px-2 py-0.5 text-[10px]" style={{ background: "rgba(255,255,255,0.1)", minHeight: 0 }}>
              next table
            </button>
          </div>
        </div>
      </div>
    </Window>
  );
}

/* ----------------------------------------------------------------- Roles */
const ROLES = ["Owner", "Manager", "Chef", "Waiter", "Cashier"];
const MODS = ["Orders", "Menu", "Stock", "Payments", "Staff", "Reports"];
const BASE = {
  Owner: [1, 1, 1, 1, 1, 1],
  Manager: [1, 1, 1, 1, 1, 0],
  Chef: [1, 0, 1, 0, 0, 0],
  Waiter: [1, 0, 0, 0, 0, 0],
  Cashier: [1, 0, 0, 1, 0, 0],
};

export function RolesDemo() {
  const [role, setRole] = useState("Chef");
  const [perm, setPerm] = useState(BASE);
  const flip = (i) => setPerm((p) => ({ ...p, [role]: p[role].map((v, k) => (k === i ? 1 - v : v)) }));
  return (
    <Window title="Roles & permissions">
      <div className="p-5">
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <Pill key={r} active={role === r} onClick={() => setRole(r)}>
              <UserCheck size={12} className="mr-1 inline" />
              {r}
            </Pill>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MODS.map((m, i) => {
            const on = perm[role][i];
            return (
              <motion.button
                key={m}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => flip(i)}
                className={`flex items-center justify-between rounded-xl border p-3 text-left text-sm font-semibold transition-colors duration-300 ${
                  on ? "border-[#e4290c]/50 bg-[#e4290c]/10 text-cream" : "border-white/10 text-cream/40"
                }`}
              >
                {m}
                {on ? <ShieldCheck size={16} className="text-[#e4290c]" /> : <Lock size={16} />}
              </motion.button>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-cream/45">Tap a module to grant or revoke access for {role}.</p>
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------------ Menu */
const MENU = [
  ["Butter Chicken", 420, images.dishCurry, "food-curry"],
  ["Biryani", 380, images.dishBiryani, "food-biryani"],
  ["Pasta Alfredo", 340, images.dishPasta, "food-pasta"],
  ["Tiramisu", 220, images.dishDessert, "food-dessert"],
  ["Mint Lemonade", 90, images.dishDrink, "food-drink"],
];

export function MenuDemo() {
  const [avail, setAvail] = useState(MENU.map(() => true));
  const [combo, setCombo] = useState([]);
  const sum = combo.reduce((a, i) => a + MENU[i][1], 0);
  const off = combo.length >= 3 ? 0.15 : 0;
  return (
    <Window title="Menu · Dishes & combos">
      <div className="p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MENU.map(([n, p, img, art], i) => (
            <div key={n} className={`group overflow-hidden rounded-xl transition-opacity ${avail[i] ? "" : "opacity-40"}`} style={{ background: "rgba(255,255,255,0.05)" }}>
              <Photo src={img} art={art} className="h-20 w-full" zoom />
              <div className="p-2.5">
                <p className="truncate text-xs font-semibold">{n}</p>
                <p className="text-[11px] text-cream/50">₹{p}</p>
                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setAvail((a) => a.map((v, k) => (k === i ? !v : v)))}
                    aria-label={`Toggle ${n} availability`}
                    className={`h-5 w-9 rounded-full p-0.5 transition-colors ${avail[i] ? "bg-[#e4290c]" : "bg-white/20"}`}
                    style={{ minHeight: 0 }}
                  >
                    <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${avail[i] ? "translate-x-4" : ""}`} />
                  </button>
                  <button
                    type="button"
                    disabled={!avail[i]}
                    onClick={() => setCombo((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]))}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${combo.includes(i) ? "bg-amber text-white" : ""}`}
                    style={{ minHeight: 0, ...(combo.includes(i) ? {} : { background: "rgba(255,255,255,0.1)" }) }}
                  >
                    {combo.includes(i) ? "In combo" : "+ Combo"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl p-3 text-sm" style={{ background: "rgba(255,255,255,0.05)" }}>
          <span className="text-cream/60">Combo ({combo.length} items){off ? " · 15% off" : " · add 3 for 15% off"}</span>
          <span className="font-display font-bold">₹{Math.round(sum * (1 - off))}</span>
        </div>
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------- Guest app */
export function GuestAppDemo() {
  const [s, setS] = useState(0);
  const [qty, setQty] = useState(0);
  return (
    <div className="flex flex-col items-center gap-5 md:flex-row md:justify-center md:gap-10">
      <Phone>
        <AnimatePresence mode="wait">
          <motion.div
            key={s}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 pt-8"
          >
            {s === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 bg-ink text-cream">
                <div className="relative">
                  <QrCode size={120} />
                  <motion.span className="absolute inset-x-0 h-0.5 bg-amber" animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 2.4, repeat: Infinity }} />
                </div>
                <p className="text-xs text-cream/60">Table 4</p>
                <button type="button" onClick={() => setS(1)} className="btn-primary !min-h-[40px] !py-2 text-sm">Scan to order</button>
              </div>
            )}
            {s === 1 && (
              <div className="p-3">
                <p className="font-display text-sm font-extrabold">Menu · Table 4</p>
                <div className="mt-3 space-y-2">
                  {MENU.slice(0, 4).map(([n, p, img, art]) => (
                    <div key={n} className="flex items-center gap-3 rounded-xl bg-beige p-2">
                      <Photo src={img} art={art} className="h-12 w-12 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">{n}</p>
                        <p className="text-[11px] text-ink/50">₹{p}</p>
                      </div>
                      <button type="button" onClick={() => setQty((q) => q + 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-amber text-white" aria-label={`Add ${n}`} style={{ minHeight: 0 }}>
                        <Plus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setS(2)} className="absolute bottom-4 left-3 right-3 flex items-center justify-between rounded-full bg-ink px-4 py-3 text-xs font-bold text-white">
                  <span className="flex items-center gap-2"><ShoppingBag size={14} /> {qty} item{qty === 1 ? "" : "s"}</span>
                  View bag
                </button>
              </div>
            )}
            {s === 2 && (
              <div className="flex h-full flex-col p-4">
                <p className="font-display text-sm font-extrabold">Your bag</p>
                <p className="mt-6 text-center text-5xl font-extrabold text-amber">{qty}</p>
                <p className="text-center text-xs text-ink/50">items for Table 4</p>
                <button type="button" onClick={() => setS(3)} className="btn-primary mt-auto !min-h-[44px] w-full text-sm">Place order</button>
              </div>
            )}
            {s === 3 && (
              <div className="p-4">
                <p className="font-display text-sm font-extrabold">Order tracking</p>
                {["Received", "Cooking", "Ready", "Served"].map((t, i) => (
                  <motion.div key={t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.5 }} className="mt-4 flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber text-white"><Check size={14} /></span>
                    <span className="text-sm font-semibold">{t}</span>
                  </motion.div>
                ))}
                <button type="button" onClick={() => { setQty(0); setS(0); }} className="mt-8 text-xs font-semibold text-amber">Start over</button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </Phone>
      <div className="flex gap-2 md:flex-col">
        {["Scan", "Menu", "Bag", "Track"].map((n, i) => (
          <Pill key={n} active={s === i} onClick={() => setS(i)}>{i + 1}. {n}</Pill>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------- Checklist (mise, etc.) */
export function ChecklistDemo({ title = "Checklist", items = [], icon: Icon = ListTodo }) {
  const [done, setDone] = useState([]);
  const pct = items.length ? Math.round((done.length / items.length) * 100) : 0;
  return (
    <Window title={title}>
      <div className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <Icon size={18} className="text-amber" />
          <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
            <motion.div className="h-full bg-amber" animate={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-bold">{pct}%</span>
        </div>
        <ul className="space-y-2">
          {items.map((t, i) => {
            const d = done.includes(i);
            return (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => setDone((x) => (d ? x.filter((y) => y !== i) : [...x, i]))}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm transition-colors hover:bg-white/10"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${d ? "border-amber bg-amber text-white" : "border-white/25"}`}>
                    {d && <Check size={12} />}
                  </span>
                  <span className={d ? "text-cream/40 line-through" : "text-cream/85"}>{t}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {pct === 100 && <p className="dk-pop mt-4 text-sm font-bold text-[#f77a67]">All done. Logged to the activity log.</p>}
      </div>
    </Window>
  );
}

/* -------------------------------------------------------------- Back office */
const DOCS = [
  ["Staff handbook.pdf", FileText],
  ["Supplier invoice.png", FileText],
  ["Opening memo", StickyNote],
  ["Audit: price changed", ScrollText],
];

export function BackOfficeDemo() {
  const [sel, setSel] = useState(0);
  const [tasks, setTasks] = useState(["Call fish supplier", "Approve Friday roster", "Review audit log"]);
  return (
    <Window title="Back office · Memos, documents, to-dos">
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <ul className="space-y-2">
          {DOCS.map(([n, I], i) => (
            <li key={n}>
              <button
                type="button"
                onClick={() => setSel(i)}
                className={`flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm transition-colors ${sel === i ? "bg-amber text-white" : "hover:bg-white/10"}`}
                style={sel !== i ? { background: "rgba(255,255,255,0.05)" } : undefined}
              >
                <I size={16} />
                {n}
              </button>
            </li>
          ))}
        </ul>
        <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.05)" }}>
          <AnimatePresence mode="wait">
            <motion.p key={sel} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-cream/70">
              {DOCS[sel][0]}
              <span className="block pt-1 text-xs text-cream/40">Shared with managers · logged</span>
            </motion.p>
          </AnimatePresence>
          <div className="mt-4 space-y-1.5">
            {tasks.map((t) => (
              <button key={t} type="button" onClick={() => setTasks((x) => x.filter((y) => y !== t))} className="flex w-full items-center gap-2 text-left text-xs text-cream/70 hover:text-cream" style={{ minHeight: 0 }}>
                <ListTodo size={13} className="shrink-0 text-amber" />
                {t}
              </button>
            ))}
            {!tasks.length && <p className="dk-pop text-xs font-bold text-[#f77a67]">Inbox zero.</p>}
          </div>
        </div>
      </div>
    </Window>
  );
}

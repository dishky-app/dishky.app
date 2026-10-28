import React, { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Handshake, BadgePercent, Camera, Clapperboard, Heart, MessageCircle, Send, Bookmark, Eye, CalendarCheck, RotateCcw, Rocket, Check } from "lucide-react";
import { Reveal, CountUp, useTicker, PhoneFrame, Chip } from "../../Kit/Kit.js";
import { images } from "../../../assets/images/imageUrls.js";
import { BrandMark } from "../../Brand/Brand.js";

const FORMATS = [
  { id: "spot", label: "Spotlight", Icon: Sparkles, from: "#f77864", to: "#f33716", line: "Come for the dish. Stay for the room." },
  { id: "collab", label: "Collab", Icon: Handshake, from: "#f66a55", to: "#f33716", line: "Made together. Served at your table." },
  { id: "boost", label: "Offer boost", Icon: BadgePercent, from: "#f6644d", to: "#ff6a4d", line: "Limited time. This week only." },
  { id: "creator", label: "Creator visit", Icon: Camera, from: "#e4290c", to: "#f66a55", line: "A food creator stopped by. Taste why." },
  { id: "reel", label: "Reel", Icon: Clapperboard, from: "#f66b56", to: "#f55d46", line: "30 seconds. One unforgettable plate." },
];
const DISHES = [
  { id: "biryani", label: "Biryani", src: images.dishBiryani },
  { id: "curry", label: "Curry", src: images.dishCurry },
  { id: "pasta", label: "Pasta", src: images.dishPasta },
  { id: "dessert", label: "Dessert", src: images.dishDessert },
  { id: "drink", label: "Drink", src: images.dishDrink },
];
const OFFERS = [
  { id: "none", label: "None", sticker: null },
  { id: "20", label: "20% off", sticker: "20% OFF" },
  { id: "dessert", label: "Free dessert", sticker: "FREE DESSERT" },
  { id: "2for1", label: "2-for-1", sticker: "2 FOR 1" },
];
const ZERO = { views: 0, likes: 0, saves: 0, bookings: 0 };

function Spark({ data }) {
  const w = 200, h = 44;
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * w, h - 4 - (v / max) * (h - 8)]);
  const d = pts.length > 1 ? pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") : "";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" role="img" aria-label="Reach over time">
      <defs>
        <linearGradient id="pd-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f33716" stopOpacity=".3" /><stop offset="1" stopColor="#f33716" stopOpacity="0" /></linearGradient>
      </defs>
      {d && <path d={`${d} L${w} ${h} L0 ${h} Z`} fill="url(#pd-fill)" />}
      {d && <motion.path d={d} fill="none" stroke="#f33716" strokeWidth="2.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />}
    </svg>
  );
}

function Post({ fmt, dish, offer, live }) {
  const { Icon } = fmt;
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-md">
      <header className="flex items-center gap-2 px-2.5 py-2">
        <BrandMark className="h-5" />
        <p className="flex-1 truncate font-display text-[11px] font-bold text-ink">dishky <span className="font-medium text-ink/45">· {fmt.label}</span></p>
        {live && <Chip tone="brand">Live</Chip>}
      </header>
      <div className="relative aspect-square overflow-hidden" style={{ background: `linear-gradient(150deg, ${fmt.from}, ${fmt.to})` }}>
        <AnimatePresence mode="wait">
          <motion.img key={dish.id} src={dish.src} alt={dish.label} draggable="false" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 0.88, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
            className="absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] rounded-2xl object-cover mix-blend-luminosity" style={{ mixBlendMode: "normal" }} />
        </AnimatePresence>
        <span className="absolute left-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/30 text-white backdrop-blur"><Icon size={14} /></span>
        <AnimatePresence>
          {offer.sticker && (
            <motion.span key={offer.id} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: -8 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 320, damping: 16 }}
              className="absolute right-3 top-3 rounded-full bg-white px-2.5 py-1.5 font-display text-[10px] font-extrabold text-amber shadow-lg">{offer.sticker}</motion.span>
          )}
        </AnimatePresence>
        <p className="absolute inset-x-4 bottom-3 font-display text-[12px] font-extrabold leading-tight text-white drop-shadow">{fmt.line}</p>
      </div>
      <footer className="flex items-center gap-3 px-2.5 py-2 text-ink/70"><Heart size={15} /><MessageCircle size={15} /><Send size={15} /><Bookmark size={15} className="ml-auto" /></footer>
    </article>
  );
}

export default function PromotionsDemo({ dark = false }) {
  const [fmtId, setFmt] = useState("spot");
  const [dishId, setDish] = useState("biryani");
  const [offerId, setOffer] = useState("20");
  const [phase, setPhase] = useState("compose");
  const [m, setM] = useState(ZERO);
  const [series, setSeries] = useState([]);
  const [hearts, setHearts] = useState([]);

  const fmt = FORMATS.find((f) => f.id === fmtId);
  const dish = DISHES.find((d) => d.id === dishId);
  const offer = OFFERS.find((o) => o.id === offerId);
  const boost = (offerId !== "none" ? 1.4 : 1) * (fmtId === "reel" ? 1.5 : 1);

  const publish = () => {
    setM(ZERO); setSeries([]); setPhase("sending");
    setTimeout(() => setPhase("live"), 1100);
  };
  const reset = () => { setPhase("compose"); setM(ZERO); setSeries([]); setHearts([]); };

  const tick = useCallback(() => {
    const dv = Math.round((90 + Math.random() * 90) * boost);
    setM((p) => ({ views: p.views + dv, likes: p.likes + Math.round(dv * 0.11), saves: p.saves + Math.round(dv * 0.03), bookings: p.bookings + (Math.random() < 0.45 * boost ? 1 : 0) }));
    setSeries((s) => [...s.slice(-14), dv]);
    setHearts((h) => [...h.slice(-5), { id: Date.now() + Math.random(), x: 10 + Math.random() * 60 }]);
  }, [boost]);
  useTicker(tick, 900, phase === "live");

  const card = dark ? "bg-white/5 border-white/10 text-white" : "bg-white border-ink/10 text-ink";
  const sub = dark ? "text-white/55" : "text-ink/50";
  const locked = phase !== "compose";
  const stats = [
    { k: "views", Icon: Eye, label: "Views" }, { k: "likes", Icon: Heart, label: "Likes" },
    { k: "saves", Icon: Bookmark, label: "Saves" }, { k: "bookings", Icon: CalendarCheck, label: "Bookings" },
  ];

  return (
    <Reveal className="w-full">
      <div className="mx-auto grid w-full max-w-[980px] gap-5 md:grid-cols-[1.1fr_0.9fr]">
        <div className="min-w-0 space-y-4">
          <section className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${card}`}>
            <p className={`mb-2 text-[11px] font-bold uppercase tracking-wider ${sub}`}>Format</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {FORMATS.map((f) => (
                <button key={f.id} type="button" disabled={locked} aria-label={`Format: ${f.label}`} aria-pressed={f.id === fmtId} onClick={() => setFmt(f.id)}
                  className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 text-[11px] font-semibold transition ${f.id === fmtId ? "border-amber bg-amber text-white shadow-lg" : dark ? "border-white/10 hover:bg-white/10" : "border-ink/10 hover:bg-beige"} disabled:opacity-60`}>
                  <f.Icon size={18} /><span className="text-center leading-tight">{f.label}</span>
                </button>
              ))}
            </div>
            <p className={`mb-2 mt-4 text-[11px] font-bold uppercase tracking-wider ${sub}`}>Dish</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {DISHES.map((d) => (
                <button key={d.id} type="button" disabled={locked} aria-label={`Dish: ${d.label}`} aria-pressed={d.id === dishId} onClick={() => setDish(d.id)}
                  className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-2 transition ${d.id === dishId ? "ring-amber" : "ring-transparent opacity-70"} disabled:opacity-50`}>
                  <img src={d.src} alt="" className="h-full w-full object-cover" draggable="false" />
                  {d.id === dishId && <span className="absolute right-0.5 top-0.5 rounded-full bg-amber p-0.5 text-white"><Check size={10} /></span>}
                </button>
              ))}
            </div>
            <p className={`mb-2 mt-4 text-[11px] font-bold uppercase tracking-wider ${sub}`}>Offer</p>
            <div className="flex flex-wrap gap-2">
              {OFFERS.map((o) => (
                <button key={o.id} type="button" disabled={locked} aria-label={`Offer: ${o.label}`} aria-pressed={o.id === offerId} onClick={() => setOffer(o.id)}
                  className={`min-h-[40px] rounded-full border px-4 text-[12px] font-semibold transition ${o.id === offerId ? "border-ink bg-ink text-white" : dark ? "border-white/15" : "border-ink/15 hover:bg-beige"} disabled:opacity-60`}>{o.label}</button>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" aria-label="Publish campaign" disabled={locked} onClick={publish}
                className="kit-sheen flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-amber font-display text-sm font-bold text-white shadow-lg transition hover:bg-amberLight disabled:opacity-60">
                <Rocket size={16} />{phase === "sending" ? "Publishing…" : phase === "live" ? "Live" : "Publish"}
              </button>
              <button type="button" aria-label="Reset demo" onClick={reset} className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${dark ? "border-white/15" : "border-ink/15"}`}><RotateCcw size={16} /></button>
            </div>
          </section>

          <section className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${card}`}>
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-bold">Reach</p>
              <Chip tone={phase === "live" ? "ok" : "mute"}>{phase === "live" ? "Climbing" : "Idle"}</Chip>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stats.map(({ k, Icon, label }) => (
                <div key={k} className={`rounded-2xl p-3 ${dark ? "bg-white/5" : "bg-beige"}`}>
                  <Icon size={14} className="text-amber" />
                  <p className="mt-1 font-display text-lg font-extrabold leading-none"><CountUp to={m[k]} duration={0.8} /></p>
                  <p className={`mt-1 text-[10px] ${sub}`}>{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3"><Spark data={series} /></div>
          </section>
        </div>

        <div className="flex min-w-0 items-center justify-center">
          <PhoneFrame>
            <div className="relative flex h-full flex-col gap-2 overflow-hidden bg-[#f6f6f6] px-2 pb-2 pt-9">
              <div className="flex items-center justify-between px-1"><BrandMark className="h-5" /><span className="font-display text-[11px] font-bold">Feed</span></div>
              <motion.div key={phase === "compose" ? "c" : "p"} initial={phase === "sending" ? { y: 160, opacity: 0 } : false} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 140, damping: 18 }} className="relative">
                <Post fmt={fmt} dish={dish} offer={offer} live={phase === "live"} />
                {phase === "live" && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 overflow-hidden" aria-hidden="true">
                    <AnimatePresence>
                      {hearts.map((h) => (
                        <motion.span key={h.id} className="absolute bottom-2 text-amber" style={{ left: `${h.x + 20}%` }} initial={{ y: 0, opacity: 1, scale: 0.6 }} animate={{ y: -130, opacity: 0, scale: 1.2 }} transition={{ duration: 1.8 }}>
                          <Heart size={16} fill="currentColor" />
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
              <div className="rounded-2xl bg-white/70 p-2 opacity-60">
                <div className="h-2 w-1/3 rounded bg-ink/10" /><div className="mt-2 h-10 rounded-lg bg-ink/5" />
              </div>
            </div>
          </PhoneFrame>
        </div>
      </div>
    </Reveal>
  );
}

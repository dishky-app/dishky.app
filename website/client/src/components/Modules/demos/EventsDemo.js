import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Music, ChefHat, Salad, Drama, Trophy, PartyPopper, Lightbulb, Megaphone, Armchair, Moon, BarChart3, ChevronLeft, ChevronRight, Rocket, Instagram, Facebook, Twitter, Youtube, MessageCircle, Check, Receipt } from "lucide-react";
import { Reveal, Tilt, CountUp, useTicker, PhoneFrame, Chip } from "../../Kit/Kit.js";
import { images } from "../../../assets/images/imageUrls.js";

const TYPES = [
  { id: "music", label: "Live music", Icon: Music, from: "#f66a55", to: "#f33716", title: "Jazz at Saffron" },
  { id: "chef", label: "Chef's table", Icon: ChefHat, from: "#1a1a1a", to: "#f33716", title: "Chef Nira's Table" },
  { id: "fest", label: "Food festival", Icon: Salad, from: "#e4290c", to: "#f6644d", title: "Street Food Fest" },
  { id: "theme", label: "Theme night", Icon: Drama, from: "#f66b56", to: "#f55d46", title: "Retro Disco Night" },
  { id: "match", label: "Match night", Icon: Trophy, from: "#e4290c", to: "#2a2a2a", title: "Final Match Night" },
  { id: "party", label: "Celebration", Icon: PartyPopper, from: "#f6644d", to: "#ff6a4d", title: "Anniversary Gala" },
];
const STEPS = [
  { id: "idea", label: "Idea", Icon: Lightbulb },
  { id: "announce", label: "Announce", Icon: Megaphone },
  { id: "book", label: "Book", Icon: Armchair },
  { id: "night", label: "Event night", Icon: Moon },
  { id: "recap", label: "Recap", Icon: BarChart3 },
];
const DAYS = [["Fri", 12], ["Sat", 13], ["Sun", 14], ["Fri", 19], ["Sat", 20], ["Sun", 21]];
const SOCIAL = [Instagram, Facebook, Twitter, Youtube, MessageCircle];
const MENU = [["Smoked wings", 320], ["Truffle fries", 240], ["Paneer tikka", 280], ["Mango fizz", 160]];
const TOTAL = 16;

const pad = (n) => String(n).padStart(2, "0");

export default function EventsDemo({ dark = false }) {
  const [step, setStep] = useState(0);
  const [typeId, setType] = useState("music");
  const [day, setDay] = useState(1);
  const [launched, setLaunched] = useState(false);
  const [ripple, setRipple] = useState(0);
  const [taken, setTaken] = useState(3);
  const [tickets, setTickets] = useState([]);
  const [secs, setSecs] = useState(5 * 86400 + 4 * 3600 + 20 * 60);

  const type = TYPES.find((t) => t.id === typeId);
  const bg = `linear-gradient(150deg, ${type.from}, ${type.to})`;
  const card = dark ? "bg-white/5 border-white/10 text-white" : "bg-white border-ink/10 text-ink";
  const sub = dark ? "text-white/55" : "text-ink/50";
  const id = STEPS[step].id;

  useTicker(useCallback(() => setSecs((s) => s - 1), []), 1000, id === "announce");
  useTicker(useCallback(() => setTaken((t) => Math.min(TOTAL, t + (Math.random() < 0.7 ? 1 : 0))), 700), 700, id === "book" && launched);
  useTicker(useCallback(() => setTickets((t) => [{ k: Date.now(), n: 100 + t.length * 3 + 12, item: MENU[Math.floor(Math.random() * MENU.length)][0], table: 1 + Math.floor(Math.random() * TOTAL) }, ...t].slice(0, 4)), []), 1500, id === "night");
  useEffect(() => { if (id !== "night") setTickets([]); }, [id]);

  const launch = () => { setLaunched(true); setRipple((r) => r + 1); };
  const go = (n) => setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
  const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), mi = Math.floor((secs % 3600) / 60), s = secs % 60;
  const revenue = 38000 + taken * 1850;

  const Poster = ({ small = false }) => (
    <div className={`relative flex ${small ? "aspect-[4/3]" : "aspect-[3/4] sm:aspect-[4/4.2]"} w-full flex-col justify-between overflow-hidden rounded-3xl p-4 text-white shadow-xl`} style={{ background: bg }}>
      <img src={images.restaurantInterior2} alt="" draggable="false" className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-overlay" />
      <motion.span key={typeId} initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/25 backdrop-blur"><type.Icon size={22} /></motion.span>
      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">{DAYS[day][0]} · {DAYS[day][1]} Nov · 8 PM</p>
        <p className="font-display text-2xl font-extrabold leading-tight">{type.title}</p>
        {!small && (
          <div className="mt-3 flex gap-2">
            {[["d", d], ["h", h], ["m", mi], ["s", s]].map(([k, v]) => (
              <div key={k} className="min-w-[44px] rounded-xl bg-black/30 px-2 py-1.5 text-center backdrop-blur">
                <p className="font-display text-lg font-extrabold leading-none tabular-nums">{pad(v)}</p><p className="text-[9px] uppercase text-white/70">{k}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Reveal className="w-full">
      <div className="mx-auto w-full max-w-[980px]">
        <nav aria-label="Event steps" className="relative mb-5">
          <div className={`absolute left-[10%] right-[10%] top-5 h-1 rounded-full ${dark ? "bg-white/10" : "bg-ink/10"}`}>
            <motion.div className="h-full rounded-full bg-amber" animate={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
          </div>
          <ol className="relative grid grid-cols-5">
            {STEPS.map((st, i) => (
              <li key={st.id} className="flex justify-center">
                <button type="button" aria-label={`Step ${i + 1}: ${st.label}`} aria-current={i === step ? "step" : undefined} onClick={() => go(i)} className="flex min-h-[44px] flex-col items-center gap-1">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${i <= step ? "border-amber bg-amber text-white" : dark ? "border-white/20 bg-[#121212] text-white/60" : "border-ink/15 bg-white text-ink/50"} ${i === step ? "kit-pulse" : ""}`}>
                    {i < step ? <Check size={16} /> : <st.Icon size={16} />}
                  </span>
                  <span className={`text-[10px] font-semibold sm:text-xs ${i === step ? "" : sub}`}>{st.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className={`min-h-[420px] overflow-hidden rounded-3xl border p-4 shadow-sm sm:p-6 ${card}`}>
          <AnimatePresence mode="wait">
            <motion.div key={id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
              {id === "idea" && (
                <div className="grid gap-5 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="min-w-0">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {TYPES.map((t) => (
                        <button key={t.id} type="button" aria-label={`Event type: ${t.label}`} aria-pressed={t.id === typeId} onClick={() => setType(t.id)}
                          className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-semibold transition ${t.id === typeId ? "border-amber bg-amber text-white shadow-lg" : dark ? "border-white/10 hover:bg-white/10" : "border-ink/10 hover:bg-beige"}`}>
                          <t.Icon size={22} />{t.label}
                        </button>
                      ))}
                    </div>
                    <p className={`mb-2 mt-5 text-[11px] font-bold uppercase tracking-wider ${sub}`}>Date</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {DAYS.map(([w, n], i) => (
                        <button key={i} type="button" aria-label={`Pick ${w} ${n} November`} aria-pressed={i === day} onClick={() => setDay(i)}
                          className={`flex h-16 min-w-[56px] flex-col items-center justify-center rounded-2xl border text-xs font-semibold transition ${i === day ? "border-ink bg-ink text-white" : dark ? "border-white/10" : "border-ink/10 hover:bg-beige"}`}>
                          <span className="opacity-60">{w}</span><span className="font-display text-lg font-extrabold">{n}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mx-auto w-full max-w-[300px]">{Poster({ small: true })}</div>
                </div>
              )}

              {id === "announce" && (
                <div className="grid items-center gap-5 md:grid-cols-2">
                  <div className="mx-auto w-full max-w-[340px]"><Tilt>{Poster({})}</Tilt></div>
                  <div className="flex flex-col items-center gap-5 text-center">
                    <div className="relative flex h-44 w-full items-center justify-center">
                      <AnimatePresence>
                        {launched && [0, 1, 2].map((r) => (
                          <motion.span key={`${ripple}-${r}`} className="absolute h-20 w-20 rounded-full border-2 border-amber" initial={{ scale: 0.4, opacity: 0.8 }} animate={{ scale: 3.2, opacity: 0 }} transition={{ duration: 2, delay: r * 0.5, repeat: 1 }} />
                        ))}
                      </AnimatePresence>
                      <span className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-amber text-white shadow-lg"><Megaphone size={26} /></span>
                      {SOCIAL.map((Ic, i) => {
                        const a = (i / SOCIAL.length) * Math.PI * 2 - Math.PI / 2;
                        return (
                          <motion.span key={i} className={`absolute flex h-10 w-10 items-center justify-center rounded-full shadow-md ${dark ? "bg-white/10" : "bg-white"} text-amber`} initial={{ x: 0, y: 0, opacity: 0 }}
                            animate={launched ? { x: Math.cos(a) * 82, y: Math.sin(a) * 66, opacity: 1 } : { x: 0, y: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 140, damping: 14, delay: 0.15 * i }}>
                            <Ic size={18} />
                          </motion.span>
                        );
                      })}
                    </div>
                    <button type="button" aria-label="Launch on Dishky" onClick={launch} className="kit-sheen flex min-h-[48px] items-center gap-2 rounded-2xl bg-amber px-6 font-display text-sm font-bold text-white shadow-lg hover:bg-amberLight">
                      <Rocket size={16} />{launched ? "Launched" : "Launch on Dishky"}
                    </button>
                    {launched && <Chip tone="ok">Live on 5 channels</Chip>}
                  </div>
                </div>
              )}

              {id === "book" && (
                <div className="grid gap-5 md:grid-cols-[1.3fr_0.7fr]">
                  <div>
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: TOTAL }, (_, i) => (
                        <motion.div key={i} animate={{ scale: i < taken ? [1, 1.12, 1] : 1 }} className={`flex h-14 items-center justify-center rounded-xl text-xs font-bold transition-colors ${i < taken ? "bg-amber text-white" : dark ? "bg-white/10 text-white/60" : "bg-beige text-ink/50"}`}>
                          T{i + 1}
                        </motion.div>
                      ))}
                    </div>
                    {!launched && <p className={`mt-3 text-xs ${sub}`}>Launch first to open bookings.</p>}
                  </div>
                  <div className={`flex flex-col justify-center rounded-2xl p-5 text-center ${dark ? "bg-white/5" : "bg-beige"}`}>
                    <p className={`text-xs ${sub}`}>Tables left</p>
                    <p className="font-display text-6xl font-extrabold text-amber"><CountUp to={TOTAL - taken} duration={0.6} /></p>
                    <div className={`mx-auto mt-3 h-2 w-full max-w-[200px] overflow-hidden rounded-full ${dark ? "bg-white/10" : "bg-ink/10"}`}>
                      <motion.div className="h-full bg-amber" animate={{ width: `${(taken / TOTAL) * 100}%` }} />
                    </div>
                    {taken >= TOTAL && <div className="mt-3"><Chip tone="ok">Sold out</Chip></div>}
                  </div>
                </div>
              )}

              {id === "night" && (
                <div className="grid items-center gap-5 md:grid-cols-2">
                  <PhoneFrame>
                    <div className="flex h-full flex-col bg-[#f6f6f6] px-3 pb-3 pt-10">
                      <div className="rounded-2xl p-3 text-white" style={{ background: bg }}><p className="font-display text-sm font-extrabold">{type.title}</p><p className="text-[10px] text-white/80">Tonight's menu</p></div>
                      <ul className="mt-2 space-y-1.5">
                        {MENU.map(([n, p]) => (
                          <li key={n} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-[11px] font-semibold"><span>{n}</span><span className="text-amber">₹{p}</span></li>
                        ))}
                      </ul>
                    </div>
                  </PhoneFrame>
                  <div className="space-y-2" aria-live="polite">
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${sub}`}>Kitchen tickets</p>
                    <AnimatePresence initial={false}>
                      {tickets.map((t) => (
                        <motion.div key={t.k} layout initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className={`flex items-center gap-3 rounded-2xl border p-3 ${dark ? "border-white/10 bg-white/5" : "border-ink/10 bg-beige"}`}>
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber text-white"><Receipt size={16} /></span>
                          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">#{t.n} · {t.item}</p><p className={`text-xs ${sub}`}>Table {t.table}</p></div>
                          <Chip tone="warn">New</Chip>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {id === "recap" && (
                <div className="grid items-center gap-5 md:grid-cols-[1.2fr_0.8fr]">
                  <Tilt max={6} className="relative mx-auto h-[300px] w-full max-w-[460px]">
                    {[[images.restaurantTable, "left-0 top-4 w-[55%] -rotate-6"], [images.chefPlating, "right-0 top-0 w-[50%] rotate-3"], [images.kitchenAction, "left-[22%] bottom-0 w-[55%] rotate-2"]].map(([src, cls], i) => (
                      <motion.img key={i} src={src} alt="" draggable="false" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }} className={`absolute aspect-[4/3] rounded-2xl border-4 border-white object-cover shadow-xl ${cls}`} />
                    ))}
                  </Tilt>
                  <div className="grid grid-cols-2 gap-2">
                    {[["Guests", taken * 4, ""], ["Orders", taken * 9, ""], ["Revenue", revenue, "₹"], ["Rating", 4.8, ""]].map(([l, v, p]) => (
                      <div key={l} className={`rounded-2xl p-4 ${dark ? "bg-white/5" : "bg-beige"}`}>
                        <p className="font-display text-2xl font-extrabold text-amber"><CountUp to={v} prefix={p} decimals={l === "Rating" ? 1 : 0} /></p>
                        <p className={`text-xs ${sub}`}>{l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" aria-label="Back" disabled={step === 0} onClick={() => go(step - 1)} className={`flex min-h-[44px] items-center gap-1 rounded-2xl border px-5 text-sm font-semibold disabled:opacity-40 ${dark ? "border-white/15 text-white" : "border-ink/15"}`}><ChevronLeft size={16} />Back</button>
          <button type="button" aria-label={step === STEPS.length - 1 ? "Restart" : "Next"} onClick={() => (step === STEPS.length - 1 ? (setStep(0), setLaunched(false), setTaken(3), setSecs(5 * 86400 + 4 * 3600 + 20 * 60)) : go(step + 1))}
            className="flex min-h-[44px] items-center gap-1 rounded-2xl bg-amber px-5 text-sm font-bold text-white shadow-lg hover:bg-amberLight">{step === STEPS.length - 1 ? "Restart" : "Next"}<ChevronRight size={16} /></button>
        </div>
      </div>
    </Reveal>
  );
}

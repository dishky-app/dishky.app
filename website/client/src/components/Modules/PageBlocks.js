import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { Check, X } from "lucide-react";
import { Demo } from "../demos/index.js";
import { CountUp, Photo, Reveal, useInterval } from "../ui/kit.js";
import Title from "./ModuleTitle.js";
import ModuleGallery from "./ModuleGallery.js";
import { UseCases, GettingStarted, ModuleFaq } from "./ModuleMore.js";
import { journeyScenes } from "./ModuleBlocks.js";
import { moduleExtras } from "../../data/moduleExtras.js";
import { RED } from "./PageHeroes.js";

const EASE = [0.22, 1, 0.36, 1];
const seedOf = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
const isDark = (tone) => tone === "dark" || tone === "color";
const TONE = { light: "bg-cream text-ink", white: "bg-white text-ink", beige: "bg-beige text-ink", dark: "bg-ink text-cream" };

/** One page section. `color` paints it in the module's own colour. */
function Sec({ tone, m, children, flush, embed }) {
  const col = tone === "color";
  if (embed) return <div className="p-5 md:p-8">{children}</div>;
  return (
    <section data-nav-theme={isDark(tone) ? "dark" : undefined} className={`relative ${col ? "" : TONE[tone]}`} style={{ paddingBlock: flush ? 0 : "var(--section-space-tight)", ...(col ? { background: "#0a0a0a", color: "#ffffff" } : {}) }}>
      {flush ? children : <div className="container-dishky">{children}</div>}
    </section>
  );
}
const H = ({ tone, ...p }) => <Title dark={isDark(tone)} inherit={tone === "color"} {...p} />;
const card = (tone) => "sk-card " + (tone === "color" ? "bg-white/20 border-white/25" : tone === "dark" ? "bg-white/[0.06] border-white/10" : "bg-white border-ink/10");
const muted = (tone) => (isDark(tone) ? "opacity-70" : "text-ink/60");

/** A number that glides to its new value. */
function Num({ value, prefix = "", className = "" }) {
  const mv = useMotionValue(value);
  const sp = useSpring(mv, { stiffness: 90, damping: 20 });
  const txt = useTransform(sp, (v) => prefix + Math.round(v).toLocaleString("en-IN"));
  useEffect(() => { mv.set(value); }, [value, mv]);
  return <motion.span className={className}>{txt}</motion.span>;
}

/* ------------------------------------------------------------- RAIL */
/** Scroll down and the journey slides sideways. */
function Rail({ m, tone, embed }) {
  const steps = m.journey || [];
  const outer = useRef(null);
  const track = useRef(null);
  const [max, setMax] = useState(0);
  const { scrollYProgress } = useScroll({ target: outer, offset: ["start start", "end end"] });
  useLayoutEffect(() => {
    const measure = () => track.current && setMax(Math.max(0, track.current.scrollWidth - track.current.parentElement.clientWidth));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [steps.length]);
  const x = useTransform(scrollYProgress, [0.05, 0.95], [0, -max]);
  const fg = "#ffffff";
  const scenes = journeyScenes(m.slug);
  return (
    <section ref={outer} data-nav-theme={isDark(tone) ? "dark" : undefined} className={tone === "color" ? "" : TONE[tone]} style={{ height: `${Math.max(180, 120 + steps.length * 38)}vh`, ...(tone === "color" ? { background: "#0a0a0a", color: fg } : {}) }}>
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden" style={{ paddingTop: "var(--header-clearance)" }}>
        <div className="container-dishky"><H tone={tone} left  >A story, one screen at a time.</H></div>
        <div className="container-dishky relative">
          <motion.ul ref={track} style={{ x }} className="flex w-max gap-4 pr-6 md:gap-6">
            {steps.map((s, i) => (
              <li key={s.title} className="sk-card relative aspect-[3/4] w-[62vw] max-w-[300px] shrink-0 overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl">
                <Photo src={s.photo} art={scenes[i % scenes.length]} className="absolute inset-0 contrast-125" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <span className="absolute left-4 top-3 font-display text-6xl font-extrabold text-white/30">{String(i + 1).padStart(2, "0")}</span>
                <div className="absolute inset-x-0 bottom-0 p-4 text-cream">
                  <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "#0a0a0a", color: fg }}><s.icon size={18} /></span>
                  <p className="font-display text-lg font-bold">{s.title}</p>
                </div>
              </li>
            ))}
          </motion.ul>
          <div className="mt-8 h-1 w-full rounded-full bg-current opacity-15"><motion.div className="h-full origin-left rounded-full opacity-100" style={{ background: RED, scaleX: scrollYProgress }} /></div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- FLOW */
/** A signal travelling along the journey's route. */
function Flow({ m, tone, embed }) {
  const steps = m.journey || [];
  const n = steps.length;
  const pts = steps.map((_, i) => [n === 1 ? 50 : 9 + i * (82 / (n - 1)), i % 2 ? 72 : 28]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  const dark = isDark(tone);
  return (
    <Sec tone={tone} m={m} embed={embed}>
      <H tone={tone}  eyebrow="Pipeline">From first signal to done.</H>
      <div className="relative mx-auto h-[330px] max-w-5xl md:h-[400px]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path d={d} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <motion.path d={d} fill="none" stroke={dark && tone === "color" ? "#ffffff" : RED} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 2.2, ease: "easeInOut" }} />
        </svg>
        <motion.span aria-hidden="true" className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_6px_rgba(243,55,22,0.25),0_0_24px_currentColor]" style={{ color: RED }} animate={{ left: [...pts.map((p) => `${p[0]}%`), `${pts[0][0]}%`], top: [...pts.map((p) => `${p[1]}%`), `${pts[0][1]}%`] }} transition={{ duration: Math.max(4, n * 2), repeat: Infinity, ease: "linear" }} />
        {steps.map((s, i) => (
          <motion.div key={s.title} initial={{ opacity: 0, scale: 0.5 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.3, type: "spring" }} className="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center md:w-32" style={{ left: `${pts[i][0]}%`, top: `${pts[i][1]}%` }}>
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-xl md:h-16 md:w-16" style={{ background: RED }}><s.icon size={24} /></span>
            <p className="mt-2 font-display text-xs font-bold leading-tight md:text-sm">{s.title}</p>
          </motion.div>
        ))}
      </div>
    </Sec>
  );
}

/* ------------------------------------------------------------- TICKETS */
/** Tickets move across a three-column board on their own. */
function Tickets({ m, tone, embed }) {
  const names = [...(m.journey || []).map((j) => j.title), ...(m.features || []).map((f) => f.title)].slice(0, 6);
  const [t, setT] = useState(0);
  useInterval(() => setT((v) => v + 1), 1200);
  const cycle = names.length * 2 + 6;
  const tt = t % cycle;
  const stageOf = (i) => { const s = tt - i * 2; return s < 0 ? -1 : Math.min(2, Math.floor(s / 2)); };
  const dark = isDark(tone);
  return (
    <Sec tone={tone} m={m} embed={embed}>
      <H tone={tone}  eyebrow="On the line">Tickets from a real shift.</H>
      <div className="grid gap-3 md:grid-cols-3 md:gap-5">
        {[(m.journey || [])[0], (m.journey || [])[1], (m.journey || [])[(m.journey || []).length - 1]].map((j, ci) => { const c = j ? j.title : ""; return (
          <div key={c} className={`min-h-[260px] rounded-3xl border p-4 ${card(tone)}`}>
            <p className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-widest opacity-70">{c}<span className="h-2 w-2 rounded-full" style={{ background: ci === 1 ? RED : "currentColor", opacity: ci === 1 ? 1 : 0.4 }} /></p>
            <div className="space-y-2.5">
              {names.map((n, i) => stageOf(i) === ci && (
                <motion.div key={n} layout layoutId={`${m.slug}-tk-${i}`} transition={{ type: "spring", stiffness: 260, damping: 26 }} className={`sk-card relative overflow-hidden rounded-2xl border px-4 py-3 ${dark ? "border-white/15 bg-white/10" : "border-ink/10 bg-beige"}`}>
                  <p className="text-[10px] font-bold opacity-50">#{210 + i}</p>
                  <p className="font-display text-sm font-bold">{n}</p>
                  {ci === 1 && <motion.span className="absolute inset-x-0 bottom-0 h-1 origin-left" style={{ background: RED }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 2.4, ease: "linear" }} />}
                  {ci === 2 && <Check size={16} className="absolute right-3 top-3" style={{ color: RED }} />}
                </motion.div>
              ))}
            </div>
          </div>
        ); })}
      </div>
    </Sec>
  );
}

/* ------------------------------------------------------------- CALENDAR */
function Calendar({ m, tone, embed }) {
  const fs = m.features || [];
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const ev = fs.map((f, i) => ({ day: 3 + ((i * 6 + (seedOf(m.slug) % 3)) % 26), f }));
  const [k, setK] = useState(0);
  useInterval(() => setK((v) => v + 1), 2600);
  const cur = ev[k % Math.max(ev.length, 1)];
  const dark = isDark(tone);
  return (
    <Sec tone={tone} m={m} embed={embed}>
      <H tone={tone}  eyebrow="Save the date">Mark the days that matter.</H>
      <div className="mx-auto grid max-w-5xl items-center gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className={`rounded-3xl border p-4 md:p-6 ${card(tone)}`}>
          <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-widest opacity-50">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="grid grid-cols-7 gap-1.5 md:gap-2">
            {days.map((d, i) => {
              const e = ev.find((x) => x.day === d);
              const on = cur && cur.day === d;
              return (
                <motion.div key={d} initial={{ opacity: 0, scale: 0.6 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.015 }} animate={on ? { scale: 1.18 } : { scale: 1 }} className={`relative flex aspect-square items-center justify-center rounded-xl text-xs font-bold md:text-sm ${on ? "text-white shadow-lg" : dark ? "bg-white/10" : "bg-ink/[0.05]"}`} style={on ? { background: RED, zIndex: 2 } : undefined}>
                  {e && !on ? <e.f.icon size={15} style={{ color: tone === "color" ? "#ffffff" : RED }} /> : d}
                </motion.div>
              );
            })}
          </div>
        </div>
        <div className="min-h-[170px]">
          <AnimatePresence mode="wait">
            {cur && (
              <motion.div key={cur.f.title} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45, ease: EASE }} className={`rounded-3xl border p-6 ${card(tone)}`}>
                <p className="font-display text-5xl font-extrabold opacity-30">{cur.day}</p>
                <span className="my-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ background: RED }}><cur.f.icon size={22} /></span>
                <p className="font-display text-xl font-extrabold">{cur.f.title}</p>
                <p className={`mt-1 text-sm ${muted(tone)}`}>{cur.f.tip}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Sec>
  );
}

/* ------------------------------------------------------------- LEDGER */
function Ledger({ m, tone, embed }) {
  const fs = m.features || [];
  const s = seedOf(m.slug);
  const amt = (i) => 180 + ((i * 97 + s) % 420);
  const [n, setN] = useState(4);
  useInterval(() => setN((v) => v + 1), 1600);
  const rows = Array.from({ length: 5 }, (_, k) => n - k);
  const total = Array.from({ length: n + 1 }, (_, i) => amt(i)).reduce((a, b) => a + b, 0);
  const dark = isDark(tone);
  return (
    <Sec tone={tone} m={m} embed={embed}>
      <H tone={tone}  left eyebrow="The statement">The numbers, itemised.</H>
      <div className={`overflow-hidden rounded-3xl border ${card(tone)}`}>
        <div className="flex items-end justify-between gap-4 border-b border-current/10 p-5 md:p-7" style={{ borderColor: "rgba(128,128,128,.2)" }}>
          <Check size={34} style={{ color: tone === "color" ? "#ffffff" : RED }} />
          <p className="font-display text-4xl font-extrabold md:text-6xl"><Num value={n} /></p>
        </div>
        <ul className="min-h-[300px] divide-y divide-[rgba(128,128,128,.18)]">
          <AnimatePresence initial={false}>
            {rows.map((idx) => {
              const f = fs[((idx % fs.length) + fs.length) % fs.length];
              if (!f) return null;
              return (
                <motion.li key={idx} layout initial={{ opacity: 0, y: -30, backgroundColor: `${RED}55` }} animate={{ opacity: 1, y: 0, backgroundColor: "rgba(0,0,0,0)" }} exit={{ opacity: 0 }} transition={{ duration: 0.7, ease: EASE }} className="flex items-center gap-4 px-5 py-4 md:px-7">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: RED }}><f.icon size={18} /></span>
                  <div className="min-w-0 flex-1"><p className="truncate font-display text-sm font-bold md:text-base">{f.title}</p><p className="truncate text-[11px] opacity-60">{f.tip}</p></div>
                  <Check size={18} style={{ color: RED }} />
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>
    </Sec>
  );
}

/* ------------------------------------------------------------- WHEEL */
function Wheel({ m, tone, embed }) {
  const fs = m.features || [];
  const [a, setA] = useState(0);
  const [auto, setAuto] = useState(true);
  useInterval(() => setA((v) => (v + 1) % fs.length), 3200, auto && fs.length > 1);
  const dark = isDark(tone);
  const F = fs[a];
  return (
    <Sec tone={tone} m={m} embed={embed}>
      <H tone={tone}  eyebrow="The index">What is on the books.</H>
      <div className="relative mx-auto aspect-square w-full max-w-[520px]">
        <div className="dk-art-spin absolute inset-[6%] rounded-full border-2 border-dashed border-current opacity-20" />
        <div className="absolute inset-[24%] rounded-full border border-current opacity-10" />
        {fs.map((f, i) => {
          const ang = (i / fs.length) * Math.PI * 2 - Math.PI / 2;
          const on = i === a;
          return (
            <button key={f.title} type="button" aria-label={f.title} aria-pressed={on} onClick={() => { setA(i); setAuto(false); }} className="absolute -translate-x-1/2 -translate-y-1/2 outline-none" style={{ left: `${50 + 44 * Math.cos(ang)}%`, top: `${50 + 44 * Math.sin(ang)}%` }}>
              <motion.span animate={{ scale: on ? 1.25 : 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} className="flex h-12 w-12 items-center justify-center rounded-full border-2 text-white shadow-lg md:h-14 md:w-14" style={{ background: on ? RED : dark ? "rgba(255,255,255,.12)" : "#ffffff", borderColor: RED, color: on ? "#ffffff" : RED }}><f.icon size={20} /></motion.span>
            </button>
          );
        })}
        <div className="absolute inset-[27%] flex items-center justify-center text-center">
          <AnimatePresence mode="wait">
            {F && (
              <motion.div key={F.title} initial={{ opacity: 0, scale: 0.85, rotate: -6 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.4, ease: EASE }}>
                <p className="font-display text-lg font-extrabold leading-tight md:text-2xl">{F.title}</p>
                <p className={`mt-2 text-xs md:text-sm ${muted(tone)}`}>{F.tip}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Sec>
  );
}

/* ------------------------------------------------------------- STACK */
function Stack({ m, tone, embed }) {
  const fs = m.features || [];
  const fg = "#ffffff";
  return (
    <Sec tone={tone} m={m} embed={embed}>
      <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-14">
        <div className="self-start lg:sticky lg:top-32">
          <H tone={tone} left  >Everything inside, one card at a time.</H>
          <p className={`text-lead -mt-6 max-w-sm ${muted(tone)}`}>{m.short}</p>
        </div>
        <div className="space-y-5">
          {fs.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 60, rotate: i % 2 ? 2 : -2 }} whileInView={{ opacity: 1, y: 0, rotate: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.8, ease: EASE }} className="sk-card rounded-[2rem] border border-ink/10 p-7 text-ink shadow-[0_18px_50px_-24px_rgba(0,0,0,0.35)] md:p-9 lg:sticky" style={{ top: `calc(var(--header-clearance) + ${i * 18}px)`, backgroundColor: "#ffffff", backgroundImage: `linear-gradient(135deg, ${RED}22, #ffffff 65%)` }}>
              <div className="flex items-start justify-between gap-4">
                <motion.span whileInView={{ rotate: [0, -12, 12, 0] }} transition={{ duration: 1, delay: 0.4 }} className="inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "#0a0a0a", color: fg }}><f.icon size={26} /></motion.span>
                <span className="font-display text-5xl font-extrabold" style={{ color: `${RED}55` }}>{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-6 font-display text-2xl font-extrabold md:text-3xl">{f.title}</h3>
              <p className="mt-2 max-w-md text-base leading-relaxed text-ink/65">{f.tip}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </Sec>
  );
}

/* ------------------------------------------------------------- CHAT */
function Chat({ m, tone, embed }) {
  const x = moduleExtras[m.slug];
  const msgs = x ? x.uses.map(([who, text]) => ({ who, text })) : (m.features || []).map((f) => ({ who: f.title, text: f.tip }));
  const [shown, setShown] = useState(1);
  useInterval(() => setShown((v) => (v > msgs.length + 2 ? 1 : v + 1)), 1900);
  const dark = isDark(tone);
  const fg = "#ffffff";
  return (
    <Sec tone={tone} m={m} embed={embed}>
      <H tone={tone}  sub="Real moments where it earns its place.">Overheard in a restaurant.</H>
      <div className="mx-auto min-h-[360px] max-w-2xl space-y-4">
        <AnimatePresence>
          {msgs.slice(0, shown).map((s, i) => (
            <motion.div key={s.who} layout initial={{ opacity: 0, y: 24, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 220, damping: 20 }} className={`flex ${i % 2 ? "justify-end" : ""}`}>
              <div className={`sk-card max-w-[88%] rounded-[1.6rem] px-5 py-4 md:max-w-[78%] ${i % 2 ? "rounded-br-md" : `rounded-bl-md ${dark ? "bg-white/15" : "bg-white shadow"}`}`} style={i % 2 ? { background: "#0a0a0a", color: fg } : undefined}>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{s.who}</p>
                <p className="mt-1 font-display text-base font-semibold leading-snug md:text-lg">{s.text}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {shown <= msgs.length && (
          <div className={`flex ${shown % 2 ? "" : "justify-end"}`}><div className={`flex gap-1 rounded-full px-4 py-3 ${dark ? "bg-white/15" : "bg-white shadow"}`}>{[0, 1, 2].map((d) => <motion.span key={d} className="h-2 w-2 rounded-full bg-current opacity-50" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: d * 0.15 }} />)}</div></div>
        )}
      </div>
    </Sec>
  );
}

/* ------------------------------------------------------------- BARS */
function Bars({ m, tone, embed }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const s = seedOf(m.slug);
  const vals = Array.from({ length: 10 }, (_, i) => 28 + ((s * (i + 3) * 37) % 66));
  const [hover, setHover] = useState(-1);
  const dark = isDark(tone);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${(i / 9) * 100} ${100 - v}`).join(" ");
  return (
    <Sec tone={tone} m={m} embed={embed}>
      <H tone={tone}  eyebrow="Change log">What changes the day you switch.</H>
      <div ref={ref} className="grid items-center gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className={`relative rounded-3xl border p-5 md:p-8 ${card(tone)}`}>
          <div className="relative flex h-60 items-end gap-2 md:h-72 md:gap-3" onMouseLeave={() => setHover(-1)}>
            {vals.map((v, i) => (
              <div key={i} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
                <motion.div className="w-full rounded-t-xl" style={{ background: hover === i ? "#ffffff" : RED, opacity: hover < 0 || hover === i ? 1 : 0.45, boxShadow: hover === i ? `0 0 0 3px ${RED}` : "none" }} initial={{ height: 0 }} animate={{ height: inView ? `${v}%` : 0 }} transition={{ duration: 1, delay: i * 0.07, ease: EASE }} />
              </div>
            ))}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true"><motion.path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.7" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: inView ? 1 : 0 }} transition={{ duration: 1.6, delay: 0.8 }} /></svg>
          </div>
        </div>
        <div className="grid gap-4">
          {(m.stats || []).map((st) => (
            <div key={st.label} className={`rounded-3xl border p-5 ${card(tone)}`}>
              <p className="font-display text-5xl font-extrabold leading-none" style={{ color: tone === "color" ? "inherit" : RED }}><CountUp to={st.to} suffix={st.suffix} /></p>
              <p className={`mt-2 text-sm font-semibold ${muted(tone)}`}>{st.label}</p>
            </div>
          ))}
        </div>
      </div>
    </Sec>
  );
}

/* ------------------------------------------------------------- COMPARE */
const CmpRow = ({ text, good }) => (
  <li className="flex items-center gap-3 px-5 py-5 md:px-8 md:py-6">
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${good ? "bg-ink" : "bg-ink/40"}`}>{good ? <Check size={18} /> : <X size={18} />}</span>
    <span className={`font-display text-sm font-bold md:text-lg ${good ? "" : "line-through decoration-ink/30 opacity-50"}`}>{text}</span>
  </li>
);
function Compare({ m, tone, embed }) {
  const gaps = m.gaps || [];
  const [p, setP] = useState(52);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  useEffect(() => {
    if (!inView) return undefined;
    const c = animate(52, [52, 18, 82, 52], { duration: 3.2, ease: "easeInOut", onUpdate: setP });
    return () => c.stop();
  }, [inView]);
  return (
    <Sec tone={tone} m={m} embed={embed}>
      <H tone={tone}  eyebrow="The difference">Not this. This.</H>
      <div ref={ref} className="sk-card relative mx-auto max-w-3xl select-none overflow-hidden rounded-3xl border border-ink/10 text-ink shadow-xl">
        <ul className="overflow-hidden rounded-2xl bg-[#ececec]">{gaps.map(([bad], i) => <CmpRow key={i} text={bad} />)}</ul>
        <ul className="absolute inset-0 bg-white" style={{ clipPath: `inset(0 ${100 - p}% 0 0)` }}>{gaps.map(([, good], i) => <CmpRow key={i} text={good} good />)}</ul>
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-1 -translate-x-1/2" style={{ left: `${p}%`, background: RED }}><span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-extrabold text-white shadow-lg" style={{ background: RED }}>⇆</span></span>
        <span className="pointer-events-none absolute right-3 top-2 text-[10px] font-bold uppercase tracking-widest text-ink/40">Typical app</span>
        <span className="pointer-events-none absolute left-3 top-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: RED }}>Dishky</span>
        <input type="range" min="0" max="100" value={Math.round(p)} onChange={(e) => setP(+e.target.value)} aria-label="Compare a typical app with Dishky" className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
      </div>
    </Sec>
  );
}

/* ------------------------------------------------------------- SPOTLIGHT */
function Spotlight({ m, tone, embed }) {
  const dark = isDark(tone);
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <Sec tone={tone} m={m} embed={embed}>
      <H tone={tone}  left eyebrow="Spec sheet">Every function, on one console.</H>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(m.features || []).map((f, i) => (
          <motion.div key={f.title} onMouseMove={move} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.7, delay: i * 0.1, ease: EASE }} className={`group relative overflow-hidden rounded-3xl border p-6 ${card(tone)}`} style={{ "--mx": "50%", "--my": "0px" }}>
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: `radial-gradient(260px circle at var(--mx) var(--my), ${RED}55, transparent 70%)` }} />
            <motion.span animate={{ y: [0, -6, 0] }} transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" }} className="relative mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ background: RED }}><f.icon size={22} /></motion.span>
            <p className="relative font-display text-lg font-extrabold">{f.title}</p>
            <p className={`relative mt-2 text-sm leading-relaxed ${muted(tone)}`}>{f.tip}</p>
          </motion.div>
        ))}
      </div>
    </Sec>
  );
}

/* ------------------------------------------------------------- TIMELINE */
function Timeline({ m, tone, embed }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] });
  const items = [...(m.journey || []).map((j) => ({ icon: j.icon, title: j.title, tip: "" })), ...[]];
  const fs = m.features || [];
  const list = items.map((it, i) => ({ ...it, tip: (fs[i] && fs[i].tip) || "" }));
  const dark = isDark(tone);
  return (
    <Sec tone={tone} m={m} embed={embed}>
      <H tone={tone}  eyebrow="How it is organised">One role leads to the next.</H>
      <div ref={ref} className="relative mx-auto max-w-3xl">
        <div className="absolute bottom-0 left-5 top-0 w-0.5 bg-current opacity-15 md:left-1/2" />
        <motion.div className="absolute bottom-0 left-5 top-0 w-0.5 origin-top md:left-1/2" style={{ background: RED, scaleY: scrollYProgress }} />
        <ul className="space-y-10">
          {list.map((it, i) => (
            <motion.li key={it.title} initial={{ opacity: 0, x: i % 2 ? 50 : -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.8, ease: EASE }} className={`relative pl-14 md:w-1/2 md:pl-0 ${i % 2 ? "md:ml-auto md:pl-12" : "md:pr-12 md:text-right"}`}>
              <span className={`absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg md:left-auto ${i % 2 ? "md:-left-5" : "md:-right-5"}`} style={{ background: RED }}><it.icon size={17} /></span>
              <div className={`rounded-2xl border p-4 ${card(tone)}`}>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Step {i + 1}</p>
                <p className="font-display text-lg font-extrabold">{it.title}</p>
                {it.tip && <p className={`mt-1 text-sm ${muted(tone)}`}>{it.tip}</p>}
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </Sec>
  );
}

/* ------------------------------------------------------------- RINGS */
function Rings({ m, tone, embed }) {
  const fills = [0.78, 0.92, 0.6, 0.85];
  const dark = isDark(tone);
  const stroke = tone === "color" ? "#ffffff" : RED;
  const wrap = useRef(null);
  const seen = useInView(wrap, { once: true, amount: 0.4 });
  return (
    <Sec tone={tone} m={m} embed={embed}>
      <H tone={tone}  eyebrow="Pull quotes">Where it pays off.</H>
      <div ref={wrap} className="grid gap-8 text-center md:grid-cols-3">
        {(m.stats || []).map((s, i) => (
          <Reveal key={s.label} delay={i * 0.12}>
            <div className="relative mx-auto h-48 w-48">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="7" />
                <path d="M50 8 a42 42 0 1 1 0 84 a42 42 0 1 1 0 -84" fill="none" stroke={stroke} strokeWidth="7" strokeLinecap="round" pathLength="1" strokeDasharray="1 1" style={{ strokeDashoffset: seen ? 1 - fills[i % fills.length] : 1, transition: `stroke-dashoffset 1.6s cubic-bezier(.22,1,.36,1) ${0.2 + i * 0.15}s` }} />
              </svg>
              <p className="absolute inset-0 flex items-center justify-center font-display text-5xl font-extrabold"><CountUp to={s.to} suffix={s.suffix} /></p>
            </div>
            <p className="mt-3 text-sm font-bold">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </Sec>
  );
}

/* ------------------------------------------------------------- simple wrappers */
const GalleryBlock = ({ m }) => <section className="overflow-x-clip bg-white text-ink" style={{ paddingTop: "var(--section-space-tight)" }}><div className="container-dishky"><Title>The story, in pictures.</Title></div><div><ModuleGallery module={{ ...m, color: RED }} /></div></section>;
const UsesBlock = ({ m, tone, embed }) => <Sec tone={tone} m={m} embed={embed}><H tone={tone}  eyebrow="Team badges">Who it is built for.</H><UseCases module={{ ...m, color: RED }} /></Sec>;
const StepsBlock = ({ m, tone, embed }) => <Sec tone={tone} m={m} embed={embed}><H tone={tone} >Live in three taps.</H><GettingStarted module={{ ...m, color: RED }} /></Sec>;
const FaqBlock = ({ m, tone, embed }) => <Sec tone={tone} m={m} embed={embed}><H tone={tone} >Questions, answered.</H><ModuleFaq module={{ ...m, color: RED }} /></Sec>;
const ExtraBlock = ({ m, tone, embed }) => <Sec tone={tone} m={m} embed={embed}><H tone={tone} >Try the routine.</H><div className="mx-auto max-w-2xl"><div className="dk-demo"><Demo name={m.extra} /></div></div></Sec>;

export { TONE, isDark };
export const BLOCKS = { rail: Rail, flow: Flow, tickets: Tickets, calendar: Calendar, ledger: Ledger, wheel: Wheel, stack: Stack, chat: Chat, bars: Bars, compare: Compare, spotlight: Spotlight, timeline: Timeline, rings: Rings, gallery: GalleryBlock, uses: UsesBlock, steps: StepsBlock, faq: FaqBlock, extra: ExtraBlock };
/** The background each block looks best on. */
export const PREF = { rail: "dark", flow: "light", tickets: "dark", calendar: "white", ledger: "dark", wheel: "light", stack: "light", chat: "beige", bars: "white", compare: "light", spotlight: "dark", timeline: "white", rings: "color", gallery: "white", uses: "beige", steps: "dark", faq: "light", extra: "beige" };

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowDown, ChevronDown, Check, X, Calendar, Settings2, Rocket } from "lucide-react";
import { Reveal, CountUp, Photo } from "../../../ui/kit.js";
import { Demo } from "../../../demos/index.js";
import Breadcrumbs from "../../../ui/Breadcrumbs.js";
import { ResponsiveLines } from "../../../SectionHeading/SectionHeading.js";
import { moduleExtras } from "../../../../data/moduleExtras.js";
import { journeyScenes } from "../../ModuleBlocks.js";
import Title from "../../ModuleTitle.js";
import PageBackdrop from "../../../ReactBits/PageBackdrop.js";

export { Title, Reveal, CountUp, Photo, Demo, motion };

/** Section theme. Every variant below reads its colours from here, so any block works on any background. */
// Section backgrounds are pure white or a shade of black: any off-white / light grey becomes #ffffff.
const lum = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return 0; const n = parseInt(m[1], 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
const pureBg = (o) => (o.bg && !o.dark && lum(o.bg) > 190 ? "#ffffff" : o.bg);
export const mk = (o) => ({ dark: false, bg: "#ffffff", card: "#ffffff", accent: "#f33716", onAccent: "#ffffff", ...o, bg: pureBg({ bg: "#ffffff", ...o }), ink: o.ink || (o.dark ? "#eeeeee" : "#0a0a0a") });
export const mute = (t, a = 0.62) => (t.dark ? `rgba(255,255,255,${a})` : `rgba(10,10,10,${a})`);
export const line = (t, a = 0.14) => (t.dark ? `rgba(255,255,255,${a})` : `rgba(10,10,10,${a})`);
export const onColor = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 165 ? "#0a0a0a" : "#ffffff";
};
export const pad = (i) => String(i + 1).padStart(2, "0");

/** A themed full-width section. */
export function Sec({ t, children, id, className = "", style, bare = false, tight = false }) {
  // The hero (the section that clears the header) fills the screen and carries the page's backdrop.
  const hero = String(style?.paddingTop || "").includes("header-clearance");
  return (
    <section id={id} data-nav-theme={t.dark ? "dark" : undefined} className={`relative ${hero ? "hero-min isolate" : ""} ${className}`} style={{ background: t.bg, color: t.ink, paddingBlock: tight ? "clamp(24px,3.5vw,48px)" : "var(--section-space-tight)", ...style }}>
      {hero && <PageBackdrop tone={t.dark ? "dark" : "light"} />}
      {bare ? children : <div className="container-dishky">{children}</div>}
    </section>
  );
}
/** Section + heading. */
export function Block({ t, title, eyebrow, sub, left, children, id, className, style, bare }) {
  return (
    <Sec t={t} id={id} className={className} style={style}>
      <Title dark={t.dark} left={left} eyebrow={eyebrow} sub={sub}>{title}</Title>
      {children}
    </Sec>
  );
}

/** Breadcrumbs + h1 + tagline + CTAs, so every hero has the same content and its own composition. */
export function HeroText({ m, t, align = "left", h1Class = "heading-hero", h1Style, sub = true, ctas = true, tryLabel = "Try it live", className = "" }) {
  const c = align === "center";
  return (
    <div className={`${c ? "mx-auto text-center" : ""} ${className}`}>
      <div className={`mb-5 ${c ? "flex justify-center" : ""}`}><Breadcrumbs dark={t.dark} items={[{ label: "Home", to: "/" }, { label: "Features", to: "/features" }, { label: m.name }]} /></div>
      <h1 className={h1Class} style={{ color: t.ink, ...h1Style }}><ResponsiveLines text={m.name} /></h1>
      {sub && <p className={`text-lead mt-4 max-w-xl ${c ? "mx-auto" : ""}`} style={{ color: mute(t, 0.72) }}>{m.tagline}</p>}
      {sub && m.lacks && <p className="mt-3 font-display text-base font-bold" style={{ color: t.accent }}>{m.lacks}</p>}
      {ctas && (
        <div className={`cta-row mt-7 ${c ? "justify-center" : ""}`}>
          <Link to="/book-demo" className="btn-primary">Book a Demo <ArrowRight size={18} /></Link>
          <a href="#try" className="btn-secondary" style={{ borderColor: line(t, 0.3), color: t.ink }}>{tryLabel} <ArrowDown size={16} /></a>
        </div>
      )}
    </div>
  );
}
export const heroPad = { paddingTop: "calc(var(--header-clearance) + clamp(24px, 5vw, 56px))", paddingBottom: "var(--section-space-tight)" };

/** The module's interactive demo. */
export function TryDemo({ m, t, name, max = "max-w-4xl", note = true }) {
  return (
    <div id={name ? undefined : "try"} className={`mx-auto w-full min-w-0 ${max}`}>
      <Demo name={name || m.demo} />
      {note && <p className="mt-3 text-center text-xs" style={{ color: mute(t, 0.5) }}>Interactive demo with sample data. It is not connected to a live restaurant.</p>}
    </div>
  );
}

/* ----------------------------------------------------------- Features */
export function Features({ v = "grid", m, t }) {
  const [on, setOn] = useState(0);
  if (v === "rows")
    return (
      <ul>
        {m.features.map((f, i) => (
          <Reveal as="li" key={f.title} delay={i * 0.04} y={16}>
            <div className="grid items-baseline gap-x-6 gap-y-1 border-t py-5 md:grid-cols-[4rem_1fr_1.1fr]" style={{ borderColor: line(t) }}>
              <span className="font-display text-xs" style={{ color: t.accent }}>{pad(i)}</span>
              <p className="font-display text-xl font-extrabold md:text-3xl">{f.title}</p>
              <p className="text-sm leading-relaxed md:text-base" style={{ color: mute(t) }}>{f.tip}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    );
  if (v === "pills")
    return (
      <div>
        <div role="tablist" className="flex flex-wrap justify-center gap-2">
          {m.features.map((f, i) => (
            <button key={f.title} role="tab" aria-selected={on === i} onClick={() => setOn(i)} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border px-5 text-sm font-bold transition-all" style={on === i ? { background: t.accent, color: t.onAccent, borderColor: t.accent } : { borderColor: line(t, 0.25) }}>
              <f.icon size={16} />{f.title}
            </button>
          ))}
        </div>
        <motion.div key={on} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-6 max-w-2xl rounded-3xl border p-7 text-center" style={{ background: t.card, borderColor: line(t) }}>
          {React.createElement(m.features[on].icon, { size: 32, style: { color: t.accent }, className: "mx-auto" })}
          <p className="mt-3 font-display text-2xl font-extrabold">{m.features[on].title}</p>
          <p className="mt-2" style={{ color: mute(t) }}>{m.features[on].tip}</p>
        </motion.div>
      </div>
    );
  if (v === "cols")
    return (
      <div className="grid gap-y-8 md:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ "--n": Math.min(m.features.length, 4) }}>
        {m.features.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.06} className={`md:px-6 ${i % 4 ? "md:border-l" : ""}`} >
            <div style={{ borderColor: line(t) }} className={i % 4 ? "md:border-l md:pl-6 md:-ml-6" : ""}>
              <f.icon size={26} style={{ color: t.accent }} />
              <p className="mt-3 font-display text-lg font-extrabold">{f.title}</p>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: mute(t) }}>{f.tip}</p>
            </div>
          </Reveal>
        ))}
      </div>
    );
  if (v === "words")
    return (
      <ul className="flex flex-wrap items-baseline gap-x-6 gap-y-4">
        {m.features.map((f, i) => (
          <Reveal as="li" key={f.title} delay={i * 0.05} className="group relative">
            <span className="font-display text-[clamp(2rem,6vw,4.5rem)] font-extrabold leading-none tracking-tight transition-colors" style={{ color: i % 2 ? t.accent : undefined }}>{f.title}</span>
            <span className="ml-2 inline-block max-w-[16rem] align-top text-xs leading-snug" style={{ color: mute(t) }}>{f.tip}</span>
          </Reveal>
        ))}
      </ul>
    );
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ "--n": m.features.length > 4 ? 3 : m.features.length }}>
      {m.features.map((f, i) => (
        <Reveal key={f.title} delay={i * 0.05} className="h-full">
          <div className="h-full rounded-3xl border p-6 transition-transform duration-500 hover:-translate-y-1" style={{ background: t.card, borderColor: line(t) }}>
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: t.accent, color: t.onAccent }}><f.icon size={20} /></span>
            <p className="font-display text-lg font-extrabold">{f.title}</p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: mute(t) }}>{f.tip}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ Journey */
export function Journey({ v = "cards", m, t }) {
  const sc = journeyScenes(m.slug);
  if (v === "steps")
    return (
      <ol className="grid gap-6 md:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ "--n": m.journey.length }}>
        {m.journey.map((s, k) => (
          <Reveal as="li" key={s.title} delay={k * 0.08}>
            <p className="font-display text-7xl font-extrabold leading-none" style={{ color: t.accent, opacity: 0.9 }}>{pad(k)}</p>
            <p className="mt-2 flex items-center gap-2 font-display text-xl font-bold"><s.icon size={18} />{s.title}</p>
            <div className="mt-3 h-px w-full" style={{ background: line(t) }} />
          </Reveal>
        ))}
      </ol>
    );
  if (v === "timeline")
    return (
      <ol className="relative mx-auto max-w-3xl">
        <span className="absolute bottom-0 left-5 top-0 w-px md:left-1/2" style={{ background: line(t, 0.25) }} />
        {m.journey.map((s, k) => (
          <Reveal as="li" key={s.title} delay={0.05} x={k % 2 ? 30 : -30} y={0} className="relative mb-8 pl-14 md:mb-10 md:grid md:grid-cols-2 md:gap-12 md:pl-0">
            <span className="absolute left-5 top-3 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full text-sm font-bold md:left-1/2" style={{ background: t.accent, color: t.onAccent }}>{k + 1}</span>
            <div className={k % 2 ? "md:col-start-2" : "md:text-right"}>
              <div className={`group relative mb-3 h-28 overflow-hidden rounded-2xl ${k % 2 ? "" : "md:ml-auto"} md:w-64`}><Photo src={s.photo} art={sc[k % sc.length]} className="absolute inset-0" zoom /></div>
              <p className="font-display text-lg font-bold">{s.title}</p>
            </div>
          </Reveal>
        ))}
      </ol>
    );
  if (v === "strip")
    return (
      <div className="-mx-[var(--page-gutter)] flex snap-x snap-mandatory gap-4 overflow-x-auto px-[var(--page-gutter)] pb-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
        {m.journey.map((s, k) => (
          <div key={s.title} className="group relative h-72 w-[78vw] max-w-[420px] shrink-0 snap-center overflow-hidden rounded-3xl md:h-80 md:w-[360px]">
            <Photo src={s.photo} art={sc[k % sc.length]} className="absolute inset-0" zoom />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
            <span className="absolute left-4 top-3 font-display text-5xl font-extrabold text-white/25">{pad(k)}</span>
            <p className="absolute bottom-4 left-4 flex items-center gap-2 font-display text-xl font-bold text-white"><s.icon size={18} />{s.title}</p>
          </div>
        ))}
      </div>
    );
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ "--n": m.journey.length }}>
      {m.journey.map((s, k) => (
        <Reveal key={s.title} delay={k * 0.08}>
          <div className="group relative h-64 overflow-hidden rounded-3xl">
            <Photo src={s.photo} art={sc[k % sc.length]} className="absolute inset-0" zoom />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <span className="absolute left-4 top-3 font-display text-4xl font-extrabold text-white/25">{pad(k)}</span>
            <p className="absolute bottom-4 left-4 flex items-center gap-2 font-display text-lg font-bold text-white"><s.icon size={18} />{s.title}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- Stats */
export function Stats({ v = "big", m, t }) {
  if (v === "line")
    return (
      <Reveal>
        <p className="text-center font-display text-[clamp(1.4rem,3.6vw,2.6rem)] font-extrabold leading-snug">
          {m.stats.map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <span style={{ color: mute(t, 0.3) }}> · </span>}
              <span style={{ color: t.accent }}><CountUp to={s.to} suffix={s.suffix} /></span> <span style={{ color: mute(t, 0.8) }}>{s.label.toLowerCase()}</span>
            </React.Fragment>
          ))}
        </p>
      </Reveal>
    );
  if (v === "cards")
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {m.stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08}>
            <div className="rounded-3xl border p-6" style={{ background: t.card, borderColor: line(t) }}>
              <p className="font-display text-5xl font-extrabold" style={{ color: t.accent }}><CountUp to={s.to} suffix={s.suffix} /></p>
              <p className="mt-1 text-sm" style={{ color: mute(t) }}>{s.label}</p>
              <div className="mt-4 h-1.5 rounded-full" style={{ background: line(t, 0.1) }}><motion.div initial={{ width: 0 }} whileInView={{ width: `${55 + i * 20}%` }} viewport={{ once: true }} transition={{ duration: 1.2 }} className="h-full rounded-full" style={{ background: t.accent }} /></div>
            </div>
          </Reveal>
        ))}
      </div>
    );
  if (v === "ring")
    return (
      <div className="grid gap-8 text-center md:grid-cols-3">
        {m.stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.1}>
            <div className="relative mx-auto h-40 w-40">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90"><circle cx="50" cy="50" r="44" fill="none" stroke={line(t, 0.12)} strokeWidth="6" /><motion.circle cx="50" cy="50" r="44" fill="none" stroke={t.accent} strokeWidth="6" strokeLinecap="round" strokeDasharray="276" initial={{ strokeDashoffset: 276 }} whileInView={{ strokeDashoffset: 276 * (0.68 - i * 0.18) }} viewport={{ once: true }} transition={{ duration: 1.4 }} /></svg>
              <p className="absolute inset-0 flex items-center justify-center font-display text-3xl font-extrabold"><CountUp to={s.to} suffix={s.suffix} /></p>
            </div>
            <p className="mt-3 text-sm font-semibold" style={{ color: mute(t, 0.75) }}>{s.label}</p>
          </Reveal>
        ))}
      </div>
    );
  return (
    <div className="grid gap-8 text-center md:grid-cols-3">
      {m.stats.map((s, i) => (
        <Reveal key={s.label} delay={i * 0.08}>
          <p className="font-display text-7xl font-extrabold leading-none md:text-8xl" style={{ color: t.accent }}><CountUp to={s.to} suffix={s.suffix} /></p>
          <p className="mt-3 text-sm font-semibold" style={{ color: mute(t, 0.7) }}>{s.label}</p>
        </Reveal>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- Gaps */
export function Gaps({ v = "table", m, t }) {
  const [good, setGood] = useState(true);
  if (v === "strike")
    return (
      <div className="space-y-5">
        {m.gaps.map(([bad, g], i) => (
          <Reveal key={g} delay={i * 0.08}>
            <p className="font-display text-[clamp(1.3rem,3.6vw,2.8rem)] font-extrabold leading-tight">
              <span className="line-through decoration-[3px]" style={{ color: mute(t, 0.35), textDecorationColor: t.accent }}>{bad}</span>
              <ArrowRight className="mx-3 inline-block -translate-y-1" style={{ color: t.accent }} />
              <span style={{ color: t.accent }}>{g}</span>
            </p>
          </Reveal>
        ))}
      </div>
    );
  if (v === "cards")
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {m.gaps.map(([bad, g], i) => (
          <Reveal key={g} delay={i * 0.08} className="h-full">
            <div className="h-full overflow-hidden rounded-3xl border" style={{ borderColor: line(t), background: t.card }}>
              <p className="flex items-start gap-2 px-5 py-4 text-sm line-through" style={{ color: mute(t, 0.45) }}><X size={16} className="mt-0.5 shrink-0" />{bad}</p>
              <p className="flex items-start gap-2 px-5 py-4 font-display text-base font-bold" style={{ background: t.accent, color: t.onAccent }}><Check size={18} className="mt-0.5 shrink-0" />{g}</p>
            </div>
          </Reveal>
        ))}
      </div>
    );
  if (v === "toggle")
    return (
      <div>
        <div className="mx-auto flex w-fit gap-1 rounded-full border p-1" style={{ borderColor: line(t, 0.25) }}>
          {[["Typical app", false], ["Dishky", true]].map(([l, val]) => (
            <button key={l} aria-pressed={good === val} onClick={() => setGood(val)} className="min-h-[44px] rounded-full px-6 text-sm font-bold transition-all" style={good === val ? { background: val ? t.accent : t.ink, color: val ? t.onAccent : t.bg } : { color: mute(t, 0.55) }}>{l}</button>
          ))}
        </div>
        <ul className="mx-auto mt-6 max-w-2xl space-y-3">
          {m.gaps.map(([bad, g]) => (
            <motion.li layout key={g} className="flex items-center gap-3 rounded-2xl border p-4" style={{ background: t.card, borderColor: good ? t.accent : line(t) }}>
              {good ? <Check size={18} style={{ color: t.accent }} /> : <X size={18} style={{ color: mute(t, 0.5) }} />}
              <span className={`font-display font-bold ${good ? "" : "line-through"}`} style={{ color: good ? t.ink : mute(t, 0.5) }}>{good ? g : bad}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    );
  return (
    <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border" style={{ borderColor: line(t, 0.25), background: t.card }}>
      <div className="grid grid-cols-2 text-xs font-bold uppercase tracking-widest" style={{ background: t.accent, color: t.onAccent }}><p className="px-5 py-3">Typical app</p><p className="px-5 py-3">Dishky</p></div>
      {m.gaps.map(([bad, g], i) => (
        <Reveal key={g} delay={i * 0.06} y={10}>
          <div className="grid grid-cols-2 border-t" style={{ borderColor: line(t) }}>
            <p className="border-r px-5 py-4 text-sm line-through" style={{ borderColor: line(t), color: mute(t, 0.45) }}>{bad}</p>
            <p className="px-5 py-4 text-sm font-bold">{g}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- Uses */
export function Uses({ v = "cards", m, t }) {
  const x = moduleExtras[m.slug];
  const [on, setOn] = useState(0);
  if (!x) return null;
  if (v === "list")
    return (
      <ul>
        {x.uses.map(([who, text], i) => (
          <Reveal as="li" key={who} delay={i * 0.06} y={14}>
            <div className="grid gap-1 border-t py-5 md:grid-cols-[14rem_1fr] md:gap-8" style={{ borderColor: line(t) }}>
              <p className="font-display text-xl font-extrabold" style={{ color: t.accent }}>{who}</p>
              <p style={{ color: mute(t, 0.75) }}>{text}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    );
  if (v === "tabs")
    return (
      <div className="mx-auto max-w-3xl">
        <div role="tablist" className="mb-4 flex flex-wrap justify-center gap-2">
          {x.uses.map(([who], i) => <button key={who} role="tab" aria-selected={on === i} onClick={() => setOn(i)} className="min-h-[44px] rounded-full border px-5 text-sm font-bold" style={on === i ? { background: t.accent, color: t.onAccent, borderColor: t.accent } : { borderColor: line(t, 0.25) }}>{who}</button>)}
        </div>
        <motion.p key={on} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border p-8 text-center font-display text-xl font-semibold leading-snug md:text-2xl" style={{ background: t.card, borderColor: line(t) }}>{x.uses[on][1]}</motion.p>
      </div>
    );
  if (v === "quotes")
    return (
      <div className="grid gap-8 md:grid-cols-3">
        {x.uses.map(([who, text], i) => (
          <Reveal key={who} delay={i * 0.1}>
            <p className="font-display text-xl font-bold leading-snug md:text-2xl">“{text}”</p>
            <p className="mt-3 border-l-4 pl-3 text-sm font-semibold" style={{ borderColor: t.accent, color: mute(t) }}>{who}</p>
          </Reveal>
        ))}
      </div>
    );
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {x.uses.map(([who, text], i) => (
        <Reveal key={who} delay={i * 0.08} className="h-full">
          <div className="h-full rounded-3xl border p-6" style={{ background: t.card, borderColor: line(t) }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: t.accent }}>{who}</p>
            <p className="mt-2 font-display text-lg font-semibold leading-snug">{text}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- Steps */
export const STEPS = (m) => [
  [Calendar, "Book a demo", `See ${m.name} on your own menu and floor.`],
  [Settings2, "We set it up", "Your team is onboarded with your dishes, tables and roles."],
  [Rocket, "Go live", "Open the doors, with help on hand for the first week."],
];
export function Steps({ v = "row", m, t }) {
  const s = STEPS(m);
  if (v === "list")
    return (
      <ol className="mx-auto max-w-2xl space-y-3">
        {s.map(([I, ti, d], i) => (
          <Reveal as="li" key={ti} delay={i * 0.1} x={-20} y={0}>
            <div className="flex items-center gap-4 rounded-2xl border p-5" style={{ background: t.card, borderColor: line(t) }}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display font-extrabold" style={{ background: t.accent, color: t.onAccent }}>{i + 1}</span>
              <div><p className="font-display text-lg font-bold">{ti}</p><p className="text-sm" style={{ color: mute(t) }}>{d}</p></div>
            </div>
          </Reveal>
        ))}
      </ol>
    );
  if (v === "big")
    return (
      <ol className="grid gap-8 md:grid-cols-3">
        {s.map(([, ti, d], i) => (
          <Reveal as="li" key={ti} delay={i * 0.1}>
            <p className="font-display text-[clamp(4rem,9vw,7rem)] font-extrabold leading-none" style={{ color: t.accent, opacity: 0.85 }}>{pad(i)}</p>
            <p className="font-display text-2xl font-extrabold">{ti}</p>
            <p className="mt-1 text-sm" style={{ color: mute(t) }}>{d}</p>
          </Reveal>
        ))}
      </ol>
    );
  return (
    <ol className="mx-auto flex max-w-4xl flex-col items-stretch gap-3 md:flex-row md:items-center">
      {s.map(([I, ti, d], i) => (
        <React.Fragment key={ti}>
          <li className="flex-1 rounded-full border px-6 py-4 text-center" style={{ background: t.card, borderColor: line(t) }}>
            <I size={20} className="mx-auto" style={{ color: t.accent }} />
            <p className="mt-1 font-display text-base font-bold">{ti}</p>
            <p className="text-xs" style={{ color: mute(t) }}>{d}</p>
          </li>
          {i < 2 && <ArrowRight className="mx-auto shrink-0 rotate-90 md:rotate-0" size={20} style={{ color: mute(t, 0.35) }} />}
        </React.Fragment>
      ))}
    </ol>
  );
}

/* ---------------------------------------------------------------- FAQ */
export function Faq({ m, t }) {
  const x = moduleExtras[m.slug];
  const [open, setOpen] = useState(0);
  if (!x) return null;
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {x.faq.map(([q, a], i) => {
        const on = open === i;
        return (
          <div key={q} className="overflow-hidden rounded-2xl border transition-colors" style={{ background: t.card, borderColor: on ? t.accent : line(t) }}>
            <button type="button" aria-expanded={on} onClick={() => setOpen(on ? -1 : i)} className="flex min-h-[48px] w-full items-center justify-between gap-4 px-5 py-4 text-left font-display text-base font-bold">
              {q}<ChevronDown size={18} className={`shrink-0 transition-transform duration-300 ${on ? "rotate-180" : ""}`} style={{ color: t.accent }} />
            </button>
            <div className={`grid transition-all duration-300 ${on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}><div className="overflow-hidden"><p className="px-5 pb-5 text-sm leading-relaxed" style={{ color: mute(t, 0.7) }}>{a}</p></div></div>
          </div>
        );
      })}
      <p className="pt-2 text-center text-sm" style={{ color: mute(t, 0.6) }}>Something else? <Link to="/contact" className="inline-flex items-center gap-1 font-semibold" style={{ color: t.accent }}>Ask our team <ArrowRight size={14} /></Link></p>
    </div>
  );
}

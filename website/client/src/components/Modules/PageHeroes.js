import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Demo } from "../demos/index.js";
import { Window } from "../ui/kit.js";
import { artFor } from "../ui/Art.js";
import Breadcrumbs from "../ui/Breadcrumbs.js";
import { ParallaxPhoto } from "./ModuleBlocks.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";

const EASE = [0.22, 1, 0.36, 1];
const PAD = { paddingTop: "calc(var(--header-clearance) + clamp(24px, 5vw, 64px))", paddingBottom: "var(--section-space-tight)" };

export const RED = "#f33716";
/** Text colour on the brand red is always white. */
export function onColor() { return "#ffffff"; }
/* ---------------------------------------------------------------- titles */
/** The page title, animated one of five ways so no two pages open alike. */
export function AnimTitle({ text, kind = "wordRise", className = "heading-hero" }) {
  const reduced = useReducedMotion();
  if (reduced) return <h1 className={className}>{text}</h1>;
  const words = text.split(" ");
  const base = { initial: "h", animate: "s" };

  if (kind === "letters" || kind === "typewriter") {
    let n = 0;
    return (
      <h1 className={className} aria-label={text}>
        {words.map((w, wi) => (
          <span key={wi} aria-hidden="true" className="inline-block whitespace-nowrap">
            {[...w].map((c, ci) => {
              const i = n++;
              return kind === "letters" ? (
                <motion.span key={ci} className="inline-block" initial={{ opacity: 0, y: 70, rotate: i % 2 ? 10 : -10 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.15 + i * 0.035 }}>{c}</motion.span>
              ) : (
                <motion.span key={ci} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.01, delay: 0.2 + i * 0.045 }}>{c}</motion.span>
              );
            })}
          </span>
        )).reduce((a, x, i) => (i ? [...a, " ", x] : [x]), [])}
        {kind === "typewriter" && <motion.span aria-hidden="true" className="ml-1 inline-block h-[0.85em] w-[0.08em] translate-y-[0.08em] bg-current" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />}
      </h1>
    );
  }

  const v = {
    wordRise: { h: { y: "110%" }, s: (i) => ({ y: 0, transition: { duration: 0.9, ease: EASE, delay: 0.1 + i * 0.08 } }) },
    blur: { h: { opacity: 0, filter: "blur(18px)", scale: 1.18 }, s: (i) => ({ opacity: 1, filter: "blur(0px)", scale: 1, transition: { duration: 1.1, ease: EASE, delay: 0.1 + i * 0.14 } }) },
    slideMask: { h: { clipPath: "inset(0 100% 0 0)", x: -30 }, s: (i) => ({ clipPath: "inset(0 0% 0 0)", x: 0, transition: { duration: 0.9, ease: EASE, delay: 0.1 + i * 0.12 } }) },
  }[kind] || null;

  return (
    <h1 className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden="true" className={`inline-block align-bottom ${kind === "wordRise" ? "overflow-hidden pb-[0.08em]" : ""}`}>
          <motion.span className="inline-block" variants={{ h: v.h, s: () => v.s(i) }} {...base}>{w}</motion.span>
        </span>
      )).reduce((a, x, i) => (i ? [...a, " ", x] : [x]), [])}
    </h1>
  );
}

/* ---------------------------------------------------------------- shared bits */
const Crumb = ({ m, dark }) => <Breadcrumbs dark={dark} items={[{ label: "Home", to: "/" }, { label: "Features", to: "/features" }, { label: m.name }]} />;
const Note = ({ dark }) => <p className={`mt-3 text-center text-xs ${dark ? "text-cream/45" : "text-ink/45"}`}>Interactive demo with sample data. It is not connected to a live restaurant.</p>;
const Lacks = ({ m, cls }) => (m.lacks ? <p className={`mt-3 font-display text-base font-bold ${cls}`}>{m.lacks}</p> : null);
const Cta = ({ dark, center, onColour }) => (
  <div className={`cta-row mt-7 ${center ? "justify-center" : ""}`}>
    <Link to="/book-demo" className={onColour ? "btn-primary !bg-ink !text-white" : "btn-primary"}>Book a Demo <ArrowRight size={18} /></Link>
    <Link to="/pricing" className={`btn-secondary ${dark ? "!border-cream/25 !text-cream" : onColour ? "!border-current !text-current" : ""}`}>View Plans</Link>
  </div>
);
const Chip = ({ m }) => <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-xl" style={{ background: RED }}><m.icon size={26} /></span>;

/* ---------------------------------------------------------------- heroes */
/** Full-colour poster: the page takes the module's own colour. */
function Poster({ m, T }) {
  const fg = "#ffffff";
  const dark = fg === "#ffffff";
  return (
    <section data-nav-theme={dark ? "dark" : undefined} className="relative overflow-hidden" style={{ ...PAD, background: "#0a0a0a", color: "#ffffff" }}>
      <motion.div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-40 opacity-[0.13]" animate={{ rotate: 360 }} transition={{ duration: 120, repeat: Infinity, ease: "linear" }}><m.icon size={720} strokeWidth={0.8} /></motion.div>
      <div className="container-dishky relative">
        <div className="mb-6"><Crumb m={m} dark={dark} /></div>
        <div className="grid items-end gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }} className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-ink shadow-xl"><m.icon size={26} style={{ color: RED }} /></motion.span>
            {T}
            <p className="text-lead mt-4 max-w-lg opacity-80">{m.tagline}</p>
            <Lacks m={m} cls="opacity-90" />
            <Cta dark={dark} onColour />
          </div>
          <div className="hidden flex-wrap justify-end gap-3 lg:flex">
            {(m.features || []).map((f, i) => (
              <motion.span key={f.title} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: [0, i % 2 ? -8 : 8, 0] }} transition={{ opacity: { delay: 0.5 + i * 0.12 }, y: { duration: 4 + i, repeat: Infinity, ease: "easeInOut", delay: 0.5 + i * 0.12 } }} className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-ink shadow-lg"><f.icon size={15} style={{ color: RED }} />{f.title}</motion.span>
            ))}
          </div>
        </div>
        <motion.div id="try" initial={{ opacity: 0, y: 70, rotate: 1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 1, delay: 0.35, ease: EASE }} className="mt-12 rounded-[2rem] bg-white/95 p-2 text-ink shadow-2xl md:p-3">
          <div className="dk-demo"><Demo name={m.demo} /></div>
        </motion.div>
        <Note dark={dark} />
      </div>
    </section>
  );
}

/** Giant outlined name sliding across the background, in opposite directions. */
function Kinetic({ m, T }) {
  const row = (rev, speed) => (
    <div className="dk-marquee overflow-hidden" aria-hidden="true">
      <div className="dk-marquee__track flex w-max" style={{ animationDuration: `${speed}s`, animationDirection: rev ? "reverse" : "normal" }}>
        {[0, 1, 2, 3].map((k) => <span key={k} className="whitespace-nowrap pr-12 font-display font-extrabold uppercase leading-[0.95]" style={{ fontSize: "clamp(70px, 14vw, 200px)", color: "transparent", WebkitTextStroke: `1.5px ${RED}66` }}>{m.name.split(" (")[0]} ·</span>)}
      </div>
    </div>
  );
  return (
    <section data-nav-theme="dark" className="relative overflow-hidden bg-ink text-cream" style={PAD}>
      <div className="pointer-events-none absolute inset-x-0 top-24 opacity-70">{row(false, 70)}{row(true, 90)}</div>
      <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/85 to-ink" />
      <div className="container-dishky relative">
        <div className="mb-6"><Crumb m={m} dark /></div>
        <div className="max-w-4xl">{T}</div>
        <p className="text-lead mt-5 max-w-xl text-cream/70">{m.tagline}</p>
        <Lacks m={m} cls="text-amberLight" />
        <Cta dark />
        <motion.div id="try" initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.4, ease: EASE }} className="mt-12"><div className="dk-demo"><Demo name={m.demo} /></div><Note dark /></motion.div>
      </div>
    </section>
  );
}

/** Features orbit the module's icon. */
function Orbit({ m, T }) {
  const fs = m.features || [];
  const R = 42;
  return (
    <section data-nav-theme="dark" className="relative overflow-hidden bg-ink text-cream" style={PAD}>
      <div aria-hidden="true" className="glow -left-24 top-10 h-[420px] w-[420px] opacity-35" style={{ background: RED }} />
      <div className="container-dishky relative">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.9, ease: EASE }}>
            <div className="mb-6"><Crumb m={m} dark /></div>
            {T}
            <p className="text-lead mt-4 max-w-md text-cream/70">{m.tagline}</p>
            <Lacks m={m} cls="text-amberLight" />
            <Cta dark />
          </motion.div>
          <div className="relative mx-auto aspect-square w-full max-w-[400px]" aria-hidden="true">
            <div className="absolute inset-[8%] rounded-full border border-dashed border-white/20" />
            <div className="absolute inset-[26%] rounded-full border border-white/10" />
            <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 36, repeat: Infinity, ease: "linear" }}>
              {fs.map((f, i) => {
                const a = (i / fs.length) * Math.PI * 2 - Math.PI / 2;
                return (
                  <div key={f.title} className="absolute" style={{ left: `${50 + R * Math.cos(a)}%`, top: `${50 + R * Math.sin(a)}%`, transform: "translate(-50%,-50%)" }}>
                    <motion.span animate={{ rotate: -360 }} transition={{ duration: 36, repeat: Infinity, ease: "linear" }} className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur"><f.icon size={13} style={{ color: RED }} />{f.title}</motion.span>
                  </div>
                );
              })}
            </motion.div>
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.3 }} className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-2xl dk-ping" style={{ background: RED }}><m.icon size={40} /></motion.span>
          </div>
        </div>
        <motion.div id="try" initial={{ opacity: 0, y: 70 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.4, ease: EASE }} className="mt-14"><div className="dk-demo"><Demo name={m.demo} /></div><Note dark /></motion.div>
      </div>
    </section>
  );
}

/** A terminal that "installs" the module line by line. */
function Terminal({ m, T }) {
  const lines = [`$ ${m.slug}`, ...(m.features || []).map((f) => `✓ ${f.title}`)];
  return (
    <section data-nav-theme="dark" className="relative overflow-hidden bg-[#070707] text-cream" style={PAD}>
      <div aria-hidden="true" className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#ffffff 1px,transparent 1px),linear-gradient(90deg,#ffffff 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
      <div className="container-dishky relative">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="mb-6"><Crumb m={m} dark /></div>
            {T}
            <p className="text-lead mt-4 max-w-md text-cream/70">{m.tagline}</p>
            <Lacks m={m} cls="text-amberLight" />
            <Cta dark />
          </div>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.2, ease: EASE }}>
            <Window title={m.slug}>
              <div className="min-h-[220px] space-y-2 p-5 font-mono text-[13px]" aria-hidden="true">
                {lines.map((l, i) => (
                  <motion.p key={l} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.55 }} className={i === 0 ? "text-cream/90" : "text-cream/65"}>{l}</motion.p>
                ))}
                <motion.span className="inline-block h-4 w-2 bg-cream/80" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />
              </div>
            </Window>
          </motion.div>
        </div>
        <motion.div id="try" initial={{ opacity: 0, y: 70 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.5, ease: EASE }} className="mt-14"><div className="dk-demo"><Demo name={m.demo} /></div><Note dark /></motion.div>
      </div>
    </section>
  );
}

/** Feature cards dealt out like a hand of cards. */
function Fan({ m, T }) {
  const fs = m.features || [];
  return (
    <section className="relative overflow-hidden bg-white text-ink" style={PAD}>
      <div aria-hidden="true" className="absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-25 blur-3xl" style={{ background: RED }} />
      <div className="container-dishky relative text-center">
        <div className="mb-6 flex justify-center"><Crumb m={m} /></div>
        <div className="mx-auto max-w-3xl">{T}</div>
        <p className="text-lead mx-auto mt-4 max-w-xl text-ink/65">{m.tagline}</p>
        <Lacks m={m} cls="text-amber" />
        <div className="mx-auto mb-6 mt-10 flex max-w-4xl items-end justify-center" style={{ minHeight: 190 }}>
          {fs.map((f, i) => {
            const mid = (fs.length - 1) / 2;
            const rot = (i - mid) * 7;
            return (
              <motion.div key={f.title} initial={{ opacity: 0, y: 120, rotate: 0 }} animate={{ opacity: 1, y: Math.abs(i - mid) * 12, rotate: rot }} whileHover={{ y: -14, rotate: 0, zIndex: 10 }} transition={{ type: "spring", stiffness: 110, damping: 14, delay: 0.4 + i * 0.12 }} className="-mx-2 w-[44%] max-w-[190px] rounded-2xl border border-ink/10 bg-white p-4 text-left shadow-xl sm:mx-[-6px]">
                <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: RED }}><f.icon size={17} /></span>
                <p className="font-display text-sm font-bold leading-tight">{f.title}</p>
              </motion.div>
            );
          })}
        </div>
        <Cta center />
        <motion.div id="try" initial={{ opacity: 0, y: 70 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.5, ease: EASE }} className="mx-auto mt-12 max-w-5xl text-left"><div className="dk-demo"><Demo name={m.demo} /></div><Note /></motion.div>
      </div>
    </section>
  );
}

/** Light, phone-first split: text on one side, the live demo on the other. */
function SplitLight({ m, T }) {
  return (
    <section className="relative overflow-hidden bg-white text-ink" style={PAD}>
      <div aria-hidden="true" className="absolute -right-32 -top-32 h-[560px] w-[560px] rounded-full opacity-25 blur-3xl" style={{ background: RED }} />
      <motion.div aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5" style={{ background: RED, originY: 0 }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 1.2, ease: EASE }} />
      <div className="container-dishky relative grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.9, ease: EASE }}>
          <div className="mb-6"><Crumb m={m} /></div>
          <div className="mb-5"><Chip m={m} /></div>
          {T}
          <p className="text-lead mt-4 max-w-md text-ink/65">{m.tagline}</p>
          <Lacks m={m} cls="text-amber" />
          <div className="cta-row mt-7"><Link to="/book-demo" className="btn-primary">Book a Demo <ArrowRight size={18} /></Link><Link to="/pricing" className="btn-secondary">View Plans</Link></div>
        </motion.div>
        <motion.div id="try" initial={{ opacity: 0, y: 50, rotate: 1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 1, delay: 0.2, ease: EASE }} className="min-w-0"><div className="dk-demo"><Demo name={m.demo} /></div><Note /></motion.div>
      </div>
    </section>
  );
}

/** Dark, centred, with the demo rising out of a coloured glow. */
function CenterGlow({ m, T }) {
  return (
    <section data-nav-theme="dark" className="relative overflow-hidden text-center text-cream" style={{ ...PAD, background: `radial-gradient(120% 80% at 50% 0%, #2a2a2a, #0a0a0a 62%)` }}>
      <ParallaxPhoto src={m.photo} art={artFor[m.slug]} className="absolute inset-0 opacity-25" strength={50} />
      <div className="container-dishky relative">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex justify-center"><Crumb m={m} dark /></div>
          <motion.span initial={{ scale: 0, rotate: 90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", delay: 0.2 }} className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-white text-ink shadow-2xl"><m.icon size={28} style={{ color: RED }} /></motion.span>
          {T}
          <p className="text-lead mx-auto mt-4 max-w-xl text-cream/75">{m.tagline}</p>
          <Lacks m={m} cls="text-amberLight" />
          <Cta dark center />
        </div>
        <motion.div id="try" initial={{ opacity: 0, y: 70, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 1, delay: 0.3, ease: EASE }} className="mx-auto mt-12 max-w-4xl text-left"><div className="dk-demo"><Demo name={m.demo} /></div><Note dark /></motion.div>
      </div>
    </section>
  );
}

/** Photograph behind the title, drifting as you scroll. */
function PhotoStack({ m, T }) {
  return (
    <section data-nav-theme="dark" className="relative overflow-hidden bg-ink text-cream" style={PAD}>
      <ParallaxPhoto src={m.photo} art={artFor[m.slug]} className="absolute inset-0 opacity-60" strength={70} />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/70 to-ink" />
      <div className="glow -right-20 top-10 h-[420px] w-[420px] opacity-40" style={{ background: RED }} />
      <div className="container-dishky relative">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE }} className="max-w-4xl">
          <div className="mb-6"><Crumb m={m} dark /></div>
          <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", delay: 0.2 }} className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-2xl" style={{ background: RED }}><m.icon size={30} /></motion.span>
          {T}
          <p className="text-lead mt-5 max-w-xl text-cream/70">{m.tagline}</p>
          <Lacks m={m} cls="text-amberLight" />
          <Cta dark />
        </motion.div>
        <motion.div id="try" initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3, ease: EASE }} className="mt-14 md:mt-20"><div className="dk-demo"><Demo name={m.demo} /></div><Note dark /></motion.div>
      </div>
    </section>
  );
}

export const HEROES = { poster: Poster, kinetic: Kinetic, orbit: Orbit, terminal: Terminal, fan: Fan, splitLight: SplitLight, centerGlow: CenterGlow, photoStack: PhotoStack };

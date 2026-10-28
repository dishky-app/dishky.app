import React, { Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, X, Smartphone, Monitor, ChefHat, Megaphone, ArrowDown } from "lucide-react";
import { Reveal, Tilt, CountUp, Float, Photo, Segmented } from "../Kit/Kit.js";
import demos from "../Modules/demos/index.js";
import { moduleBySlug, otherModules } from "../../data/modules.js";
import { images } from "../../assets/images/imageUrls.js";

/* ---------------------------------------------------------------- 1. WHAT */
export function WhatIsDishky() {
  const steps = [
    { Icon: Smartphone, label: "Guests scan & order" },
    { Icon: ChefHat, label: "Kitchen sees it live" },
    { Icon: Monitor, label: "You run everything" },
    { Icon: Megaphone, label: "We help you grow" },
  ];
  return (
    <section className="relative overflow-hidden bg-cream" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="container-dishky grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <h2 className="heading-xl text-ink">What is <span className="text-amber">Dishky?</span></h2>
          <p className="mt-5 max-w-sm font-display text-xl font-semibold leading-snug text-ink/70">The restaurant OS. Order to kitchen to cash, plus the marketing nobody else does.</p>
        </Reveal>
        <div className="relative">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {steps.map(({ Icon, label }, i) => (
              <Reveal key={label} delay={i * 0.12} y={40}>
                <motion.div whileHover={{ y: -8, rotate: i % 2 ? 1.5 : -1.5 }} className={`relative flex aspect-square flex-col justify-between overflow-hidden rounded-3xl p-5 ${i === 3 ? "bg-amber text-white" : i % 2 ? "bg-ink text-cream" : "bg-beige text-ink"}`}>
                  <span className="font-display text-5xl font-extrabold leading-none opacity-20">{i + 1}</span>
                  <Icon size={34} />
                  <p className="font-display text-sm font-bold leading-tight sm:text-base">{label}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- 2. WHY */
const rows = [
  ["Marketing for your restaurant", false],
  ["Event co-creation", false],
  ["Live kitchen display", false],
  ["QR ordering, no app", true],
  ["Stock that warns you", true],
  ["Multi-branch, one login", true],
  ["Roles & permissions", true],
];

export function WhyDishky() {
  const [mode, setMode] = useState("dishky");
  const isDishky = mode === "dishky";
  return (
    <section data-nav-theme="dark" className="relative overflow-hidden bg-ink text-cream" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="kit-glow -right-20 top-0 h-[420px] w-[420px]" aria-hidden="true" />
      <div className="container-dishky relative">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="heading-xl text-cream">Why <span className="text-amber">Dishky?</span></h2>
          <Segmented dark value={mode} onChange={setMode} options={[{ value: "others", label: "Other apps" }, { value: "dishky", label: "Dishky" }]} />
        </Reveal>

        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {rows.map(([label, others], i) => {
            const has = isDishky || others;
            return (
              <Reveal key={label} delay={i * 0.05} y={24}>
                <motion.div layout className={`flex items-center justify-between gap-4 rounded-2xl border p-5 transition-colors duration-500 ${has ? "border-cream/15 bg-cream/[0.06]" : "border-cream/5 bg-transparent"}`}>
                  <span className={`font-display text-base font-bold transition-opacity duration-500 sm:text-lg ${has ? "" : "opacity-40"}`}>{label}</span>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={has ? "y" : "n"} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 400, damping: 18 }} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${has ? "bg-amber text-white" : "bg-cream/10 text-cream/40"}`}>
                      {has ? <Check size={18} /> : <X size={18} />}
                    </motion.span>
                  </AnimatePresence>
                </motion.div>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-12 grid grid-cols-3 gap-4 border-t border-cream/10 pt-10">
          {[{ to: 3, label: "things no other app does" }, { to: 14, label: "modules, one login" }, { to: 0, label: "app for guests to install" }].map((s) => (
            <div key={s.label}>
              <p className="font-display text-4xl font-extrabold text-amber sm:text-6xl"><CountUp to={s.to} /></p>
              <p className="mt-2 text-xs font-semibold text-cream/55 sm:text-sm">{s.label}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- 3. SPOTLIGHT */
/** A full section for one standout feature: huge title, live demo, 3 chips. */
export function Spotlight({ slug, dark = false, index = 1 }) {
  const m = moduleBySlug[slug];
  const Demo = demos[m.demo];
  const { Icon } = m;
  return (
    <section
      id={slug}
      data-nav-theme={dark ? "dark" : undefined}
      className={`relative overflow-hidden ${dark ? "bg-charcoal text-cream" : "bg-beige text-ink"}`}
      style={{ paddingBlock: "var(--section-space)" }}
    >
      <div className="kit-glow -left-32 top-20 h-[420px] w-[420px]" aria-hidden="true" />
      <div className="container-dishky relative">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <Reveal>
            <p className={`font-display text-7xl font-extrabold leading-none sm:text-9xl ${dark ? "text-cream/10" : "text-ink/10"}`}>0{index}</p>
            <h2 className={`heading-xl -mt-6 sm:-mt-10 ${dark ? "text-cream" : "text-ink"}`}>{m.name}</h2>
            <p className={`mt-4 max-w-xl font-display text-xl font-semibold leading-snug ${dark ? "text-cream/70" : "text-ink/65"}`}>{m.tagline}</p>
          </Reveal>
          <Reveal delay={0.1} className="flex items-center gap-3">
            <span className="rounded-full bg-amber px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">Only on Dishky</span>
          </Reveal>
        </div>

        <Reveal y={60} className="mt-10">
          <Suspense fallback={<div className="grid h-[420px] place-items-center rounded-3xl bg-white/5 text-sm opacity-50">Loading…</div>}>
            {Demo && <Demo dark={dark} />}
          </Suspense>
        </Reveal>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {m.features.slice(0, 3).map((f, i) => {
            const FIcon = f.Icon;
            return (
              <Reveal key={f.title} delay={i * 0.1}>
                <motion.div whileHover={{ y: -6 }} className={`flex items-center gap-4 rounded-2xl border p-4 ${dark ? "border-cream/12 bg-cream/[0.05]" : "border-ink/10 bg-white"}`}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber text-white"><FIcon size={20} /></span>
                  <div>
                    <p className="font-display text-sm font-bold leading-tight">{f.title}</p>
                    <p className={`mt-0.5 text-xs ${dark ? "text-cream/55" : "text-ink/55"}`}>{f.line}</p>
                  </div>
                </motion.div>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="cta-row mt-10">
          <Link to={`/modules/${slug}`} className="btn-primary group"><Icon size={17} /> See every feature <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></Link>
          <Link to="/book-demo" className={`btn-secondary ${dark ? "!border-cream/25 !text-cream" : ""}`}>Book a Demo</Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- 4. OTHER FEATURES */
export function OtherFeatures() {
  return (
    <section className="bg-cream" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="container-dishky">
        <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-4">
          <h2 className="heading-xl text-ink">And everything else.</h2>
          <p className="flex items-center gap-2 text-sm font-semibold text-ink/50">Hover or tap a module <ArrowDown size={15} /></p>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {otherModules.map((m, i) => {
            const { Icon } = m;
            return (
              <Reveal key={m.slug} delay={(i % 3) * 0.08} y={40}>
                <Link to={`/modules/${m.slug}`} className="group relative block aspect-[4/3.2] overflow-hidden rounded-3xl bg-ink text-cream">
                  <img src={m.hero} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-60 transition duration-700 group-hover:scale-110 group-hover:opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <span className="absolute left-5 top-5 flex h-11 w-11 items-center justify-center rounded-xl bg-amber text-white transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110"><Icon size={20} /></span>
                  <div className="absolute inset-x-5 bottom-5">
                    <p className="font-display text-xl font-extrabold leading-tight">{m.short}</p>
                    <p className="mt-1 translate-y-2 text-sm text-cream/80 opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">{m.tagline}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amberLight">Explore <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" /></span>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

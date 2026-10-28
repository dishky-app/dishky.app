import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Check, X } from "lucide-react";
import { Photo, CountUp, Reveal, Tilt, useInterval } from "../ui/kit.js";
import Art, { artFor } from "../ui/Art.js";
import { bySlug, categories } from "../../data/modules.js";

/** Four-beat story for a module's journey, by the family it belongs to. */
const FAMILY_SCENES = {
  guest: ["p-menu", "order", "cook", "pay"],
  ops: ["order", "cook", "p-food", "serve"],
  book: ["p-double", "bookings", "night", "serve"],
  people: ["p-access", "staff", "serve", "p-cash"],
  growth: ["post-spotlight", "post-collab", "post-offer", "analytics"],
};
const OVERRIDES = {
  kitchen: ["order", "cook", "p-food", "serve"],
  payments: ["order", "serve", "p-bill", "pay"],
  inventory: ["p-stock", "inventory", "cook", "analytics"],
  analytics: ["order", "pay", "analytics", "p-branches"],
  branches: ["p-branches", "analytics", "p-access", "platform"],
  "back-office": ["backoffice", "p-access", "staff", "analytics"],
  loyalty: ["order", "b-guests", "post-offer", "pay"],
};
export function journeyScenes(slug) {
  if (OVERRIDES[slug]) return OVERRIDES[slug];
  const c = categories.find((x) => x.slugs.includes(slug));
  return FAMILY_SCENES[c ? c.id : "ops"];
}

/** Photo that drifts slower than the page (parallax), inside its own box. */
export function ParallaxPhoto({ src, art, className = "", strength = 80 }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-strength, strength]);
  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <motion.div style={{ y }} className="absolute -inset-x-0 -inset-y-[90px]">
        <Photo src={src} art={art} className="h-full w-full" />
      </motion.div>
    </div>
  );
}

/** Tabs on the left, a scene on the right. Auto-advances until the visitor takes over. */
export function FeatureExplorer({ module: m }) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  useInterval(() => setI((v) => (v + 1) % m.features.length), 4200, auto);
  const F = m.features[i];
  const photos = m.journey.map((j) => j.photo);
  const scenes = journeyScenes(m.slug);
  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <ul className="space-y-2" role="tablist" aria-label={`${m.name} features`}>
        {m.features.map((f, k) => (
          <li key={f.title}>
            <button
              type="button"
              role="tab"
              aria-selected={k === i}
              onClick={() => { setAuto(false); setI(k); }}
              className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border p-4 text-left transition-all duration-500 ${
                k === i ? "border-amber/60 bg-white shadow-[0_20px_40px_-20px_rgba(243,55,22,0.45)]" : "border-ink/10 bg-white/60 hover:bg-white"
              }`}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-500 ${k === i ? "bg-amber text-white" : "bg-ink/5 text-ink/60"}`}>
                <f.icon size={20} />
              </span>
              <span className="font-display text-base font-bold text-ink">{f.title}</span>
              {k === i && auto && (
                <span key={i} className="dk-progress absolute inset-x-0 bottom-0 h-0.5 origin-left bg-amber" style={{ animationDuration: "4.2s" }} />
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className="relative min-h-[320px] overflow-hidden rounded-3xl bg-ink lg:min-h-[420px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <Photo src={photos[i % photos.length]} art={scenes[i % scenes.length]} className="h-full w-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10" />
          </motion.div>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div
            key={"c" + i}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/15 bg-black/55 p-5 text-cream"
          >
            <F.icon className="text-amber" size={26} />
            <p className="mt-3 font-display text-2xl font-extrabold">{F.title}</p>
            <p className="mt-1 text-sm text-cream/70">{F.tip}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** A day with the module: photo cards joined by a line that draws itself. */
export function Journey({ module: m }) {
  const scenes = journeyScenes(m.slug);
  return (
    <div className="relative">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ "--n": m.journey.length }}>
        {m.journey.map((s, k) => (
          <Reveal key={s.title} delay={k * 0.1}>
            <Tilt>
              <div className="group relative h-72 overflow-hidden rounded-3xl border border-white/10">
                <Photo src={s.photo} art={scenes[k % scenes.length]} className="absolute inset-0" zoom />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <span className="absolute left-4 top-4 font-display text-5xl font-extrabold text-white/20">{String(k + 1).padStart(2, "0")}</span>
                <div className="absolute inset-x-0 bottom-0 p-5 text-cream">
                  <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-12">
                    <s.icon size={20} />
                  </span>
                  <p className="font-display text-xl font-bold">{s.title}</p>
                </div>
              </div>
            </Tilt>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/** A photo band with big counting numbers. */
export function StatsBand({ module: m }) {
  return (
    <section data-nav-theme="dark" className="relative overflow-hidden bg-ink text-cream">
      <ParallaxPhoto src={m.photo} art={artFor[m.slug]} className="absolute inset-0 opacity-50" strength={60} />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/60 to-ink/85" />
      <div className="container-dishky relative grid gap-8 py-20 text-center md:grid-cols-3 md:py-28">
        {m.stats.map((s) => (
          <Reveal key={s.label}>
            <p className="font-display text-6xl font-extrabold text-amber md:text-7xl">
              <CountUp to={s.to} suffix={s.suffix} />
            </p>
            <p className="mt-2 text-sm text-cream/70">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/** Switch between "typical app" and "Dishky" and watch the rows change. */
export function GapCompare({ module: m }) {
  const [dk, setDk] = useState(true);
  return (
    <div>
      <div className="mx-auto flex w-fit items-center gap-1 rounded-full bg-ink/5 p-1" role="group" aria-label="Compare">
        {[["Typical app", false], ["Dishky", true]].map(([l, v]) => (
          <button
            key={l}
            type="button"
            onClick={() => setDk(v)}
            aria-pressed={dk === v}
            className={`min-h-[44px] rounded-full px-6 text-sm font-bold transition-all duration-500 ${dk === v ? (v ? "bg-amber text-white shadow-lg" : "bg-ink text-white") : "text-ink/50"}`}
          >
            {l}
          </button>
        ))}
      </div>
      <ul className="mx-auto mt-8 max-w-2xl space-y-3">
        {m.gaps.map(([bad, good], k) => (
          <motion.li
            key={good}
            layout
            className={`flex items-center gap-4 rounded-2xl border p-5 transition-colors duration-500 ${dk ? "border-amber/30 bg-white" : "border-ink/10 bg-ink/[0.03]"}`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${dk ? "bg-[#e4290c]" : "bg-ink/40"}`}>
              {dk ? <Check size={18} /> : <X size={18} />}
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={dk ? "g" : "b"}
                initial={{ opacity: 0, x: dk ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, delay: k * 0.05 }}
                className={`font-display text-base font-bold md:text-lg ${dk ? "text-ink" : "text-ink/45 line-through decoration-ink/30"}`}
              >
                {dk ? good : bad}
              </motion.span>
            </AnimatePresence>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/** Cards that link to related modules. */
export function RelatedModules({ slugs }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {slugs.map((s) => {
        const r = bySlug[s];
        if (!r) return null;
        return (
          <Reveal key={s}>
            <Link to={r.path} className="group relative block h-64 overflow-hidden rounded-3xl">
              <Photo src={r.photo} art={artFor[s]} className="absolute inset-0" zoom />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-cream">
                <r.icon size={22} className="text-amber" />
                <p className="mt-2 font-display text-xl font-extrabold">{r.name}</p>
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-cream/70 transition-all duration-500 group-hover:gap-3 group-hover:text-amberLight">
                  Explore <ArrowRight size={14} />
                </p>
              </div>
            </Link>
          </Reveal>
        );
      })}
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useScroll } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BLOCKS, PREF, TONE, isDark } from "./PageBlocks.js";
import { RED } from "./PageHeroes.js";
import { Photo } from "../ui/kit.js";
import { artFor } from "../ui/Art.js";

const EASE = [0.22, 1, 0.36, 1];
const ALT = { light: "white", white: "beige", beige: "light", dark: "color", color: "dark" };

/** Short names for navigation chrome (index, tabs, dots). */
const LABEL = { rail: "Journey", flow: "Pipeline", tickets: "On the line", calendar: "Dates", ledger: "Statement", wheel: "Index", stack: "Inside", chat: "Moments", bars: "Change log", compare: "Difference", spotlight: "Spec sheet", timeline: "Roles", rings: "Pays off", gallery: "Pictures", uses: "Built for", steps: "Taps", faq: "Questions", extra: "Routine" };
const label = (b) => LABEL[b] || b;

/** Section backgrounds for the linear frame: neighbours never match. */
export function linearTones(blocks) {
  let prev = "";
  return blocks.map((b) => {
    let t = b === "gallery" ? "white" : PREF[b] || "light";
    if (t === prev && b !== "gallery") t = ALT[t];
    prev = t;
    return t;
  });
}

/** Non-linear frames cannot hold the full-bleed scroll rail or the WebGL gallery. */
export function forFrame(blocks, frame) {
  if (frame === "linear") return blocks;
  const out = [];
  blocks.forEach((b) => {
    if (b === "rail") { if (!blocks.includes("timeline") && !out.includes("timeline")) out.push("timeline"); return; }
    if (b === "gallery") { if (!blocks.includes("spotlight") && !out.includes("spotlight")) out.push("spotlight"); return; }
    out.push(b);
  });
  return out;
}

const panelTone = (b) => ({ light: "white", white: "white", beige: "beige", dark: "dark", color: "color" }[PREF[b] || "white"]);
const Panel = ({ b, m, i = 0, className = "", style }) => {
  const t = panelTone(b);
  const Block = BLOCKS[b];
  return (
    <div data-panel className={`sk-card overflow-hidden ${t === "color" ? "" : TONE[t]} ${className}`} style={{ ...(t === "color" ? { background: "#0a0a0a", color: "#ffffff" } : {}), ...style }} data-nav-theme={isDark(t) ? "dark" : undefined}>
      <Block m={m} tone={t} embed />
    </div>
  );
};

/* ------------------------------------------------------------- 1. linear */
function Linear({ m, blocks }) {
  const tones = linearTones(blocks);
  return <>{blocks.map((b, i) => { const B = BLOCKS[b]; return <B key={b} m={m} tone={tones[i]} />; })}</>;
}

/* ------------------------------------------------------------- 2. sidebar */
function Sidebar({ m, blocks }) {
  const [on, setOn] = useState(blocks[0]);
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setOn(e.target.dataset.b)), { rootMargin: "-35% 0px -55% 0px" });
    document.querySelectorAll("[data-b]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [blocks]);
  return (
    <section className="bg-white" style={{ paddingBlock: "var(--section-space-tight)" }}>
      <div className="container-dishky grid gap-8 lg:grid-cols-[190px_1fr] lg:gap-12">
        <nav aria-label="On this page" className="hidden self-start lg:sticky lg:top-32 lg:block">
          <ul className="relative space-y-1 border-l-2 border-ink/10">
            {blocks.map((b, i) => (
              <li key={b}>
                <a href={`#sec-${b}`} className={`relative -ml-[2px] block border-l-2 py-2 pl-4 font-display text-sm font-bold transition-all ${on === b ? "border-amber text-ink" : "border-transparent text-ink/45 hover:text-ink"}`}>
                  <span className="mr-2 font-mono text-[10px] opacity-60">{String(i + 1).padStart(2, "0")}</span>{label(b)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-6">
          {blocks.map((b, i) => (
            <motion.div key={b} id={`sec-${b}`} data-b={b} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.7, ease: EASE }} className="scroll-mt-28">
              <Panel b={b} m={m} i={i} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- 3. tabs */
function Tabs({ m, blocks }) {
  const [i, setI] = useState(0);
  const b = blocks[i];
  return (
    <section className="bg-ink text-cream" data-nav-theme="dark" style={{ paddingBlock: "var(--section-space-tight)" }}>
      <div className="container-dishky">
        <div role="tablist" className="sk-card mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.06] p-1.5">
          {blocks.map((x, k) => (
            <button key={x} role="tab" aria-selected={k === i} onClick={() => setI(k)} className="relative shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 font-display text-sm font-bold">
              {k === i && <motion.span layoutId={`tab-${m.slug}`} className="absolute inset-0 rounded-xl" style={{ background: RED }} transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
              <span className="relative">{label(x)}</span>
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={b} initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.45, ease: EASE }}>
            <Panel b={b} m={m} />
          </motion.div>
        </AnimatePresence>
        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => setI((v) => (v + blocks.length - 1) % blocks.length)} className="inline-flex items-center gap-2 font-display text-sm font-bold opacity-70 hover:opacity-100"><ArrowLeft size={16} />{label(blocks[(i + blocks.length - 1) % blocks.length])}</button>
          <span className="font-mono text-xs opacity-50">{i + 1} / {blocks.length}</span>
          <button onClick={() => setI((v) => (v + 1) % blocks.length)} className="inline-flex items-center gap-2 font-display text-sm font-bold opacity-70 hover:opacity-100">{label(blocks[(i + 1) % blocks.length])}<ArrowRight size={16} /></button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- 4. bento */
function Bento({ m, blocks }) {
  const spans = ["lg:col-span-6", "lg:col-span-3", "lg:col-span-3", "lg:col-span-3", "lg:col-span-3", "lg:col-span-6", "lg:col-span-6"];
  return (
    <section className="bg-beige" style={{ paddingBlock: "var(--section-space-tight)" }}>
      <div className="container-dishky grid gap-4 lg:grid-cols-6 lg:gap-5">
        {blocks.map((b, i) => (
          <motion.div key={b} initial={{ opacity: 0, scale: 0.94, y: 40 }} whileInView={{ opacity: 1, scale: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.7, delay: (i % 2) * 0.1, ease: EASE }} className={`min-w-0 ${spans[i % spans.length]}`}>
            <Panel b={b} m={m} className="h-full" />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- 5. spine */
function Spine({ m, blocks }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 40%"] });
  return (
    <section className="overflow-x-clip bg-white" style={{ paddingBlock: "var(--section-space-tight)" }}>
      <div ref={ref} className="container-dishky relative">
        <div aria-hidden="true" className="absolute bottom-0 left-4 top-0 w-1 bg-ink/10 lg:left-1/2 lg:-translate-x-1/2" />
        <motion.div aria-hidden="true" className="absolute bottom-0 left-4 top-0 w-1 origin-top lg:left-1/2 lg:-translate-x-1/2" style={{ background: RED, scaleY: scrollYProgress }} />
        <div className="space-y-10 lg:space-y-[-4rem]">
          {blocks.map((b, i) => (
            <motion.div key={b} initial={{ opacity: 0, x: i % 2 ? 60 : -60 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.8, ease: EASE }} className={`relative pl-12 lg:w-[47%] lg:pl-0 ${i % 2 ? "lg:ml-auto" : ""}`}>
              <span className={`absolute left-0 top-6 flex h-9 w-9 items-center justify-center rounded-full font-display text-xs font-extrabold text-white lg:left-auto ${i % 2 ? "lg:-left-[8.5%]" : "lg:-right-[8.5%]"}`} style={{ background: RED }}>{i + 1}</span>
              <Panel b={b} m={m} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- 6. chapters */
function Chapters({ m, blocks }) {
  return (
    <section className="bg-white">
      {blocks.map((b, i) => {
        const t = panelTone(b);
        const dark = isDark(t);
        return (
          <div key={b} data-nav-theme={dark ? "dark" : undefined} className={`relative border-t-4 ${t === "color" ? "" : TONE[t]}`} style={{ borderColor: dark ? "#ffffff" : "#000000", ...(t === "color" ? { background: "#0a0a0a", color: "#ffffff" } : {}) }}>
            <div className="container-dishky grid gap-2 lg:grid-cols-[9rem_1fr]">
              <div className="pt-6 lg:sticky lg:top-28 lg:self-start lg:pt-10">
                <p className="font-display font-extrabold leading-none" style={{ fontSize: "clamp(4rem, 10vw, 7.5rem)", color: "transparent", WebkitTextStroke: `2px ${dark ? "#ffffff" : RED}` }}>{String(i + 1).padStart(2, "0")}</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] opacity-60">{label(b)}</p>
              </div>
              <div className="min-w-0">{(() => { const B = BLOCKS[b]; return <B m={m} tone={t} embed />; })()}</div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

/* ------------------------------------------------------------- 7. magazine */
function Magazine({ m, blocks }) {
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
  return (
    <section className="bg-white text-ink" style={{ paddingBlock: "var(--section-space-tight)" }}>
      <div className="container-dishky max-w-4xl">
        <motion.p initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE }} className="mx-auto max-w-2xl text-center font-serif text-3xl leading-snug md:text-5xl">“{m.short}”</motion.p>
        <div className="mt-14 space-y-16">
          {blocks.map((b, i) => (
            <motion.article key={b} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.8, ease: EASE }}>
              <div className="mb-4 flex items-center gap-4"><span className="font-serif text-2xl text-amber">{roman[i]}.</span><motion.span initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, ease: EASE }} className="h-px flex-1 origin-left bg-ink/40" /><span className="text-[11px] font-bold uppercase tracking-[0.25em] text-ink/50">{label(b)}</span></div>
              <Panel b={b} m={m} />
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- 8. split */
function Split({ m, blocks }) {
  return (
    <section className="bg-white" style={{ paddingBlock: "var(--section-space-tight)" }}>
      <div className="container-dishky grid gap-6 lg:grid-cols-[0.42fr_1fr] lg:gap-10">
        <aside className="relative hidden self-start lg:sticky lg:top-28 lg:block">
          <div className="sk-card relative h-[70vh] min-h-[420px] overflow-hidden rounded-[2rem] bg-ink">
            <Photo src={m.photo} art={artFor[m.slug]} className="absolute inset-0 contrast-125" zoom />
            <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 30%, ${RED}dd)` }} />
            <p className="absolute bottom-6 left-6 right-6 font-display text-3xl font-extrabold leading-tight text-white">{m.short}</p>
            <span className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-white" style={{ color: RED }}><m.icon size={22} /></span>
          </div>
        </aside>
        <div className="min-w-0 space-y-6">
          {blocks.map((b, i) => (
            <motion.div key={b} initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.7, ease: EASE }}><Panel b={b} m={m} /></motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- 9. carousel */
function Carousel({ m, blocks }) {
  const ref = useRef(null);
  const [i, setI] = useState(0);
  const go = (k) => {
    const el = ref.current;
    if (!el) return;
    const n = Math.max(0, Math.min(blocks.length - 1, k));
    el.children[n].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setI(n);
  };
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const c = el.scrollLeft + el.clientWidth / 2;
    let best = 0, d = 1e9;
    [...el.children].forEach((ch, k) => { const dd = Math.abs(ch.offsetLeft + ch.offsetWidth / 2 - c); if (dd < d) { d = dd; best = k; } });
    setI(best);
  };
  return (
    <section className="overflow-x-clip bg-beige" style={{ paddingBlock: "var(--section-space-tight)" }}>
      <div className="container-dishky mb-5 flex items-center justify-between gap-4">
        <div className="flex gap-2">{blocks.map((b, k) => <button key={b} aria-label={label(b)} onClick={() => go(k)} className="h-2.5 rounded-full transition-all" style={{ width: k === i ? 44 : 10, background: k === i ? RED : "rgba(0,0,0,.2)" }} />)}</div>
        <div className="flex gap-2">
          <button aria-label="Previous" onClick={() => go(i - 1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/20 bg-white hover:bg-ink hover:text-white"><ArrowLeft size={18} /></button>
          <button aria-label="Next" onClick={() => go(i + 1)} className="flex h-11 w-11 items-center justify-center rounded-full text-white" style={{ background: RED }}><ArrowRight size={18} /></button>
        </div>
      </div>
      <div ref={ref} onScroll={onScroll} className="flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-[var(--page-gutter)] pb-4 md:gap-6 md:px-[max(var(--page-gutter),calc((100vw-var(--container-max))/2))]" style={{ scrollbarWidth: "none" }}>
        {blocks.map((b) => (
          <div key={b} className="w-[92vw] max-w-[980px] shrink-0 snap-center md:w-[82vw]"><Panel b={b} m={m} /></div>
        ))}
      </div>
    </section>
  );
}

export const FRAMES = { linear: Linear, sidebar: Sidebar, tabs: Tabs, bento: Bento, spine: Spine, chapters: Chapters, magazine: Magazine, split: Split, carousel: Carousel };

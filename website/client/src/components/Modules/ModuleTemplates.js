import React, { useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Check, CheckCircle2, Quote, UserRound, Calendar, Settings2, Rocket } from "lucide-react";
import { Demo } from "../demos/index.js";
import { Photo, CountUp, Reveal, useInterval } from "../ui/kit.js";
import { moduleExtras } from "../../data/moduleExtras.js";
import { journeyScenes, GapCompare } from "./ModuleBlocks.js";
import { ModuleFaq } from "./ModuleMore.js";
import ModuleGallery from "./ModuleGallery.js";
import Title from "./ModuleTitle.js";

/** Readable text colour on top of a module's accent colour. */
function onColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? "#0a0a0a" : "#ffffff";
}
const pad = (i) => String(i + 1).padStart(2, "0");
const sec = { paddingBlock: "var(--section-space-tight)" };
const STEPS = (m) => [
  [Calendar, "Book a demo", `See ${m.name} on your own menu and floor.`],
  [Settings2, "We set it up", "Your team is onboarded with your dishes, tables and roles."],
  [Rocket, "Go live", "Open the doors, with help on hand for the first week."],
];

/* ------------------------------------------------------------------ GUEST */
/** Guest modules: soft, phone-first. Stacking cards, a swipe story, bubbles. */
export function GuestBody({ m, alt }) {
  const x = moduleExtras[m.slug];
  const fg = onColor(m.color);
  const scenes = journeyScenes(m.slug);
  return (
    <>
      <section className="bg-cream" style={sec}>
        <div className="container-dishky grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-14">
          <div className={`self-start lg:sticky lg:top-32 ${alt ? "lg:order-2" : ""}`}>
            <Title left eyebrow="What guests get">Everything inside, one card at a time.</Title>
            <p className="text-lead -mt-6 mb-6 max-w-sm text-ink/60">{m.short}</p>
            <div className="hidden items-center gap-2 lg:flex">
              {m.features.map((f, i) => <span key={f.title} className="h-1.5 w-8 rounded-full" style={{ background: m.color, opacity: 0.25 + (i / m.features.length) * 0.75 }} />)}
            </div>
          </div>
          <div className="space-y-5">
            {m.features.map((f, i) => (
              <div key={f.title} className="rounded-[2rem] border border-ink/10 p-7 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.35)] md:p-9 lg:sticky" style={{ top: `calc(var(--header-clearance) + ${i * 18}px)`, backgroundColor: "#ffffff", backgroundImage: `linear-gradient(135deg, ${m.color}22, #ffffff 65%)` }}>
                <div className="flex items-start justify-between gap-4">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: m.color, color: fg }}><f.icon size={26} /></span>
                  <span className="font-display text-5xl font-extrabold" style={{ color: `${m.color}55` }}>{pad(i)}</span>
                </div>
                <h3 className="mt-6 font-display text-2xl font-extrabold text-ink md:text-3xl">{f.title}</h3>
                <p className="mt-2 max-w-md text-base leading-relaxed text-ink/65">{f.tip}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-white" style={sec}>
        <div className="container-dishky"><Title eyebrow="The guest's day" sub="Swipe through it.">A story, one screen at a time.</Title></div>
        <div className="container-dishky">
          <div className="-mx-[var(--page-gutter)] flex snap-x snap-mandatory gap-4 overflow-x-auto px-[var(--page-gutter)] pb-6 [scrollbar-width:none] lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-12 [&::-webkit-scrollbar]:hidden">
            {m.journey.map((s, k) => (
              <Reveal key={s.title} delay={k * 0.08} className={`w-[68vw] max-w-[300px] shrink-0 snap-center lg:w-auto lg:max-w-none lg:flex-1 ${k % 2 ? "lg:translate-y-10" : ""}`}>
                <div className="group relative aspect-[3/4] overflow-hidden rounded-[2rem] border-[6px] border-ink shadow-xl">
                  <Photo src={s.photo} art={scenes[k % scenes.length]} className="absolute inset-0" zoom />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                  <span className="absolute left-1/2 top-2 h-1.5 w-14 -translate-x-1/2 rounded-full bg-black/60" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-cream">
                    <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: m.color, color: fg }}><s.icon size={18} /></span>
                    <p className="font-display text-lg font-bold">{s.title}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section style={{ ...sec, background: "#0a0a0a", color: "#ffffff" }}>
        <div className="container-dishky grid gap-8 text-center md:grid-cols-3">
          {m.stats.map((s) => (
            <Reveal key={s.label}>
              <p className="font-display text-7xl font-extrabold leading-none md:text-8xl"><CountUp to={s.to} suffix={s.suffix} /></p>
              <p className="mt-3 text-sm font-semibold opacity-80">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {m.extra && (
        <section className="bg-beige" style={sec}>
          <div className="container-dishky"><Title>Try the routine.</Title><div className="mx-auto max-w-2xl"><Demo name={m.extra} /></div></div>
        </section>
      )}

      <section className="overflow-x-clip bg-white" style={{ paddingTop: "var(--section-space-tight)" }}>
        <div className="container-dishky"><Title>The story, in pictures.</Title></div>
        <ModuleGallery module={m} />
      </section>

      <section className="bg-cream" style={sec}>
        <div className="container-dishky"><Title>What others miss.</Title><GapCompare module={m} /></div>
      </section>

      {x && (
        <section className="bg-beige" style={sec}>
          <div className="container-dishky">
            <Title sub="Real moments where it earns its place.">Overheard in a restaurant.</Title>
            <div className="mx-auto max-w-3xl space-y-5">
              {x.uses.map(([who, text], i) => (
                <Reveal key={who} x={i % 2 ? 40 : -40} y={0} className={`flex ${i % 2 ? "justify-end" : ""}`}>
                  <div className={`max-w-[88%] rounded-[1.75rem] px-6 py-5 md:max-w-[75%] ${i % 2 ? "rounded-br-md text-right" : "rounded-bl-md bg-white"}`} style={i % 2 ? { background: m.color, color: fg } : undefined}>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-60">{who}</p>
                    <p className="mt-1 font-display text-lg font-semibold leading-snug">{text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-white" style={sec}>
        <div className="container-dishky">
          <Title>Live in three taps.</Title>
          <ol className="mx-auto flex max-w-4xl flex-col items-stretch gap-3 md:flex-row md:items-center">
            {STEPS(m).map(([Icon, t, d], i) => (
              <React.Fragment key={t}>
                <li className="flex-1 rounded-full border border-ink/10 bg-cream px-6 py-4 text-center">
                  <Icon size={20} className="mx-auto" style={{ color: m.color }} />
                  <p className="mt-1 font-display text-base font-bold">{t}</p>
                  <p className="text-xs text-ink/55">{d}</p>
                </li>
                {i < 2 && <ArrowRight className="mx-auto shrink-0 rotate-90 text-ink/30 md:rotate-0" size={20} />}
              </React.Fragment>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-cream" style={sec}>
        <div className="container-dishky"><Title>Questions, answered.</Title><ModuleFaq module={m} /></div>
      </section>
    </>
  );
}

/* -------------------------------------------------------------------- OPS */
function LiveLog({ m }) {
  const [n, setN] = useState(3);
  useInterval(() => setN((v) => v + 1), 1800, true);
  const rows = Array.from({ length: 6 }, (_, k) => {
    const idx = n - k;
    const f = m.features[((idx % m.features.length) + m.features.length) % m.features.length];
    const s = (idx * 7) % 60;
    return { key: idx, t: `19:${String(40 + ((idx * 3) % 20)).padStart(2, "0")}:${String(s).padStart(2, "0")}`, f };
  });
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 font-display text-xs text-cream/70">
      <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-cream/40"><span className="h-2 w-2 animate-pulse rounded-full bg-[#e4290c]" /> live event stream</p>
      <ul className="space-y-1.5">
        {rows.map((r, k) => (
          <li key={r.key} className="flex gap-3" style={{ opacity: 1 - k * 0.15 }}>
            <span className="text-cream/35">{r.t}</span>
            <span className="truncate" style={{ color: k === 0 ? m.color : undefined }}>{r.f.title.toLowerCase().replace(/\s+/g, "_")}.ok</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Operations modules: a dark control room. Spec console, pipeline, diff view, tickets. */
export function OpsBody({ m }) {
  const x = moduleExtras[m.slug];
  const lineRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: lineRef, offset: ["start 80%", "end 55%"] });
  const scale = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const scenes = journeyScenes(m.slug);
  return (
    <>
      <section data-nav-theme="dark" className="bg-[#0d0d0d] text-cream" style={sec}>
        <div className="container-dishky">
          <Title dark left eyebrow="Spec sheet">Every function, on one console.</Title>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              {m.features.map((f, i) => (
                <Reveal key={f.title} delay={i * 0.05} y={14} as="li">
                  <div className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-4 transition-colors hover:bg-white/[0.05] md:px-6">
                    <span className="font-display text-xs text-cream/35">FN-{pad(i)}</span>
                    <span className="flex items-center gap-2 font-display text-base font-bold md:text-lg"><f.icon size={16} style={{ color: m.color }} />{f.title}</span>
                    <span className="flex items-center gap-1.5 font-display text-[10px] font-bold uppercase tracking-widest text-[#e4290c]"><span className="h-1.5 w-1.5 rounded-full bg-[#e4290c]" />live</span>
                    <span />
                    <p className="col-span-2 text-sm text-cream/55">{f.tip}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
            <div className="space-y-4 self-start lg:sticky lg:top-28">
              <LiveLog m={m} />
              <div className="grid grid-cols-3 gap-3 font-display">
                {m.stats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/10 p-3 text-center">
                    <p className="text-xl font-bold" style={{ color: m.color }}><CountUp to={s.to} suffix={s.suffix} /></p>
                    <p className="mt-1 text-[10px] leading-tight text-cream/45">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section data-nav-theme="dark" className="bg-ink text-cream" style={sec}>
        <div className="container-dishky">
          <Title dark left eyebrow="Pipeline">From first signal to done.</Title>
          <div ref={lineRef} className="relative">
            <div className="absolute left-[22px] top-0 h-full w-px bg-white/10 lg:left-0 lg:top-[34px] lg:h-px lg:w-full" />
            <motion.div className="absolute left-[22px] top-0 h-full w-px origin-top lg:hidden" style={{ background: m.color, scaleY: scale }} />
            <motion.div className="absolute left-0 top-[34px] hidden h-px w-full origin-left lg:block" style={{ background: m.color, scaleX: scale }} />
            <ol className="relative grid gap-8 lg:grid-cols-[repeat(var(--n),minmax(0,1fr))] lg:gap-6" style={{ "--n": m.journey.length }}>
              {m.journey.map((s, k) => (
                <Reveal key={s.title} delay={k * 0.1} as="li" className="relative pl-14 lg:pl-0 lg:pt-14">
                  <span className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full border-2 bg-ink font-display text-sm font-bold lg:top-3" style={{ borderColor: m.color, color: m.color }}>{k + 1}</span>
                  <div className="group relative h-40 overflow-hidden rounded-2xl border border-white/10 lg:h-44">
                    <Photo src={s.photo} art={scenes[k % scenes.length]} className="absolute inset-0" zoom />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
                    <p className="absolute bottom-3 left-4 font-display text-lg font-bold">{s.title}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {m.extra && (
        <section data-nav-theme="dark" className="bg-[#0d0d0d] text-cream" style={sec}>
          <div className="container-dishky"><Title dark>Run the routine.</Title><div className="mx-auto max-w-2xl"><Demo name={m.extra} /></div></div>
        </section>
      )}

      <section data-nav-theme="dark" className="bg-ink text-cream" style={sec}>
        <div className="container-dishky">
          <Title dark left eyebrow="Change log">What changes the day you switch.</Title>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 font-display text-sm">
            {m.gaps.map(([bad, good], i) => (
              <Reveal key={good} delay={i * 0.08} y={12}>
                <div className="border-b border-white/5 last:border-0">
                  <p className="bg-[#ff5f56]/10 px-4 py-3 text-[#ff8b84]"><span className="mr-3 select-none opacity-60">-</span>{bad}</p>
                  <p className="bg-[#e4290c]/10 px-4 py-3 text-[#f77864]"><span className="mr-3 select-none opacity-60">+</span>{good}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {x && (
        <section className="bg-beige" style={sec}>
          <div className="container-dishky">
            <Title eyebrow="On the line">Tickets from a real shift.</Title>
            <div className="grid gap-5 md:grid-cols-3">
              {x.uses.map(([who, text], i) => (
                <Reveal key={who} delay={i * 0.08} className="h-full">
                  <div className="relative h-full rounded-2xl bg-white p-6 shadow-lg" style={{ borderTop: `6px solid ${m.color}` }}>
                    <p className="font-display text-[11px] font-bold uppercase tracking-widest text-ink/40">Ticket #{String(101 + i)} · {who}</p>
                    <p className="mt-3 border-t border-dashed border-ink/20 pt-3 font-display text-sm leading-relaxed text-ink/75">{text}</p>
                    <p className="mt-4 pb-2 font-display text-[11px] font-bold" style={{ color: m.color }}>● READY</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <section data-nav-theme="dark" className="bg-ink text-cream" style={sec}>
        <div className="container-dishky">
          <Title dark left eyebrow="Deploy">Live in three commands.</Title>
          <div className="rounded-2xl border border-white/10 bg-black/50 p-5 font-display text-sm md:p-8">
            {STEPS(m).map(([, t, d], i) => (
              <Reveal key={t} delay={i * 0.12} y={10}>
                <p className="py-1.5"><span style={{ color: m.color }}>$</span> <span className="font-bold text-cream">{t.toLowerCase().replace(/ /g, "-")}</span> <span className="text-cream/45"># {d}</span></p>
              </Reveal>
            ))}
            <p className="pt-2 text-[#e4290c]">✓ {m.name} is live<span className="ml-1 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-cream/80" /></p>
          </div>
        </div>
      </section>

      <section className="bg-cream" style={sec}>
        <div className="container-dishky"><Title>Questions, answered.</Title><ModuleFaq module={m} /></div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------- BOOK */
const PERF = "radial-gradient(circle at 0 50%, #ffffff 9px, transparent 10px), radial-gradient(circle at 100% 50%, #ffffff 9px, transparent 10px)";

/** Bookings & events: tickets, dates and invitations on warm paper. */
export function BookBody({ m, alt }) {
  const x = moduleExtras[m.slug];
  const fg = onColor(m.color);
  const scenes = journeyScenes(m.slug);
  return (
    <>
      <section className="bg-white" style={sec}>
        <div className="container-dishky">
          <Title eyebrow="Admit one" sub={m.short}>Tear off what you need.</Title>
          <div className={`mx-auto grid gap-5 ${alt ? "max-w-3xl" : "max-w-5xl md:grid-cols-2"}`}>
            {m.features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 2) * 0.1} className="h-full">
                <div className="group relative flex h-full overflow-hidden rounded-2xl bg-white shadow-[0_14px_40px_-22px_rgba(0,0,0,0.4)] transition-transform duration-500 hover:-rotate-1 hover:-translate-y-1">
                  <div className="flex w-24 shrink-0 flex-col items-center justify-center gap-2 py-6" style={{ background: m.color, color: fg }}>
                    <f.icon size={26} />
                    <span className="font-display text-xs font-extrabold tracking-widest opacity-70">NO.{pad(i)}</span>
                  </div>
                  <div className="relative flex-1 border-l-2 border-dashed border-ink/15 p-5 md:p-6" style={{ backgroundImage: PERF, backgroundSize: "100% 100%" }}>
                    <p className="font-display text-xl font-extrabold text-ink">{f.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink/60">{f.tip}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white" style={sec}>
        <div className="container-dishky">
          <Title eyebrow="Save the date">Mark the days that matter.</Title>
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ "--n": m.journey.length }}>
            {m.journey.map((s, k) => (
              <Reveal key={s.title} delay={k * 0.1} as="li">
                <div className="overflow-hidden rounded-2xl border border-ink/10 bg-cream shadow-md">
                  <div className="flex items-baseline justify-between px-4 py-2.5" style={{ background: m.color, color: fg }}>
                    <span className="text-[11px] font-bold uppercase tracking-widest">Day</span>
                    <span className="font-display text-3xl font-extrabold">{pad(k)}</span>
                  </div>
                  <div className="group relative h-40"><Photo src={s.photo} art={scenes[k % scenes.length]} className="absolute inset-0" zoom /></div>
                  <p className="flex items-center gap-2 px-4 py-3 font-display text-base font-bold"><s.icon size={16} style={{ color: m.color }} />{s.title}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-white" style={sec}>
        <div className="container-dishky">
          <Reveal>
            <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl bg-ink text-cream md:grid-cols-[1fr_auto]">
              <div className="grid divide-y divide-dashed divide-white/20 md:grid-cols-3 md:divide-x md:divide-y-0">
                {m.stats.map((s) => (
                  <div key={s.label} className="p-7 text-center md:p-10">
                    <p className="font-display text-6xl font-extrabold md:text-7xl" style={{ color: m.color }}><CountUp to={s.to} suffix={s.suffix} /></p>
                    <p className="mt-2 text-sm text-cream/65">{s.label}</p>
                  </div>
                ))}
              </div>
              <div aria-hidden="true" className="hidden w-24 md:block" style={{ background: "repeating-linear-gradient(90deg,#ffffff 0 2px,transparent 2px 5px,#ffffff 5px 6px,transparent 6px 10px)", opacity: 0.85 }} />
            </div>
          </Reveal>
        </div>
      </section>

      {m.extra && (
        <section className="bg-white" style={sec}>
          <div className="container-dishky"><Title>Try the routine.</Title><div className="mx-auto max-w-2xl"><Demo name={m.extra} /></div></div>
        </section>
      )}

      <section className="bg-white" style={sec}>
        <div className="container-dishky">
          <Title eyebrow="RSVP">Without us, with us.</Title>
          <div className="mx-auto grid max-w-4xl items-stretch gap-5 md:grid-cols-[1fr_auto_1fr]">
            <Reveal x={-30} y={0}>
              <div className="h-full rounded-3xl border border-ink/10 bg-white/60 p-7">
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-ink/40">Before</p>
                <ul className="space-y-4">{m.gaps.map(([bad]) => <li key={bad} className="font-display text-base font-semibold text-ink/45 line-through decoration-ink/30">{bad}</li>)}</ul>
              </div>
            </Reveal>
            <ArrowRight className="mx-auto self-center rotate-90 text-ink/30 md:rotate-0" size={26} />
            <Reveal x={30} y={0}>
              <div className="h-full rounded-3xl p-7 shadow-xl" style={{ background: m.color, color: fg }}>
                <p className="mb-4 text-xs font-bold uppercase tracking-widest opacity-70">With Dishky</p>
                <ul className="space-y-4">{m.gaps.map(([, good]) => <li key={good} className="flex gap-2 font-display text-base font-bold"><Check size={18} className="mt-0.5 shrink-0" />{good}</li>)}</ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {x && (
        <section className="bg-white" style={sec}>
          <div className="container-dishky">
            <Title eyebrow="You are invited">Made for nights like these.</Title>
            <div className="grid gap-6 md:grid-cols-3">
              {x.uses.map(([who, text], i) => (
                <Reveal key={who} delay={i * 0.1} className="h-full">
                  <div className="h-full rounded-[1.25rem] border-2 p-2" style={{ borderColor: `${m.color}66` }}>
                    <div className="flex h-full flex-col items-center rounded-xl border border-ink/10 bg-[#f4f4f4] px-6 py-8 text-center">
                      <span className="mb-3 text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: m.color }}>You are invited</span>
                      <p className="font-serif text-2xl font-semibold text-ink">{who}</p>
                      <span className="my-3 h-px w-10" style={{ background: m.color }} />
                      <p className="text-sm leading-relaxed text-ink/65">{text}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-white" style={sec}>
        <div className="container-dishky">
          <Title>Three steps to the big night.</Title>
          <ol className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
            {STEPS(m).map(([Icon, t, d], i) => (
              <Reveal key={t} delay={i * 0.1} as="li" className="text-center">
                <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed font-display text-3xl font-extrabold" style={{ borderColor: m.color, color: m.color }}>{i + 1}</span>
                <p className="mt-4 flex items-center justify-center gap-2 font-display text-lg font-bold"><Icon size={18} />{t}</p>
                <p className="mt-1 text-sm text-ink/60">{d}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-white" style={sec}>
        <div className="container-dishky"><Title>Questions, answered.</Title><ModuleFaq module={m} /></div>
      </section>
    </>
  );
}

/* ----------------------------------------------------------------- PEOPLE */
const GRID_BG = { backgroundImage: "linear-gradient(rgba(10,10,10,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(10,10,10,0.05) 1px, transparent 1px)", backgroundSize: "36px 36px" };

/** People & management: ledgers, org charts and ID badges on graph paper. */
export function PeopleBody({ m, alt }) {
  const x = moduleExtras[m.slug];
  const fg = onColor(m.color);
  const scenes = journeyScenes(m.slug);
  return (
    <>
      <section className="bg-white" style={{ ...sec, ...GRID_BG }}>
        <div className="container-dishky">
          <Title left eyebrow="The index">What is on the books.</Title>
          <ul className={`grid gap-x-12 ${alt ? "" : "lg:grid-cols-2"}`}>
            {m.features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 2) * 0.08} y={20} as="li">
                <div className="group relative grid grid-cols-[auto_1fr_auto] items-start gap-4 border-t-2 border-ink py-6">
                  <span className="font-display text-4xl font-extrabold leading-none text-ink/15 transition-colors group-hover:text-ink/60">{pad(i)}</span>
                  <div>
                    <p className="font-display text-xl font-extrabold text-ink">{f.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink/60">{f.tip}</p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 transition-all duration-500 group-hover:rotate-12" style={{ color: m.color }}><f.icon size={18} /></span>
                  <span className="absolute -top-[2px] left-0 h-[2px] w-0 transition-all duration-700 group-hover:w-full" style={{ background: m.color }} />
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-white" style={sec}>
        <div className="container-dishky">
          <Title eyebrow="How it is organised">One role leads to the next.</Title>
          <div className="relative">
            <Reveal className="mx-auto mb-0 w-fit"><span className="inline-flex items-center gap-2 rounded-full px-6 py-3 font-display text-base font-extrabold shadow-lg" style={{ background: m.color, color: fg }}><m.icon size={18} />{m.name}</span></Reveal>
            <div className="mx-auto hidden h-8 w-px bg-ink/25 lg:block" />
            <div className="relative">
              <div className="absolute top-0 hidden h-px bg-ink/25 lg:block" style={{ left: `${50 / m.journey.length}%`, right: `${50 / m.journey.length}%` }} />
              <ol className="grid gap-6 border-l border-ink/20 pl-6 sm:grid-cols-2 sm:border-l-0 sm:pl-0 lg:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ "--n": m.journey.length }}>
                {m.journey.map((s, k) => (
                  <Reveal key={s.title} delay={k * 0.1} as="li" className="relative lg:pt-8">
                    <span className="absolute left-1/2 top-0 hidden h-8 w-px bg-ink/25 lg:block" />
                    <div className="group rounded-2xl border border-ink/10 bg-white p-5 text-center shadow-sm transition-shadow hover:shadow-xl">
                      <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full ring-4 ring-white" style={{ boxShadow: `0 0 0 2px ${m.color}` }}>
                        <Photo src={s.photo} art={scenes[k % scenes.length]} className="absolute inset-0" zoom />
                      </div>
                      <p className="mt-3 flex items-center justify-center gap-1.5 font-display text-base font-bold"><s.icon size={15} style={{ color: m.color }} />{s.title}</p>
                    </div>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white" style={{ ...sec, ...GRID_BG }}>
        <div className="container-dishky">
          <Title eyebrow="The statement">The numbers, itemised.</Title>
          <Reveal>
            <div className="mx-auto max-w-2xl rounded-2xl border-2 border-ink bg-white p-6 shadow-[8px_8px_0_0_#0a0a0a] md:p-9">
              <p className="mb-5 flex items-center justify-between border-b-2 border-ink pb-3 font-display text-sm font-extrabold uppercase tracking-widest"><span>{m.name}</span><span style={{ color: m.color }}>Summary</span></p>
              {m.stats.map((s) => (
                <div key={s.label} className="flex items-baseline gap-3 py-2.5">
                  <span className="text-sm font-semibold text-ink/75 md:text-base">{s.label}</span>
                  <span className="flex-1 translate-y-[-3px] border-b-2 border-dotted border-ink/25" />
                  <span className="font-display text-3xl font-extrabold md:text-4xl"><CountUp to={s.to} suffix={s.suffix} /></span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {m.extra && (
        <section className="bg-white" style={sec}>
          <div className="container-dishky"><Title>Try the routine.</Title><div className="mx-auto max-w-2xl"><Demo name={m.extra} /></div></div>
        </section>
      )}

      <section className="bg-white" style={sec}>
        <div className="container-dishky">
          <Title eyebrow="Reconciled">Before and after.</Title>
          <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border-2 border-ink bg-white">
            <div className="grid grid-cols-2 border-b-2 border-ink bg-ink text-xs font-bold uppercase tracking-widest text-cream"><p className="px-5 py-3">Without</p><p className="px-5 py-3" style={{ color: m.color }}>With Dishky</p></div>
            {m.gaps.map(([bad, good], i) => (
              <Reveal key={good} delay={i * 0.08} y={10}>
                <div className="grid grid-cols-2 border-b border-ink/10 last:border-0">
                  <p className="border-r border-ink/10 px-5 py-4 text-sm text-ink/45 line-through">{bad}</p>
                  <p className="px-5 py-4 text-sm font-bold text-ink">{good}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {x && (
        <section className="bg-white" style={{ ...sec, ...GRID_BG }}>
          <div className="container-dishky">
            <Title eyebrow="Team badges">Who it is built for.</Title>
            <div className="grid gap-8 md:grid-cols-3">
              {x.uses.map(([who, text], i) => (
                <Reveal key={who} delay={i * 0.1} className="h-full">
                  <div className="relative h-full rounded-2xl border border-ink/15 bg-white px-6 pb-7 pt-10 text-center shadow-lg">
                    <span className="absolute left-1/2 top-3 h-2 w-12 -translate-x-1/2 rounded-full bg-ink/15" />
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `${m.color}22`, color: m.color }}><UserRound size={28} /></span>
                    <p className="mt-3 font-display text-xl font-extrabold">{who}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-widest" style={{ color: m.color }}>ID {String(2041 + i)}</p>
                    <p className="mt-3 text-sm leading-relaxed text-ink/65">{text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-white" style={sec}>
        <div className="container-dishky">
          <Title eyebrow="Onboarding checklist">Tick these three off.</Title>
          <ul className="mx-auto max-w-2xl space-y-3">
            {STEPS(m).map(([, t, d], i) => (
              <Reveal key={t} delay={i * 0.12} x={-24} y={0} as="li">
                <div className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-5">
                  <CheckCircle2 size={28} style={{ color: m.color }} className="shrink-0" />
                  <div><p className="font-display text-lg font-bold">{t}</p><p className="text-sm text-ink/60">{d}</p></div>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-white" style={sec}>
        <div className="container-dishky"><Title>Questions, answered.</Title><ModuleFaq module={m} /></div>
      </section>
    </>
  );
}

/* ----------------------------------------------------------------- GROWTH */
/** Growth & insight: an editorial spread. Huge type, film strip, big claims. */
export function GrowthBody({ m }) {
  const x = moduleExtras[m.slug];
  const fg = onColor(m.color);
  const scenes = journeyScenes(m.slug);
  const [hot, setHot] = useState(0);
  return (
    <>
      <section data-nav-theme="dark" className="bg-ink text-cream" style={sec}>
        <div className="container-dishky">
          <Title dark left eyebrow="Contents">The whole issue, in headlines.</Title>
          <ul className="border-t border-white/15">
            {m.features.map((f, i) => (
              <li key={f.title} onMouseEnter={() => setHot(i)} onFocus={() => setHot(i)} className="relative overflow-hidden border-b border-white/15">
                <div className="absolute inset-0 origin-left transition-transform duration-500" style={{ background: m.color, transform: hot === i ? "scaleX(1)" : "scaleX(0)" }} />
                <div tabIndex={0} className="relative grid items-center gap-x-6 gap-y-1 px-1 py-5 md:grid-cols-[4rem_1fr_minmax(0,22rem)] md:py-7" style={{ color: hot === i ? fg : undefined }}>
                  <span className="font-display text-sm opacity-60">{pad(i)}</span>
                  <p className="font-display text-[clamp(1.9rem,5.5vw,4.5rem)] font-extrabold leading-[1.02] tracking-tight">{f.title}</p>
                  <p className="text-sm leading-relaxed opacity-70">{f.tip}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="overflow-hidden bg-ink py-10 text-cream">
        <div className="container-dishky mb-6"><p className="text-xs font-bold uppercase tracking-[0.22em] text-amberLight">Photo essay</p></div>
        <div className="border-y-[14px] border-black bg-black" style={{ backgroundImage: "repeating-linear-gradient(90deg,#ffffff 0 14px,transparent 14px 34px)", backgroundSize: "100% 8px", backgroundRepeat: "repeat-x", backgroundPosition: "0 0" }}>
          <div className="-mx-0 flex snap-x gap-4 overflow-x-auto rounded-3xl bg-black px-5 py-5 [scrollbar-width:none] md:px-10 [&::-webkit-scrollbar]:hidden">
            {m.journey.concat(m.journey).slice(0, Math.max(m.journey.length, 5)).map((s, k) => (
              <div key={k} className="group relative h-64 w-[78vw] max-w-[420px] shrink-0 snap-center overflow-hidden rounded-md md:h-80">
                <Photo src={s.photo} art={scenes[k % scenes.length]} className="absolute inset-0" zoom />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                <span className="absolute left-3 top-2 font-display text-xs text-cream/70">▶ {pad(k)}A</span>
                <p className="absolute bottom-4 left-4 font-display text-2xl font-extrabold">{s.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-cream" style={sec}>
        <div className="container-dishky grid gap-10 md:grid-cols-3">
          {m.stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.1}>
              <p className="font-display text-[clamp(5rem,13vw,10rem)] font-extrabold leading-[0.85]" style={{ color: "transparent", WebkitTextStroke: `2px ${m.color}` }}><CountUp to={s.to} suffix={s.suffix} /></p>
              <p className="mt-3 max-w-[14rem] border-t-2 border-ink pt-2 text-sm font-semibold text-ink/70">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {m.extra && (
        <section className="bg-white" style={sec}>
          <div className="container-dishky"><Title>Try the routine.</Title><div className="mx-auto max-w-2xl"><Demo name={m.extra} /></div></div>
        </section>
      )}

      <section className="overflow-x-clip bg-white" style={{ paddingTop: "var(--section-space-tight)" }}>
        <div className="container-dishky"><Title>The story, in pictures.</Title></div>
        <ModuleGallery module={m} />
      </section>

      <section className="bg-beige" style={sec}>
        <div className="container-dishky">
          <Title left eyebrow="The difference">Not this. This.</Title>
          <div className="space-y-6 md:space-y-8">
            {m.gaps.map(([bad, good], i) => (
              <Reveal key={good} delay={i * 0.08}>
                <p className="font-display text-[clamp(1.5rem,4vw,3.25rem)] font-extrabold leading-[1.1] text-ink">
                  <span className="text-ink/30 line-through decoration-[3px]" style={{ textDecorationColor: m.color }}>{bad}</span>
                  <ArrowRight className="mx-3 inline-block -translate-y-1" style={{ color: m.color }} />
                  <span className="rounded-md px-2" style={{ background: m.color, color: fg, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{good}</span>
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {x && (
        <section data-nav-theme="dark" className="bg-ink text-cream" style={sec}>
          <div className="container-dishky">
            <Title dark left eyebrow="Pull quotes">Where it pays off.</Title>
            <div className="grid gap-10 md:grid-cols-3">
              {x.uses.map(([who, text], i) => (
                <Reveal key={who} delay={i * 0.1}>
                  <Quote size={36} style={{ color: m.color }} />
                  <p className="mt-3 font-display text-xl font-bold leading-snug md:text-2xl">{text}</p>
                  <p className="mt-4 border-l-4 pl-3 text-sm font-semibold text-cream/60" style={{ borderColor: m.color }}>{who}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <section style={{ ...sec, background: "#0a0a0a", color: "#ffffff" }}>
        <div className="container-dishky">
          <ol className="grid gap-8 md:grid-cols-3">
            {STEPS(m).map(([, t, d], i) => (
              <Reveal key={t} delay={i * 0.1} as="li">
                <p className="font-display text-[clamp(4rem,9vw,7rem)] font-extrabold leading-none opacity-30">{pad(i)}</p>
                <p className="font-display text-2xl font-extrabold">{t}</p>
                <p className="mt-1 text-sm opacity-80">{d}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-cream" style={sec}>
        <div className="container-dishky"><Title>Questions, answered.</Title><ModuleFaq module={m} /></div>
      </section>
    </>
  );
}

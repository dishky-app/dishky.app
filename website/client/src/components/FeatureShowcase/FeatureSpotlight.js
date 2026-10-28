import React, { lazy, Suspense, useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import { Demo } from "../demos/index.js";
import { Photo } from "../ui/kit.js";
import { artFor } from "../ui/Art.js";
import { bySlug } from "../../data/modules.js";
import SpotlightChapters from "./SpotlightChapters.js";
import SpotlightCollage from "./SpotlightCollage.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";

const DriftBackground = lazy(() => import("../CTA/DriftBackground.js"));

/**
 * A full section for one module. Three compositions so the page does not
 * repeat itself:
 *  - "stage":  heading + illustration on top, live demo below
 *  - "split":  sticky illustration + chips beside the live demo
 *  - "banner": full-bleed illustration, a big sliding title, demo floats over it
 * All reveal on scroll (clip-path image wipe, rising demo, sliding title).
 */
function BandSpotlight({ slug, tone = "dark", variant = "stage", flip = false, also = [], index, total, drift = false }) {
  const m = bySlug[slug];
  const sectionRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const dark = tone === "dark";

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || reducedMotion) return undefined;
    const ctx = gsap.context(() => {
      const st = (trigger, start, end, scrub = 0.8) => ({ trigger, start, end, scrub });
      const art = section.querySelector("[data-spot-art]");
      if (art) {
        gsap.fromTo(art, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", ease: "none", scrollTrigger: st(art, "top 92%", "top 45%") });
        gsap.fromTo(art.firstElementChild, { scale: 1.25 }, { scale: 1, ease: "none", scrollTrigger: st(art, "top 95%", "bottom 30%", true) });
      }
      const chips = section.querySelectorAll("[data-spot-chip]");
      if (chips.length) {
        gsap.fromTo(chips, { opacity: 0, y: 36, x: -18 }, { opacity: 1, y: 0, x: 0, ease: "none", stagger: 0.07, scrollTrigger: st(section, "top 70%", "top 30%") });
      }
      const demo = section.querySelector("[data-spot-demo]");
      if (demo) gsap.fromTo(demo, { y: 90, rotateX: 10, scale: 0.94, opacity: 0.15, transformPerspective: 1400, transformOrigin: "50% 100%" }, { y: 0, rotateX: 0, scale: 1, opacity: 1, ease: "none", scrollTrigger: st(demo, "top 98%", "top 45%", 1) });
      const slide = section.querySelector("[data-spot-slide]");
      if (slide) gsap.fromTo(slide, { xPercent: flip ? -25 : 5 }, { xPercent: flip ? 5 : -25, ease: "none", scrollTrigger: st(section, "top bottom", "bottom top", true) });
      const bg = section.querySelector("[data-spot-bg]");
      if (bg) gsap.to(bg, { yPercent: 14, ease: "none", scrollTrigger: st(section, "top bottom", "bottom top", true) });
      section.querySelectorAll("[data-spot-also]").forEach((el, i) => {
        gsap.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, ease: "none", scrollTrigger: st(el, "top 98%", "top 80%") });
      });
    }, section);
    return () => ctx.revert();
  }, [reducedMotion, flip, variant]);

  if (!m) return null;
  const artKind = artFor[slug] || "menu";

  const bgClass = dark ? "bg-ink text-cream" : "bg-beige text-ink";

  const Chips = (
    <ul className="flex flex-wrap gap-2">
      {m.features.slice(0, 7).map((f) => (
        <li key={f.title} data-spot-chip className="group relative">
          <span
            tabIndex={0}
            className={`flex min-h-[40px] cursor-default items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors duration-300 ${
              dark ? "border-white/15 hover:border-amber hover:bg-amber/15 focus-visible:border-amber" : "border-ink/10 bg-white hover:border-amber focus-visible:border-amber"
            }`}
          >
            <f.icon size={14} className="text-amber" /> {f.title}
          </span>
          <span
            role="tooltip"
            className={`pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-52 translate-y-1 rounded-xl p-3 text-xs opacity-0 shadow-xl transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 ${
              dark ? "bg-white text-ink" : "bg-ink text-cream"
            }`}
          >
            {f.tip}
          </span>
        </li>
      ))}
    </ul>
  );

  const Also = also.length > 0 && (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`text-xs font-semibold ${dark ? "text-cream/50" : "text-ink/50"}`}>Also in this family</span>
      {also.map((s) => {
        const o = bySlug[s];
        if (!o) return null;
        return (
          <Link key={s} data-spot-also to={o.path} className={`group flex min-h-[40px] items-center gap-2 rounded-full px-3.5 text-xs font-bold transition-all duration-300 hover:-translate-y-0.5 ${dark ? "bg-white/10 hover:bg-amber" : "bg-ink/5 hover:bg-amber hover:text-white"}`}>
            <o.icon size={14} className="text-amber transition-colors group-hover:text-current" /> {o.name}
          </Link>
        );
      })}
    </div>
  );

  const Title = (
    <>
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber text-white shadow-[0_18px_40px_-10px_rgba(243,55,22,0.7)]">
          <m.icon size={26} />
        </span>
        {index && <span className={`font-display text-sm font-extrabold tabular-nums ${dark ? "text-cream/50" : "text-ink/40"}`}>{String(index).padStart(2, "0")} / {total}</span>}
      </div>
      <SectionHeading title={m.name} dark={dark} />
      <p className={`text-lead mt-3 max-w-xl ${dark ? "text-cream/65" : "text-ink/60"}`}>{m.tagline}</p>
      {m.lacks && <p className="mt-2 font-display text-base font-bold text-amber">{m.lacks}</p>}
    </>
  );

  const Cta = (
    <Link to={m.path} className="btn-primary group">
      Explore {m.name}
      <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
    </Link>
  );

  const side = variant === "split";
  const demoBlock = (
    <div data-spot-demo className="min-w-0">
      <Demo name={m.demo} />
      <p className="mt-3 text-center text-[11px] text-cream/55">Interactive demo with sample data</p>
    </div>
  );

  // Glass panel that sits beside the demo in the "split" layout.
  const Inside = (
    <aside className="rounded-3xl border border-white/15 bg-black/40 p-6 text-cream backdrop-blur-xl md:p-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">What's inside</p>
      <ul className="mt-5 space-y-4">
        {m.features.slice(0, 5).map((f) => (
          <li key={f.title} data-spot-chip className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber"><f.icon size={16} /></span>
            <span>
              <span className="block font-display text-sm font-bold">{f.title}</span>
              <span className="block text-xs leading-relaxed text-cream/60">{f.tip}</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );

  return (
    <section
      ref={sectionRef}
      id={`feature-${slug}`}
      data-feature-rail={m.name}
      data-nav-theme={dark ? "dark" : undefined}
      className={`relative overflow-x-clip ${bgClass} ${drift ? "md:min-h-[100svh]" : ""}`}
      style={{ paddingTop: "var(--section-space)", paddingBottom: drift ? "var(--section-space)" : 0 }}
    >
      {drift && !reducedMotion && (
        <>
          <Suspense fallback={null}><DriftBackground /></Suspense>
          <div className="absolute inset-0 bg-gradient-to-b from-ink/80 via-ink/10 to-ink/80" aria-hidden="true" />
        </>
      )}
      {variant === "banner" && (
        <div data-spot-slide aria-hidden="true" className={`pointer-events-none absolute left-0 top-10 whitespace-nowrap font-display font-extrabold uppercase leading-none ${dark ? "text-white/[0.06]" : "text-ink/[0.05]"}`} style={{ fontSize: "clamp(5rem, 16vw, 15rem)" }}>
          {m.name} · {m.name}
        </div>
      )}

      <div className="container-dishky relative">
        <div className="grid items-end gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
          <div>{Title}</div>
          <div className="space-y-5 lg:justify-self-end lg:pb-2">
            {!side && Chips}
            {Also}
            <div className="pt-1">{Cta}</div>
          </div>
        </div>
      </div>

      {!drift && (
        <div className="relative mt-12 md:mt-16">
          <div data-spot-art className="absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute inset-0 will-change-transform">
              <Photo src={m.photo} art={artKind} artDark className="h-full w-full" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/75" />
          </div>
          <div className="container-dishky relative py-12 md:py-20">
            {side ? (
              <div className={`grid items-center gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-10 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}>
                {demoBlock}
                {Inside}
              </div>
            ) : (
              <div className="mx-auto max-w-5xl">{demoBlock}</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Picks the layout: "split"/"stage"/"banner" = photo band, "chapters" = pinned photo story, "collage" = ticker + drifting photos. */
export default function FeatureSpotlight(props) {
  if (props.variant === "chapters") return <SpotlightChapters {...props} />;
  if (props.variant === "collage") return <SpotlightCollage {...props} />;
  return <BandSpotlight {...props} />;
}

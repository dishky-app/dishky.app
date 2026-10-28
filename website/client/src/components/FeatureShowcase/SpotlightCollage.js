import React, { useLayoutEffect, useRef } from "react";
import { Demo } from "../demos/index.js";
import { bySlug } from "../../data/modules.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import { SpotTitle, SpotAlso, SpotCta } from "./spotlightParts.js";

/**
 * Layout "collage": a huge centred title that rises word by word, a ticker of
 * every feature, then the live demo in the middle that rises into place as you scroll.
 */
export default function SpotlightCollage({ slug, tone = "dark", also = [], index, total }) {
  const m = bySlug[slug];
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const dark = tone === "dark";

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced || !m) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(el.querySelectorAll("[data-word]"), { yPercent: 115, rotate: 4 }, { yPercent: 0, rotate: 0, stagger: 0.1, duration: 1, ease: "power4.out", scrollTrigger: { trigger: el.querySelector("[data-col-title]"), start: "top 80%" } });
      gsap.fromTo(el.querySelectorAll("[data-col-fade]"), { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: el.querySelector("[data-col-title]"), start: "top 70%" } });
      const stage = el.querySelector("[data-col-stage]");
      gsap.fromTo(el.querySelector("[data-col-demo]"), { y: 100, scale: 0.9, rotateX: 12, opacity: 0.2, transformPerspective: 1400 }, { y: 0, scale: 1, rotateX: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: stage, start: "top 95%", end: "top 45%", scrub: 0.8 } });
    }, el);
    return () => ctx.revert();
  }, [reduced, m]);

  if (!m) return null;
  const words = m.name.split(" ");
  const reps = Math.max(1, Math.ceil(8 / m.features.length));
  const base = Array.from({ length: reps }).flatMap(() => m.features);
  const ticker = base.concat(base);

  return (
    <section
      ref={ref}
      id={`feature-${slug}`}
      data-feature-rail={m.name}
      data-nav-theme={dark ? "dark" : undefined}
      className={`relative overflow-x-clip ${dark ? "bg-ink text-cream" : "bg-beige text-ink"}`}
      style={{ paddingBlock: "var(--section-space)" }}
    >
      <div className="container-dishky relative text-center" data-col-title>
        <div data-col-fade className="flex justify-center"><SpotTitle m={m} dark={dark} index={index} total={total} /></div>
        <h2 className="mx-auto mt-6 max-w-5xl font-display text-[clamp(2.75rem,9vw,8rem)] font-extrabold leading-[0.95] tracking-tight">
          {words.map((w, i) => (
            <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
              <span data-word className="inline-block">{w}&nbsp;</span>
            </span>
          ))}
        </h2>
        <p data-col-fade className={`text-lead mx-auto mt-5 max-w-xl ${dark ? "text-cream/65" : "text-ink/60"}`}>{m.tagline}</p>
        {m.lacks && <p data-col-fade className="mt-2 font-display text-base font-bold text-amber">{m.lacks}</p>}
      </div>

      {/* feature ticker */}
      <div className={`dk-marquee relative mt-12 overflow-hidden border-y py-4 md:mt-16 ${dark ? "border-white/10" : "border-ink/10"}`} aria-label="Features">
        <ul className="dk-marquee__track flex w-max gap-3 pr-3">
          {ticker.map((f, i) => (
            <li key={i} aria-hidden={i >= base.length ? "true" : undefined} className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-5 py-2.5 text-sm font-semibold ${dark ? "border-white/15" : "border-ink/10 bg-white"}`}>
              <f.icon size={16} className="text-amber" /> {f.title}
            </li>
          ))}
        </ul>
      </div>

      {/* demo with drifting photo cards */}
      <div data-col-stage className="container-dishky relative mt-14 md:mt-24">
        <div data-col-demo className="relative z-10 mx-auto min-w-0 max-w-4xl">
          <Demo name={m.demo} />
          <p className={`mt-3 text-center text-[11px] ${dark ? "text-cream/40" : "text-ink/40"}`}>Interactive demo with sample data</p>
        </div>
      </div>

      <div className="container-dishky relative mt-12 flex flex-col items-center gap-5 text-center">
        <SpotAlso also={also} dark={dark} />
        <SpotCta m={m} />
      </div>
    </section>
  );
}

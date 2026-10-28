import React, { useLayoutEffect, useRef } from "react";
import { Demo } from "../demos/index.js";
import { Photo } from "../ui/kit.js";
import { artFor } from "../ui/Art.js";
import { bySlug } from "../../data/modules.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import { SpotTitle, SpotAlso, SpotCta } from "./spotlightParts.js";

/**
 * Layout "chapters": a full-height photo pinned to one half of the screen while
 * the other half scrolls through the feature list as numbered chapters. As each
 * chapter passes the middle of the screen it lights up, a progress line fills,
 * and the pinned photo drifts. The live demo closes the section.
 */
export default function SpotlightChapters({ slug, tone = "dark", flip = false, also = [], index, total }) {
  const m = bySlug[slug];
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const dark = tone === "dark";

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced || !m) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(el.querySelector("[data-ch-photo]"), { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", duration: 1.1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 70%" } });
      gsap.fromTo(el.querySelector("[data-ch-img]"), { yPercent: -6, scale: 1.15 }, { yPercent: 6, scale: 1.02, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      gsap.fromTo(el.querySelectorAll("[data-ch-head] > *"), { y: 50, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: el.querySelector("[data-ch-head]"), start: "top 85%" } });
      const list = el.querySelector("[data-ch-list]");
      gsap.fromTo(el.querySelector("[data-ch-bar]"), { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: list, start: "top 60%", end: "bottom 60%", scrub: true } });
      el.querySelectorAll("[data-ch-step]").forEach((step) => {
        gsap.fromTo(step, { opacity: 0.25, x: 40 }, { opacity: 1, x: 0, ease: "none", scrollTrigger: { trigger: step, start: "top 85%", end: "top 55%", scrub: true } });
        gsap.fromTo(step.querySelector("[data-ch-num]"), { scale: 0.6 }, { scale: 1, ease: "none", scrollTrigger: { trigger: step, start: "top 85%", end: "top 55%", scrub: true } });
      });
      gsap.fromTo(el.querySelector("[data-ch-demo]"), { y: 80, opacity: 0.2, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, ease: "none", scrollTrigger: { trigger: el.querySelector("[data-ch-demo]"), start: "top 100%", end: "top 55%", scrub: 0.8 } });
    }, el);
    return () => ctx.revert();
  }, [reduced, m]);

  if (!m) return null;
  const artKind = artFor[slug] || "menu";
  const steps = m.features.slice(0, 5);

  return (
    <section
      ref={ref}
      id={`feature-${slug}`}
      data-feature-rail={m.name}
      data-nav-theme={dark ? "dark" : undefined}
      className={`relative overflow-x-clip ${dark ? "bg-ink text-cream" : "bg-beige text-ink"}`}
    >
      <div className="grid lg:grid-cols-2">
        {/* pinned photo */}
        <div className={`relative h-[55vh] lg:sticky lg:top-0 lg:h-screen ${flip ? "lg:order-2" : ""}`}>
          <div data-ch-photo className="absolute inset-0 overflow-hidden">
            <div data-ch-img className="absolute -inset-y-[8%] inset-x-0 will-change-transform">
              <Photo src={m.photo} art={artKind} artDark className="h-full w-full" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-cream md:p-10">
              <p className="font-display text-[clamp(4rem,10vw,9rem)] font-extrabold leading-none text-white/90">{String(index || 0).padStart(2, "0")}</p>
              <p className="mt-2 font-display text-lg font-bold">{m.name}</p>
            </div>
          </div>
        </div>

        {/* scrolling story */}
        <div className="px-6 py-[var(--section-space)] sm:px-10 lg:px-14 xl:px-24">
          <div data-ch-head className="space-y-5">
            <SpotTitle m={m} dark={dark} index={index} total={total} />
            <h2 className="heading-lg">{m.name}</h2>
            <p className={`text-lead max-w-xl ${dark ? "text-cream/65" : "text-ink/60"}`}>{m.tagline}</p>
            {m.lacks && <p className="font-display text-base font-bold text-amber">{m.lacks}</p>}
          </div>

          <ol data-ch-list className="relative mt-14 space-y-10 pl-10 md:mt-20 md:space-y-14 md:pl-14">
            <span className={`absolute bottom-2 left-[15px] top-2 w-px md:left-[19px] ${dark ? "bg-white/15" : "bg-ink/15"}`} aria-hidden="true" />
            <span data-ch-bar className="absolute bottom-2 left-[14px] top-2 w-[3px] origin-top rounded-full bg-amber md:left-[18px]" aria-hidden="true" />
            {steps.map((f, i) => (
              <li key={f.title} data-ch-step className="relative">
                <span data-ch-num className="absolute -left-10 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-amber font-display text-xs font-extrabold text-white md:-left-14 md:h-10 md:w-10 md:text-sm">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex items-center gap-3">
                  <f.icon size={20} className="text-amber" />
                  <h3 className="font-display text-xl font-extrabold md:text-2xl">{f.title}</h3>
                </div>
                <p className={`mt-2 max-w-md text-sm leading-relaxed md:text-base ${dark ? "text-cream/60" : "text-ink/60"}`}>{f.tip}</p>
              </li>
            ))}
          </ol>

          <div data-ch-demo className="mt-16 min-w-0 md:mt-24">
            <Demo name={m.demo} />
            <p className={`mt-3 text-center text-[11px] ${dark ? "text-cream/40" : "text-ink/40"}`}>Interactive demo with sample data</p>
          </div>

          <div className="mt-10 space-y-5">
            <SpotAlso also={also} dark={dark} />
            <SpotCta m={m} />
          </div>
        </div>
      </div>
    </section>
  );
}

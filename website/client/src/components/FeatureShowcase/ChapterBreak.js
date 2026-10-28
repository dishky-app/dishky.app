import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import Art from "../ui/Art.js";

/**
 * A full-bleed chapter card between parts of the story. The big words slide
 * sideways as you scroll, the illustration wipes in, and the background
 * eases from the previous section's colour to this one.
 */
export default function ChapterBreak({ number, title, words, art = "menu", tone = "dark" }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const dark = tone === "dark";

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(el.querySelector("[data-ch-words]"), { xPercent: 10 }, { xPercent: -35, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      gsap.fromTo(el.querySelector("[data-ch-art]"), { clipPath: "circle(0% at 50% 50%)", rotate: -6 }, { clipPath: "circle(75% at 50% 50%)", rotate: 0, ease: "none", scrollTrigger: { trigger: el, start: "top 85%", end: "center 45%", scrub: 0.8 } });
      gsap.fromTo(el.querySelector("[data-ch-title]"), { y: 60, opacity: 0 }, { y: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: el, start: "top 80%", end: "top 40%", scrub: 0.8 } });
    }, el);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={ref} data-nav-theme={dark ? "dark" : undefined} className={`relative overflow-hidden py-20 md:py-28 ${dark ? "bg-ink text-cream" : "bg-cream text-ink"}`} aria-label={title}>
      <div data-ch-words aria-hidden="true" className={`pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 whitespace-nowrap font-display font-extrabold uppercase leading-none ${dark ? "text-white/[0.06]" : "text-ink/[0.05]"}`} style={{ fontSize: "clamp(6rem, 22vw, 20rem)" }}>
        {words} · {words}
      </div>
      <div className="container-dishky relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
        <div data-ch-title>
          <p className="font-display text-sm font-extrabold tabular-nums text-amber">{number}</p>
          <h2 className="heading-xl mt-2 max-w-3xl">{title}</h2>
        </div>
        <div data-ch-art className="mx-auto h-40 w-40 overflow-hidden rounded-full shadow-2xl sm:h-52 sm:w-52 md:h-64 md:w-64">
          <Art kind={art} dark={dark} />
        </div>
      </div>
    </section>
  );
}

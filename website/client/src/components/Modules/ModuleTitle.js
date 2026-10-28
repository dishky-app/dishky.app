import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";

/** Section heading whose words rise out of a mask. `left` aligns it to the start instead of the centre. */
export default function Title({ children, dark = false, inherit = false, sub, left = false, eyebrow, className = "", style }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(el.querySelectorAll("[data-w]"), { yPercent: 110 }, { yPercent: 0, stagger: 0.06, duration: 0.8, ease: "power4.out", scrollTrigger: { trigger: el, start: "top 85%", once: true } });
      gsap.fromTo(el.querySelectorAll("[data-sub]"), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, delay: 0.25, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%", once: true } });
    }, el);
    return () => ctx.revert();
  }, [reduced]);
  const words = String(children).split(" ");
  return (
    <div ref={ref} className={`mb-8 max-w-3xl md:mb-12 ${left ? "" : "mx-auto text-center"} ${className}`}>
      {eyebrow && <p data-sub className={`mb-3 text-xs font-bold uppercase tracking-[0.22em] ${inherit ? "opacity-70" : dark ? "text-amberLight" : "text-amber"}`}>{eyebrow}</p>}
      <h2 className={`heading-lg ${inherit ? "" : dark ? "text-cream" : "text-ink"}`} style={style} aria-label={String(children)}>
        {words.map((w, i) => (
          <span key={i} aria-hidden="true" className="inline-block overflow-hidden pb-[0.1em] align-bottom">
            <span data-w className="inline-block">{w}{i < words.length - 1 ? " " : ""}</span>
          </span>
        ))}
      </h2>
      {sub && <p data-sub className={`text-lead mt-3 ${inherit ? "opacity-75" : dark ? "text-cream/60" : "text-ink/60"}`}>{sub}</p>}
    </div>
  );
}

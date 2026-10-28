import React, { useLayoutEffect, useRef } from "react";
import PageBackdrop from "../components/ReactBits/PageBackdrop.js";
import { Link } from "react-router-dom";
import { gsap } from "../animations/gsapSetup.js";
import useReducedMotion from "../hooks/useReducedMotion.js";
import { modules } from "../data/modules.js";

/** 404: the zero is a plate that wobbles on the table. Suggestions below. */
export default function NotFound() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(el.querySelectorAll("[data-n]"), { y: 80, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, duration: 0.9, ease: "back.out(1.6)" });
      gsap.to(el.querySelector("[data-plate]"), { rotate: 8, transformOrigin: "50% 100%", duration: 1.1, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.fromTo(el.querySelectorAll("[data-s]"), { y: 20, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.06, duration: 0.6, delay: 0.7 });
    }, el);
    return () => ctx.revert();
  }, [reduced]);

  const picks = modules.slice(0, 6);
  return (
    <div ref={ref} data-nav-theme="dark" className="relative isolate min-h-screen-safe flex flex-col items-center justify-center overflow-hidden bg-ink px-6 py-24 text-center text-cream">
      <PageBackdrop tone="dark" />
      <div className="flex items-end justify-center gap-2 font-display font-extrabold leading-none sm:gap-4" style={{ fontSize: "clamp(6rem, 26vw, 16rem)" }} aria-label="404">
        <span data-n>4</span>
        <svg data-n data-plate viewBox="0 0 100 100" className="h-[0.82em] w-[0.82em]" aria-hidden="true">
          <circle cx="50" cy="50" r="46" fill="#ededed" />
          <circle cx="50" cy="50" r="34" fill="none" stroke="#faaca0" strokeWidth="3" />
          <path d="M30 56c6-14 16-20 24-18 8 2 14 12 16 22-12 8-30 8-40-4z" fill="#f33716" />
          <circle cx="62" cy="40" r="4" fill="#f77a67" />
        </svg>
        <span data-n>4</span>
      </div>
      <p className="mt-4 font-display text-2xl font-bold">This table is empty.</p>
      <p className="mt-1 text-cream/60">The page you wanted is not here. Try one of these.</p>
      <div className="mt-6 flex max-w-xl flex-wrap justify-center gap-2">
        {picks.map((m) => (
          <Link key={m.slug} data-s to={m.path} className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-cream/85 transition-colors hover:border-amber hover:text-amber"><m.icon size={14} /> {m.name}</Link>
        ))}
      </div>
      <Link to="/" className="btn-primary mt-8">Back to Home</Link>
    </div>
  );
}

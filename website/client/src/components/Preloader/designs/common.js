import { useLayoutEffect, useRef } from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import useReducedMotion from "../../../hooks/useReducedMotion.js";

/**
 * Shared plumbing for the preloader designs. A design only describes its
 * timeline; this hook handles:
 *  - reduced motion: a quick fade instead of the full sequence
 *  - cleanup: everything is reverted if the component unmounts
 *  - onComplete: always the LATEST callback, so a parent re-render can never
 *    restart the animation
 *
 * build({ tl, root, q }) gets a ready GSAP timeline, the root element, and a
 * selector scoped to it (q("[data-x]")).
 */
export function usePreloader(onComplete, build) {
  const rootRef = useRef(null);
  const reduced = useReducedMotion();
  const doneRef = useRef(onComplete);
  const buildRef = useRef(build);
  doneRef.current = onComplete;
  buildRef.current = build;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const finish = () => doneRef.current && doneRef.current();

    if (reduced) {
      const t = gsap.to(root, { opacity: 0, duration: 0.25, delay: 0.25, onComplete: finish });
      return () => t.kill();
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" }, onComplete: finish });
      buildRef.current({ tl, root, q: gsap.utils.selector(root) });
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  return rootRef;
}

/** 0 -> 100 counter written straight to the DOM (no React re-renders). */
export function countTo(el, { duration, ease = "power2.inOut", onUpdate } = {}) {
  const state = { v: 0 };
  return gsap.to(state, {
    v: 100,
    duration,
    ease,
    onUpdate: () => {
      if (el) el.textContent = String(Math.round(state.v)).padStart(2, "0");
      if (onUpdate) onUpdate(state.v);
    },
  });
}

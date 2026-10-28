import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "../animations/gsapSetup.js";
import useReducedMotion from "./useReducedMotion.js";

/**
 * Initializes Lenis smooth scrolling for the whole app, driven by GSAP's
 * own ticker rather than its own requestAnimationFrame loop. This is what
 * keeps ScrollTrigger-pinned/scrubbed sections perfectly in sync with the
 * smooth-scrolled position instead of jittering against it — Lenis and
 * ScrollTrigger must share one clock.
 *
 * Skips entirely when the user prefers reduced motion, falling back to
 * native scroll (and any ScrollTrigger animations that don't rely on
 * smooth scroll still work, they just track native scroll position).
 */
// Shared handle so route changes can move Lenis itself. Calling
// window.scrollTo while Lenis is active does not stick: Lenis keeps its own
// scroll target and glides the page back to it.
let lenisInstance = null;
export const getLenis = () => lenisInstance;

export default function useScrollAnimation() {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenisInstance = lenis;
    // We reset scroll ourselves on every route change; stop the browser from
    // restoring an old position on back/forward and fighting us.
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";

    // Tell ScrollTrigger to read scroll position from Lenis.
    lenis.on("scroll", ScrollTrigger.update);

    // Drive Lenis's raf loop from GSAP's ticker (already running at
    // display refresh rate) instead of a separate rAF loop.
    const tickerCallback = (time) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tickerCallback);
      lenis.destroy();
      if (lenisInstance === lenis) lenisInstance = null;
    };
  }, [reducedMotion]);
}


import { useLayoutEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "../animations/gsapSetup.js";
import useReducedMotion from "./useReducedMotion.js";

/**
 * Moves an element vertically at a fraction/multiple of scroll speed as
 * its containing section passes through the viewport, creating the
 * classic parallax depth effect (background slower than foreground, or
 * decorative elements drifting faster than content).
 *
 * @param {number} speed - relative speed. 0.5 = moves at half scroll speed
 *   (appears to lag behind, reads as "further away"). 1.5 = moves faster
 *   than scroll (reads as "closer / foreground"). Negative values move
 *   opposite to scroll direction.
 */
export default function useParallaxLayer(speed = 0.3) {
  const ref = useRef(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.to(el, {
        yPercent: speed * 100,
        ease: "none",
        scrollTrigger: {
          trigger: el.closest("section") || el.parentElement || el,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    }, el);

    return () => ctx.revert();
  }, [speed, reducedMotion]);

  return ref;
}

import { useLayoutEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "../animations/gsapSetup.js";
import useReducedMotion from "./useReducedMotion.js";

/**
 * Ties an element's entrance animation directly to scroll position
 * (scrubbed) rather than firing once when it enters the viewport. Used
 * for the "story builds as you scroll" feel — the element visibly
 * tracks scroll rather than playing a fixed-duration animation.
 *
 * @param {object} from - GSAP "from" vars, e.g. { opacity: 0, y: 80, scale: 0.9 }
 * @param {object} options
 * @param {string} options.start - default "top 85%"
 * @param {string} options.end - default "top 40%"
 */
export default function useScrubReveal(from = { opacity: 0, y: 60 }, options = {}) {
  const ref = useRef(null);
  const reducedMotion = useReducedMotion();
  const { start = "top 85%", end = "top 40%" } = options;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        from,
        {
          opacity: 1,
          y: 0,
          x: 0,
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start,
            end,
            scrub: true,
          },
        }
      );
    }, el);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return ref;
}

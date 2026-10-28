import { useLayoutEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "../animations/gsapSetup.js";
import useReducedMotion from "./useReducedMotion.js";

/**
 * Pins a section in place for the duration of a scroll distance while a
 * GSAP timeline plays, scrubbed to scroll position. This is the core
 * "content changes while the viewport holds still" technique used by
 * cinematic/scroll-storytelling sites (e.g. a dashboard that stays fixed
 * while its panels swap, or a heading that holds while background
 * elements move past it).
 *
 * @param {(timeline: gsap.core.Timeline, ctx: { el: HTMLElement }) => void} buildTimeline
 *   Callback that receives an empty GSAP timeline and the pinned element;
 *   add tweens to the timeline using relative positions ("<", "-=0.2", etc.)
 * @param {object} options
 * @param {number} options.scrollLength - extra scroll distance (in viewport
 *   heights) the pin holds for; higher = slower/longer sequence. Default 1.5.
 * @param {string} options.start - ScrollTrigger start position. Default "top top".
 * @param {boolean} options.pin - whether to actually pin (set false to just
 *   scrub a timeline without pinning, e.g. for parallax-only sections).
 */
export default function usePinSection(buildTimeline, options = {}) {
  const sectionRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const { scrollLength = 1.5, start = "top top", pin = true } = options;

  useLayoutEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    // Reduced motion: skip pinning/scrubbing entirely. Content stays in
    // normal document flow and static (any Framer Motion fade-ins still
    // apply independently).
    if (reducedMotion) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start,
          end: () => `+=${window.innerHeight * scrollLength}`,
          scrub: 1,
          pin: pin,
          pinSpacing: true,
          anticipatePin: 1,
        },
      });
      buildTimeline(tl, { el });
    }, el);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return sectionRef;
}

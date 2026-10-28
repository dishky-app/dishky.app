import { useEffect, useState } from "react";

/**
 * Reports what the current device can comfortably handle so heavy effects
 * (pinned scroll scenes, parallax, mouse-follow) can be skipped where they hurt
 * more than they help — small screens, touch-only devices, and users who asked
 * for reduced motion.
 *
 *   isTouch      primary input is a finger (no hover, coarse pointer)
 *   isSmall      viewport is below the tablet breakpoint (< 768px)
 *   isCompact    viewport is below the laptop breakpoint (< 1024px)
 *   canParallax  true only when it is worth running scrub-driven parallax
 *   canPin       true only when pinned scroll scenes are safe to run
 *
 * Values update live when the window is resized or rotated.
 */
const QUERIES = {
  isTouch: "(hover: none) and (pointer: coarse)",
  isSmall: "(max-width: 767px)",
  isCompact: "(max-width: 1023px)",
  reduced: "(prefers-reduced-motion: reduce)",
  // Short landscape phones can't fit a "full screen" pinned scene.
  isShortLandscape: "(orientation: landscape) and (max-height: 500px)",
};

function read() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return {
      isTouch: false,
      isSmall: false,
      isCompact: false,
      reduced: false,
      isShortLandscape: false,
    };
  }
  const out = {};
  for (const [key, q] of Object.entries(QUERIES)) out[key] = window.matchMedia(q).matches;
  return out;
}

export default function useDeviceCapabilities() {
  const [state, setState] = useState(read);

  useEffect(() => {
    const lists = Object.values(QUERIES).map((q) => window.matchMedia(q));
    const update = () => setState(read());
    lists.forEach((l) => l.addEventListener("change", update));
    return () => lists.forEach((l) => l.removeEventListener("change", update));
  }, []);

  const canParallax = !state.reduced && !state.isSmall && !state.isTouch;
  const canPin =
    !state.reduced && !state.isSmall && !state.isShortLandscape && !state.isTouch;

  return { ...state, canParallax, canPin };
}

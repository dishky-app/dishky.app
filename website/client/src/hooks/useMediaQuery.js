import { useEffect, useState } from "react";

/**
 * Subscribes to a CSS media query and returns whether it currently matches.
 * Used to make animation decisions per device capability (not per pixel
 * width): e.g. skip cursor parallax on touch, or skip heavy pinned scroll
 * sequences on phones.
 */
export default function useMediaQuery(query) {
  const get = () =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false;

  const [matches, setMatches] = useState(get);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

// Named presets so components don't re-type query strings.
export const QUERIES = {
  // A real mouse/trackpad: hover-capable and precise pointer.
  finePointer: "(hover: hover) and (pointer: fine)",
  // Phones + small tablets in portrait.
  belowLg: "(max-width: 1023px)",
  belowMd: "(max-width: 767px)",
  // Short landscape screens (phones on their side).
  shortLandscape: "(max-height: 520px) and (orientation: landscape)",
};

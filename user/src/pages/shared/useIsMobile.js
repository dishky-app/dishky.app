import { useEffect, useState } from "react";

/**
 * useIsMobile(breakpoint = 576)
 * ────────────────────────────────────────────────────────────────
 * Tracks whether the viewport is at or below `breakpoint` (matches
 * the app's `@media screen and (max-width: 576px)` mobile rules).
 *
 * This exists specifically for elements whose mobile CSS switches
 * them to `position: fixed` (e.g. `.bottom` in FoodItem, `.fav-actions`
 * in FavouriteDishDetail) while their desktop CSS keeps them as a
 * normal in-flow flex child. Those elements live inside
 * `.page-transition-wrapper`, which Framer Motion animates with a
 * CSS `transform` on route enter/exit. A `transform` on an ancestor
 * makes that ancestor the containing block for any `position: fixed`
 * descendant, so the fixed bar gets dragged along with the sliding
 * page instead of staying pinned to the viewport — producing a
 * visible jump/glitch right as the transition starts or ends.
 *
 * The fix is to portal the fixed bar to `document.body` (a true
 * sibling of the animated wrapper) only while it's actually fixed on
 * mobile, and render it in its normal in-flow position on desktop.
 * This hook is what decides which mode is active.
 *
 * Usage:
 *   const isMobile = useIsMobile();
 *   {isMobile ? createPortal(bar, document.body) : bar}
 */
export function useIsMobile(breakpoint = 576) {
  const query = `(max-width: ${breakpoint}px)`;
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handleChange = () => setIsMobile(mql.matches);

    handleChange();
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [query]);

  return isMobile;
}

export default useIsMobile;

import { useEffect, useState } from "react";

/**
 * Tracks whether the viewport is at/below `breakpoint` (px).
 *
 * Used to decide when a bar that becomes `position: fixed` at a mobile
 * breakpoint (e.g. FoodItem's `.bottom`, FavouriteDishDetail's
 * `.fav-actions`) needs to be rendered via a portal straight to
 * `document.body` instead of inline.
 *
 * Why: those bars only become fixed below a given width. While a route
 * transition plays, Framer Motion applies a CSS `transform` to the
 * `.page-transition-wrapper` ancestor — and a transformed ancestor
 * becomes the containing block for any `position: fixed` descendant.
 * So at that width the bar would suddenly be "fixed" relative to the
 * sliding wrapper instead of the viewport, jumping/glitching on every
 * page enter and exit. Portalling it to `document.body` only when this
 * hook is true keeps it anchored to the viewport at that width, while
 * leaving it as a normal in-flow child everywhere else.
 */
export const useIsBelowWidth = (breakpoint) => {
  const [isBelow, setIsBelow] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= breakpoint
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsBelow(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isBelow;
};

export default useIsBelowWidth;

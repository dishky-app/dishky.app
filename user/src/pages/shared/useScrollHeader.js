import { useEffect, useRef, useState } from "react";

/**
 * useScrollHeader(threshold = 4)
 * ────────────────────────────────────────────────────────────────
 * Powers the app-wide "transparent until you scroll" sticky header
 * effect. Every top-level page header (`.food-header`, `.food-grid-header`,
 * `.combo-topbar`, `.ep-hero-topbar`, etc.) is `position: sticky; top: 0`
 * and starts fully transparent so it doesn't box in the page title
 * before there's anything to hide. Once the page is actually scrolled,
 * the header needs a truly OPAQUE backdrop (not just a tint) — otherwise
 * the content scrolling underneath keeps bleeding through the sticky
 * header the whole time, which was the actual bug being reported
 * (headers were always a semi-transparent `color-mix(...55%...)` blur,
 * never a solid surface). This hook just tracks the boolean and lets
 * each page's CSS decide how "scrolled" looks via a `.header-scrolled`
 * modifier class — the visual states live in CSS, not here.
 *
 * Attach the returned ref to the sticky header element itself. The
 * hook walks up from that element to find its actual scrolling
 * ancestor (an `overflow-y: auto/scroll` parent, e.g. the mobile
 * `.page-transition-wrapper`) and falls back to `window` for the
 * normal desktop case where the document itself scrolls. This means
 * it works correctly regardless of which layout is scrolling, without
 * every page having to know or pass that in.
 *
 * Usage:
 *   const { headerRef, scrolled } = useScrollHeader();
 *   <div ref={headerRef} className={`food-header${scrolled ? " header-scrolled" : ""}`}>
 *
 * `PageHeader.js` (used by most pages) already wires this in, so most
 * pages get the effect for free. Pages with their own bespoke header
 * markup (ComboPage, AppetizerBuilder, EventHome, EventsPage,
 * EventForms) call the hook directly the same way.
 */
export function useScrollHeader(threshold = 4) {
  const headerRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    // Find the nearest ancestor that actually scrolls. Most pages rely
    // on the document/window scrolling; the mobile layout instead
    // scrolls a `.page-transition-wrapper` div (overflow-y: auto), and
    // a few pages may nest their own scroll container. Walking up
    // covers all of those without each page needing to specify one.
    const getScrollParent = (el) => {
      let node = el.parentElement;
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY)) return node;
        node = node.parentElement;
      }
      return window;
    };

    const scrollTarget = getScrollParent(header);

    const getScrollTop = () =>
      scrollTarget === window
        ? window.scrollY || document.documentElement.scrollTop || 0
        : scrollTarget.scrollTop;

    const handleScroll = () => {
      setScrolled(getScrollTop() > threshold);
    };

    // Set the correct initial state (e.g. navigating in already scrolled,
    // or a page that restores scroll position) rather than always
    // starting transparent for a frame.
    handleScroll();

    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollTarget.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return { headerRef, scrolled };
}

export default useScrollHeader;

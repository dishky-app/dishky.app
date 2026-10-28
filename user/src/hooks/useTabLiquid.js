import { useLayoutEffect, useRef, useState } from "react";

/**
 * useTabLiquid(activeKey, selector)
 * ────────────────────────────────────────────────────────────────
 * Powers a "liquid" sliding highlight behind a set of tab buttons —
 * ported from the admin panel's identical hook (src/hooks/useTabLiquid.js
 * there), which drives the Permissions/Roles switch. Measures the
 * actual active button in the DOM, so it works for any number of tabs
 * and any tab width without the caller precomputing a 1/N split.
 *
 * `selector` defaults to ".app-tab-pill.active" (the admin panel's
 * class) but is overridable so other tab bars — like the mobile
 * footer nav's `.mobile-footer-tab.active` — can reuse the same hook
 * without fighting over class names.
 *
 * Usage:
 *   const { containerRef, thumbStyle } = useTabLiquid(activeKey, ".mobile-footer-tab.active");
 *   <nav ref={containerRef}>
 *     <span className="mobile-footer-tab-liquid" style={thumbStyle} />
 *     <button className={`mobile-footer-tab${activeKey === "x" ? " active" : ""}`} ...>
 *
 * The thumb element must be the FIRST child inside the container — it's
 * positioned absolutely, sits behind the tab buttons (z-index handled in
 * CSS), and its width/left are recomputed whenever activeKey changes or
 * the container resizes.
 */
export function useTabLiquid(activeKey, selector = ".app-tab-pill.active") {
  const containerRef = useRef(null);
  const [thumbStyle, setThumbStyle] = useState({ opacity: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const activeBtn = container.querySelector(selector);
      if (!activeBtn) {
        setThumbStyle((prev) => ({ ...prev, opacity: 0 }));
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      setThumbStyle({
        opacity: 1,
        width: btnRect.width,
        height: btnRect.height,
        transform: `translate(${btnRect.left - containerRect.left}px, ${btnRect.top - containerRect.top}px)`,
      });
    };

    measure();

    // Re-measure on container resize — covers viewport resize crossing
    // the mobile breakpoint, tabs appearing/disappearing (e.g. Favourites
    // or Orders hidden for guest accounts), and label/width changes.
    const ro = new ResizeObserver(measure);
    ro.observe(container);

    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, selector]);

  return { containerRef, thumbStyle };
}

export default useTabLiquid;

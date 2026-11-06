/**
 * InfiniteScrollLoader.js  —  Dishky Admin Panel
 * Shared infinite-scroll sentinel + spinner component
 */

import React, { useLayoutEffect, useRef, useState } from "react";

import "./InfiniteScrollLoader.css";

/**
 * InfiniteScrollLoader
 *
 * Drop this component right after your <tbody> (or at the bottom of a
 * scrollable list).  It renders:
 *   - A sentinel <div> that the IntersectionObserver watches
 *   - An animated spinner + "Loading more…" label while more rows exist
 *   - Nothing (sentinel only) once all rows are loaded
 *
 * Props
 * ──────────────────────────────────────────
 * sentinelRef  RefObject   Required. Ref from useInfiniteScroll.
 * hasMore      boolean     Required. Whether more rows remain.
 * label        string      Optional. Override the loading text.
 * colSpan      number      Optional. If provided, wraps inside a <tr><td>.
 *                          Use this when placed inside a <tbody>.
 * isLoading    boolean     Optional. When true, renders a translucent
 *                          overlay across the whole table/list while the
 *                          next page of infinite-scroll rows loads in.
 *                          Only meaningful when colSpan is NOT set (i.e.
 *                          rendered as a sibling of the scroll container),
 *                          pair with InfiniteScrollOverlay below for
 *                          <table> layouts.
 */
const InfiniteScrollLoader = ({
  sentinelRef,
  hasMore,
  label = "Loading more…",
  colSpan,
}) => {
  const content = (
    <>
      <div ref={sentinelRef} className="isl-sentinel" aria-hidden="true" />
      {/* The visible loading state is the shared <InfiniteScrollOverlay/> over the whole table; this stays an invisible sentinel. */}
    </>
  );

  // When used inside a <table><tbody>, we must wrap in <tr><td>
  if (colSpan) {
    return (
      <tr className="isl-row">
        <td colSpan={colSpan} className="isl-cell">
          {content}
        </td>
      </tr>
    );
  }

  return <div className="isl-wrapper">{content}</div>;
};

/**
 * InfiniteScrollOverlay
 *
 * Renders a translucent full-table inline loader while the next batch
 * of infinite-scroll rows is being appended. Place it as a sibling
 * inside the same `position: relative` scroll wrapper that holds the
 * <table>/list, right after it — it absolutely covers the whole area.
 *
 * Props
 * ──────────────────────────────────────────
 * isLoading   boolean   Required. Show/hide the overlay.
 * label       string    Optional. Override the loading text.
 */
export const InfiniteScrollOverlay = ({ isLoading, label = "Loading…" }) => {
  const ref = useRef(null);
  const [box, setBox] = useState(null);

  // The overlay is pinned (position: fixed) to the on-screen box of the table's scroll container, so it covers the
  // whole table no matter how far the table has been scrolled, and follows it while the page scrolls or resizes.
  useLayoutEffect(() => {
    if (!isLoading) { setBox(null); return undefined; }
    const el = ref.current;
    if (!el) return undefined;
    let host = el.parentElement;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = window.getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflowX)) { host = p; break; }
    }
    let raf = 0;
    const measure = () => {
      raf = 0;
      const r = host.getBoundingClientRect();
      const top = Math.max(r.top, 0), left = Math.max(r.left, 0);
      const bottom = Math.min(r.bottom, window.innerHeight), right = Math.min(r.right, window.innerWidth);
      setBox((prev) => {
        const next = { top, left, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) };
        return prev && prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height ? prev : next;
      });
    };
    const schedule = () => { if (!raf) raf = window.requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [isLoading]);

  if (!isLoading) return null;
  return (
    <div ref={ref} className="isl-table-overlay" role="status" aria-live="polite" style={box || { visibility: "hidden" }}>
      <span className="isl-spinner" aria-hidden="true" />
      <span className="isl-label">{label}</span>
    </div>
  );
};

export default InfiniteScrollLoader;

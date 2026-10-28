import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./TableScrollButtons.css";

/**
 * TableScrollButtons — mount ONCE at the app root. For every <table> whose scroll container overflows
 * horizontally it shows two floating buttons (jump to the far left / far right of the table).
 * Identical file in the Admin Panel, Super Admin console and Developer Panel. No per-page wiring:
 * tables are discovered from the DOM (re-checked on DOM changes, scroll, resize and a slow timer).
 */

// Nearest ancestor that can scroll sideways (overflow-x auto/scroll — also what overflow-y:auto computes to).
function scrollParent(table) {
  let el = table.parentElement;
  for (let i = 0; el && el !== document.body && i < 10; i += 1, el = el.parentElement) {
    const ox = window.getComputedStyle(el).overflowX;
    if (ox === "auto" || ox === "scroll") return el;
  }
  return null;
}

const same = (a, b) =>
  a.length === b.length &&
  a.every((x, i) => x.el === b[i].el && x.y === b[i].y && x.l === b[i].l && x.r === b[i].r && x.atStart === b[i].atStart && x.atEnd === b[i].atEnd);

function measure() {
  const containers = new Set();
  document.querySelectorAll("table").forEach((t) => { const sp = scrollParent(t); if (sp) containers.add(sp); });
  const out = [];
  containers.forEach((el) => {
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 2) return;                                  // nothing to scroll sideways
    const rect = el.getBoundingClientRect();
    const top = Math.max(rect.top, 0), bottom = Math.min(rect.bottom, window.innerHeight);
    const l = Math.max(rect.left, 0), r = Math.min(rect.right, window.innerWidth);
    if (bottom - top < 70 || r - l < 140) return;          // off-screen or too small
    const hit = document.elementFromPoint((l + r) / 2, (top + bottom) / 2);
    if (!hit || !el.contains(hit)) return;                 // covered by a modal / another layer
    out.push({ el, y: Math.round((top + bottom) / 2), l: Math.round(l), r: Math.round(r), atStart: el.scrollLeft <= 1, atEnd: el.scrollLeft >= max - 1 });
  });
  return out;
}

const Chevrons = ({ dir }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {dir === "left" ? <><path d="M12 6l-6 6 6 6" /><path d="M19 6l-6 6 6 6" /></> : <><path d="M5 6l6 6-6 6" /><path d="M12 6l6 6-6 6" /></>}
  </svg>
);

export default function TableScrollButtons() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let raf = 0;
    const run = () => { raf = 0; const next = measure(); setItems((prev) => (same(prev, next) ? prev : next)); };
    const schedule = () => { if (!raf) raf = window.requestAnimationFrame(run); };

    const mo = new MutationObserver((muts) => {
      // Ignore our own buttons.
      if (muts.every((m) => { const n = m.target.nodeType === 1 ? m.target : m.target.parentElement; return n && n.closest && n.closest(".tsb-layer"); })) return;
      schedule();
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    window.addEventListener("scroll", schedule, true);     // capture: scrolling of any element
    window.addEventListener("resize", schedule);
    const timer = window.setInterval(schedule, 800);       // safety net for layout changes nobody announces
    schedule();
    return () => {
      mo.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      window.clearInterval(timer);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  const go = (el, toEnd) => el.scrollTo({ left: toEnd ? el.scrollWidth : 0, behavior: "smooth" });

  if (!items.length) return null;
  return createPortal(
    <div className="tsb-layer">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <button type="button" className="tsb-btn" style={{ top: it.y, left: it.l + 8 }} disabled={it.atStart}
            onClick={() => go(it.el, false)} aria-label="Scroll table to the far left" title="Jump to the first columns">
            <Chevrons dir="left" />
          </button>
          <button type="button" className="tsb-btn" style={{ top: it.y, left: it.r - 8 - 36 }} disabled={it.atEnd}
            onClick={() => go(it.el, true)} aria-label="Scroll table to the far right" title="Jump to the last columns">
            <Chevrons dir="right" />
          </button>
        </React.Fragment>
      ))}
    </div>,
    document.body
  );
}

import React, { useEffect, useRef } from "react";

/**
 * Wraps a page in a design skin and keeps everything inside it to brand red,
 * white and black. Shared demos and illustrations use other hues (greens,
 * yellows, purples); on skinned pages those are remapped at runtime, so the
 * shared components themselves, and the landing page, are never touched.
 */
const PROPS = [
  ["color", "color"], ["backgroundColor", "background-color"], ["borderTopColor", "border-top-color"],
  ["borderRightColor", "border-right-color"], ["borderBottomColor", "border-bottom-color"], ["borderLeftColor", "border-left-color"],
  ["fill", "fill"], ["stroke", "stroke"], ["outlineColor", "outline-color"],
];

function parse(c) {
  const m = /rgba?\(([^)]+)\)/.exec(c || "");
  if (!m) return null;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}
function hsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}
/** Returns the replacement colour, or null when the colour is already on-brand. */
function remap(c) {
  const p = parse(c);
  if (!p || p.a < 0.02) return null;
  const { h, s, l } = hsl(p);
  if (s < 0.22 || l < 0.06 || l > 0.96 || h <= 22 || h >= 345) return null;
  if (l >= 0.82 || l <= 0.3) { const g = Math.round(l * 255); return `rgba(${g},${g},${g},${p.a})`; }
  return `rgba(243,55,22,${p.a})`;
}

function normalise(root, nodes) {
  const list = nodes || root.querySelectorAll("*");
  list.forEach((el) => {
    if (el.nodeType !== 1) return;
    if (el.closest && el.closest("[data-keep-colors]")) return; // opt-out (e.g. the green success tick)
    const cs = getComputedStyle(el);
    PROPS.forEach(([js, css]) => {
      const out = remap(cs[js]);
      if (out) el.style.setProperty(css, out, "important");
    });
  });
}

export default function PaletteGuard({ skin, frame, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    let raf = 0, full = true;
    const pending = new Set();
    const run = () => {
      raf = 0;
      if (full || pending.size > 80) normalise(root); else normalise(root, [...pending].flatMap((n) => [n, ...(n.querySelectorAll ? n.querySelectorAll("*") : [])]));
      full = false; pending.clear();
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(() => setTimeout(run, 60)); };
    const mo = new MutationObserver((ms) => {
      ms.forEach((m) => {
        if (m.type === "attributes" && m.attributeName === "style" && m.target.style.getPropertyPriority && m.target.__pg) { m.target.__pg = false; return; }
        pending.add(m.type === "childList" ? m.target : m.target);
      });
      queue();
    });
    mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class"] });
    queue();
    const t = setInterval(() => { full = true; queue(); }, 1500);
    return () => { mo.disconnect(); clearInterval(t); cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref} data-skin={skin} data-frame={frame}>{children}</div>;
}

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Photo } from "../ui/kit.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import { clamp } from "./motion.js";

/**
 * Horizontal cinematic carousel. One slide dominates, its neighbours peek in
 * from both edges. Native scroll-snap gives touch swipe; mouse drag, arrows,
 * keyboard, progress segments and a counter sit on top.
 * items: [{ id, kicker, title, text?, to?, cta?, art, photo?, media? }]
 */
export default function FeatureCarousel({ items, label = "Features", dark = false, className = "" }) {
  const track = useRef(null);
  const slides = useRef([]);
  const drag = useRef(null);
  const [active, setActive] = useState(0);
  const [dragging, setDragging] = useState(false);
  const reduced = useReducedMotion();
  const n = items.length;

  const nearest = useCallback(() => {
    const t = track.current;
    if (!t) return 0;
    const c = t.scrollLeft + t.clientWidth / 2;
    let best = 0;
    let d = Infinity;
    slides.current.forEach((el, i) => {
      if (!el) return;
      const dd = Math.abs(el.offsetLeft + el.offsetWidth / 2 - c);
      if (dd < d) { d = dd; best = i; }
    });
    return best;
  }, []);

  useEffect(() => {
    const t = track.current;
    if (!t) return undefined;
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; setActive(nearest()); });
    };
    t.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      cancelAnimationFrame(raf);
      t.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [nearest]);

  const go = useCallback((i) => {
    const t = track.current;
    const el = slides.current[clamp(i, 0, n - 1)];
    if (!t || !el) return;
    t.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - t.clientWidth / 2, behavior: reduced ? "auto" : "smooth" });
  }, [n, reduced]);

  const onPointerDown = (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag.current = { x: e.clientX, left: track.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 6) return;
    if (!d.moved) { d.moved = true; setDragging(true); }
    track.current.scrollLeft = d.left - dx;
  };
  const endDrag = () => {
    const d = drag.current;
    if (!d) return;
    if (d.moved) {
      setDragging(false);
      go(nearest());
      setTimeout(() => { drag.current = null; }, 0);
    } else drag.current = null;
  };
  const onClickCapture = (e) => {
    if (drag.current && drag.current.moved) { e.preventDefault(); e.stopPropagation(); }
  };
  const onKeyDown = (e) => {
    if (e.target !== e.currentTarget && e.target.tagName === "A") {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    }
    if (e.key === "ArrowRight") go(active + 1);
    else if (e.key === "ArrowLeft") go(active - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(n - 1);
    else return;
    e.preventDefault();
  };

  const ink = dark ? "text-cream" : "text-ink";
  const btn = dark ? "border-white/25 text-cream hover:bg-white/10" : "border-ink/20 text-ink hover:bg-ink/5";

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={`outline-none focus-visible:ring-2 focus-visible:ring-amber/60 ${className}`}
    >
      <div
        ref={track}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
        className={`dk-noscroll relative flex items-stretch gap-3 overflow-x-auto overscroll-x-contain py-2 md:gap-5 ${
          dragging ? "cursor-grabbing select-none" : "cursor-grab snap-x snap-mandatory"
        }`}
        style={{ scrollBehavior: dragging || reduced ? "auto" : undefined }}
      >
        <div aria-hidden="true" className="w-[6%] shrink-0 sm:w-[10%] lg:w-[14%]" />
        {items.map((it, i) => {
          const on = i === active;
          return (
            <article
              key={it.id}
              ref={(el) => { slides.current[i] = el; }}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${n}: ${it.title}`}
              className="group relative h-[27rem] w-[88%] shrink-0 snap-center overflow-hidden rounded-[2rem] bg-ink text-cream transition-[transform,opacity] duration-700 ease-dishky sm:w-[80%] md:h-[31rem] lg:w-[72%]"
              style={{ opacity: on ? 1 : 0.5, transform: on ? "scale(1)" : "scale(0.94)" }}
            >
              <Photo src={it.photo} art={it.art} className="absolute inset-0" zoom />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10 md:bg-gradient-to-r md:from-black/85 md:via-black/45 md:to-transparent" />
              {it.media && (
                <div className="absolute inset-y-8 right-6 hidden w-[44%] overflow-hidden rounded-2xl md:block" style={{ opacity: on ? 1 : 0, transition: "opacity .7s .2s" }}>
                  {it.media}
                </div>
              )}
              <div
                className="absolute inset-x-0 bottom-0 p-6 md:inset-y-0 md:flex md:w-[52%] md:flex-col md:justify-end md:p-10"
                style={{ opacity: on ? 1 : 0, transform: on ? "none" : "translateY(18px)", transition: "opacity .7s .12s, transform .7s .12s" }}
              >
                <p className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-cream/70">
                  <span className="font-display text-sm text-amber">{String(i + 1).padStart(2, "0")}</span>
                  <span className="h-px w-8 bg-cream/40" aria-hidden="true" />
                  {it.kicker}
                </p>
                <h3 className="font-display text-2xl font-extrabold leading-tight md:text-4xl">{it.title}</h3>
                {it.text && <p className="mt-3 max-w-sm text-sm text-cream/75">{it.text}</p>}
                {it.to && (
                  <Link to={it.to} tabIndex={on ? 0 : -1} className="group/cta mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-white">
                    {it.cta || "Explore feature"}
                    <ArrowRight size={16} className="transition-transform duration-300 group-hover/cta:translate-x-1" />
                  </Link>
                )}
              </div>
            </article>
          );
        })}
        <div aria-hidden="true" className="w-[6%] shrink-0 sm:w-[10%] lg:w-[14%]" />
      </div>

      <div className={`mt-5 flex items-center gap-4 ${ink}`}>
        <span className="font-display text-sm font-bold tabular-nums">
          {String(active + 1).padStart(2, "0")}<span className="opacity-40"> / {String(n).padStart(2, "0")}</span>
        </span>
        <div className="flex flex-1 gap-1.5" role="group" aria-label={`${label} progress`}>
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to ${it.title}`}
              aria-current={i === active}
              className="group/seg flex h-6 flex-1 items-center"
            >
              <span className={`block h-[3px] w-full overflow-hidden rounded-full ${dark ? "bg-white/20" : "bg-ink/15"}`}>
                <span className="block h-full origin-left bg-amber transition-transform duration-700 ease-dishky" style={{ transform: `scaleX(${i <= active ? 1 : 0})` }} />
              </span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous" className={`flex h-11 w-11 items-center justify-center rounded-full border transition disabled:opacity-30 ${btn}`}>
          <ArrowLeft size={18} />
        </button>
        <button type="button" onClick={() => go(active + 1)} disabled={active === n - 1} aria-label="Next" className={`flex h-11 w-11 items-center justify-center rounded-full border transition disabled:opacity-30 ${btn}`}>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

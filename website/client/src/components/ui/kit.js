import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import Art from "./Art.js";
import { USE_STOCK_PHOTOS } from "../../assets/images/imageUrls.js";

/** Photo with a graceful fallback: if the URL fails, a warm gradient shows. */
export function Photo({ src, alt = "", className = "", imgClassName = "", zoom = false, tint, art, artDark = true }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={`${/\b(absolute|fixed|sticky)\b/.test(className) ? "" : "relative"} overflow-hidden bg-gradient-to-br from-[#111111] via-[#2a2a2a] to-[#3a3a3a] ${className}`}
    >
      {art && <div className="absolute inset-0"><Art kind={art} dark={artDark} /></div>}
      {!failed && src && (!art || USE_STOCK_PHOTOS) && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover ${
            zoom ? "transition-transform duration-[1200ms] ease-dishky group-hover:scale-110" : ""
          } ${imgClassName}`}
        />
      )}
      {tint && <div className="absolute inset-0" style={{ background: tint }} />}
    </div>
  );
}

export function useInterval(fn, ms, active = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active || !ms) return;
    const id = setInterval(() => { if (!document.hidden) ref.current(); }, ms);
    return () => clearInterval(id);
  }, [ms, active]);
}

/** Counts up to `to` when scrolled into view. */
export function CountUp({ to, prefix = "", suffix = "", duration = 1.6, decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: duration * 1000, bounce: 0 });
  const text = useTransform(spring, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`);
  useEffect(() => {
    if (inView) mv.set(to);
  }, [inView, to, mv]);
  if (reduced) return <span ref={ref}>{`${prefix}${to}${suffix}`}</span>;
  return <motion.span ref={ref}>{text}</motion.span>;
}

/** Card that tilts towards the cursor (fine pointers only). */
export function Tilt({ children, className = "", max = 8 }) {
  const ref = useRef(null);
  const onMove = (e) => {
    if (!window.matchMedia("(hover: hover)").matches) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transform = `perspective(900px) rotateY(${x * max}deg) rotateX(${-y * max}deg) translateZ(0)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = "";
  };
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={`transition-transform duration-300 ease-out will-change-transform ${className}`}
    >
      {children}
    </div>
  );
}

/** Infinite CSS marquee. */
export function Marquee({ children, speed = 40, className = "", reverse = false }) {
  return (
    <div className={`dk-marquee overflow-hidden ${className}`}>
      <div
        className="dk-marquee__track flex w-max gap-4"
        style={{ animationDuration: `${speed}s`, animationDirection: reverse ? "reverse" : "normal" }}
      >
        {children}
        {children}
      </div>
    </div>
  );
}

/** A browser-like window frame for demos. */
export function Window({ title = "Dishky Admin", children, className = "", dark = true }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border shadow-2xl ${
        dark ? "border-white/10 bg-[#0e0e0e] text-cream" : "border-ink/10 bg-white text-ink"
      } ${className}`}
    >
      <div className={`flex items-center gap-2 border-b px-4 py-2.5 ${dark ? "border-white/10 bg-white/[0.03]" : "border-ink/10 bg-beige"}`}>
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#f45138]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e4290c]" />
        <span className={`ml-3 truncate text-[11px] font-medium ${dark ? "text-cream/50" : "text-ink/50"}`}>{title}</span>
      </div>
      {children}
    </div>
  );
}

/** A phone shell for guest-side demos. */
export function Phone({ children, className = "" }) {
  return (
    <div className={`relative mx-auto w-[270px] shrink-0 rounded-[2.4rem] border-[7px] border-[#1b1b1b] bg-white shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] ${className}`}>
      <div className="absolute left-1/2 top-1.5 z-20 h-4 w-20 -translate-x-1/2 rounded-full bg-[#1b1b1b]" />
      <div className="relative h-[540px] overflow-hidden rounded-[1.9rem] bg-white text-ink">{children}</div>
    </div>
  );
}

export function Pill({ active, children, onClick, dark = true, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[40px] rounded-full px-4 text-xs font-semibold transition-all duration-300 ${
        active
          ? "bg-amber text-white shadow-[0_8px_24px_-8px_rgba(243,55,22,0.8)]"
          : dark
          ? "bg-white/8 text-cream/70 hover:bg-white/15"
          : "bg-ink/5 text-ink/70 hover:bg-ink/10"
      } ${className}`}
      style={!active && dark ? { background: "rgba(255,255,255,0.08)" } : undefined}
    >
      {children}
    </button>
  );
}

/** Reveal-on-scroll wrapper. */
export function Reveal({ children, delay = 0, y = 40, className = "", as = "div", x = 0 }) {
  const Tag = motion[as] || motion.div;
  return (
    <Tag
      initial={{ opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </Tag>
  );
}

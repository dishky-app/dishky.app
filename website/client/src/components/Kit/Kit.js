import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import { EASE } from "../../animations/variants.js";
import "./kit.css";

/** Fade/slide in once when scrolled into view. */
export function Reveal({ children, delay = 0, y = 32, x = 0, className = "", as = "div" }) {
  const Tag = motion[as] || motion.div;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}

/** Card that tilts toward the pointer. Pure visual, no content changes. */
export function Tilt({ children, max = 8, className = "", style }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [max, -max]), { stiffness: 220, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-max, max]), { stiffness: 220, damping: 20 });
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => { mx.set(0); my.set(0); };
  return (
    <motion.div
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900, ...style }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Number that counts up when it scrolls into view (and whenever `to` changes). */
export function CountUp({ to, prefix = "", suffix = "", duration = 1.2, decimals = 0, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [val, setVal] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!inView) return undefined;
    let raf;
    const start = performance.now();
    const a = from.current;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / (duration * 1000));
      const e = 1 - Math.pow(1 - p, 3);
      setVal(a + (to - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, inView, duration]);
  return <span ref={ref} className={className}>{prefix}{val.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

/** Segmented control / tabs. options: [{value, label, icon?}] */
export function Segmented({ options, value, onChange, dark = false, className = "" }) {
  return (
    <div role="tablist" className={`kit-seg ${dark ? "kit-seg--dark" : ""} ${className}`}>
      {options.map((o) => {
        const Icon = o.icon;
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.value)} className={`kit-seg__btn ${on ? "is-on" : ""}`}>
            {on && <motion.span layoutId={`seg-${options.map((x) => x.value).join("")}`} className="kit-seg__pill" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
            <span className="kit-seg__label">{Icon && <Icon size={15} />}{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Calls fn every `ms` while mounted and visible-ish. */
export function useTicker(fn, ms, active = true) {
  const saved = useRef(fn);
  useEffect(() => { saved.current = fn; }, [fn]);
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms, active]);
}

/** Window-style frame for dashboard demos. */
export function BrowserFrame({ title = "admin.dishky.com", children, className = "", dark = false }) {
  return (
    <div className={`kit-browser ${dark ? "kit-browser--dark" : ""} ${className}`}>
      <div className="kit-browser__bar">
        <span /><span /><span />
        <em>{title}</em>
      </div>
      <div className="kit-browser__body">{children}</div>
    </div>
  );
}

/** Phone frame for guest-side demos. */
export function PhoneFrame({ children, className = "" }) {
  return (
    <div className={`kit-phone ${className}`}>
      <div className="kit-phone__notch" />
      <div className="kit-phone__screen">{children}</div>
    </div>
  );
}

/** Small status chip. tone: ok | warn | bad | info | mute | brand */
export function Chip({ tone = "mute", children, className = "" }) {
  return <span className={`kit-chip kit-chip--${tone} ${className}`}>{children}</span>;
}

/** Soft floating wrapper for decorative motion. */
export function Float({ children, delay = 0, amp = 10, className = "" }) {
  return (
    <motion.div className={className} animate={{ y: [0, -amp, 0] }} transition={{ duration: 5 + delay, repeat: Infinity, ease: "easeInOut", delay }}>
      {children}
    </motion.div>
  );
}

/** Image with a gentle scroll-linked zoom and a hover lift. */
export function Photo({ src, alt = "", className = "", ratio = "aspect-[4/3]", children }) {
  return (
    <div className={`kit-photo ${ratio} ${className}`}>
      <img src={src} alt={alt} loading="lazy" draggable="false" />
      <div className="kit-photo__shade" />
      {children}
    </div>
  );
}

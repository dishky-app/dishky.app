import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import { glideToTop, jumpToTop } from "../../utils/scroll.js";

const R = 20;
const C = 2 * Math.PI * R;
const EASE = [0.22, 1, 0.36, 1];

/** Floating back-to-top button (bottom right). Appears after the first screen and shows scroll progress as a ring. */
export default function BackToTop() {
  const reduce = useReducedMotion();
  const [state, setState] = useState({ show: false, p: 0 });

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      setState((prev) => {
        const show = y > window.innerHeight * 0.6;
        const p = max > 0 ? Math.min(1, y / max) : 0;
        return prev.show === show && Math.abs(prev.p - p) < 0.01 ? prev : { show, p };
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <AnimatePresence>
      {state.show && (
        <motion.button
          type="button"
          aria-label="Back to top"
          onClick={() => (reduce ? jumpToTop() : glideToTop())}
          className="group fixed bottom-5 right-5 z-[60] grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-ink/85 text-white shadow-[0_18px_40px_-14px_rgba(0,0,0,0.7)] backdrop-blur-md transition-colors duration-300 hover:bg-amber hover:text-ink md:bottom-8 md:right-8"
          initial={reduce ? false : { opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 20 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          <svg aria-hidden="true" viewBox="0 0 48 48" className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="24" cy="24" r={R} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
            <circle cx="24" cy="24" r={R} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - state.p)} />
          </svg>
          <ArrowUp size={20} aria-hidden="true" className="relative transition-transform duration-300 group-hover:-translate-y-0.5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

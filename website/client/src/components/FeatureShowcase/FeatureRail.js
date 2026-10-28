import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import useMediaQuery from "../../hooks/useMediaQuery.js";

/**
 * Progress rail for the feature chapters: a column of dots on the right edge
 * (desktop only). The dot for the section on screen fills; hover or focus
 * shows its name; click jumps there. Appears only while you are inside the
 * features area.
 */
export default function FeatureRail({ startId = "features-start", endId = "features-end" }) {
  const desktop = useMediaQuery("(min-width: 1280px)");
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(-1);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!desktop) return undefined;
    const t = setTimeout(() => {
      setItems([...document.querySelectorAll("[data-feature-rail]")].map((el) => ({ el, label: el.getAttribute("data-feature-rail") })));
    }, 600);
    return () => clearTimeout(t);
  }, [desktop]);

  useEffect(() => {
    if (!items.length) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(items.findIndex((i) => i.el === e.target));
        });
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    items.forEach((i) => io.observe(i.el));
    const s = document.getElementById(startId);
    const f = document.getElementById(endId);
    const onScroll = () => {
      if (!s || !f) return;
      const y = window.innerHeight / 2;
      setShow(s.getBoundingClientRect().top < y && f.getBoundingClientRect().top > y);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [items, startId, endId]);

  if (!desktop || !items.length) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.nav
          aria-label="Feature progress"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="fixed right-4 top-1/2 z-40 -translate-y-1/2 rounded-full bg-black/35 px-2 py-3 backdrop-blur-md"
        >
          <ul className="flex flex-col items-center gap-1">
            {items.map((it, i) => (
              <li key={it.label} className="group relative">
                <button
                  type="button"
                  aria-label={`Jump to ${it.label}`}
                  aria-current={i === active}
                  onClick={() => it.el.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="flex h-5 w-5 items-center justify-center"
                >
                  <span className={`block rounded-full transition-all duration-300 ${i === active ? "h-3 w-3 bg-amber" : "h-1.5 w-1.5 bg-white/60 group-hover:bg-white"}`} />
                </button>
                <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-bold text-ink opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  {it.label}
                </span>
              </li>
            ))}
          </ul>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

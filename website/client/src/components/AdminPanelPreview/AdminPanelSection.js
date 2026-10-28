import React, { useLayoutEffect, useRef, useState } from "react";
import { useMotionValue } from "framer-motion";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import AdminShowcase, { adminFixes } from "./AdminShowcase.js";
import { gsap, ScrollTrigger } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import useMediaQuery from "../../hooks/useMediaQuery.js";

const PIN_TOP = 110; // clears the floating header
const VIEWPORT_PER_STEP = 60; // % of viewport height scrolled per problem

/**
 * Homepage centrepiece for restaurant owners.
 *
 * Desktop: scroll-driven. The panel flies in (tilts up, scales, fades) as it
 * arrives, then pins; scrolling steps through the problems one at a time and
 * each tab's hairline fills with your scroll. Click a tab to scroll to it.
 *
 * Phones / short screens / reduced motion: no pin. The showcase just runs its
 * own auto-play, so nothing ever fights native scrolling.
 */
export default function AdminPanelSection() {
  const wrapRef = useRef(null);
  const stRef = useRef(null);
  const [active, setActive] = useState(0);
  const progress = useMotionValue(0);
  const reducedMotion = useReducedMotion();
  const roomy = useMediaQuery("(min-width: 1024px) and (hover: hover) and (pointer: fine) and (min-height: 780px)");
  const scrollMode = roomy && !reducedMotion;

  useLayoutEffect(() => {
    if (!scrollMode) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const n = adminFixes.length;

    const ctx = gsap.context(() => {
      const entrance = { trigger: wrap, start: "top 96%", end: "top 38%", scrub: 1 };
      gsap.fromTo(
        wrap.querySelector("[data-showcase-window]"),
        { y: 90, rotateX: 12, scale: 0.93, opacity: 0.15, transformPerspective: 1400, transformOrigin: "50% 100%" },
        { y: 0, rotateX: 0, scale: 1, opacity: 1, ease: "none", scrollTrigger: entrance }
      );
      gsap.fromTo(
        wrap.querySelector("[data-showcase-tabs]"),
        { x: -70, opacity: 0 },
        { x: 0, opacity: 1, ease: "none", scrollTrigger: { ...entrance } }
      );

      stRef.current = ScrollTrigger.create({
        trigger: wrap,
        start: `top ${PIN_TOP}px`,
        end: `+=${n * VIEWPORT_PER_STEP}%`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          const p = self.progress * n;
          const idx = Math.min(n - 1, Math.floor(p));
          progress.set(Math.min(1, p - idx));
          setActive((prev) => (prev === idx ? prev : idx));
        },
      });
    }, wrap);

    return () => {
      ctx.revert();
      stRef.current = null;
    };
  }, [scrollMode, progress]);

  // Tab click in scroll mode = scroll to that step.
  const goTo = (i) => {
    const st = stRef.current;
    if (!st) return;
    const n = adminFixes.length;
    const y = st.start + ((i + 0.02) / n) * (st.end - st.start);
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <section data-feature-rail="Admin Panel"
      id="admin-panel"
      data-nav-theme="dark"
      className="relative overflow-x-clip bg-ink text-cream"
      style={{ paddingBlock: "var(--section-space)" }}
    >
      <div
        className="pointer-events-none absolute -right-40 top-0 h-[520px] w-[520px] rounded-full bg-neutral-500/10 blur-[110px]"
        aria-hidden="true"
      />
      <div className="container-dishky relative">
        <SectionHeading
          title={"YOUR DAY.\nONE CONTROL CENTER."}
          subtitle={scrollMode ? "Scroll." : "Tap a tab."}
          dark
        />
        <div ref={wrapRef} className="mt-10 md:mt-14">
          {scrollMode ? (
            <AdminShowcase active={active} progress={progress} onSelect={goTo} />
          ) : (
            <AdminShowcase />
          )}
        </div>
      </div>
    </section>
  );
}

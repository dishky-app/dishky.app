import React, { useLayoutEffect, useRef, useState } from "react";
import useReducedMotion from "../../../hooks/useReducedMotion.js";
import useMediaQuery from "../../../hooks/useMediaQuery.js";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";

/**
 * DISHKY entrance, ~3.8s. "Shutter" concept: calm, typographic, all motion is
 * transform/opacity only (no masks, no filters), so it stays smooth.
 *
 *   0.0s  The logo and brand name ease up out of the dark. A large counter
 *         (bottom left) and a thin progress line start to fill, slow - fast -
 *         slow, while a short status line changes with the progress
 *         ("Preparing the pass" -> "Setting the table" -> "Firing the first order").
 *   2.8s  Content lifts away and fades.
 *   2.9s  The screen is made of vertical shutters. They lift up and off in a
 *         ripple from the centre outwards, with a thin brand-red edge, and
 *         the live homepage (mounted underneath the whole time) is revealed.
 *
 * prefers-reduced-motion: a short fade, nothing else.
 */

const PHRASES = [
  { at: 0, text: "Preparing the pass" },
  { at: 34, text: "Setting the table" },
  { at: 68, text: "Firing the first order" },
];

export default function Preloader({ onComplete }) {
  const reducedMotion = useReducedMotion();
  const compact = useMediaQuery("(max-width: 767px)");
  const rootRef = useRef(null);
  const shuttersRef = useRef([]);
  const contentRef = useRef(null);
  const logoRef = useRef(null);
  const nameRef = useRef(null);
  const counterRef = useRef(null);
  const phraseRef = useRef(null);
  const barRef = useRef(null);
  const [done, setDone] = useState(false);

  const count = compact ? 5 : 9; // odd, so there is a true centre shutter
  shuttersRef.current = [];
  const addShutter = (el) => el && shuttersRef.current.push(el);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (reducedMotion) {
      const tl = gsap.timeline({ onComplete });
      tl.to(root, { opacity: 0, duration: 0.25, delay: 0.2, ease: "power1.out" });
      return () => tl.kill();
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" }, onComplete });

      gsap.set([logoRef.current, nameRef.current], { opacity: 0, y: 26 });
      gsap.set(counterRef.current.parentNode, { opacity: 0, y: 30 });
      gsap.set(phraseRef.current, { opacity: 0, y: 8 });
      gsap.set(barRef.current, { scaleX: 0 });

      // ---- Enter ---------------------------------------------------------
      tl.to(logoRef.current, { opacity: 1, y: 0, duration: 1.0, ease: "power3.out" }, 0.15);
      tl.to(nameRef.current, { opacity: 1, y: 0, duration: 1.0, ease: "power3.out" }, 0.35);
      tl.to(counterRef.current.parentNode, { opacity: 1, y: 0, duration: 0.9 }, 0.3);
      tl.to(phraseRef.current, { opacity: 0.7, y: 0, duration: 0.7 }, 0.5);

      // ---- Progress (slow - fast - slow), written straight to the DOM -----
      const p = { v: 0 };
      let phraseIndex = 0;
      const setPhrase = (i) => {
        phraseIndex = i;
        gsap
          .timeline()
          .to(phraseRef.current, { opacity: 0, y: -8, duration: 0.25, ease: "power2.in" })
          .call(() => {
            if (phraseRef.current) phraseRef.current.textContent = PHRASES[i].text;
          })
          .fromTo(phraseRef.current, { y: 8 }, { opacity: 0.7, y: 0, duration: 0.4, ease: "power2.out" });
      };
      tl.to(barRef.current, { scaleX: 1, duration: 2.2, ease: "power2.inOut" }, 0.4);
      tl.to(
        p,
        {
          v: 100,
          duration: 2.2,
          ease: "power2.inOut",
          onUpdate: () => {
            if (counterRef.current) counterRef.current.textContent = String(Math.round(p.v)).padStart(2, "0");
            const next = PHRASES.findLastIndex((ph) => p.v >= ph.at);
            if (next !== phraseIndex && next >= 0) setPhrase(next);
          },
        },
        0.4
      );

      // ---- Exit: content lifts away, shutters ripple open -----------------
      const exitAt = 2.85;
      tl.to(contentRef.current, { y: -40, opacity: 0, duration: 0.55, ease: "power2.in" }, exitAt);
      tl.to(
        shuttersRef.current,
        {
          yPercent: -101,
          duration: 1.0,
          ease: "expo.inOut",
          stagger: { each: 0.075, from: "center" },
        },
        exitAt + 0.15
      );
      tl.call(() => setDone(true), null, exitAt + 1.9);
    }, root);

    return () => ctx.revert();
  }, [reducedMotion, onComplete, count]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{ pointerEvents: done ? "none" : "auto" }}
    >
      {/* The screen itself: vertical shutters. They overlap by 1px so no
          hairline gaps show between them. */}
      <div className="absolute inset-0 flex">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            ref={addShutter}
            className="relative h-full flex-1 bg-charcoal will-change-transform"
            style={{ marginRight: i === count - 1 ? 0 : -1 }}
          >
            <span className="absolute inset-x-0 bottom-0 h-[2px] bg-amber" />
          </div>
        ))}
      </div>

      <div ref={contentRef} className="pointer-events-none absolute inset-0">
        {/* faint dot grid for texture */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1.4px)",
            backgroundSize: "28px 28px",
            WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, #000000 20%, transparent 75%)",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, #000000 20%, transparent 75%)",
          }}
        />

        {/* Brand */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
          <div ref={logoRef}>
            <BrandMark className="h-[clamp(56px,11vmin,96px)]" />
          </div>
          <div ref={nameRef}>
            <BrandWordmark dark className="h-[clamp(20px,3.6vmin,32px)]" />
          </div>
        </div>

        {/* Counter + status, bottom left */}
        <div className="absolute inset-x-0 bottom-[clamp(28px,7vh,64px)] flex items-end justify-between gap-6 px-[clamp(20px,4vw,64px)]">
          <div className="flex items-baseline leading-none">
            <span
              ref={counterRef}
              className="font-display text-[clamp(4.5rem,15vw,13rem)] font-extrabold tabular-nums tracking-tight text-cream"
            >
              00
            </span>
            <span className="ml-1 font-display text-[clamp(1.25rem,3.5vw,3rem)] font-bold text-amber">%</span>
          </div>
          <p
            ref={phraseRef}
            className="pb-[0.6em] text-right text-[clamp(0.7rem,1.4vw,0.95rem)] font-medium uppercase tracking-[0.2em] text-cream"
          >
            {PHRASES[0].text}
          </p>
        </div>

        {/* Progress hairline along the very bottom */}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-cream/10">
          <div ref={barRef} className="h-full origin-left bg-amber" />
        </div>
      </div>
    </div>
  );
}

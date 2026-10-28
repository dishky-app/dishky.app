import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader } from "./common.js";

const WORDS = ["Orders", "Kitchen", "Stock", "Team", "Payments", "Branches"];
const AMBER = "#f33716";
const DARK = "#1a1a1a";

/**
 * "Words" (~4s). Kinetic type. The things Dishky runs flash by in giant
 * capitals, rising out of a mask, alternating between brand red and dark.
 * Then it settles on the logo, and the screen closes to a slit and
 * disappears, revealing the live homepage.
 */
export default function Words({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const texts = q("[data-text]");
    const [idx] = q("[data-idx]");
    const [stage] = q("[data-stage]");
    const [mark] = q("[data-mark]");
    const [name] = q("[data-name]");
    const [tag] = q("[data-tag]");

    gsap.set(root, { backgroundColor: DARK });
    gsap.set(texts, { yPercent: 115 });
    gsap.set(stage, { opacity: 0 });
    gsap.set([mark, name, tag], { opacity: 0, y: 18, scale: 0.94 });

    const STEP = 0.36;
    const start = 0.25;
    WORDS.forEach((_, i) => {
      const t = start + i * STEP;
      const onAmber = i % 2 === 0;
      tl.set(root, { backgroundColor: onAmber ? AMBER : DARK }, t);
      tl.set(texts[i], { color: onAmber ? "#0a0a0a" : "#ffffff" }, t);
      tl.call(() => idx && (idx.textContent = `0${i + 1} / 0${WORDS.length}`), null, t);
      tl.to(texts[i], { yPercent: 0, duration: 0.2, ease: "power4.out" }, t);
      tl.to(texts[i], { yPercent: -115, duration: 0.15, ease: "power3.in" }, t + 0.2);
    });

    // Settle on the brand
    const brandAt = start + WORDS.length * STEP + 0.05;
    tl.set(root, { backgroundColor: DARK }, brandAt);
    tl.set(stage, { opacity: 1 }, brandAt);
    tl.to(idx.parentNode, { opacity: 0, duration: 0.2 }, brandAt - 0.05);
    tl.to(mark, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "back.out(1.5)" }, brandAt);
    tl.to(name, { opacity: 1, y: 0, scale: 1, duration: 0.7 }, brandAt + 0.1);
    tl.to(tag, { opacity: 0.7, y: 0, scale: 1, duration: 0.7 }, brandAt + 0.25);

    // Close to a slit
    const exitAt = brandAt + 0.95;
    tl.to(stage, { opacity: 0, scale: 1.04, duration: 0.4, ease: "power2.in" }, exitAt);
    tl.to(root, { clipPath: "inset(50% 0% 50% 0%)", duration: 0.9, ease: "expo.inOut" }, exitAt + 0.1);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden bg-charcoal" style={{ clipPath: "inset(0% 0% 0% 0%)" }}>
      {WORDS.map((w) => (
        <div key={w} className="absolute inset-0 flex items-center justify-center">
          {/* the mask hugs the text line, so a word is invisible until it rises into it */}
          <span className="block overflow-hidden px-[0.1em] pb-[0.08em] text-[clamp(3rem,17vw,15rem)] leading-[0.95]">
            <span
              data-text
              className="block font-display font-extrabold uppercase leading-[0.95] tracking-[-0.04em]"
            >
              {w}
            </span>
          </span>
        </div>
      ))}

      <p className="absolute bottom-[clamp(24px,6vh,56px)] left-[clamp(20px,4vw,64px)] font-mono text-xs tabular-nums text-cream/70">
        <span data-idx>01 / 06</span>
      </p>

      <div data-stage className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div data-mark>
          <BrandMark className="h-[clamp(60px,12vmin,100px)]" />
        </div>
        <div data-name className="mt-5">
          <BrandWordmark dark className="h-[clamp(22px,4vmin,34px)]" />
        </div>
        <p data-tag className="mt-4 text-[clamp(0.7rem,1.5vw,0.85rem)] font-medium uppercase tracking-[0.22em] text-cream">
          One platform. Every daily problem.
        </p>
      </div>
    </div>
  );
}

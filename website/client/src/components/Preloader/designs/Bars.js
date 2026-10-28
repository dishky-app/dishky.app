import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

const HEIGHTS = [0.3, 0.46, 0.38, 0.62, 0.5, 0.78, 0.58, 0.9, 0.7];

/**
 * "Bars" (~4s). Dark, analytics. The whole screen is a bar chart: nine
 * full-height columns rise to different heights as the counter climbs. At
 * 100 every bar surges to the top and turns brand red, then the columns lift
 * away one after another, left to right, uncovering the homepage.
 */
export default function Bars({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q }) => {
    const cols = q("[data-col]");
    const [bg] = q("[data-bg]");
    const [content] = q("[data-content]");
    const [count] = q("[data-count]");

    gsap.set(cols, { scaleY: 0, transformOrigin: "50% 100%" });
    gsap.set(content, { opacity: 0, y: 20 });

    tl.to(content, { opacity: 1, y: 0, duration: 0.9 }, 0.15);
    tl.to(cols, { scaleY: (i) => HEIGHTS[i], duration: 1.4, ease: "power3.out", stagger: 0.09 }, 0.3);
    tl.add(countTo(count, { duration: 1.9 }), 0.3);
    // gentle breathing while loading
    tl.to(cols, { scaleY: (i) => Math.min(1, HEIGHTS[i] + (i % 2 ? 0.05 : -0.04)), duration: 0.5, ease: "sine.inOut", yoyo: true, repeat: 1, stagger: 0.04 }, 1.9);

    // surge, then lift away
    const surgeAt = 2.5;
    tl.to(content, { opacity: 0, duration: 0.35, ease: "power1.in" }, surgeAt);
    tl.to(cols, { scaleY: 1, backgroundColor: "#f33716", duration: 0.65, ease: "power3.inOut", stagger: 0.05 }, surgeAt);
    tl.set(bg, { opacity: 0 }, surgeAt + 0.65 + 0.4);
    tl.to(cols, { yPercent: -101, duration: 0.85, ease: "expo.inOut", stagger: 0.05 }, surgeAt + 0.85);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      <div data-bg className="absolute inset-0 bg-charcoal" />
      <div className="absolute inset-0">
        {HEIGHTS.map((_, i) => (
          <div
            key={i}
            data-col
            className="absolute bottom-0 h-full border-t-2 border-amber/70 bg-[#2a2a2a] will-change-transform"
            style={{ left: `${(i * 100) / HEIGHTS.length}%`, width: `calc(${100 / HEIGHTS.length}% + 1px)` }}
          />
        ))}
      </div>

      <div data-content className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <BrandMark className="h-[clamp(40px,7vmin,60px)]" />
        <div className="mt-4">
          <BrandWordmark dark className="h-[clamp(16px,2.8vmin,24px)]" />
        </div>
        <p className="mt-6 font-display font-extrabold tabular-nums leading-none tracking-[-0.04em] text-cream" style={{ fontSize: "clamp(4.5rem, 15vw, 11rem)" }}>
          <span data-count>00</span>
          <span className="ml-1 align-top text-[0.28em] text-amber">%</span>
        </p>
      </div>
    </div>
  );
}

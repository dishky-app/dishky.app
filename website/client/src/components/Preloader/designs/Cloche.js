import React from "react";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { gsap } from "../../../animations/gsapSetup.js";
import { usePreloader, countTo } from "./common.js";

/**
 * "Cloche" (~3.7s). Dark. A serving cloche drops onto a plate, holds while a
 * thin line fills, then lifts away with a puff of steam to reveal the logo.
 * The screen then opens like a pair of kitchen doors (top and bottom halves
 * slide apart) onto the live homepage.
 */
export default function Cloche({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q }) => {
    const [plate] = q("[data-plate]");
    const [cloche] = q("[data-cloche]");
    const steam = q("[data-steam]");
    const [logo] = q("[data-logo]");
    const [name] = q("[data-name]");
    const [bar] = q("[data-bar]");
    const [count] = q("[data-count]");
    const [stage] = q("[data-stage]");

    steam.forEach((p) => {
      const len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len, opacity: 0 });
    });
    gsap.set(plate, { scaleX: 0, transformOrigin: "50% 50%" });
    gsap.set(cloche, { y: -150, opacity: 0, transformOrigin: "50% 100%" });
    gsap.set(logo, { opacity: 0, scale: 0.7, y: 8 });
    gsap.set(name, { opacity: 0, y: 12 });
    gsap.set(bar, { scaleX: 0 });
    gsap.set(count, { opacity: 0 });

    // Set the table
    tl.to(plate, { scaleX: 1, duration: 0.8, ease: "power3.inOut" }, 0.1);
    tl.to(cloche, { y: 0, opacity: 1, duration: 0.95, ease: "back.out(1.3)" }, 0.45);
    tl.to(count, { opacity: 0.6, duration: 0.5 }, 0.8);
    tl.to(bar, { scaleX: 1, duration: 1.4, ease: "power2.inOut" }, 0.9);
    tl.add(countTo(count, { duration: 1.4 }), 0.9);

    // Lift the cloche: steam, then the logo underneath
    const liftAt = 2.4;
    tl.to(cloche, { y: -70, rotate: -12, x: -30, opacity: 0, duration: 0.85, ease: "power3.inOut" }, liftAt);
    tl.to(steam, { opacity: 0.7, duration: 0.2, stagger: 0.1 }, liftAt + 0.05);
    tl.to(steam, { strokeDashoffset: 0, y: -26, duration: 0.9, stagger: 0.1, ease: "sine.out" }, liftAt + 0.05);
    tl.to(steam, { opacity: 0, duration: 0.5, stagger: 0.1, ease: "power1.in" }, liftAt + 0.55);
    tl.to(logo, { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: "back.out(1.5)" }, liftAt + 0.2);
    tl.to(name, { opacity: 1, y: 0, duration: 0.7 }, liftAt + 0.4);
    tl.to([bar.parentNode, count], { opacity: 0, duration: 0.3 }, liftAt);

    // Doors open
    const openAt = liftAt + 1.15;
    tl.to(stage, { opacity: 0, scale: 1.05, duration: 0.45, ease: "power2.in" }, openAt);
    tl.to("[data-door='top']", { yPercent: -100, duration: 0.95, ease: "expo.inOut" }, openAt + 0.1);
    tl.to("[data-door='bottom']", { yPercent: 100, duration: 0.95, ease: "expo.inOut" }, openAt + 0.1);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      <div data-door="top" className="absolute inset-x-0 top-0 h-[50.5%] bg-charcoal" />
      <div data-door="bottom" className="absolute inset-x-0 bottom-0 h-[50.5%] bg-charcoal" />

      <div data-stage className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="relative w-[clamp(210px,38vmin,340px)]">
          <svg viewBox="0 0 240 190" className="w-full overflow-visible" fill="none">
            <ellipse data-plate cx="120" cy="152" rx="106" ry="11" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
            {[96, 120, 144].map((x, i) => (
              <path
                key={x}
                data-steam
                d={`M${x} 60 C${x - 8} 48 ${x + 8} 38 ${x} 26 C${x - 6} 16 ${x + 4} 8 ${x} 0`}
                stroke="rgba(255,255,255,0.6)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            ))}
            <g data-cloche>
              <path d="M44 146 C44 92 76 62 120 62 C164 62 196 92 196 146 Z" fill="rgba(255,255,255,0.07)" stroke="#ffffff" strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M62 128 C64 104 78 88 98 80" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" />
              <rect x="38" y="144" width="164" height="9" rx="4.5" fill="#ffffff" />
              <rect x="117" y="57" width="6" height="7" fill="#f33716" />
              <circle cx="120" cy="53" r="7" fill="#f33716" />
            </g>
          </svg>

          {/* The logo sits on the plate, under the cloche */}
          <div className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2">
            <div data-logo>
              <BrandMark className="h-[clamp(44px,8vmin,72px)]" />
            </div>
          </div>
        </div>

        <div data-name className="mt-6">
          <BrandWordmark dark className="h-[clamp(18px,3.2vmin,28px)]" />
        </div>

        <div className="absolute bottom-[clamp(32px,9vh,80px)] flex w-[min(70vw,260px)] items-center gap-3">
          <div className="h-px flex-1 bg-cream/15">
            <div data-bar className="h-full origin-left bg-amber" />
          </div>
          <span data-count className="w-6 text-right font-display text-xs tabular-nums text-cream">00</span>
        </div>
      </div>
    </div>
  );
}

// tiny local alias so the setup lines above stay short

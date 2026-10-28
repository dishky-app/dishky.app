import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

const BUBBLES = [[-30, -34, 5], [26, -30, 4], [38, 8, 6], [-8, 36, 4.5], [-40, 12, 5.5], [14, 30, 3.5]];
const RING = 2 * Math.PI * 110;

/**
 * "Egg" (~3.9s). Dark. A frying pan slides in. An egg drops in, the white
 * spreads and sizzles with popping bubbles, and a ring around the pan fills
 * as the real progress. The pan is then flung to the right while a wipe
 * follows it off the screen.
 */
export default function Egg({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const [pan] = q("[data-pan]");
    const [yolk] = q("[data-yolk]");
    const [white] = q("[data-white]");
    const bubbles = q("[data-bubble]");
    const [ring] = q("[data-ring]");
    const [meta] = q("[data-meta]");
    const [count] = q("[data-count]");

    gsap.set(pan, { x: -380, rotation: -8, svgOrigin: "0 0" });
    gsap.set(white, { scale: 0.15, opacity: 0, svgOrigin: "0 0" });
    gsap.set(yolk, { y: -320, opacity: 0, scale: 1 });
    gsap.set(bubbles, { scale: 0, transformOrigin: "50% 50%" });
    gsap.set(ring, { strokeDasharray: RING, strokeDashoffset: RING });
    gsap.set(meta, { opacity: 0 });

    tl.to(pan, { x: 0, rotation: 0, duration: 1.0, ease: "expo.out" }, 0.1);
    tl.to(meta, { opacity: 1, duration: 0.6 }, 0.4);
    tl.to(ring, { strokeDashoffset: 0, duration: 2.3, ease: "power2.inOut" }, 0.5);
    tl.add(countTo(count, { duration: 2.3 }), 0.5);

    // the egg lands and spreads
    tl.to(yolk, { y: 0, opacity: 1, duration: 0.55, ease: "power2.in" }, 0.85);
    tl.to(white, { scale: 1, opacity: 1, duration: 1.1, ease: "power3.out" }, 1.35);
    tl.to(yolk, { scale: 1.12, duration: 0.2, ease: "power2.out", yoyo: true, repeat: 1 }, 1.4);

    // sizzle
    bubbles.forEach((b, i) => {
      gsap.to(b, { scale: 1, duration: 0.5, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.9 + i * 0.17, repeatDelay: 0.35 });
    });
    gsap.to(pan, { rotation: 1.2, duration: 0.12, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.4 });

    // fling the pan right; the wipe follows
    const exitAt = 3.0;
    tl.to(meta, { opacity: 0, duration: 0.3 }, exitAt - 0.1);
    tl.to(pan, { x: 900, rotation: 22, duration: 0.8, ease: "power3.in" }, exitAt);
    tl.to(root, { clipPath: "inset(0% 0% 0% 100%)", duration: 0.9, ease: "expo.inOut" }, exitAt + 0.1);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-charcoal" style={{ clipPath: "inset(0% 0% 0% 0%)" }}>
      <svg viewBox="-140 -124 380 248" className="w-[clamp(280px,64vmin,540px)] overflow-visible">
        <circle r="110" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        <circle data-ring r="110" fill="none" stroke="#f33716" strokeWidth="3.5" strokeLinecap="round" transform="rotate(-90)" />
        <g data-pan>
          <rect x="92" y="-10" width="146" height="20" rx="10" fill="#3a3a3a" />
          <circle cx="222" cy="0" r="3.5" fill="#1a1a1a" />
          <circle r="100" fill="#2c2c2c" stroke="#4a4a4a" strokeWidth="6" />
          <circle r="84" fill="#1d1d1d" />
          <g data-white>
            <path
              d="M-46 -8 C-52 -40 -14 -58 14 -50 C46 -44 62 -18 54 10 C48 38 18 56 -10 50 C-38 44 -42 22 -46 -8 Z"
              fill="#fbfbfb"
              stroke="#dfdfdf"
              strokeWidth="2"
            />
            {BUBBLES.map(([x, y, r], i) => (
              <circle key={i} data-bubble cx={x} cy={y} r={r} fill="#fbfbfb" stroke="#d2d2d2" strokeWidth="1.5" />
            ))}
          </g>
          <g data-yolk>
            <circle cx="-2" cy="0" r="20" fill="#f33b1f" />
            <ellipse cx="-8" cy="-7" rx="6" ry="4" fill="#f99c8e" />
          </g>
        </g>
      </svg>

      <div data-meta className="mt-6 flex flex-col items-center gap-3">
        <BrandWordmark dark className="h-[clamp(18px,3.2vmin,28px)]" />
        <p className="font-display text-xs tabular-nums text-cream">
          <span className="uppercase tracking-[0.2em] text-cream/55">Sizzling</span>
          <span className="ml-3">
            <span data-count>00</span>
            <span className="text-amber">%</span>
          </span>
        </p>
      </div>
    </div>
  );
}

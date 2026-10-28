import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

const BANDS = [
  { c: "#f33716", w: "95vmax", h: "26vmax", l: "-20%", t: "8%", r: -18, dx: 10, o: 0.55 },
  { c: "#f66a55", w: "90vmax", h: "24vmax", l: "10%", t: "36%", r: 14, dx: -12, o: 0.5 },
  { c: "#f4452a", w: "80vmax", h: "20vmax", l: "-6%", t: "62%", r: -8, dx: 8, o: 0.32 },
];

/**
 * "Aurora" (~4s). Dark, premium. Soft bands of red, violet and blue light
 * drift slowly behind a frosted-glass card holding your logo and progress.
 * At 100 the card swells and dissolves in a soft blur, and the aurora fades
 * out onto the homepage.
 */
export default function Aurora({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const bands = q("[data-band]");
    const [card] = q("[data-card]");
    const items = q("[data-item]");
    const [bar] = q("[data-bar]");
    const [count] = q("[data-count]");

    bands.forEach((b, i) => {
      gsap.to(b, { x: `${BANDS[i].dx}vw`, y: `${(i % 2 ? -1 : 1) * 4}vh`, duration: 5 + i * 1.2, ease: "sine.inOut", yoyo: true, repeat: -1 });
    });
    gsap.set(bands, { opacity: 0, scale: 0.8 });
    gsap.set(card, { opacity: 0, y: 30, scale: 0.96 });
    gsap.set(items, { opacity: 0, y: 12 });
    gsap.set(bar, { scaleX: 0 });

    tl.to(bands, { opacity: (i) => BANDS[i].o, scale: 1, duration: 1.8, ease: "power2.out", stagger: 0.2 }, 0);
    tl.to(card, { opacity: 1, y: 0, scale: 1, duration: 1.0, ease: "power3.out" }, 0.3);
    tl.to(items, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1 }, 0.6);
    tl.to(bar, { scaleX: 1, duration: 2.3, ease: "power2.inOut" }, 0.7);
    tl.add(countTo(count, { duration: 2.3 }), 0.7);

    const exitAt = 3.2;
    tl.to(card, { scale: 1.15, opacity: 0, filter: "blur(14px)", duration: 0.8, ease: "power2.in" }, exitAt);
    tl.to(bands, { opacity: 0, scale: 1.25, duration: 0.9, ease: "power2.in", stagger: 0.05 }, exitAt + 0.1);
    tl.to(root, { opacity: 0, duration: 0.55, ease: "power1.inOut" }, exitAt + 0.5);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#090909]">
      {BANDS.map((b, i) => (
        <div
          key={i}
          data-band
          className="absolute rounded-[50%] will-change-transform"
          style={{ width: b.w, height: b.h, left: b.l, top: b.t, background: b.c, filter: "blur(70px)", transform: `rotate(${b.r}deg)`, mixBlendMode: "screen" }}
        />
      ))}

      <div
        data-card
        className="relative w-[min(86vw,360px)] overflow-hidden rounded-3xl border border-white/15 bg-white/[0.06] px-8 py-10 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.7)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        <div className="flex flex-col items-center">
          <div data-item>
            <BrandMark className="h-[clamp(46px,8vmin,64px)]" />
          </div>
          <div data-item className="mt-5">
            <BrandWordmark dark className="h-[clamp(16px,2.8vmin,24px)]" />
          </div>
          <div data-item className="mt-8 flex w-full items-center gap-3">
            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/15">
              <div data-bar className="h-full origin-left rounded-full bg-white" />
            </div>
            <span className="w-9 text-right font-display text-[11px] tabular-nums text-white/80">
              <span data-count>00</span>%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

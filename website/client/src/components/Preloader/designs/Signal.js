import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

const LINES = 27;
const POINTS = 90;

/**
 * "Signal" (~4s). Dark, hypnotic. A stack of fine horizontal lines carries
 * a travelling wave that swells as the progress climbs and then settles
 * back to perfectly flat, like a signal locking in. Your logo and counter
 * float in the middle. At 100 the lines retract to the centre one after
 * another and the backdrop fades onto the homepage.
 */
export default function Signal({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q }) => {
    const [svg] = q("[data-svg]");
    const lines = q("[data-line]");
    const [content] = q("[data-content]");
    const [count] = q("[data-count]");
    const [bg] = q("[data-bg]");
    const [veil] = q("[data-veil]");
    const W = window.innerWidth;
    const H = window.innerHeight;

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const top = H * 0.2;
    const span = H * 0.6;
    const mid = (LINES - 1) / 2;
    const state = { p: 0, t: 0, a: 0 };

    const render = () => {
      // swell then settle: 0 at the start and the end, peak in the middle
      const swell = Math.pow(Math.sin(Math.PI * Math.min(1, state.p / 100)), 0.9);
      const amp = swell * H * 0.075;
      for (let i = 0; i < LINES; i++) {
        const base = top + (i / (LINES - 1)) * span;
        const near = 1 - Math.abs(i - mid) / (mid + 2); // bigger waves in the middle lines
        let d = "";
        for (let k = 0; k <= POINTS; k++) {
          const u = k / POINTS;
          const x = u * W;
          const env = Math.pow(Math.sin(Math.PI * u), 1.4);
          const y = base + amp * near * env * Math.sin(u * Math.PI * 5 + state.t * 1.6 + i * 0.28);
          d += `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
        }
        lines[i].setAttribute("d", d);
      }
    };
    render();

    gsap.set(content, { opacity: 0, y: 18 });
    gsap.set(lines, { opacity: 0, transformOrigin: "50% 50%" });

    // the wave keeps travelling (tracked by the context, killed on unmount)
    gsap.to(state, { t: 40, duration: 40, ease: "none", onUpdate: render });

    tl.to(lines, { opacity: (i) => 0.25 + 0.55 * (1 - Math.abs(i - mid) / mid), duration: 0.9, stagger: { each: 0.025, from: "center" } }, 0.05);
    tl.to(content, { opacity: 1, y: 0, duration: 0.9 }, 0.35);
    tl.to(state, { p: 100, duration: 2.5, ease: "power1.inOut", onUpdate: render }, 0.4);
    tl.add(countTo(count, { duration: 2.5 }), 0.4);

    const exitAt = 3.1;
    tl.to(content, { opacity: 0, y: -14, duration: 0.4, ease: "power2.in" }, exitAt - 0.1);
    tl.to(veil, { opacity: 0, duration: 0.3 }, exitAt - 0.1);
    tl.to(lines, { scaleX: 0, duration: 0.75, ease: "expo.inOut", stagger: { each: 0.03, from: "center" } }, exitAt);
    tl.to(bg, { opacity: 0, duration: 0.5, ease: "power1.inOut" }, exitAt + 0.55);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      <div data-bg className="absolute inset-0 bg-[#111111]" />
      <svg data-svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" fill="none">
        {Array.from({ length: LINES }).map((_, i) => (
          <path key={i} data-line stroke={i === Math.floor(LINES / 2) ? "#f33716" : "#f0f0f0"} strokeWidth={i === Math.floor(LINES / 2) ? 1.8 : 1.1} strokeLinecap="round" />
        ))}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          data-veil
          className="absolute h-[44vmin] w-[44vmin] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(17,17,17,0.95) 0%, rgba(17,17,17,0.85) 45%, rgba(17,17,17,0) 72%)" }}
        />
        <div data-content className="relative flex flex-col items-center">
          <BrandMark className="h-[clamp(44px,8vmin,68px)]" />
          <div className="mt-4">
            <BrandWordmark dark className="h-[clamp(16px,2.8vmin,24px)]" />
          </div>
          <p className="mt-5 font-display text-sm tabular-nums text-cream">
            <span data-count>00</span>
            <span className="text-amber">%</span>
          </p>
        </div>
      </div>
    </div>
  );
}

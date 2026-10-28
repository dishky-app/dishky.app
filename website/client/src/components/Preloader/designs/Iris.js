import React from "react";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { gsap } from "../../../animations/gsapSetup.js";
import { usePreloader, countTo } from "./common.js";

const R = 88;
const C = 2 * Math.PI * R;

/**
 * "Iris" (~3.6s). The only LIGHT preloader. A progress ring draws around the
 * logo (it is the real progress), the brand name sits below, and at 100 the
 * whole screen closes like a camera iris down to a point, uncovering the
 * live homepage from the outside in.
 */
export default function Iris({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const [arc] = q("[data-arc]");
    const [logo] = q("[data-logo]");
    const [name] = q("[data-name]");
    const [count] = q("[data-count]");
    const [tag] = q("[data-tag]");
    const [stage] = q("[data-stage]");
    const [halo] = q("[data-halo]");

    gsap.set(arc, { strokeDasharray: C, strokeDashoffset: C });
    gsap.set(logo, { opacity: 0, scale: 0.75 });
    gsap.set(name, { opacity: 0, y: 14 });
    gsap.set(tag, { opacity: 0, y: 10 });
    gsap.set(halo, { opacity: 0, scale: 0.8 });
    gsap.set(root, { clipPath: "circle(150% at 50% 50%)" });

    tl.to(halo, { opacity: 1, scale: 1, duration: 1.4, ease: "sine.out" }, 0);
    tl.to(logo, { opacity: 1, scale: 1, duration: 1.0, ease: "back.out(1.4)" }, 0.15);
    tl.to(name, { opacity: 1, y: 0, duration: 0.9 }, 0.45);
    tl.to(tag, { opacity: 1, y: 0, duration: 0.9 }, 0.65);
    tl.to(arc, { strokeDashoffset: 0, duration: 2.3, ease: "power2.inOut" }, 0.35);
    tl.add(countTo(count, { duration: 2.3 }), 0.35);
    // the logo breathes once as the ring closes
    tl.to(logo, { scale: 1.08, duration: 0.3, ease: "power2.out", yoyo: true, repeat: 1 }, 2.7);

    const closeAt = 3.0;
    tl.to(stage, { scale: 0.9, opacity: 0, duration: 0.5, ease: "power2.in" }, closeAt);
    tl.to(root, { clipPath: "circle(0% at 50% 50%)", duration: 1.0, ease: "expo.inOut" }, closeAt + 0.1);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] bg-[#f2f2f2]" style={{ clipPath: "circle(150% at 50% 50%)" }}>
      <div
        data-halo
        className="pointer-events-none absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(243.0,55.0,22.0,0.12) 0%, rgba(243.0,55.0,22.0,0) 65%)" }}
      />
      <div data-stage className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="relative h-[clamp(170px,32vmin,260px)] w-[clamp(170px,32vmin,260px)]">
          <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90" fill="none">
            <circle cx="100" cy="100" r={R} stroke="rgba(10,10,10,0.1)" strokeWidth="3" />
            <circle data-arc cx="100" cy="100" r={R} stroke="#f33716" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div data-logo>
              <BrandMark className="h-[clamp(52px,10vmin,84px)]" />
            </div>
          </div>
        </div>

        <div data-name className="mt-8">
          <BrandWordmark className="h-[clamp(20px,3.6vmin,32px)]" />
        </div>
        <p data-tag className="mt-3 text-[clamp(0.7rem,1.5vw,0.85rem)] font-medium uppercase tracking-[0.2em] text-ink/50">
          Run your restaurant. Not your software.
        </p>
        <p className="mt-6 font-display text-sm font-bold tabular-nums text-ink/60">
          <span data-count>00</span>
          <span className="text-amber">%</span>
        </p>
      </div>
    </div>
  );
}

import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

const R = 62;
const C = 2 * Math.PI * R;
const FEATHER = 90;

/**
 * "Ripple" (~4s). LIGHT, minimal. Sonar-style rings pulse outward from your
 * logo while a thin progress ring closes around it. At 100 a soft circular
 * hole opens from the centre and widens until the homepage fills the screen.
 */
export default function Ripple({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const rings = q("[data-pulse]");
    const [arc] = q("[data-arc]");
    const [logo] = q("[data-logo]");
    const [name] = q("[data-name]");
    const [content] = q("[data-content]");
    const [count] = q("[data-count]");

    rings.forEach((r, i) => {
      gsap.fromTo(r, { scale: 1, opacity: 0.55 }, { scale: 5, opacity: 0, duration: 2.8, ease: "sine.out", repeat: -1, delay: 0.3 + i * 0.7 });
    });
    gsap.set(arc, { strokeDasharray: C, strokeDashoffset: C });
    gsap.set(logo, { scale: 0.7, opacity: 0 });
    gsap.set(name, { opacity: 0, y: 12 });

    tl.to(logo, { scale: 1, opacity: 1, duration: 0.9, ease: "back.out(1.5)" }, 0.15);
    tl.to(name, { opacity: 1, y: 0, duration: 0.8 }, 0.45);
    tl.to(arc, { strokeDashoffset: 0, duration: 2.4, ease: "power2.inOut" }, 0.4);
    tl.add(countTo(count, { duration: 2.4 }), 0.4);

    const maxR = Math.hypot(window.innerWidth, window.innerHeight) / 2 + FEATHER;
    const hole = { r: -FEATHER };
    const apply = () => {
      const m = `radial-gradient(circle at 50% 50%, transparent ${hole.r}px, #000000 ${hole.r + FEATHER}px)`;
      root.style.maskImage = m;
      root.style.webkitMaskImage = m;
    };
    const exitAt = 3.0;
    tl.to(content, { opacity: 0, scale: 0.94, duration: 0.45, ease: "power2.in" }, exitAt - 0.05);
    tl.to(hole, { r: maxR, duration: 1.1, ease: "expo.inOut", onUpdate: apply }, exitAt);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden bg-[#f4f4f4]">
      <div data-content className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="relative flex h-[clamp(130px,24vmin,200px)] w-[clamp(130px,24vmin,200px)] items-center justify-center">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} data-pulse className="absolute inset-[18%] rounded-full border border-amber/60" />
          ))}
          <svg viewBox="0 0 140 140" className="absolute inset-0 h-full w-full -rotate-90" fill="none">
            <circle cx="70" cy="70" r={R} stroke="rgba(10,10,10,0.1)" strokeWidth="2.5" />
            <circle data-arc cx="70" cy="70" r={R} stroke="#f33716" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div data-logo>
            <BrandMark className="h-[clamp(40px,7.5vmin,62px)]" />
          </div>
        </div>
        <div data-name className="mt-8">
          <BrandWordmark className="h-[clamp(18px,3.2vmin,28px)]" />
        </div>
        <p className="mt-4 font-display text-xs tabular-nums text-ink/60">
          <span data-count>00</span>
          <span className="text-amber">%</span>
        </p>
      </div>
    </div>
  );
}

import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

/**
 * "Cutlery" (~3.9s). Dark, elegant line art. A plate, fork and knife draw
 * themselves in white lines, the logo settles on the plate, and then the
 * camera flies THROUGH the plate: it scales up past the screen while the
 * dark backdrop fades, landing on the live homepage.
 */
export default function Cutlery({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q }) => {
    const lines = q("[data-draw]");
    const [logo] = q("[data-logo]");
    const [name] = q("[data-name]");
    const [count] = q("[data-count]");
    const [stage] = q("[data-stage]");
    const [bg] = q("[data-bg]");
    const [svgWrap] = q("[data-svgwrap]");

    lines.forEach((el) => {
      const len = el.getTotalLength();
      gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
    });
    gsap.set(logo, { opacity: 0, scale: 0.7 });
    gsap.set(name, { opacity: 0, y: 14 });
    gsap.set(count.parentNode, { opacity: 0 });
    gsap.set(svgWrap, { transformOrigin: "50% 50%" });

    // draw order: plate rings, then fork, then knife
    tl.to(lines[0], { strokeDashoffset: 0, duration: 1.2, ease: "power2.inOut" }, 0.15);
    tl.to(lines[1], { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut" }, 0.35);
    tl.to(lines[2], { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut" }, 0.65);
    tl.to(lines[3], { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut" }, 0.8);
    tl.to(logo, { opacity: 1, scale: 1, duration: 0.9, ease: "back.out(1.5)" }, 1.4);
    tl.to(name, { opacity: 1, y: 0, duration: 0.8 }, 1.65);
    tl.to(count.parentNode, { opacity: 0.7, duration: 0.5 }, 1.6);
    tl.add(countTo(count, { duration: 1.3 }), 1.5);

    // Fly through the plate
    const exitAt = 3.0;
    tl.to([name, count.parentNode], { opacity: 0, duration: 0.3, ease: "power1.in" }, exitAt - 0.05);
    tl.to(svgWrap, { scale: 11, duration: 0.95, ease: "power3.in" }, exitAt);
    tl.to(svgWrap, { opacity: 0, duration: 0.3, ease: "power1.in" }, exitAt + 0.65);
    tl.to(bg, { opacity: 0, duration: 0.55, ease: "power2.inOut" }, exitAt + 0.4);
    tl.set(stage, { display: "none" }, exitAt + 1.0);
  });

  const stroke = { stroke: "#ffffff", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      <div data-bg className="absolute inset-0 bg-charcoal" />

      <div data-stage className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div data-svgwrap className="relative w-[clamp(300px,64vmin,560px)]">
          <svg viewBox="0 0 400 240" className="w-full overflow-visible">
            {/* plate: two rings drawn as one path each */}
            <path data-draw d="M284 120 a84 84 0 1 0 -168 0 a84 84 0 1 0 168 0" {...stroke} />
            <path data-draw d="M262 120 a62 62 0 1 0 -124 0 a62 62 0 1 0 124 0" {...stroke} strokeOpacity="0.45" />
            {/* fork */}
            <path data-draw d="M52 30 V92 C52 110 82 110 82 92 V30 M67 30 V104 M67 112 V212" {...stroke} />
            {/* knife */}
            <path data-draw d="M324 30 C350 52 350 124 324 144 V212 M324 30 V144" {...stroke} />
          </svg>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div data-logo>
              <BrandMark className="h-[clamp(40px,8vmin,68px)]" />
            </div>
          </div>
        </div>

        <div data-name className="mt-8">
          <BrandWordmark dark className="h-[clamp(18px,3.2vmin,28px)]" />
        </div>
        <p className="mt-4 font-mono text-xs tabular-nums text-cream">
          <span data-count>00</span>
          <span className="text-amber">%</span>
        </p>
      </div>
    </div>
  );
}

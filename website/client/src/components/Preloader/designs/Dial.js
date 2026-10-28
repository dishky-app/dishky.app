import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader } from "./common.js";

const N = 72;
const R_IN = 112;
const BASE = 14;
const PEAK = 18;

/**
 * "Dial" (~4s). LIGHT, precise, like a watch face. Seventy-two ticks ring
 * your logo; as the progress climbs, ticks turn brand red clockwise and the
 * ones near the leading edge stretch like a wave. A big number sits inside.
 * At 100 the dial zooms past the camera and the screen fades to the
 * homepage.
 */
export default function Dial({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const ticks = q("[data-tick]");
    const [ring] = q("[data-ring]");
    const [dial] = q("[data-dial]");
    const [inner] = q("[data-inner]");
    const [num] = q("[data-num]");
    const [name] = q("[data-name]");
    const [bg] = q("[data-bg]");

    const angles = ticks.map((_, i) => (i / N) * Math.PI * 2 - Math.PI / 2);
    const render = (p) => {
      const head = (p / 100) * N;
      ticks.forEach((t, i) => {
        const d = i + 0.5 - head;
        const len = BASE + PEAK * Math.exp(-(d * d) / 14);
        const r2 = R_IN + len;
        t.setAttribute("x2", (Math.cos(angles[i]) * r2).toFixed(2));
        t.setAttribute("y2", (Math.sin(angles[i]) * r2).toFixed(2));
        t.setAttribute("stroke", d <= 0 ? "#f33716" : "#c4c4c4");
      });
      num.textContent = String(Math.round(p)).padStart(2, "0");
    };
    render(0);

    gsap.set(dial, { opacity: 0, scale: 0.9, svgOrigin: undefined, transformOrigin: "50% 50%" });
    gsap.set(inner, { opacity: 0, y: 14 });
    gsap.set(name, { opacity: 0, y: 12 });

    tl.to(dial, { opacity: 1, scale: 1, duration: 1.0, ease: "power3.out" }, 0.1);
    tl.to(inner, { opacity: 1, y: 0, duration: 0.8 }, 0.3);
    tl.to(name, { opacity: 1, y: 0, duration: 0.8 }, 0.5);
    tl.to(ring, { rotation: 24, duration: 3.0, ease: "power1.inOut", transformOrigin: "50% 50%" }, 0.2);

    const p = { v: 0 };
    tl.to(p, { v: 100, duration: 2.4, ease: "power2.inOut", onUpdate: () => render(p.v) }, 0.4);

    const exitAt = 3.05;
    tl.to([inner, name], { opacity: 0, duration: 0.35, ease: "power1.in" }, exitAt - 0.1);
    tl.to(dial, { scale: 14, duration: 1.0, ease: "power3.in", transformOrigin: "50% 50%" }, exitAt);
    tl.to(dial, { opacity: 0, duration: 0.35, ease: "power1.in" }, exitAt + 0.65);
    tl.to(bg, { opacity: 0, duration: 0.55, ease: "power2.inOut" }, exitAt + 0.45);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      <div data-bg className="absolute inset-0 bg-[#f0f0f0]" />

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div data-dial className="relative w-[clamp(250px,58vmin,500px)]">
          <svg viewBox="-150 -150 300 300" className="w-full overflow-visible">
            <g data-ring>
              {Array.from({ length: N }).map((_, i) => {
                const a = (i / N) * Math.PI * 2 - Math.PI / 2;
                return (
                  <line
                    key={i}
                    data-tick
                    x1={Math.cos(a) * R_IN}
                    y1={Math.sin(a) * R_IN}
                    x2={Math.cos(a) * (R_IN + BASE)}
                    y2={Math.sin(a) * (R_IN + BASE)}
                    stroke="#c4c4c4"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          </svg>

          <div data-inner className="absolute inset-0 flex flex-col items-center justify-center">
            <BrandMark className="h-[clamp(30px,6vmin,50px)]" />
            <p className="mt-2 font-display font-extrabold tabular-nums leading-none tracking-[-0.04em] text-ink" style={{ fontSize: "clamp(3rem, 12vmin, 6.5rem)" }}>
              <span data-num>00</span>
            </p>
            <span className="mt-1 text-[clamp(0.6rem,1.4vmin,0.8rem)] font-bold uppercase tracking-[0.3em] text-ink/45">Percent</span>
          </div>
        </div>

        <div data-name className="mt-8">
          <BrandWordmark className="h-[clamp(16px,2.8vmin,24px)]" />
        </div>
      </div>
    </div>
  );
}

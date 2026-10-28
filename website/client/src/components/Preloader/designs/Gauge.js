import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader } from "./common.js";

const CX = 160;
const CY = 170;
const TICKS = Array.from({ length: 41 }, (_, i) => {
  const th = Math.PI - (i / 40) * Math.PI;
  const long = i % 5 === 0;
  const r1 = 134;
  const r2 = long ? 150 : 144;
  return { i, x1: CX + r1 * Math.cos(th), y1: CY - r1 * Math.sin(th), x2: CX + r2 * Math.cos(th), y2: CY - r2 * Math.sin(th), long };
});
const ARC = `M${CX - 120} ${CY} A120 120 0 0 1 ${CX + 120} ${CY}`;
const ARC_LEN = Math.PI * 120;

// polygon for a diagonal wipe from the top-left corner: visible = x% + y% >= s
const diag = (s) =>
  s <= 100
    ? `polygon(${s}% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${s}%)`
    : `polygon(100% ${s - 100}%, 100% 100%, ${s - 100}% 100%)`;

/**
 * "Gauge" (~4s). LIGHT, dashboard feel. A speedometer-style gauge: ticks
 * light up and a needle sweeps from 0 to 100 while the arc fills in brand
 * colour and a big readout counts up. The screen then peels away on a
 * diagonal from the top-left corner.
 */
export default function Gauge({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const [needle] = q("[data-needle]");
    const [arc] = q("[data-arc]");
    const ticks = q("[data-tick]");
    const [num] = q("[data-num]");
    const [wrap] = q("[data-wrap]");
    const [meta] = q("[data-meta]");

    gsap.set(arc, { strokeDasharray: ARC_LEN, strokeDashoffset: ARC_LEN });
    gsap.set(needle, { rotation: -90, svgOrigin: `${CX} ${CY}` });
    gsap.set(wrap, { opacity: 0, y: 24, scale: 0.97 });
    gsap.set(meta, { opacity: 0 });

    tl.to(wrap, { opacity: 1, y: 0, scale: 1, duration: 0.9 }, 0.1);
    tl.to(meta, { opacity: 1, duration: 0.7 }, 0.4);

    const p = { v: 0 };
    tl.to(
      p,
      {
        v: 100,
        duration: 2.5,
        ease: "power3.inOut",
        onUpdate: () => {
          const lit = Math.round((p.v / 100) * 40);
          ticks.forEach((t, i) => t.setAttribute("stroke", i <= lit && p.v > 0 ? (i === lit ? "#f33716" : "#1a1a1a") : "#d4d4d4"));
          arc.style.strokeDashoffset = ARC_LEN * (1 - p.v / 100);
          gsap.set(needle, { rotation: -90 + (p.v / 100) * 180 });
          num.textContent = String(Math.round(p.v)).padStart(2, "0");
        },
      },
      0.45
    );
    // a tiny settle on the needle at the end
    tl.to(needle, { rotation: 87, svgOrigin: `${CX} ${CY}`, duration: 0.25, ease: "power2.out", yoyo: true, repeat: 1 }, 3.0);

    const exitAt = 3.35;
    tl.to([wrap, meta], { opacity: 0, y: -14, duration: 0.4, ease: "power2.in" }, exitAt - 0.1);
    const s = { v: 0 };
    tl.to(s, { v: 200, duration: 1.0, ease: "expo.inOut", onUpdate: () => (root.style.clipPath = diag(s.v)) }, exitAt);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#f6f6f6]">
      <p data-meta className="absolute top-[clamp(24px,6vh,52px)] text-[clamp(0.65rem,1.3vw,0.8rem)] font-bold uppercase tracking-[0.24em] text-ink/50">
        Preparing your dashboard
      </p>

      <div data-wrap className="flex w-[clamp(280px,64vmin,560px)] flex-col items-center">
        <svg viewBox="0 0 320 196" className="w-full overflow-visible">
          <path d={ARC} fill="none" stroke="#e4e4e4" strokeWidth="16" strokeLinecap="round" />
          <path data-arc d={ARC} fill="none" stroke="#f33716" strokeWidth="16" strokeLinecap="round" />
          {TICKS.map((t) => (
            <line key={t.i} data-tick x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#d4d4d4" strokeWidth={t.long ? 2.4 : 1.4} strokeLinecap="round" />
          ))}
          <g data-needle>
            <path d={`M${CX - 4} ${CY} L${CX} ${CY - 100} L${CX + 4} ${CY} Z`} fill="#1a1a1a" />
          </g>
          <circle cx={CX} cy={CY} r="11" fill="#1a1a1a" />
          <circle cx={CX} cy={CY} r="4.5" fill="#f33716" />
        </svg>

        <p className="mt-3 font-display font-extrabold tabular-nums leading-none tracking-[-0.04em] text-ink" style={{ fontSize: "clamp(3.4rem, 11vw, 7rem)" }}>
          <span data-num>00</span>
          <span className="ml-1 align-top text-[0.3em] text-amber">%</span>
        </p>
      </div>

      <div data-meta className="absolute bottom-[clamp(24px,6vh,52px)]">
        <BrandWordmark className="h-[clamp(16px,2.8vmin,24px)]" />
      </div>
    </div>
  );
}

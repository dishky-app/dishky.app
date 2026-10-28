import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

const N = 8;
const R = 96;
const CRUST_IN = 87;
const GAP = 1.1;
const rad = (d) => (d * Math.PI) / 180;
const xy = (r, a) => [r * Math.cos(rad(a)), r * Math.sin(rad(a))];
const P = (r, a) => xy(r, a).map((v) => v.toFixed(2)).join(" ");
const sector = (a0, a1, r0, r1) =>
  r0 === 0
    ? `M0 0 L${P(r1, a0)} A${r1} ${r1} 0 0 1 ${P(r1, a1)} Z`
    : `M${P(r1, a0)} A${r1} ${r1} 0 0 1 ${P(r1, a1)} L${P(r0, a1)} A${r0} ${r0} 0 0 0 ${P(r0, a0)} Z`;

const SLICES = Array.from({ length: N }, (_, i) => {
  const a0 = -90 + i * (360 / N) + GAP;
  const a1 = -90 + (i + 1) * (360 / N) - GAP;
  return { i, a0, a1, m: (a0 + a1) / 2 };
});

/**
 * "Pizza" (~3.9s). Dark, warm. A pizza is assembled slice by slice: each
 * wedge glides in from outside, turning slightly, while the whole pie
 * rotates gently. When the last slice lands, every slice bursts outward and
 * the backdrop fades onto the homepage.
 */
export default function Pizza({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q }) => {
    const slices = q("[data-slice]");
    const [pie] = q("[data-pie]");
    const [logo] = q("[data-logo]");
    const [meta] = q("[data-meta]");
    const [count] = q("[data-count]");
    const [bg] = q("[data-bg]");
    const [glow] = q("[data-glow]");
    const [shadow] = q("[data-shadow]");

    gsap.set(slices, {
      x: (i) => Math.cos(rad(SLICES[i].m)) * 70,
      y: (i) => Math.sin(rad(SLICES[i].m)) * 70,
      rotation: (i) => (i % 2 ? 16 : -16),
      svgOrigin: "0 0",
      opacity: 0,
    });
    gsap.set(pie, { rotation: -30, scale: 0.94, svgOrigin: "0 0" });
    gsap.set(logo, { opacity: 0, y: -10 });
    gsap.set(meta, { opacity: 0 });
    gsap.set(glow, { opacity: 0 });

    tl.to(glow, { opacity: 1, duration: 1.2 }, 0);
    tl.to(logo, { opacity: 1, y: 0, duration: 0.8 }, 0.1);
    tl.to(meta, { opacity: 1, duration: 0.6 }, 0.3);
    tl.to(pie, { rotation: 60, scale: 1, duration: 3.0, ease: "power1.inOut" }, 0.2);
    tl.to(
      slices,
      { x: 0, y: 0, rotation: 0, opacity: 1, duration: 0.65, ease: "back.out(1.3)", stagger: 0.2 },
      0.4
    );
    tl.add(countTo(count, { duration: N * 0.2 + 0.4 }), 0.4);

    const exitAt = 2.85;
    tl.to([logo, meta], { opacity: 0, duration: 0.3 }, exitAt - 0.05);
    tl.to(
      slices,
      {
        x: (i) => Math.cos(rad(SLICES[i].m)) * 900,
        y: (i) => Math.sin(rad(SLICES[i].m)) * 900,
        rotation: (i) => (i % 2 ? 40 : -40),
        duration: 0.8,
        ease: "power3.in",
        stagger: 0.035,
      },
      exitAt
    );
    tl.to(shadow, { opacity: 0, duration: 0.4, ease: "power1.in" }, exitAt);
    tl.to(bg, { opacity: 0, duration: 0.6, ease: "power2.inOut" }, exitAt + 0.35);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      <div data-bg className="absolute inset-0 bg-charcoal" />
      <div
        data-glow
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% 52%, rgba(245.0,93.0,70.0,0.16) 0%, rgba(245.0,93.0,70.0,0) 55%)" }}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6">
        <div data-logo>
          <BrandMark className="h-[clamp(36px,6.5vmin,56px)]" />
        </div>
        <svg viewBox="-112 -112 224 224" className="w-[clamp(240px,52vmin,440px)] overflow-visible">
          <circle data-shadow r="106" fill="rgba(0,0,0,0.38)" />
          <g data-pie>
            {SLICES.map((s) => {
              const [p1x, p1y] = xy(54, s.m);
              const [p2x, p2y] = xy(74, s.m + (s.i % 2 ? 6 : -6));
              const [bx, by] = xy(30, s.m);
              return (
                <g key={s.i} data-slice>
                  <path d={sector(s.a0, s.a1, 0, CRUST_IN)} fill="#f6644d" />
                  <path d={sector(s.a0, s.a1, CRUST_IN, R)} fill="#f33416" />
                  <circle cx={p1x} cy={p1y} r="8.5" fill="#c23b2a" />
                  <circle cx={p1x - 2} cy={p1y - 2} r="2.6" fill="#e0675a" opacity="0.7" />
                  <circle cx={p2x} cy={p2y} r="6.5" fill="#b8321f" />
                  <ellipse cx={bx} cy={by} rx="5.5" ry="2.8" fill="#da270c" transform={`rotate(${s.m} ${bx} ${by})`} />
                </g>
              );
            })}
          </g>
        </svg>
        <p data-meta className="flex items-center gap-3 font-display text-xs tabular-nums text-cream">
          <span className="uppercase tracking-[0.2em] text-cream/55">Fresh out of the oven</span>
          <span>
            <span data-count>00</span>
            <span className="text-amber">%</span>
          </span>
        </p>
      </div>
    </div>
  );
}

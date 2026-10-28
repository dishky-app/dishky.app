import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader } from "./common.js";

const STRANDS = [
  { color: "#d8d8d8", w: 9, phase: 0, bMul: 1.7, yOff: 0, amp: 0.08 },
  { color: "#f7745f", w: 9, phase: 2.1, bMul: 1.5, yOff: 0.07, amp: 0.07 },
  { color: "#e7e7e7", w: 6, phase: 4.2, bMul: 1.9, yOff: -0.06, amp: 0.09 },
];

/**
 * "Noodle" (~3.9s). A bold tomato-red screen. Three strands of spaghetti
 * draw themselves across it in looping curves behind a huge counter. At
 * 100 the strands pull back out the way they came, and the red screen lifts
 * away upward.
 */
export default function Noodle({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const [svg] = q("[data-svg]");
    const strands = q("[data-strand]");
    const [num] = q("[data-num]");
    const [count] = q("[data-count]");
    const [meta] = q("[data-meta]");
    const W = window.innerWidth;
    const H = window.innerHeight;

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const loops = Math.max(5, Math.round(W / 190));
    const a = (W + 240) / (loops * 2 * Math.PI);

    strands.forEach((el, i) => {
      const s = STRANDS[i];
      const b = a * s.bMul;
      const steps = loops * 70;
      let d = "";
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const th = t * loops * 2 * Math.PI + s.phase;
        const x = -120 + a * (th - s.phase) - b * Math.sin(th);
        const yc = H / 2 + s.yOff * H + Math.sin(t * Math.PI * 2.4 + s.phase) * s.amp * H;
        const y = yc - b * Math.cos(th);
        d += `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
      }
      el.setAttribute("d", d);
      const len = el.getTotalLength();
      gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
      el.dataset.len = String(len);
    });

    gsap.set(num, { y: 40, opacity: 0 });
    gsap.set(meta, { opacity: 0 });

    tl.to(num, { y: 0, opacity: 1, duration: 0.9 }, 0.15);
    tl.to(meta, { opacity: 1, duration: 0.6 }, 0.3);
    strands.forEach((el, i) => {
      tl.to(el, { strokeDashoffset: 0, duration: 2.4, ease: "power2.inOut" }, 0.2 + i * 0.12);
    });
    const p = { v: 0 };
    tl.to(p, { v: 100, duration: 2.4, ease: "power2.inOut", onUpdate: () => (count.textContent = String(Math.round(p.v)).padStart(2, "0")) }, 0.25);

    const exitAt = 2.85;
    tl.to([num, meta], { opacity: 0, duration: 0.35, ease: "power1.in" }, exitAt);
    strands.forEach((el, i) => {
      tl.to(el, { strokeDashoffset: -Number(el.dataset.len), duration: 0.9, ease: "power2.inOut" }, exitAt + i * 0.06);
    });
    tl.to(root, { yPercent: -100, duration: 0.95, ease: "expo.inOut" }, exitAt + 0.15);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden bg-amber">
      <svg data-svg className="absolute inset-0 h-full w-full" fill="none">
        {STRANDS.map((s, i) => (
          <path key={i} data-strand stroke={s.color} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <p
          data-num
          className="font-display font-extrabold tabular-nums leading-none tracking-[-0.045em] text-[#1a1a1a]"
          style={{ fontSize: "clamp(7rem, 28vw, 24rem)" }}
        >
          <span data-count>00</span>
          <span className="ml-1 align-top text-[0.2em] font-bold">%</span>
        </p>
      </div>

      <div data-meta className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-[clamp(20px,4vw,64px)] pt-[clamp(20px,5vh,44px)]">
        <BrandWordmark dark className="h-[clamp(18px,3vmin,26px)]" />
        <p className="text-[clamp(0.65rem,1.3vw,0.8rem)] font-bold uppercase tracking-[0.22em] text-white/90">Twirling</p>
      </div>
    </div>
  );
}

import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader } from "./common.js";

const CUP = "M64 62 H176 L162 226 Q160.5 240 146 240 H94 Q79.5 240 78 226 Z";
const WAVE = "M-40 100 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V270 H-40 Z";
// pearl rest positions (bottom row first)
const PEARLS = [
  [92, 228], [106, 228], [120, 228], [134, 228], [148, 228],
  [99, 214], [113, 214], [127, 214], [141, 214],
  [106, 200], [120, 200], [134, 200],
  [113, 186], [127, 186],
];

/**
 * "Boba" (~3.9s). LIGHT. A bubble-tea cup: tapioca pearls drop in one by one
 * and settle at the bottom, then milk tea pours up around them while a red
 * straw bobs. Then the whole screen lifts away upward, cup and all, like
 * taking the lid off.
 */
export default function Boba({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const pearls = q("[data-pearl]");
    const [tea] = q("[data-tea]");
    const [wave] = q("[data-wave]");
    const [straw] = q("[data-straw]");
    const [cup] = q("[data-cup]");
    const [meta] = q("[data-meta]");
    const [count] = q("[data-count]");

    gsap.set(cup, { y: 30, opacity: 0 });
    gsap.set(pearls, { y: -230, opacity: 0 });
    gsap.set(tea, { y: 150 });
    gsap.set(meta, { opacity: 0 });
    gsap.to(wave, { x: -80, duration: 1.2, ease: "none", repeat: -1 });
    gsap.to(straw, { rotation: 2.5, svgOrigin: "128 120", duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: -1 });

    tl.to(cup, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, 0.1);
    tl.to(meta, { opacity: 1, duration: 0.6 }, 0.3);
    tl.to(pearls, { y: 0, opacity: 1, duration: 0.7, ease: "bounce.out", stagger: 0.085 }, 0.6);

    const p = { v: 0 };
    const teaAt = 1.2;
    tl.to(
      p,
      {
        v: 100,
        duration: 1.9,
        ease: "power1.inOut",
        onUpdate: () => {
          gsap.set(tea, { y: 150 * (1 - p.v / 100) });
          count.textContent = String(Math.round(p.v)).padStart(2, "0");
        },
      },
      teaAt
    );

    const exitAt = 3.2;
    tl.to(meta, { opacity: 0, duration: 0.3 }, exitAt - 0.05);
    tl.to(cup, { y: -20, scale: 1.05, duration: 0.45, ease: "power2.in" }, exitAt - 0.05);
    tl.to(root, { yPercent: -100, duration: 0.95, ease: "expo.inOut" }, exitAt + 0.05);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#ececec]">
      <div data-cup className="w-[clamp(200px,40vmin,330px)]">
        <svg viewBox="0 0 240 260" className="w-full overflow-visible">
          <defs>
            <clipPath id="dkBobaClip">
              <path d={CUP} />
            </clipPath>
          </defs>
          <path d={CUP} fill="rgba(255,255,255,0.7)" />
          <path data-straw d="M140 2 L124 150" fill="none" stroke="#f33716" strokeWidth="10" strokeLinecap="round" />
          <g clipPath="url(#dkBobaClip)">
            <g data-tea>
              <rect x="-40" y="104" width="320" height="170" fill="#f66a55" />
              <g data-wave>
                <path d={WAVE} fill="#f66a55" />
              </g>
            </g>
            {PEARLS.map(([x, y], i) => (
              <g key={i} data-pearl>
                <circle cx={x} cy={y} r="7.2" fill="#202020" />
                <circle cx={x - 2.2} cy={y - 2.4} r="2" fill="#e4290c" />
              </g>
            ))}
          </g>
          <path d={CUP} fill="none" stroke="#2f2f2f" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M72 90 L82 200" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="5" strokeLinecap="round" />
          <rect x="54" y="46" width="132" height="17" rx="8.5" fill="#2f2f2f" />
        </svg>
      </div>

      <div data-meta className="mt-6 flex flex-col items-center gap-3">
        <BrandWordmark className="h-[clamp(18px,3.2vmin,28px)]" />
        <p className="font-display text-xs tabular-nums text-[#2f2f2f]/70">
          <span className="uppercase tracking-[0.2em]">Shaking it up</span>
          <span className="ml-3">
            <span data-count>00</span>
            <span className="text-amber">%</span>
          </span>
        </p>
      </div>
    </div>
  );
}

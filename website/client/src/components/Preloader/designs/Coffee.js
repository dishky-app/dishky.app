import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader } from "./common.js";

const CUP = "M46 96 H194 V146 C194 192 160 220 120 220 C80 220 46 192 46 146 Z";
const WAVE = "M-40 100 q20 -7 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V250 H-40 Z";
const INK = "#2a2a2a";

/**
 * "Coffee" (~3.9s). LIGHT, warm. A cup fills from a thin stream of coffee;
 * the surface sloshes gently, steam curls up, and a latte-art heart appears
 * when the cup is full. The cup lifts and the whole screen wipes upward.
 */
export default function Coffee({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const [cup] = q("[data-cup]");
    const [coffee] = q("[data-coffee]");
    const [wave] = q("[data-wave]");
    const [stream] = q("[data-stream]");
    const steams = q("[data-steam]");
    const [surface] = q("[data-surface]");
    const [heart] = q("[data-heart]");
    const [meta] = q("[data-meta]");
    const [count] = q("[data-count]");

    gsap.set(cup, { y: 40, opacity: 0 });
    gsap.set(coffee, { y: 132 });
    gsap.set(stream, { scaleY: 0, transformOrigin: "50% 0%", opacity: 1 });
    gsap.set(surface, { opacity: 0 });
    gsap.set(heart, { opacity: 0, scale: 0.2, transformOrigin: "50% 50%" });
    gsap.set(meta, { opacity: 0 });
    steams.forEach((s) => {
      const len = s.getTotalLength();
      gsap.set(s, { strokeDasharray: len, strokeDashoffset: len, opacity: 0 });
    });
    gsap.to(wave, { x: -80, duration: 1.1, ease: "none", repeat: -1 });
    gsap.to(stream, { strokeDashoffset: -21, duration: 0.35, ease: "none", repeat: -1 });

    tl.to(cup, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out" }, 0.1);
    tl.to(meta, { opacity: 1, duration: 0.6 }, 0.3);
    tl.to(stream, { scaleY: 1, duration: 0.45, ease: "power2.out" }, 0.55);

    const p = { v: 0 };
    tl.to(
      p,
      {
        v: 100,
        duration: 2.1,
        ease: "power1.inOut",
        onUpdate: () => {
          gsap.set(coffee, { y: 132 * (1 - p.v / 100) });
          count.textContent = String(Math.round(p.v)).padStart(2, "0");
        },
      },
      0.7
    );

    // stream stops, surface + heart appear, steam curls
    tl.to(stream, { scaleY: 0, transformOrigin: "50% 100%", duration: 0.35, ease: "power2.in" }, 2.7);
    tl.to(surface, { opacity: 1, duration: 0.4 }, 2.75);
    tl.to(heart, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.8)" }, 2.9);
    steams.forEach((s, i) => {
      tl.to(s, { opacity: 0.4, strokeDashoffset: 0, duration: 0.9, ease: "sine.out" }, 2.8 + i * 0.12);
      tl.to(s, { y: -14, opacity: 0, duration: 0.8, ease: "sine.in" }, 3.4 + i * 0.1);
    });

    const exitAt = 3.55;
    tl.to(cup, { y: -24, scale: 1.04, duration: 0.5, ease: "power2.in" }, exitAt - 0.05);
    tl.to(meta, { opacity: 0, duration: 0.3 }, exitAt - 0.05);
    tl.to(root, { clipPath: "inset(0% 0% 100% 0%)", duration: 0.95, ease: "expo.inOut" }, exitAt + 0.05);
  });

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#eaeaea]"
      style={{ clipPath: "inset(0% 0% 0% 0%)" }}
    >
      <div data-cup className="w-[clamp(220px,44vmin,360px)]">
        <svg viewBox="0 0 240 250" className="w-full overflow-visible">
          <defs>
            <clipPath id="dkCupClip">
              <path d={CUP} />
            </clipPath>
          </defs>
          <ellipse cx="120" cy="226" rx="106" ry="14" fill="#d4d4d4" />
          <ellipse cx="120" cy="222" rx="90" ry="9" fill="#ededed" />

          {["M104 78 C96 64 112 54 104 38", "M122 70 C114 56 130 46 122 30", "M140 78 C132 64 148 54 140 38"].map((d, i) => (
            <path key={i} data-steam d={d} fill="none" stroke={INK} strokeOpacity="0.5" strokeWidth="5" strokeLinecap="round" />
          ))}

          <path d="M194 112 C234 110 234 178 188 178" fill="none" stroke={INK} strokeWidth="14" strokeLinecap="round" />
          <path d="M194 112 C234 110 234 178 188 178" fill="none" stroke="#f9f9f9" strokeWidth="6" strokeLinecap="round" />

          <ellipse cx="120" cy="96" rx="74" ry="10" fill="#e0e0e0" stroke={INK} strokeWidth="4" />
          <path d={CUP} fill="#f9f9f9" stroke={INK} strokeWidth="4" strokeLinejoin="round" />

          <g clipPath="url(#dkCupClip)">
            <g data-coffee>
              <rect x="-40" y="108" width="320" height="160" fill="#e4290c" />
              <g data-wave>
                <path d={WAVE} fill="#e4290c" />
              </g>
            </g>
          </g>

          <line data-stream x1="120" y1="-30" x2="120" y2="104" stroke="#e4290c" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="16 5" />

          <ellipse data-surface cx="120" cy="96" rx="72" ry="9" fill="#e4290c" />
          <g transform="translate(120 96) scale(1.5 0.55)">
            <g data-heart>
              <path d="M0 7 C-15 -5 -13 -17 -5 -17 C-1 -17 0 -13 0 -11 C0 -13 1 -17 5 -17 C13 -17 15 -5 0 7 Z" fill="#dcdcdc" />
            </g>
          </g>
          <path d="M46 96 A74 10 0 0 0 194 96" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>

      <div data-meta className="mt-6 flex flex-col items-center gap-3">
        <BrandWordmark className="h-[clamp(18px,3.2vmin,28px)]" />
        <p className="font-display text-xs tabular-nums text-[#2a2a2a]/70">
          <span className="uppercase tracking-[0.2em]">Brewing</span>
          <span className="ml-3">
            <span data-count>00</span>
            <span className="text-amber">%</span>
          </span>
        </p>
      </div>
    </div>
  );
}

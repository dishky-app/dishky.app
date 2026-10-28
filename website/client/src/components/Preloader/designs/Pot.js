import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader } from "./common.js";

const BODY = "M52 84 H208 V178 C208 208 188 222 160 222 H100 C72 222 52 208 52 178 Z";
const WAVE = "M-40 112 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V280 H-40 Z";
const BUBBLES = [[78, 8], [104, 5], [132, 9], [158, 6], [184, 7], [92, 4], [146, 5], [170, 8]];
const PIECES = [
  [90, 150, "#f33d21", 8], [150, 168, "#f33d21", 8], [120, 192, "#f33d21", 7],
  [74, 186, "#f44024", 4], [172, 148, "#f44024", 4], [128, 140, "#f44024", 4], [104, 176, "#f44024", 4],
];
const PUFFS = [[70, 74], [190, 74], [100, 62], [160, 62]];

/**
 * "Pot" (~4s). Dark. A glass pot of soup comes to a boil on a flame: broth
 * rises with the progress, bubbles stream up, carrots and peas drift, and the
 * lid starts to rattle harder and harder. At 100 the lid pops off the top
 * of the screen in a burst of steam and the backdrop fades.
 */
export default function Pot({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q }) => {
    const [water] = q("[data-water]");
    const [wave] = q("[data-wave]");
    const bubbles = q("[data-bubble]");
    const pieces = q("[data-piece]");
    const [lid] = q("[data-lid]");
    const puffs = q("[data-puff]");
    const flames = q("[data-flame]");
    const [pot] = q("[data-pot]");
    const [meta] = q("[data-meta]");
    const [count] = q("[data-count]");
    const [bg] = q("[data-bg]");

    gsap.set(pot, { y: 30, opacity: 0 });
    gsap.set(water, { y: 150 });
    gsap.set(meta, { opacity: 0 });
    gsap.set(puffs, { opacity: 0, scale: 0.4, transformOrigin: "50% 50%" });
    gsap.set(flames, { scaleY: 0, transformOrigin: "50% 100%" });
    gsap.to(wave, { x: -80, duration: 1.1, ease: "none", repeat: -1 });
    bubbles.forEach((b, i) => {
      gsap.fromTo(b, { y: 0, opacity: 0, scale: 0.6 }, { y: -92, opacity: 0.85, scale: 1, duration: 1.4 + i * 0.13, ease: "sine.in", repeat: -1, delay: i * 0.21 });
    });
    pieces.forEach((pc, i) => {
      gsap.to(pc, { y: i % 2 ? -6 : 6, rotation: i % 2 ? 40 : -40, svgOrigin: undefined, transformOrigin: "50% 50%", duration: 1.3 + i * 0.1, ease: "sine.inOut", yoyo: true, repeat: -1 });
    });

    tl.to(pot, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, 0.1);
    tl.to(meta, { opacity: 1, duration: 0.6 }, 0.3);
    tl.to(flames, { scaleY: 1, duration: 0.5, ease: "back.out(2)", stagger: 0.08 }, 0.5);
    flames.forEach((f, i) => {
      gsap.to(f, { scaleY: 1.18, duration: 0.18 + i * 0.03, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1 });
    });

    const p = { v: 0 };
    tl.to(
      p,
      {
        v: 100,
        duration: 2.2,
        ease: "power1.inOut",
        onUpdate: () => {
          gsap.set(water, { y: 150 * (1 - p.v / 100) });
          count.textContent = String(Math.round(p.v)).padStart(2, "0");
        },
      },
      0.65
    );

    // the lid rattles harder as it boils
    const rattle = gsap.to(lid, { y: -3, rotation: -1.5, svgOrigin: "130 84", duration: 0.2, ease: "sine.inOut", yoyo: true, repeat: -1, paused: true });
    tl.call(() => rattle.play(), null, 1.5);
    tl.call(() => rattle.timeScale(1.8), null, 2.1);
    tl.to(puffs, { opacity: 0.3, scale: 1, duration: 0.5, stagger: 0.1 }, 1.9);
    puffs.forEach((pf, i) => {
      gsap.to(pf, { y: -70, scale: 1.9, opacity: 0, duration: 1.3, ease: "sine.out", repeat: -1, delay: 2 + i * 0.3 });
    });

    // pop!
    const exitAt = 3.0;
    tl.call(() => rattle.kill(), null, exitAt);
    tl.to(meta, { opacity: 0, duration: 0.3 }, exitAt - 0.1);
    tl.to(lid, { y: -520, rotation: 460, svgOrigin: "130 84", duration: 0.95, ease: "power2.out" }, exitAt);
    tl.to(puffs, { scale: 3.2, opacity: 0.45, duration: 0.5, ease: "power2.out", stagger: 0.03 }, exitAt);
    tl.to(pot, { y: 16, opacity: 0, duration: 0.6, ease: "power2.in" }, exitAt + 0.35);
    tl.to(bg, { opacity: 0, duration: 0.6, ease: "power2.inOut" }, exitAt + 0.45);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      <div data-bg className="absolute inset-0 bg-charcoal">
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(circle at 50% 70%, rgba(244.0,77.0,51.0,0.16) 0%, rgba(244.0,77.0,51.0,0) 50%)" }}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div data-pot className="w-[clamp(230px,46vmin,380px)]">
          <svg viewBox="0 0 260 270" className="w-full overflow-visible">
            <defs>
              <clipPath id="dkPotClip">
                <path d={BODY} />
              </clipPath>
            </defs>

            {[95, 130, 165].map((x, i) => (
              <path
                key={x}
                data-flame
                d={`M${x} 262 C${x - 10} 252 ${x - 3} 246 ${x} 234 C${x + 3} 246 ${x + 10} 252 ${x} 262 Z`}
                fill={i === 1 ? "#f55238" : "#f44125"}
              />
            ))}
            <rect x="66" y="260" width="128" height="5" rx="2.5" fill="#4a4a4a" />

            <rect x="28" y="106" width="28" height="13" rx="6.5" fill="#a1a1a1" />
            <rect x="204" y="106" width="28" height="13" rx="6.5" fill="#a1a1a1" />

            <path d={BODY} fill="rgba(255,255,255,0.07)" />
            <g clipPath="url(#dkPotClip)">
              <g data-water>
                <rect x="-40" y="120" width="340" height="170" fill="#f44b31" opacity="0.92" />
                <g data-wave>
                  <path d={WAVE} fill="#f44b31" opacity="0.92" />
                </g>
                {PIECES.map(([x, y, c, r], i) => (
                  <g key={i} data-piece>
                    <ellipse cx={x} cy={y} rx={r} ry={r * 0.7} fill={c} />
                  </g>
                ))}
                {BUBBLES.map(([x, r], i) => (
                  <circle key={i} data-bubble cx={x} cy="208" r={r} fill="none" stroke="#e7e7e7" strokeWidth="2" />
                ))}
              </g>
            </g>
            <path d={BODY} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="4" strokeLinejoin="round" />

            {PUFFS.map(([x, y], i) => (
              <circle key={i} data-puff cx={x} cy={y} r="11" fill="#ffffff" />
            ))}

            <g data-lid>
              <path d="M58 84 C58 54 92 44 130 44 C168 44 202 54 202 84 Z" fill="#b1b1b1" />
              <rect x="54" y="81" width="152" height="9" rx="4.5" fill="#969696" />
              <circle cx="130" cy="40" r="8" fill="#757575" />
              <path d="M76 72 C80 60 94 54 110 52" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="4" strokeLinecap="round" />
            </g>
          </svg>
        </div>

        <div data-meta className="mt-3 flex flex-col items-center gap-3">
          <BrandWordmark dark className="h-[clamp(18px,3.2vmin,28px)]" />
          <p className="font-display text-xs tabular-nums text-cream">
            <span className="uppercase tracking-[0.2em] text-cream/55">Coming to a boil</span>
            <span className="ml-3">
              <span data-count>00</span>
              <span className="text-amber">%</span>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

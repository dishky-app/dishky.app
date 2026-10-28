import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

const LETTUCE = `M30 134 ${"q10 -12 20 0 t20 0 ".repeat(5)}V147 H30 Z`;
const SEEDS = [[92, 62, -20], [118, 48, 10], [146, 56, 25], [172, 74, 40], [76, 88, -40], [128, 80, 0], [102, 102, -10], [156, 98, 20]];

/**
 * "Burger" (~3.9s). Dark, warm. A burger is built layer by layer: bottom
 * bun, patty, cheese, lettuce, tomato, top bun. Each layer drops in with a
 * soft squash. Then the burger falls apart layer by layer, top first, and
 * the backdrop fades to the homepage.
 */
export default function Burger({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q }) => {
    const layers = q("[data-layer]"); // bottom -> top
    const [burger] = q("[data-burger]");
    const [shadow] = q("[data-shadow]");
    const [meta] = q("[data-meta]");
    const [count] = q("[data-count]");
    const [bg] = q("[data-bg]");

    gsap.set(layers, { y: -320, opacity: 0 });
    gsap.set(shadow, { opacity: 0, scaleX: 0.5, transformOrigin: "50% 50%" });
    gsap.set(meta, { opacity: 0 });

    tl.to(meta, { opacity: 1, duration: 0.6 }, 0.1);
    tl.to(shadow, { opacity: 1, scaleX: 1, duration: 1.4, ease: "power2.out" }, 0.3);
    layers.forEach((l, i) => {
      const at = 0.35 + i * 0.27;
      tl.to(l, { y: 0, opacity: 1, duration: 0.65, ease: "back.out(1.5)" }, at);
      tl.to(burger, { scaleY: 0.965, duration: 0.09, ease: "power1.out", yoyo: true, repeat: 1, svgOrigin: "130 214" }, at + 0.34);
    });
    tl.add(countTo(count, { duration: layers.length * 0.27 + 0.2 }), 0.35);

    const exitAt = 2.7;
    tl.to(meta, { opacity: 0, duration: 0.3 }, exitAt - 0.1);
    tl.to(burger, { y: -6, duration: 0.2, ease: "power2.out" }, exitAt - 0.1);
    tl.to(
      layers,
      {
        y: 900,
        rotation: (i) => (i % 2 ? 14 : -14),
        svgOrigin: "130 120",
        duration: 0.85,
        ease: "power2.in",
        stagger: { each: 0.07, from: "end" },
      },
      exitAt
    );
    tl.to(shadow, { opacity: 0, duration: 0.4 }, exitAt);
    tl.to(bg, { opacity: 0, duration: 0.6, ease: "power2.inOut" }, exitAt + 0.5);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      <div data-bg className="absolute inset-0 bg-charcoal">
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(circle at 50% 50%, rgba(245.0,85.0,60.0,0.14) 0%, rgba(245.0,85.0,60.0,0) 55%)" }}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <svg viewBox="0 0 260 236" className="w-[clamp(240px,50vmin,420px)] overflow-visible">
          <ellipse data-shadow cx="130" cy="224" rx="104" ry="9" fill="rgba(0,0,0,0.5)" />
          <g data-burger>
            <g data-layer>
              <path d="M42 176 H218 V184 C218 202 202 212 184 212 H76 C58 212 42 202 42 184 Z" fill="#f5563d" />
              <path d="M52 200 H208" stroke="#f22f11" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
            </g>
            <g data-layer>
              <rect x="36" y="150" width="188" height="26" rx="13" fill="#e4290c" />
              <rect x="50" y="154" width="160" height="5" rx="2.5" fill="#e4290c" opacity="0.7" />
            </g>
            <g data-layer>
              <path d="M34 142 H226 L214 152 L196 170 L178 152 H82 L64 170 L46 152 Z" fill="#f5604a" />
            </g>
            <g data-layer>
              <path d={LETTUCE} fill="#f12b0d" />
            </g>
            <g data-layer>
              <rect x="46" y="118" width="168" height="17" rx="8.5" fill="#d9432f" />
              <rect x="60" y="122" width="140" height="4" rx="2" fill="#ee7260" opacity="0.7" />
            </g>
            <g data-layer>
              <path d="M38 122 C38 58 80 26 130 26 C180 26 222 58 222 122 Z" fill="#f55b43" />
              <path d="M62 100 C66 66 92 44 120 40" fill="none" stroke="#f99585" strokeWidth="6" strokeLinecap="round" opacity="0.6" />
              {SEEDS.map(([x, y, r], i) => (
                <ellipse key={i} cx={x} cy={y} rx="5.5" ry="2.6" fill="#eaeaea" transform={`rotate(${r} ${x} ${y})`} />
              ))}
            </g>
          </g>
        </svg>

        <div data-meta className="mt-8 flex flex-col items-center gap-3">
          <BrandWordmark dark className="h-[clamp(18px,3.2vmin,28px)]" />
          <p className="font-display text-xs tabular-nums text-cream">
            <span className="uppercase tracking-[0.2em] text-cream/55">Stacking your order</span>
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

import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

const TABLES = [
  [110, 70], [190, 70], [110, 150], [190, 150], [300, 200], [390, 200],
];
const CHAIRS = [[0, -25], [25, 0], [0, 25], [-25, 0]];
const STRIPS = 8;
const stroke = { stroke: "#ffffff", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };

/**
 * "Blueprint" (~3.9s). Dark, architectural. A restaurant floor plan draws
 * itself in white line: walls, kitchen, bar, door, then tables with chairs.
 * The tables light up in brand red one by one (every table booked), then
 * venetian blinds close open from the top and reveal the live homepage.
 */
export default function Blueprint({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q }) => {
    const walls = q("[data-wall]");
    const tcircles = q("[data-tcircle]");
    const chairs = q("[data-chair]");
    const fills = q("[data-tfill]");
    const labels = q("[data-label]");
    const [logo] = q("[data-logo]");
    const [meta] = q("[data-meta]");
    const [count] = q("[data-count]");
    const [content] = q("[data-content]");
    const strips = q("[data-strip]");

    [...walls, ...tcircles].forEach((el) => {
      const len = el.getTotalLength();
      gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
    });
    gsap.set(chairs, { scale: 0, transformOrigin: "50% 50%" });
    gsap.set(fills, { opacity: 0, scale: 0.4, transformOrigin: "50% 50%" });
    gsap.set(labels, { opacity: 0 });
    gsap.set(logo, { opacity: 0, y: 10 });
    gsap.set(meta, { opacity: 0 });
    gsap.set(strips, { transformOrigin: "50% 0%" });

    tl.to(walls[0], { strokeDashoffset: 0, duration: 1.2, ease: "power2.inOut" }, 0.15);
    tl.to(walls.slice(1), { strokeDashoffset: 0, duration: 0.9, ease: "power2.inOut", stagger: 0.12 }, 0.6);
    tl.to(tcircles, { strokeDashoffset: 0, duration: 0.5, ease: "power2.out", stagger: 0.07 }, 0.95);
    tl.to(chairs, { scale: 1, duration: 0.35, ease: "back.out(2.5)", stagger: 0.02 }, 1.2);
    tl.to(labels, { opacity: 0.55, duration: 0.6 }, 1.3);
    tl.to(logo, { opacity: 1, y: 0, duration: 0.8 }, 0.5);
    tl.to(meta, { opacity: 1, duration: 0.6 }, 0.6);
    tl.add(countTo(count, { duration: 1.9 }), 0.55);

    fills.forEach((f, i) => {
      tl.to(f, { opacity: 0.95, scale: 1, duration: 0.35, ease: "back.out(2)" }, 1.55 + i * 0.14);
    });

    // blinds
    const exitAt = 2.85;
    tl.to(content, { opacity: 0, scale: 1.03, duration: 0.4, ease: "power2.in" }, exitAt);
    tl.to(strips, { scaleY: 0, duration: 0.6, ease: "power3.inOut", stagger: 0.07 }, exitAt + 0.15);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      <div className="absolute inset-0 flex flex-col">
        {Array.from({ length: STRIPS }).map((_, i) => (
          <div key={i} data-strip className="flex-1 bg-[#171717]" style={{ marginBottom: i === STRIPS - 1 ? 0 : -1 }} />
        ))}
      </div>

      <div data-content className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
            WebkitMaskImage: "radial-gradient(ellipse 75% 65% at 50% 50%, #000000 25%, transparent 80%)",
            maskImage: "radial-gradient(ellipse 75% 65% at 50% 50%, #000000 25%, transparent 80%)",
          }}
        />

        <div className="relative w-[clamp(300px,72vmin,640px)]">
          <svg viewBox="0 0 480 300" className="w-full overflow-visible">
            {/* outer walls with a door gap */}
            <path data-wall d="M160 280 H20 V20 H460 V280 H200" {...stroke} />
            {/* kitchen, bar, door swing */}
            <path data-wall d="M300 20 V120 H460" {...stroke} />
            <path data-wall d="M34 50 H52 V160 H34 Z" {...stroke} />
            <path data-wall d="M200 280 A40 40 0 0 0 160 240" {...stroke} strokeOpacity="0.5" />

            {TABLES.map(([x, y], i) => (
              <g key={i}>
                <circle data-tfill cx={x} cy={y} r="16" fill="#f33716" />
                <circle data-tcircle cx={x} cy={y} r="16" {...stroke} />
                {CHAIRS.map(([dx, dy], ci) => (
                  <circle key={ci} data-chair cx={x + dx} cy={y + dy} r="4.5" {...stroke} strokeWidth="1.6" />
                ))}
              </g>
            ))}

            <g fill="#ffffff" fontSize="9" letterSpacing="2.5" textAnchor="middle" fontWeight="700">
              <text data-label x="375" y="76">KITCHEN</text>
              <text data-label x="43" y="108" transform="rotate(-90 43 108)">BAR</text>
              <text data-label x="180" y="298">ENTRANCE</text>
            </g>
          </svg>
        </div>

        <div data-logo className="mt-8">
          <BrandMark className="h-[clamp(34px,6vmin,52px)]" />
        </div>
        <p data-meta className="mt-4 flex items-center gap-3 font-display text-xs tabular-nums text-cream">
          <span className="uppercase tracking-[0.2em] text-cream/55">Laying out the floor</span>
          <span>
            <span data-count>00</span>
            <span className="text-amber">%</span>
          </span>
        </p>
      </div>
    </div>
  );
}

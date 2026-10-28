import React from "react";
import useMediaQuery from "../../../hooks/useMediaQuery.js";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

/**
 * "Mosaic" (~3.9s). Dark. The screen is a grid of tiles. A wave of brand
 * colour ripples out from the centre, the logo and counter settle in, then
 * the tiles shrink away in a second wave from the centre, uncovering the
 * live homepage tile by tile.
 */
export default function Mosaic({ onComplete }) {
  const compact = useMediaQuery("(max-width: 767px)");
  const cols = compact ? 6 : 16;
  const rows = compact ? 12 : 9;

  const rootRef = usePreloader(onComplete, ({ tl, q }) => {
    const tiles = q("[data-tile]");
    const [content] = q("[data-content]");
    const [mark] = q("[data-mark]");
    const [name] = q("[data-name]");
    const [count] = q("[data-count]");
    const grid = [cols, rows];

    gsap.set(tiles, { scale: 1.02 });
    gsap.set([mark, name], { opacity: 0, y: 20 });
    gsap.set(count.parentNode, { opacity: 0 });

    // Wave in: colour floods out from the centre, then drains back the same way
    tl.to(
      tiles,
      { backgroundColor: "#f33716", duration: 0.4, ease: "power2.out", stagger: { amount: 0.8, from: "center", grid } },
      0.2
    );
    tl.to(
      tiles,
      { backgroundColor: "#1a1a1a", duration: 0.45, ease: "power2.inOut", stagger: { amount: 0.8, from: "center", grid } },
      1.15
    );
    tl.to(mark, { opacity: 1, y: 0, duration: 0.9 }, 1.5);
    tl.to(name, { opacity: 1, y: 0, duration: 0.9 }, 1.65);
    tl.to(count.parentNode, { opacity: 0.8, duration: 0.6 }, 1.7);
    tl.add(countTo(count, { duration: 1.2 }), 1.7);

    // Wave out
    const exitAt = 3.1;
    tl.to(content, { opacity: 0, scale: 0.94, duration: 0.45, ease: "power2.in" }, exitAt);
    tl.to(
      tiles,
      {
        scale: 0,
        duration: 0.5,
        ease: "power3.in",
        stagger: { amount: 0.75, from: "center", grid },
      },
      exitAt + 0.15
    );
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      <div
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
      >
        {Array.from({ length: cols * rows }).map((_, i) => (
          <div key={i} data-tile className="bg-charcoal will-change-transform" />
        ))}
      </div>

      <div data-content className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div data-mark>
          <BrandMark className="h-[clamp(56px,11vmin,92px)]" />
        </div>
        <div data-name className="mt-5">
          <BrandWordmark dark className="h-[clamp(20px,3.6vmin,30px)]" />
        </div>
        <p className="mt-6 font-mono text-xs tabular-nums text-cream">
          <span data-count>00</span>
          <span className="text-amber">%</span>
        </p>
      </div>
    </div>
  );
}

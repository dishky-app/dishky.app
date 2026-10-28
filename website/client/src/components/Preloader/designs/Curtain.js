import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

const CURVE = { borderRadius: "0 0 50% 50% / 0 0 100% 100%" };

/**
 * "Curtain" (~4s). Dark, calm and minimal: your logo, a hairline progress
 * bar and a quiet counter. The screen then lifts away as a curtain with a
 * soft curved lower edge that flattens as it rises, with a thin band of
 * brand colour trailing just behind it.
 */
export default function Curtain({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q }) => {
    const [panel] = q("[data-panel]");
    const [accent] = q("[data-accent]");
    const curves = q("[data-curve]");
    const [logo] = q("[data-logo]");
    const [name] = q("[data-name]");
    const [bar] = q("[data-bar]");
    const [meta] = q("[data-meta]");
    const [count] = q("[data-count]");
    const [content] = q("[data-content]");
    const H = window.innerHeight;

    gsap.set(curves, { transformOrigin: "50% 0%" });
    gsap.set([logo, name], { opacity: 0, y: 18 });
    gsap.set(bar, { scaleX: 0 });
    gsap.set(meta, { opacity: 0 });

    tl.to(logo, { opacity: 1, y: 0, duration: 1.0 }, 0.2);
    tl.to(name, { opacity: 1, y: 0, duration: 1.0 }, 0.4);
    tl.to(meta, { opacity: 1, duration: 0.7 }, 0.6);
    tl.to(bar, { scaleX: 1, duration: 2.2, ease: "power2.inOut" }, 0.6);
    tl.add(countTo(count, { duration: 2.2 }), 0.6);

    const exitAt = 3.05;
    tl.to(content, { y: -30, opacity: 0, duration: 0.5, ease: "power2.in" }, exitAt);
    tl.to(panel, { y: -H * 1.25, duration: 1.1, ease: "expo.inOut" }, exitAt + 0.05);
    tl.to(accent, { y: -H * 1.25, duration: 1.1, ease: "expo.inOut" }, exitAt + 0.17);
    tl.to(curves, { scaleY: 0.25, duration: 1.1, ease: "power2.inOut" }, exitAt + 0.05);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      <div data-accent className="absolute inset-0 bg-amber will-change-transform">
        <div data-curve className="absolute inset-x-0 top-full h-[20vh] bg-amber" style={CURVE} />
      </div>
      <div data-panel className="absolute inset-0 bg-charcoal will-change-transform">
        <div data-curve className="absolute inset-x-0 top-full h-[20vh] bg-charcoal" style={CURVE} />
      </div>

      <div data-content className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div data-logo>
          <BrandMark className="h-[clamp(48px,9vmin,76px)]" />
        </div>
        <div data-name className="mt-5">
          <BrandWordmark dark className="h-[clamp(18px,3.2vmin,28px)]" />
        </div>
        <div data-meta className="mt-10 flex w-[min(72vw,280px)] items-center gap-4">
          <div className="h-px flex-1 bg-cream/15">
            <div data-bar className="h-full origin-left bg-amber" />
          </div>
          <p className="font-mono text-xs tabular-nums text-cream/80">
            <span data-count>00</span>
            <span className="text-amber">%</span>
          </p>
        </div>
      </div>
    </div>
  );
}

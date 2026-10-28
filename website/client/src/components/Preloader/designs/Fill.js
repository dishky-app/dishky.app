import React from "react";
import { BrandMark } from "../../Brand/Brand.js";
import { gsap } from "../../../animations/gsapSetup.js";
import { usePreloader, countTo } from "./common.js";

/**
 * "Fill" (~3.6s). Dark and typographic. A huge DISHKY sits ghosted; brand
 * colour pours up through the letters as the counter climbs. At 100 it
 * holds a beat, then the screen wipes upward, with a strip of brand colour
 * trailing the dark panel's edge.
 */
export default function Fill({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q }) => {
    const [fill] = q("[data-fill]");
    const [word] = q("[data-word]");
    const [count] = q("[data-count]");
    const [meta] = q("[data-meta]");
    const [dark] = q("[data-dark]");
    const [accent] = q("[data-accent]");
    const [content] = q("[data-content]");

    gsap.set(fill, { clipPath: "inset(100% 0% 0% 0%)" });
    gsap.set(word, { y: 40, opacity: 0 });
    gsap.set(meta, { opacity: 0, y: 14 });

    tl.to(word, { y: 0, opacity: 1, duration: 1.0, ease: "power3.out" }, 0.1);
    tl.to(meta, { opacity: 1, y: 0, duration: 0.8 }, 0.35);
    tl.to(fill, { clipPath: "inset(0% 0% 0% 0%)", duration: 2.3, ease: "power2.inOut" }, 0.4);
    tl.add(countTo(count, { duration: 2.3 }), 0.4);
    // little overshoot when it hits 100
    tl.to(word, { scale: 1.025, duration: 0.25, ease: "power2.out", yoyo: true, repeat: 1 }, 2.75);

    const wipeAt = 3.0;
    tl.to(content, { y: -50, opacity: 0, duration: 0.5, ease: "power2.in" }, wipeAt);
    tl.to(dark, { clipPath: "inset(0% 0% 100% 0%)", duration: 0.95, ease: "expo.inOut" }, wipeAt + 0.05);
    tl.to(accent, { clipPath: "inset(0% 0% 100% 0%)", duration: 0.95, ease: "expo.inOut" }, wipeAt + 0.2);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      <div data-accent className="absolute inset-0 bg-amber" style={{ clipPath: "inset(0% 0% 0% 0%)" }} />
      <div data-dark className="absolute inset-0 bg-charcoal" style={{ clipPath: "inset(0% 0% 0% 0%)" }} />

      <div data-content className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="absolute left-[clamp(20px,4vw,64px)] top-[clamp(20px,5vh,48px)]">
          <BrandMark className="h-[clamp(32px,5vmin,44px)]" />
        </div>

        <div data-word className="relative select-none font-display text-[clamp(3.5rem,21vw,19rem)] font-extrabold leading-[0.85] tracking-[-0.045em]">
          <span className="block text-cream/[0.09]">DISHKY</span>
          <span data-fill className="absolute inset-0 block text-amber">DISHKY</span>
        </div>

        <div data-meta className="absolute inset-x-0 bottom-[clamp(28px,7vh,64px)] flex items-end justify-between px-[clamp(20px,4vw,64px)]">
          <p className="max-w-[16rem] text-[clamp(0.7rem,1.4vw,0.9rem)] font-medium uppercase tracking-[0.2em] text-cream/60">
            Setting up your restaurant
          </p>
          <p className="font-display text-[clamp(1.5rem,4vw,3rem)] font-bold tabular-nums text-cream">
            <span data-count>00</span>
            <span className="text-amber">%</span>
          </p>
        </div>
      </div>
    </div>
  );
}

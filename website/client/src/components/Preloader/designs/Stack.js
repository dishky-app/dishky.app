import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

const N = 7;

/**
 * "Stack" (~3.9s). Dark and playful. Plates drop onto a stack one after
 * another, each with a little bounce, and your logo lands on top. Then the
 * table is cleared: the plates fly off to alternating sides, top first, and
 * the dark backdrop fades to the live homepage.
 */
export default function Stack({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q }) => {
    const plates = q("[data-plate]"); // index 0 = bottom plate
    const [logo] = q("[data-logo]");
    const [name] = q("[data-name]");
    const [shadow] = q("[data-shadow]");
    const [count] = q("[data-count]");
    const [bg] = q("[data-bg]");
    const [meta] = q("[data-meta]");
    const H = window.innerHeight;
    const W = window.innerWidth;

    gsap.set(plates, { y: -H * 0.7, opacity: 0 });
    gsap.set(logo, { y: -H * 0.7, opacity: 0 });
    gsap.set(name, { opacity: 0, y: 12 });
    gsap.set(shadow, { scaleX: 0.3, opacity: 0 });
    gsap.set(meta, { opacity: 0 });

    tl.to(meta, { opacity: 1, duration: 0.6 }, 0.1);
    tl.to(shadow, { opacity: 1, duration: 0.5 }, 0.3);
    plates.forEach((p, i) => {
      const at = 0.35 + i * 0.21;
      tl.to(p, { y: 0, opacity: 1, duration: 0.75, ease: "bounce.out" }, at);
      tl.to(shadow, { scaleX: 0.45 + (i / (N - 1)) * 0.55, duration: 0.4, ease: "power2.out" }, at + 0.2);
    });
    tl.add(countTo(count, { duration: 1.9 }), 0.35);

    const logoAt = 0.35 + N * 0.21 + 0.1;
    tl.to(logo, { y: 0, opacity: 1, duration: 0.8, ease: "bounce.out" }, logoAt);
    tl.to(name, { opacity: 1, y: 0, duration: 0.7 }, logoAt + 0.25);

    // Clear the table
    const exitAt = logoAt + 1.15;
    tl.to(name, { opacity: 0, duration: 0.25 }, exitAt - 0.05);
    tl.to(meta, { opacity: 0, duration: 0.25 }, exitAt - 0.05);
    tl.to(logo, { y: -H * 0.5, opacity: 0, duration: 0.6, ease: "power3.in" }, exitAt);
    tl.to(
      plates,
      {
        x: (i) => (i % 2 ? 1 : -1) * W * 0.9,
        rotation: (i) => (i % 2 ? 1 : -1) * 24,
        duration: 0.7,
        ease: "power3.in",
        stagger: { each: 0.07, from: "end" },
      },
      exitAt + 0.05
    );
    tl.to(shadow, { opacity: 0, duration: 0.4 }, exitAt + 0.1);
    tl.to(bg, { opacity: 0, duration: 0.6, ease: "power2.inOut" }, exitAt + 0.5);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      <div data-bg className="absolute inset-0 bg-charcoal" />

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="relative flex flex-col items-center">
          <div data-logo className="mb-3">
            <BrandMark className="h-[clamp(48px,9vmin,80px)]" />
          </div>

          <div className="flex flex-col-reverse items-center">
            {Array.from({ length: N }).map((_, i) => (
              <div
                key={i}
                data-plate
                className={`-mt-[3px] h-[15px] w-[clamp(190px,36vmin,300px)] rounded-[50%/100%] shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)] ${
                  i === N - 1 ? "bg-gradient-to-b from-[#ff6a4d] to-amber" : "bg-gradient-to-b from-white to-[#cecece]"
                }`}
              />
            ))}
          </div>

          <div
            data-shadow
            className="mt-1 h-[10px] w-[clamp(220px,42vmin,340px)] rounded-[50%] bg-black/60 blur-md"
          />

          <div data-name className="mt-7">
            <BrandWordmark dark className="h-[clamp(18px,3.2vmin,28px)]" />
          </div>
        </div>

        <div data-meta className="absolute bottom-[clamp(28px,7vh,64px)] flex items-center gap-3 font-display text-xs tabular-nums text-cream">
          <span className="uppercase tracking-[0.2em] text-cream/55">Setting the table</span>
          <span>
            <span data-count>00</span>
            <span className="text-amber">%</span>
          </span>
        </div>
      </div>
    </div>
  );
}

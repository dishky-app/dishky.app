import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { usePreloader, countTo } from "./common.js";

const WORD = "DISHKY".split("");
const WIDTHS = { D: 0.74, I: 0.34, S: 0.64, H: 0.76, K: 0.7, Y: 0.68 };
const ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const COLS = 10;
const BG = "#f0f0f0";

// deterministic filler letters, ending on the target letter
const strip = (target, i) => {
  let seed = (i + 3) * 9301;
  const out = [];
  for (let k = 0; k < 14; k++) {
    seed = (seed * 49297 + 233280) % 233280;
    out.push(ALPH[seed % 26]);
  }
  out.push(target);
  return out;
};
const STRIPS = WORD.map(strip);

/**
 * "Scramble" (~4s). LIGHT, typographic. Each letter of DISHKY is a slot
 * reel that spins through random letters and lands on the right one, left to
 * right, while a line underneath draws and the counter climbs. The screen
 * then opens as ten interlaced columns sliding alternately up and down.
 */
export default function Scramble({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q }) => {
    const reels = q("[data-reel]");
    const [line] = q("[data-line]");
    const [meta] = q("[data-meta]");
    const [word] = q("[data-word]");
    const [rule] = q("[data-rule]");
    const cols = q("[data-col]");

    gsap.set(reels, { yPercent: 0 });
    gsap.set(line, { scaleX: 0, transformOrigin: "0% 50%" });
    gsap.set(meta, { opacity: 0 });
    gsap.set(word, { opacity: 0 });

    tl.to(word, { opacity: 1, duration: 0.5 }, 0.1);
    tl.to(meta, { opacity: 1, duration: 0.6 }, 0.3);
    reels.forEach((r, i) => {
      const n = STRIPS[i].length;
      tl.to(r, { yPercent: -((n - 1) / n) * 100, duration: 1.4, ease: "power3.inOut" }, 0.35 + i * 0.13);
    });
    tl.add(countTo(meta.querySelector("[data-count]"), { duration: 2.1 }), 0.35);
    tl.to(line, { scaleX: 1, duration: 1.8, ease: "power2.inOut" }, 0.6);

    const exitAt = 2.95;
    tl.to([word, meta, rule], { opacity: 0, y: -16, duration: 0.4, ease: "power2.in" }, exitAt - 0.05);
    tl.to(cols, { yPercent: (i) => (i % 2 ? 101 : -101), duration: 0.95, ease: "expo.inOut", stagger: { each: 0.05, from: "center" } }, exitAt + 0.05);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      <div className="absolute inset-0 flex">
        {Array.from({ length: COLS }).map((_, i) => (
          <div key={i} data-col className="h-full flex-1 will-change-transform" style={{ background: BG, marginRight: i === COLS - 1 ? 0 : -1 }} />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div data-word className="flex font-display font-extrabold tracking-[-0.04em] text-ink" style={{ fontSize: "clamp(3.4rem, 17vw, 15rem)", lineHeight: 1 }}>
          {WORD.map((ch, i) => (
            <span key={i} className="block" style={{ width: `${WIDTHS[ch]}em`, height: "1em", clipPath: "inset(0 -0.6em)" }}>
              <span data-reel className="block will-change-transform">
                {STRIPS[i].map((l, k) => (
                  <span key={k} className="block text-center" style={{ height: "1em", lineHeight: 1 }}>
                    {l}
                  </span>
                ))}
              </span>
            </span>
          ))}
        </div>
        <div data-rule className="mt-6 h-[3px] w-[clamp(200px,40vw,420px)] bg-ink/10">
          <div data-line className="h-full bg-amber" />
        </div>
        <p data-meta className="mt-5 font-display text-xs tabular-nums text-ink/60">
          <span className="uppercase tracking-[0.2em]">Restaurant operating system</span>
          <span className="ml-3">
            <span data-count>00</span>
            <span className="text-amber">%</span>
          </span>
        </p>
      </div>
    </div>
  );
}

import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
)}")`;

// tomato, orange, basil, cream
const BLOBS = [
  { c: "#f33716", s: "64vmax", l: "-14%", t: "-18%", dx: 18, dy: 12 },
  { c: "#f55e47", s: "50vmax", l: "52%", t: "-14%", dx: -16, dy: 18 },
  { c: "#e4290c", s: "46vmax", l: "46%", t: "50%", dx: -14, dy: -16 },
  { c: "#d4d4d4", s: "34vmax", l: "-4%", t: "56%", dx: 20, dy: -12 },
];

/**
 * "Sauce" (~4s). A slow, grainy mesh-gradient in tomato, orange, basil and
 * cream drifts behind a huge white counter, like sauce swirling in a pan.
 * At 100 the colours flood the screen and the whole thing dissolves onto
 * the homepage.
 */
export default function Sauce({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const blobs = q("[data-blob]");
    const [num] = q("[data-num]");
    const [count] = q("[data-count]");
    const [top] = q("[data-top]");
    const [bottom] = q("[data-bottom]");
    const [content] = q("[data-content]");

    blobs.forEach((b, i) => {
      gsap.to(b, { x: `${BLOBS[i].dx}vmin`, y: `${BLOBS[i].dy}vmin`, duration: 4 + i * 0.9, ease: "sine.inOut", yoyo: true, repeat: -1 });
    });
    gsap.set(blobs, { scale: 0.45, opacity: 0 });
    gsap.set(num, { y: 50, opacity: 0 });
    gsap.set([top, bottom], { opacity: 0, y: 14 });

    tl.to(blobs, { scale: 1, opacity: 1, duration: 1.6, ease: "power2.out", stagger: 0.15 }, 0);
    tl.to(num, { y: 0, opacity: 1, duration: 1.0 }, 0.2);
    tl.to([top, bottom], { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 }, 0.4);
    tl.add(countTo(count, { duration: 2.3 }), 0.35);

    const exitAt = 2.85;
    tl.to(content, { opacity: 0, scale: 1.05, duration: 0.5, ease: "power2.in" }, exitAt);
    tl.to(blobs, { scale: 2.8, duration: 1.0, ease: "power3.in", stagger: 0.05 }, exitAt);
    tl.to(root, { opacity: 0, duration: 0.55, ease: "power2.inOut" }, exitAt + 0.75);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden bg-[#161616]">
      {BLOBS.map((b, i) => (
        <div
          key={i}
          data-blob
          className="absolute rounded-full will-change-transform"
          style={{ width: b.s, height: b.s, left: b.l, top: b.t, background: b.c, filter: "blur(90px)", opacity: 0.85 }}
        />
      ))}
      <div className="absolute inset-0 opacity-[0.35] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />

      <div data-content className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div data-top className="absolute top-[clamp(24px,6vh,52px)]">
          <BrandWordmark dark className="h-[clamp(20px,3.4vmin,30px)]" />
        </div>
        <p
          data-num
          className="font-display font-extrabold tabular-nums leading-none tracking-[-0.045em] text-white"
          style={{ fontSize: "clamp(7rem, 28vw, 24rem)" }}
        >
          <span data-count>00</span>
          <span className="ml-1 align-top text-[0.2em] font-bold text-white/80">%</span>
        </p>
        <p data-bottom className="absolute bottom-[clamp(24px,6vh,52px)] text-[clamp(0.7rem,1.4vw,0.9rem)] font-bold uppercase tracking-[0.24em] text-white/80">
          Simmering the details
        </p>
      </div>
    </div>
  );
}

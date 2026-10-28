import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

const TICKS = Array.from({ length: 41 }, (_, i) => i);
const CORNERS = [
  "left-0 top-0 border-l-2 border-t-2",
  "right-0 top-0 border-r-2 border-t-2",
  "bottom-0 left-0 border-b-2 border-l-2",
  "bottom-0 right-0 border-b-2 border-r-2",
];

/**
 * "Focus" (~4s). Dark and cinematic. Your logo starts as a soft blur and a
 * camera lens "hunts" for focus, overshooting once or twice before it
 * locks sharp. The viewfinder corners snap inward and turn brand red, a
 * small LOCKED label appears, and the frame expands off the screen with a
 * brief soft flash as the homepage comes into view.
 */
export default function Focus({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const [subject] = q("[data-subject]");
    const [frame] = q("[data-frame]");
    const corners = q("[data-corner]");
    const [ind] = q("[data-ind]");
    const [locked] = q("[data-locked]");
    const [hud] = q("[data-hud]");
    const [flash] = q("[data-flash]");
    const [count] = q("[data-count]");

    gsap.set(subject, { filter: "blur(30px)", opacity: 0.45, scale: 1.18 });
    gsap.set(hud, { opacity: 0 });
    gsap.set(locked, { opacity: 0, y: 6 });
    gsap.set(flash, { opacity: 0 });
    gsap.set(ind, { left: "0%" });

    tl.to(hud, { opacity: 1, duration: 0.7 }, 0.1);
    tl.add(countTo(count, { duration: 2.3 }), 0.3);

    // the lens hunts: too far, back, then lock
    tl.to(subject, { filter: "blur(10px)", opacity: 0.8, scale: 1.08, duration: 0.8, ease: "sine.inOut" }, 0.4);
    tl.to(subject, { filter: "blur(18px)", opacity: 0.65, scale: 1.12, duration: 0.55, ease: "sine.inOut" }, 1.2);
    tl.to(subject, { filter: "blur(0px)", opacity: 1, scale: 1, duration: 0.95, ease: "power3.out" }, 1.75);
    tl.to(ind, { left: "66%", duration: 0.8, ease: "sine.inOut" }, 0.4);
    tl.to(ind, { left: "36%", duration: 0.55, ease: "sine.inOut" }, 1.2);
    tl.to(ind, { left: "50%", duration: 0.95, ease: "power3.out" }, 1.75);

    // lock: corners snap in and turn red
    const lockAt = 2.75;
    tl.to(frame, { top: "17vmin", left: "17vmin", right: "17vmin", bottom: "17vmin", duration: 0.45, ease: "back.out(2)" }, lockAt);
    tl.to(corners, { borderColor: "#f33716", duration: 0.2 }, lockAt);
    tl.to(locked, { opacity: 1, y: 0, duration: 0.35 }, lockAt + 0.1);

    // expand off-screen, soft flash, dissolve
    const exitAt = 3.35;
    tl.to(hud, { opacity: 0, duration: 0.3 }, exitAt - 0.05);
    tl.to(frame, { top: "-6vmin", left: "-6vmin", right: "-6vmin", bottom: "-6vmin", duration: 0.7, ease: "expo.in" }, exitAt);
    tl.to(subject, { scale: 1.25, opacity: 0, duration: 0.6, ease: "power2.in" }, exitAt + 0.05);
    tl.to(flash, { opacity: 0.55, duration: 0.18, ease: "power2.out" }, exitAt + 0.5);
    tl.to(root, { opacity: 0, duration: 0.55, ease: "power1.inOut" }, exitAt + 0.62);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden bg-[#0c0c0c]">
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 55%)" }}
      />

      <div data-frame className="pointer-events-none absolute" style={{ top: "6vmin", left: "6vmin", right: "6vmin", bottom: "6vmin" }}>
        {CORNERS.map((c, i) => (
          <span key={i} data-corner className={`absolute h-[clamp(22px,4vmin,38px)] w-[clamp(22px,4vmin,38px)] border-cream/80 ${c}`} />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div data-subject className="flex flex-col items-center will-change-[filter]">
          <BrandMark className="h-[clamp(56px,11vmin,92px)]" />
          <div className="mt-5">
            <BrandWordmark dark className="h-[clamp(20px,3.8vmin,32px)]" />
          </div>
        </div>
        <p data-locked className="mt-6 font-display text-[11px] font-bold uppercase tracking-[0.3em] text-amber">
          Locked
        </p>
      </div>

      <div data-hud className="pointer-events-none absolute inset-0">
        <p className="absolute left-[clamp(28px,9vmin,90px)] top-[clamp(28px,9vmin,90px)] font-display text-[11px] font-bold uppercase tracking-[0.22em] text-cream/70">
          <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber align-middle" />
          AF
        </p>
        <p className="absolute right-[clamp(28px,9vmin,90px)] top-[clamp(28px,9vmin,90px)] font-display text-sm tabular-nums text-cream">
          <span data-count>00</span>
          <span className="text-amber">%</span>
        </p>

        <div className="absolute inset-x-0 bottom-[clamp(28px,9vmin,90px)] mx-auto w-[min(60vw,320px)]">
          <div className="relative flex h-5 items-end justify-between">
            {TICKS.map((i) => (
              <span key={i} className={`w-px ${i === 20 ? "h-5 bg-cream" : i % 5 === 0 ? "h-3 bg-cream/55" : "h-2 bg-cream/25"}`} />
            ))}
            <span
              data-ind
              className="absolute -top-2.5 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[7px] border-x-transparent border-t-amber"
              style={{ left: "0%" }}
            />
          </div>
        </div>
      </div>

      <div data-flash className="pointer-events-none absolute inset-0 bg-white" />
    </div>
  );
}

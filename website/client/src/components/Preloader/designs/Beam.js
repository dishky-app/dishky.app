import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

const STATUS = ["Connecting to your restaurant", "Syncing menu and stock", "Opening for service"];
const SPIN = "dk-angle 3.2s linear infinite";
const BEAM = "conic-gradient(from var(--dk-angle), rgba(255,255,255,0.08) 0deg, rgba(255,255,255,0.08) 250deg, #f33716 315deg, #ffd2c7 345deg, rgba(255,255,255,0.08) 360deg)";

/**
 * "Beam" (~4s). Dark, modern SaaS. A glass card with a bright beam of light
 * travelling around its border holds your logo, a status line that moves
 * through three stages and a slim progress bar. At 100 the card grows to
 * fill the whole screen and dissolves into the homepage.
 */
export default function Beam({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const [card] = q("[data-card]");
    const [inner] = q("[data-inner]");
    const [glow] = q("[data-glow]");
    const items = q("[data-item]");
    const [bar] = q("[data-bar]");
    const [status] = q("[data-status]");
    const [count] = q("[data-count]");
    const W = window.innerWidth;
    const H = window.innerHeight;

    gsap.set(card, { scale: 0.92, opacity: 0 });
    gsap.set(glow, { opacity: 0 });
    gsap.set(items, { opacity: 0, y: 14 });
    gsap.set(bar, { scaleX: 0 });

    tl.to(card, { scale: 1, opacity: 1, duration: 0.9, ease: "power3.out" }, 0.1);
    tl.to(glow, { opacity: 0.6, duration: 1.2 }, 0.2);
    tl.to(items, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1 }, 0.5);
    tl.to(bar, { scaleX: 1, duration: 2.3, ease: "power2.inOut" }, 0.7);

    const swap = (i) =>
      gsap
        .timeline()
        .to(status, { opacity: 0, y: -6, duration: 0.2, ease: "power1.in" })
        .call(() => (status.textContent = STATUS[i]))
        .fromTo(status, { y: 6 }, { opacity: 0.8, y: 0, duration: 0.35, ease: "power2.out" });
    let stage = 0;
    tl.add(
      countTo(count, {
        duration: 2.3,
        onUpdate: (v) => {
          const s = v >= 66 ? 2 : v >= 33 ? 1 : 0;
          if (s !== stage) {
            stage = s;
            swap(s);
          }
        },
      }),
      0.7
    );

    // the card grows to fill the screen, then everything dissolves
    const exitAt = 3.2;
    tl.to(items, { opacity: 0, duration: 0.3 }, exitAt - 0.05);
    tl.to(glow, { opacity: 0, duration: 0.3 }, exitAt);
    // stop the beam and turn the border solid before the card grows, so no
    // bright wedge smears across the screen
    tl.set(card, { background: "#111111", animation: "none" }, exitAt);
    tl.to([card, inner], { borderRadius: 0, duration: 0.9, ease: "expo.inOut" }, exitAt);
    tl.to(card, { width: W + 4, height: H + 4, duration: 0.9, ease: "expo.inOut" }, exitAt);
    tl.to(root, { opacity: 0, duration: 0.45, ease: "power1.inOut" }, exitAt + 0.8);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
      <div
        data-glow
        className="absolute h-[360px] w-[360px] rounded-[48px] opacity-60 blur-3xl"
        style={{ background: BEAM, animation: SPIN }}
      />
      <div
        data-card
        className="relative w-[min(86vw,380px)] rounded-[28px] p-[1.5px]"
        style={{ background: BEAM, animation: SPIN }}
      >
        <div data-inner className="flex flex-col items-center rounded-[27px] bg-[#111111] px-8 py-10">
          <div data-item>
            <BrandMark className="h-[clamp(46px,8vmin,64px)]" />
          </div>
          <div data-item className="mt-5">
            <BrandWordmark dark className="h-[clamp(16px,2.8vmin,24px)]" />
          </div>
          <p data-item className="mt-8 h-5 text-center text-[13px] font-medium text-cream">
            <span data-status className="inline-block opacity-80">{STATUS[0]}</span>
          </p>
          <div data-item className="mt-4 flex w-full items-center gap-3">
            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-cream/10">
              <div data-bar className="h-full origin-left rounded-full bg-amber" />
            </div>
            <span className="w-9 text-right font-display text-[11px] tabular-nums text-cream/70">
              <span data-count>00</span>%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

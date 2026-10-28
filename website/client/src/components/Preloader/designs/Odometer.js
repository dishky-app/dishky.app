import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader } from "./common.js";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]; // trailing 0 makes the wrap seamless
const HUNDREDS = ["", "1"];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function Strip({ items, stripRef }) {
  return (
    <span className="block overflow-hidden" style={{ height: "1em", lineHeight: 1 }}>
      <span ref={stripRef} data-strip className="block will-change-transform">
        {items.map((d, i) => (
          <span key={i} className="block text-center" style={{ height: "1em", lineHeight: 1 }}>
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * "Odometer" (~4s). The bold one: the whole screen is brand red with a huge
 * mechanical counter whose digits roll like a slot machine from 0 to 100.
 * At 100 the red screen drops away downward, revealing the homepage.
 */
export default function Odometer({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const [hunCol] = q("[data-hcol]");
    const strips = q("[data-strip]"); // hundreds, tens, ones
    const [hunStrip, tenStrip, oneStrip] = strips;
    const [meta] = q("[data-meta]");
    const [pct] = q("[data-pct]");
    const [num] = q("[data-num]");
    const setHun = gsap.quickSetter(hunStrip, "yPercent");
    const setTen = gsap.quickSetter(tenStrip, "yPercent");
    const setOne = gsap.quickSetter(oneStrip, "yPercent");

    gsap.set(num, { y: 60, opacity: 0 });
    gsap.set([meta, pct], { opacity: 0 });
    gsap.set(hunCol, { width: 0 });

    const render = (p) => {
      const ones = p % 10;
      const tens = Math.floor(p / 10) + clamp(ones - 9, 0, 1);
      const hun = clamp(p - 99, 0, 1);
      setOne(-(ones / DIGITS.length) * 100);
      setTen(-(tens / DIGITS.length) * 100);
      setHun(-(hun / HUNDREDS.length) * 100);
      hunCol.style.width = `${hun * 0.66}em`;
    };
    render(0);

    tl.to(num, { y: 0, opacity: 1, duration: 0.9 }, 0.1);
    tl.to([meta, pct], { opacity: 1, duration: 0.7 }, 0.3);
    const st = { p: 0 };
    tl.to(st, { p: 100, duration: 2.5, ease: "power2.inOut", onUpdate: () => render(st.p) }, 0.35);
    // a small settle when it lands on 100
    tl.to(num, { scale: 1.04, duration: 0.25, ease: "power2.out", yoyo: true, repeat: 1 }, 2.9);

    const exitAt = 3.25;
    tl.to(root, { yPercent: 100, duration: 0.95, ease: "expo.inOut" }, exitAt);
    tl.to(num, { y: -40, duration: 0.95, ease: "expo.inOut" }, exitAt);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden bg-amber">
      <div data-meta className="absolute inset-x-0 top-0 flex items-center justify-between px-[clamp(20px,4vw,64px)] pt-[clamp(20px,5vh,44px)]">
        <BrandWordmark dark className="h-[clamp(18px,3vmin,26px)]" />
        <p className="text-[clamp(0.65rem,1.3vw,0.8rem)] font-bold uppercase tracking-[0.22em] text-white/90">Loading</p>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          data-num
          className="flex items-center font-display font-extrabold tabular-nums tracking-[-0.04em] text-ink"
          style={{ fontSize: "clamp(7rem, 31vw, 27rem)", lineHeight: 1 }}
        >
          <span data-hcol className="block overflow-hidden" style={{ width: 0 }}>
            <Strip items={HUNDREDS} />
          </span>
          <span className="block" style={{ width: "0.64em" }}>
            <Strip items={DIGITS} />
          </span>
          <span className="block" style={{ width: "0.64em" }}>
            <Strip items={DIGITS} />
          </span>
          <span data-pct className="ml-[0.06em] self-start text-[0.22em] font-bold leading-none text-white/90" style={{ marginTop: "0.18em" }}>
            %
          </span>
        </div>
      </div>

      <p className="absolute bottom-[clamp(24px,6vh,56px)] left-[clamp(20px,4vw,64px)] max-w-[16rem] text-[clamp(0.7rem,1.4vw,0.9rem)] font-bold uppercase tracking-[0.2em] text-ink/80">
        Fixing the daily problems
      </p>
    </div>
  );
}

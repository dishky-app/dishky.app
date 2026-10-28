import React from "react";
import { Salad, Carrot, Citrus, Soup, Croissant, CookingPot, ChefHat, IceCream2, Fish, Wine, EggFried, Pizza } from "lucide-react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

const ROWS = [
  { dir: -1, dur: 9, tone: "text-cream", items: [["Fresh", Salad], ["Local", Carrot], ["Seasonal", Citrus]] },
  { dir: 1, dur: 11, tone: "text-cream/[0.14]", items: [["Hot", Soup], ["Homemade", Croissant], ["Order up", CookingPot]] },
  { dir: -1, dur: 8, tone: "text-amber", items: [["Chef\u2019s pick", ChefHat], ["Sweet", IceCream2], ["Savoury", Fish]] },
  { dir: 1, dur: 10, tone: "text-cream", items: [["Table for two", Wine], ["Brunch", EggFried], ["Late night", Pizza]] },
  { dir: -1, dur: 12, tone: "text-cream/[0.14]", items: [["Fresh", Salad], ["Hot", Soup], ["Local", Carrot]] },
];

/**
 * "Marquee" (~3.9s). Dark, kinetic type. Five rows of food words and icons
 * (Fresh, Hot, Homemade, Chef's pick, Brunch...) glide past in alternating
 * directions behind a floating pill with the logo and counter. At 100 the
 * rows are thrown off to opposite sides and the backdrop fades.
 */
export default function Marquee({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q }) => {
    const rows = q("[data-row]");
    const [pill] = q("[data-pill]");
    const [count] = q("[data-count]");
    const [bg] = q("[data-bg]");
    const W = window.innerWidth;

    rows.forEach((row, i) => {
      const { dir, dur } = ROWS[i];
      gsap.fromTo(row, { xPercent: dir < 0 ? 0 : -50 }, { xPercent: dir < 0 ? -50 : 0, duration: dur, ease: "none", repeat: -1 });
    });
    gsap.set(rows, { y: 36, opacity: 0 });
    gsap.set(pill, { scale: 0.8, opacity: 0 });

    tl.to(rows, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", stagger: 0.09 }, 0.1);
    tl.to(pill, { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.5)" }, 0.45);
    tl.add(countTo(count, { duration: 2.3 }), 0.45);

    const exitAt = 3.0;
    tl.to(pill, { scale: 0.85, opacity: 0, duration: 0.4, ease: "power2.in" }, exitAt - 0.05);
    tl.to(rows, { x: (i) => (i % 2 ? 1 : -1) * W * 1.4, duration: 0.85, ease: "power3.in", stagger: 0.05 }, exitAt);
    tl.to(bg, { opacity: 0, duration: 0.55, ease: "power2.inOut" }, exitAt + 0.45);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      <div data-bg className="absolute inset-0 bg-charcoal" />

      <div className="absolute inset-0 flex flex-col justify-center">
        {ROWS.map((r, ri) => (
          <div key={ri} className="overflow-hidden">
            <div data-row className="flex w-max items-center">
              {[0, 1].map((k) => (
                <div key={k} className="flex shrink-0 items-center">
                  {r.items.map(([word, Icon]) => (
                    <span
                      key={word}
                      className={`flex items-center gap-[0.35em] whitespace-nowrap pr-[0.6em] font-display font-extrabold uppercase leading-[1.05] tracking-[-0.035em] ${r.tone}`}
                      style={{ fontSize: "clamp(2.6rem, 9vw, 8rem)" }}
                    >
                      {word}
                      <Icon size="0.62em" strokeWidth={2.2} />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          data-pill
          className="flex items-center gap-4 rounded-full border border-cream/15 bg-charcoal/90 px-[clamp(16px,3vw,28px)] py-[clamp(10px,1.6vw,16px)] shadow-[0_30px_80px_-10px_rgba(0,0,0,0.8)] backdrop-blur"
        >
          <BrandMark className="h-[clamp(30px,4.6vmin,44px)]" />
          <BrandWordmark dark className="h-[clamp(14px,2.2vmin,20px)]" />
          <span className="font-mono text-sm font-bold tabular-nums text-cream">
            <span data-count>00</span>
            <span className="text-amber">%</span>
          </span>
        </div>
      </div>
    </div>
  );
}

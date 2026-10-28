import React from "react";
import { Check } from "lucide-react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader } from "./common.js";

const ITEMS = ["Orders", "Kitchen", "Stock", "Team", "Payments", "Branches"];

/**
 * "Menu" (~3.8s). LIGHT. A restaurant menu card settles onto the screen and
 * its items (the parts of Dishky) are marked Ready one by one, each with a
 * dotted leader. The card slides off and the screen wipes away to the left.
 */
export default function Menu({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const [card] = q("[data-card]");
    const [head] = q("[data-head]");
    const rows = q("[data-row]");
    const marks = q("[data-mark]");
    const [note] = q("[data-note]");

    gsap.set(card, { y: 56, opacity: 0, rotateX: 10, transformPerspective: 1200, transformOrigin: "50% 100%" });
    gsap.set(head, { opacity: 0, y: 10 });
    gsap.set(rows, { opacity: 0, x: -14 });
    gsap.set(marks, { opacity: 0, scale: 0.6 });
    gsap.set(note, { opacity: 0 });

    tl.to(card, { y: 0, opacity: 1, rotateX: 0, duration: 1.0, ease: "power3.out" }, 0.1);
    tl.to(head, { opacity: 1, y: 0, duration: 0.8 }, 0.45);
    rows.forEach((row, i) => {
      const at = 0.8 + i * 0.26;
      tl.to(row, { opacity: 1, x: 0, duration: 0.45 }, at);
      tl.to(marks[i], { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2.2)" }, at + 0.22);
    });
    tl.to(note, { opacity: 1, duration: 0.6 }, 2.4);

    const exitAt = 2.9;
    tl.to(card, { x: -70, opacity: 0, duration: 0.5, ease: "power2.in" }, exitAt);
    tl.to(root, { clipPath: "inset(0% 100% 0% 0%)", duration: 0.95, ease: "expo.inOut" }, exitAt + 0.1);
  });

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#e8e8e8] px-5"
      style={{ clipPath: "inset(0% 0% 0% 0%)" }}
    >
      <div
        data-card
        className="w-full max-w-[520px] rounded-[4px] bg-white p-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.25)]"
      >
        <div className="border border-ink/15 px-[clamp(22px,6vw,44px)] py-[clamp(24px,5vw,40px)]">
          <div data-head className="text-center">
            <div className="flex items-center justify-center gap-2.5">
              <BrandMark className="h-8" />
              <BrandWordmark className="h-4" />
            </div>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.3em] text-ink/45">Today&rsquo;s service</p>
            <div className="mx-auto mt-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-ink/20" />
              <span className="h-1.5 w-1.5 rotate-45 bg-amber" />
              <span className="h-px flex-1 bg-ink/20" />
            </div>
          </div>

          <ul className="mt-6 space-y-3.5">
            {ITEMS.map((item) => (
              <li key={item} data-row className="flex items-baseline gap-3">
                <span className="font-display text-[clamp(1rem,2.6vw,1.2rem)] font-bold text-ink">{item}</span>
                <span className="mb-1 flex-1 border-b-2 border-dotted border-ink/25" />
                <span data-mark className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber">
                  <Check size={14} strokeWidth={3.5} />
                  Ready
                </span>
              </li>
            ))}
          </ul>

          <p data-note className="mt-7 text-center text-[12px] font-semibold text-ink/50">
            Your restaurant is ready to serve.
          </p>
        </div>
      </div>
    </div>
  );
}

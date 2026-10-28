import React from "react";
import { Check } from "lucide-react";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { gsap } from "../../../animations/gsapSetup.js";
import { usePreloader } from "./common.js";

const STEPS = ["Order received", "Kitchen notified", "Stock checked", "Table ready"];
// zig-zag tear along the bottom of the paper
const ZIGZAG = "conic-gradient(from -45deg at bottom, #00000000, #000000 1deg 89deg, #00000000 90deg) 50% / 18px 100%";

/**
 * "Ticket" (~3.8s). Dark. A kitchen ticket prints out of a slot and ticks off
 * four steps one by one. When the last tick lands, the ticket tilts away and
 * the whole screen lifts off upward, like tearing the ticket off the rail.
 */
export default function Ticket({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const [paper] = q("[data-paper]");
    const [slot] = q("[data-slot]");
    const rows = q("[data-row]");
    const checks = q("[data-check]");
    const [stamp] = q("[data-stamp]");
    const [glow] = q("[data-glow]");
    const [stage] = q("[data-stage]");

    gsap.set(paper, { yPercent: -101 });
    gsap.set(slot, { scaleX: 0, opacity: 0 });
    gsap.set(rows, { opacity: 0.25, x: -8 });
    gsap.set(checks, { scale: 0.6 });
    gsap.set(stamp, { opacity: 0, scale: 1.6, rotate: -10 });
    gsap.set(glow, { opacity: 0 });

    tl.to(slot, { scaleX: 1, opacity: 1, duration: 0.6, ease: "power3.out" }, 0.1);
    tl.to(glow, { opacity: 1, duration: 0.8 }, 0.3);
    // printing: the paper eases down out of the slot
    tl.to(paper, { yPercent: 0, duration: 1.3, ease: "power2.inOut" }, 0.5);

    // ticking off the steps
    rows.forEach((row, i) => {
      const at = 1.15 + i * 0.4;
      tl.to(row, { opacity: 1, x: 0, duration: 0.4 }, at);
      tl.to(
        checks[i],
        { scale: 1, backgroundColor: "#f33716", color: "#ffffff", duration: 0.35, ease: "back.out(2)" },
        at + 0.12
      );
    });

    tl.to(stamp, { opacity: 1, scale: 1, rotate: -6, duration: 0.45, ease: "back.out(1.8)" }, 2.85);

    const liftAt = 3.35;
    tl.to(paper, { rotate: -4, y: -30, duration: 0.5, ease: "power2.in" }, liftAt);
    tl.to(stage, { opacity: 0, duration: 0.35, ease: "power1.in" }, liftAt + 0.2);
    tl.to(root, { yPercent: -100, duration: 0.95, ease: "expo.inOut" }, liftAt + 0.15);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden bg-charcoal">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1.4px)",
          backgroundSize: "28px 28px",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, #000000 20%, transparent 75%)",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, #000000 20%, transparent 75%)",
        }}
      />

      <div data-stage className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="w-[clamp(250px,72vw,340px)]">
          {/* printer slot */}
          <div className="relative mb-0.5">
            <div data-glow className="absolute -inset-x-6 -bottom-3 h-8 rounded-full bg-amber/30 blur-xl" />
            <div data-slot className="relative h-3 origin-center rounded-full bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.12)]" />
          </div>

          {/* paper emerges from here */}
          <div className="overflow-hidden px-2">
            <div
              data-paper
              className="bg-[#f0f0f0] px-6 pb-10 pt-6 text-ink"
              style={{ WebkitMask: ZIGZAG, mask: ZIGZAG }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BrandMark className="h-7" />
                  <BrandWordmark className="h-3.5" />
                </div>
                <span className="font-display text-[10px] font-bold tracking-widest text-ink/50">#00000011</span>
              </div>

              <div className="my-4 border-t border-dashed border-ink/25" />

              <ul className="space-y-3 font-display text-[13px] font-semibold uppercase tracking-wide">
                {STEPS.map((s) => (
                  <li key={s} data-row className="flex items-center justify-between">
                    <span>{s}</span>
                    <span data-check className="flex h-5 w-5 items-center justify-center rounded-full bg-ink/10 text-ink/30">
                      <Check size={12} strokeWidth={3.5} />
                    </span>
                  </li>
                ))}
              </ul>

              <div className="my-4 border-t border-dashed border-ink/25" />

              <div className="flex items-center justify-between">
                <span className="font-display text-[10px] font-bold uppercase tracking-widest text-ink/50">Status</span>
                <span
                  data-stamp
                  className="rounded border-2 border-amber px-2 py-0.5 font-display text-sm font-extrabold uppercase tracking-wider text-amber"
                >
                  Ready
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

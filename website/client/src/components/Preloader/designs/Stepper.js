import React from "react";
import { Check } from "lucide-react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader } from "./common.js";

const STEPS = [
  ["Connecting to your kitchen", "Orders and tickets"],
  ["Syncing menu and stock", "Dishes and ingredients"],
  ["Loading your team", "Roles and permissions"],
  ["Opening for service", "Everything is ready"],
];
const BG = "#f2f2f2";

/**
 * "Stepper" (~4s). LIGHT, onboarding-style. A clean card walks through four
 * set-up steps: each dot spins, turns into a tick in brand colour and the
 * line to the next step fills. The progress bar finishes, the card lifts
 * out, and the two halves of the screen slide apart sideways.
 */
export default function Stepper({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q }) => {
    const [card] = q("[data-card]");
    const dots = q("[data-dot]");
    const spins = q("[data-spin]");
    const checks = q("[data-check]");
    const labels = q("[data-label]");
    const states = q("[data-state]");
    const segs = q("[data-seg]");
    const [bar] = q("[data-bar]");
    const [pct] = q("[data-pct]");
    const [left] = q("[data-half='l']");
    const [right] = q("[data-half='r']");

    gsap.set(card, { y: 30, opacity: 0 });
    gsap.set(spins, { opacity: 0, transformOrigin: "50% 50%" });
    gsap.set(checks, { scale: 0 });
    gsap.set(segs, { scaleY: 0, transformOrigin: "50% 0%" });
    gsap.set(bar, { scaleX: 0 });

    tl.to(card, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out" }, 0.1);

    const STEP = 0.5;
    STEPS.forEach((_, i) => {
      const t = 0.7 + i * STEP;
      tl.to(dots[i], { borderColor: "#f33716", duration: 0.2 }, t);
      tl.to(labels[i], { color: "#1a1a1a", duration: 0.3 }, t);
      tl.to(spins[i], { opacity: 1, rotation: 540, duration: 0.7, ease: "power1.inOut" }, t);
      tl.call(() => (states[i].textContent = "Working\u2026"), null, t);
      tl.to(spins[i], { opacity: 0, duration: 0.15 }, t + 0.62);
      tl.to(dots[i], { backgroundColor: "#f33716", duration: 0.2 }, t + 0.62);
      tl.to(checks[i], { scale: 1, duration: 0.35, ease: "back.out(2.4)" }, t + 0.64);
      tl.call(() => (states[i].textContent = "Done"), null, t + 0.64);
      if (segs[i]) tl.to(segs[i], { scaleY: 1, duration: 0.35, ease: "power2.out" }, t + 0.5);
      tl.to(bar, { scaleX: (i + 1) / STEPS.length, duration: 0.5, ease: "power2.out" }, t + 0.4);
    });
    const pr = { v: 0 };
    tl.to(pr, { v: 100, duration: STEPS.length * STEP + 0.3, ease: "power1.inOut", onUpdate: () => (pct.textContent = `${Math.round(pr.v)}%`) }, 0.8);

    const exitAt = 3.2;
    tl.to(card, { y: -24, opacity: 0, duration: 0.45, ease: "power2.in" }, exitAt - 0.1);
    tl.to(left, { xPercent: -101, duration: 0.95, ease: "expo.inOut" }, exitAt);
    tl.to(right, { xPercent: 101, duration: 0.95, ease: "expo.inOut" }, exitAt);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      <div data-half="l" className="absolute inset-y-0 left-0 w-1/2" style={{ background: BG, marginRight: -1 }} />
      <div data-half="r" className="absolute inset-y-0 right-0 w-1/2" style={{ background: BG, marginLeft: -1 }} />

      <div data-card className="relative w-[min(90vw,440px)] rounded-2xl border border-ink/10 bg-white p-[clamp(20px,5vw,32px)] shadow-[0_30px_80px_-24px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-2.5">
          <BrandMark className="h-7" />
          <BrandWordmark className="h-3.5" />
        </div>
        <p className="mt-5 font-display text-lg font-bold text-ink">Setting up your restaurant</p>

        <ol className="mt-5">
          {STEPS.map(([label, sub], i) => (
            <li key={label} className="relative flex gap-4 pb-6 last:pb-1">
              {i < STEPS.length - 1 && (
                <span className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px bg-ink/10">
                  <span data-seg className="block h-full w-full bg-amber" />
                </span>
              )}
              <span data-dot className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-ink/15 bg-white">
                <svg data-spin viewBox="0 0 28 28" className="absolute -inset-[2px] h-[calc(100%+4px)] w-[calc(100%+4px)]" fill="none">
                  <path d="M14 2 A12 12 0 0 1 26 14" stroke="#f33716" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <span data-check className="text-white">
                  <Check size={14} strokeWidth={3.5} />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span data-label className="block text-sm font-semibold text-ink/40">{label}</span>
                <span className="block text-xs text-ink/45">{sub}</span>
              </span>
              <span data-state className="shrink-0 pt-0.5 font-display text-[11px] font-bold uppercase tracking-wider text-amber" />
            </li>
          ))}
        </ol>

        <div className="mt-2 flex items-center gap-3">
          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-ink/10">
            <div data-bar className="h-full origin-left rounded-full bg-amber" />
          </div>
          <span data-pct className="w-9 text-right font-display text-[11px] tabular-nums text-ink/60">0%</span>
        </div>
      </div>
    </div>
  );
}

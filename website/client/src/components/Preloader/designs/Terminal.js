import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { usePreloader } from "./common.js";

const LINES = [
  { text: "dishky start", kind: "cmd" },
  { text: "Orders connected", kind: "ok" },
  { text: "Kitchen online", kind: "ok" },
  { text: "Stock synced", kind: "ok" },
  { text: "Team permissions loaded", kind: "ok" },
  { text: "Branches ready", kind: "ok" },
  { text: "Ready. Open for service.", kind: "done" },
];

/**
 * "Terminal" (~3.7s). Dark, for the developer-minded. A terminal window
 * types `dishky start`, then reports each part of the platform coming
 * online with a red tick. A slanted wipe sweeps left to right and the live
 * homepage appears behind it.
 */
export default function Terminal({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const win = q("[data-win]")[0];
    const lines = q("[data-line]");
    const txts = q("[data-txt]");
    const ticks = q("[data-tick]");
    const [cursor] = q("[data-cursor]");
    const [bar] = q("[data-bar]");
    const [pct] = q("[data-pct]");

    gsap.set(win, { y: 30, opacity: 0, scale: 0.97 });
    gsap.set(lines, { display: "none" });
    gsap.set(ticks, { scale: 0 });
    gsap.set(bar, { scaleX: 0 });
    gsap.to(cursor, { opacity: 0, duration: 0.5, ease: "steps(1)", repeat: -1, yoyo: true });

    tl.to(win, { y: 0, opacity: 1, scale: 1, duration: 0.7, ease: "power3.out" }, 0.05);
    tl.to(bar, { scaleX: 1, duration: 2.3, ease: "power2.inOut" }, 0.3);
    const prog = { v: 0 };
    tl.to(prog, { v: 100, duration: 2.3, ease: "power2.inOut", onUpdate: () => (pct.textContent = `${Math.round(prog.v)}%`) }, 0.3);

    const type = (i, at, perChar) => {
      const full = LINES[i].text;
      const st = { n: 0 };
      tl.set(lines[i], { display: "flex" }, at);
      if (ticks[i]) tl.to(ticks[i], { scale: 1, duration: 0.25, ease: "back.out(3)" }, at);
      tl.to(
        st,
        { n: full.length, duration: Math.max(0.2, full.length * perChar), ease: "none", onUpdate: () => (txts[i].textContent = full.slice(0, Math.round(st.n))) },
        at + (ticks[i] ? 0.05 : 0)
      );
    };

    type(0, 0.4, 0.045);
    for (let i = 1; i <= 5; i++) type(i, 0.95 + (i - 1) * 0.25, 0.012);
    type(6, 2.3, 0.016);

    // slanted wipe, left to right
    const exitAt = 3.0;
    const wipe = { a: -30 };
    tl.to(win, { y: -20, opacity: 0, duration: 0.4, ease: "power2.in" }, exitAt - 0.1);
    tl.to(
      wipe,
      {
        a: 100,
        duration: 0.9,
        ease: "expo.inOut",
        onUpdate: () => (root.style.clipPath = `polygon(${wipe.a + 30}% 0%, 100% 0%, 100% 100%, ${wipe.a}% 100%)`),
      },
      exitAt
    );
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#0d0d0d] px-4">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1.4px)",
          backgroundSize: "26px 26px",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, #000000 20%, transparent 75%)",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, #000000 20%, transparent 75%)",
        }}
      />
      <div data-win className="relative w-full max-w-[640px] overflow-hidden rounded-2xl border border-cream/15 bg-[#161616] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-2 border-b border-cream/10 bg-[#1d1d1d] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#f45138]" />
          <span className="h-3 w-3 rounded-full bg-[#e4290c]" />
          <span className="ml-3 font-display text-xs text-cream/50">dishky ~ start</span>
        </div>

        <div className="min-h-[clamp(230px,40vh,300px)] space-y-2 p-5 font-display text-[clamp(0.78rem,2.4vw,0.95rem)] text-cream sm:p-6">
          {LINES.map((l, i) => (
            <p key={i} data-line className="items-center gap-2.5">
              {l.kind === "cmd" && <span className="text-amber">$</span>}
              {l.kind === "ok" && (
                <span data-tick className="font-bold text-amber">
                  ✓
                </span>
              )}
              <span data-txt className={l.kind === "done" ? "font-bold text-white" : l.kind === "ok" ? "text-cream/80" : "text-white"} />
            </p>
          ))}
          <p className="flex items-center gap-2.5">
            <span className="text-amber">$</span>
            <span data-cursor className="inline-block h-[1.1em] w-[0.55em] bg-cream/80" />
          </p>
        </div>

        <div className="flex items-center gap-3 border-t border-cream/10 px-5 py-3 sm:px-6">
          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-cream/10">
            <div data-bar className="h-full origin-left bg-amber" />
          </div>
          <span data-pct className="w-10 text-right font-display text-xs tabular-nums text-cream/70">0%</span>
        </div>
      </div>
    </div>
  );
}

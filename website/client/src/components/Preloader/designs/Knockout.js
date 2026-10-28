import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

/**
 * "Knockout" (~4s). Dark and typographic. The screen is solid charcoal with
 * the word DISHKY cut out of it, so the page behind shows through the
 * letters. A hairline fills beneath as the counter climbs. Then the camera
 * dives into the letter I: the cut-out zooms until a single stem of the
 * letter fills the screen, uncovering the live homepage.
 */
export default function Knockout({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q }) => {
    const [svg] = q("[data-svg]");
    const [text] = q("[data-ktext]");
    const [rects] = q("[data-mrect]");
    const [cover] = q("[data-cover]");
    const [paper] = q("[data-paper]");
    const [ui] = q("[data-ui]");
    const [bar] = q("[data-bar]");
    const [count] = q("[data-count]");
    const W = window.innerWidth;
    const H = window.innerHeight;
    const fs = Math.min(W * 0.19, H * 0.42);

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    [rects, cover].forEach((r) => {
      r.setAttribute("width", W);
      r.setAttribute("height", H);
    });
    text.setAttribute("x", W / 2);
    text.setAttribute("y", H / 2 + fs * 0.35); // caps vertically centred
    text.setAttribute("font-size", fs);

    // zoom target: the middle of the stem of the letter "I"
    let ox = W / 2;
    const oy = H / 2;
    try {
      const e = text.getExtentOfChar(1);
      ox = e.x + e.width / 2;
    } catch (err) {
      /* keep the centre */
    }

    gsap.set(text, { opacity: 0, scale: 0.94, svgOrigin: `${W / 2} ${H / 2}` });
    gsap.set(ui, { opacity: 0 });
    gsap.set(bar, { scaleX: 0 });

    tl.to(text, { opacity: 1, scale: 1, duration: 1.1, ease: "power3.out" }, 0.1);
    tl.to(ui, { opacity: 1, duration: 0.7 }, 0.5);
    tl.to(bar, { scaleX: 1, duration: 2.2, ease: "power2.inOut" }, 0.5);
    tl.add(countTo(count, { duration: 2.2 }), 0.5);

    const zoomAt = 3.0;
    tl.to(ui, { opacity: 0, duration: 0.3, ease: "power1.in" }, zoomAt - 0.1);
    // the clean paper behind the letters fades away as the dive begins,
    // so the real homepage is what the letters open onto
    tl.to(paper, { opacity: 0, duration: 0.5, ease: "power1.inOut" }, zoomAt);
    tl.set(text, { svgOrigin: `${ox} ${oy}` }, zoomAt);
    tl.to(text, { scale: (1.3 * W) / (0.1 * fs), duration: 1.15, ease: "expo.in" }, zoomAt);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      {/* clean backing so the letters read as crisp white while loading */}
      <div data-paper className="absolute inset-0 bg-[#f4f4f4]" />
      <svg data-svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <defs>
          <mask id="dkKnockMask">
            <rect data-mrect fill="#ffffff" />
            <text
              data-ktext
              textAnchor="middle"
              fill="#000000"
              style={{ fontFamily: "Sora, 'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 800, letterSpacing: "-0.04em" }}
            >
              DISHKY
            </text>
          </mask>
        </defs>
        <rect data-cover fill="#1a1a1a" mask="url(#dkKnockMask)" />
      </svg>

      <div data-ui className="pointer-events-none absolute inset-0">
        <div className="absolute left-[clamp(20px,4vw,64px)] top-[clamp(20px,5vh,44px)]">
          <BrandMark className="h-[clamp(30px,4.6vmin,42px)]" />
        </div>
        <p className="absolute right-[clamp(20px,4vw,64px)] top-[clamp(24px,5.4vh,48px)] text-[clamp(0.65rem,1.2vw,0.78rem)] font-bold uppercase tracking-[0.22em] text-cream/70">
          Restaurant operating system
        </p>
        <div className="absolute inset-x-[clamp(20px,4vw,64px)] bottom-[clamp(24px,6vh,52px)] flex items-center gap-4">
          <div className="h-px flex-1 bg-cream/20">
            <div data-bar className="h-full origin-left bg-amber" />
          </div>
          <p className="font-display text-xs tabular-nums text-cream">
            <span data-count>00</span>
            <span className="text-amber">%</span>
          </p>
        </div>
      </div>
    </div>
  );
}

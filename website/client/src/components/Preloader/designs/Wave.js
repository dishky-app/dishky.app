import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader } from "./common.js";

const CREST = 64; // height of the wave edge, px
const WAVE_PATH = "M0 40 q90 -34 180 0 t180 0 t180 0 t180 0 t180 0 t180 0 t180 0 t180 0 t180 0 t180 0 t180 0 t180 0 t180 0 t180 0 t180 0 t180 0 L2880 64 L0 64 Z";

function Readout({ dark }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <BrandWordmark dark={dark} className="h-[clamp(20px,3.6vmin,32px)]" />
      <p
        className={`mt-4 font-display font-extrabold tabular-nums leading-none tracking-[-0.04em] ${dark ? "text-white" : "text-ink"}`}
        style={{ fontSize: "clamp(6rem, 24vw, 20rem)" }}
      >
        <span data-count>00</span>
        <span className={`ml-1 text-[0.22em] align-top ${dark ? "text-white/80" : "text-amber"}`}>%</span>
      </p>
    </div>
  );
}

/**
 * "Wave" (~3.8s). LIGHT to RED. The screen is cream with a big ink counter;
 * a wave of brand red rises with the progress, and the counter turns white
 * where the red covers it. When the red fills the screen it drains away
 * downward, its wavy crest sweeping down over the live homepage.
 */
export default function Wave({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q }) => {
    const [water] = q("[data-water]");
    const [inner] = q("[data-inner]");
    const [wave] = q("[data-wave]");
    const [bg] = q("[data-bg]");
    const counts = q("[data-count]");
    const contents = q("[data-content]");
    const H = window.innerHeight;
    const HIDDEN = H + CREST;

    const lvl = { y: HIDDEN };
    // the white copy of the readout is counter-translated so it stays put
    // on screen while the red layer moves over it
    const apply = () => {
      gsap.set(water, { y: lvl.y });
      gsap.set(inner, { y: -lvl.y });
    };
    apply();
    gsap.to(wave, { xPercent: -50, duration: 1.2, ease: "none", repeat: -1 });
    gsap.set(contents, { opacity: 0, y: 24 });

    tl.to(contents, { opacity: 1, y: 0, duration: 0.8 }, 0.1);

    const p = { v: 0 };
    tl.to(
      p,
      {
        v: 100,
        duration: 2.3,
        ease: "power1.inOut",
        onUpdate: () => {
          lvl.y = HIDDEN * (1 - p.v / 100);
          apply();
          const t = String(Math.round(p.v)).padStart(2, "0");
          counts.forEach((c) => (c.textContent = t));
        },
      },
      0.3
    );

    // fully covered: remove the cream underneath, then drain the red downward
    const coveredAt = 2.65;
    tl.to(contents, { opacity: 0, duration: 0.3, ease: "power1.in" }, coveredAt);
    tl.set(bg, { opacity: 0 }, coveredAt + 0.3);
    const drain = { y: 0 };
    tl.to(
      drain,
      {
        y: HIDDEN,
        duration: 1.0,
        ease: "expo.inOut",
        onUpdate: () => {
          lvl.y = drain.y;
          gsap.set(water, { y: lvl.y });
        },
      },
      coveredAt + 0.35
    );
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden">
      <div data-bg className="absolute inset-0 bg-[#eeeeee]">
        <div data-content className="absolute inset-0">
          <Readout dark={false} />
        </div>
      </div>

      <div data-water className="absolute inset-x-0 top-0 h-full will-change-transform">
        <div className="absolute inset-x-0 overflow-hidden" style={{ top: -(CREST - 1), height: CREST }}>
          <svg data-wave className="block h-full w-[200%] max-w-none" viewBox="0 0 2880 64" preserveAspectRatio="none" fill="#f33716">
            <path d={WAVE_PATH} />
          </svg>
        </div>
        <div className="absolute inset-0 overflow-hidden bg-amber">
          <div data-inner className="absolute inset-0">
            <div data-content className="absolute inset-0">
              <Readout dark />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

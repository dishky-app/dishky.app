import React from "react";
import { BellRing, Boxes, CalendarDays, Wallet, ShieldCheck, GitBranch } from "lucide-react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

const RINGS = [
  { size: 30, dur: 9, dir: 1, nodes: [{ Icon: BellRing, pos: "top" }, { Icon: Wallet, pos: "bottom" }] },
  { size: 48, dur: 14, dir: -1, nodes: [{ Icon: Boxes, pos: "top" }, { Icon: CalendarDays, pos: "bottom" }] },
  { size: 66, dur: 20, dir: 1, nodes: [{ Icon: ShieldCheck, pos: "top" }, { Icon: GitBranch, pos: "bottom" }] },
];

/**
 * "Orbit" (~3.9s). Dark. The parts of Dishky (orders, stock, bookings,
 * payments, team, branches) orbit your logo on three rings. As the counter
 * climbs they "connect" one by one, lighting up in brand red. Then the rings
 * collapse into the logo and a burst of brand colour fills the screen and
 * fades to the live homepage.
 */
export default function Orbit({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const rings = q("[data-ring]");
    const nodes = q("[data-node]");
    const [logo] = q("[data-logo]");
    const [name] = q("[data-name]");
    const [count] = q("[data-count]");
    const [meta] = q("[data-meta]");
    const [burst] = q("[data-burst]");
    const [glow] = q("[data-glow]");

    // endless rotation; icons counter-rotate so they always stay upright
    rings.forEach((ring, i) => {
      const { dur, dir } = RINGS[i];
      gsap.to(ring, { rotation: dir * 360, duration: dur, ease: "none", repeat: -1 });
      gsap.to(ring.querySelectorAll("[data-upright]"), { rotation: -dir * 360, duration: dur, ease: "none", repeat: -1 });
    });

    gsap.set(rings, { scale: 0.2, opacity: 0 });
    gsap.set(logo, { scale: 0.5, opacity: 0 });
    gsap.set(name, { opacity: 0, y: 12 });
    gsap.set(meta, { opacity: 0 });
    gsap.set(burst, { scale: 0 });
    gsap.set(glow, { opacity: 0 });

    tl.to(glow, { opacity: 1, duration: 1.2 }, 0);
    tl.to(logo, { scale: 1, opacity: 1, duration: 0.9, ease: "back.out(1.6)" }, 0.1);
    tl.to(rings, { scale: 1, opacity: 1, duration: 1.1, ease: "power3.out", stagger: 0.18 }, 0.25);
    tl.to(name, { opacity: 1, y: 0, duration: 0.8 }, 0.55);
    tl.to(meta, { opacity: 1, duration: 0.6 }, 0.7);
    tl.add(countTo(count, { duration: 2.0 }), 0.6);

    // connect the nodes one by one
    nodes.forEach((n, i) => {
      tl.to(n, { backgroundColor: "#f33716", color: "#ffffff", scale: 1.15, duration: 0.3, ease: "back.out(2)" }, 0.9 + i * 0.28);
      tl.to(n, { scale: 1, duration: 0.3 }, 1.2 + i * 0.28);
    });

    // collapse, burst, fade
    const exitAt = 2.75;
    tl.to([meta, name], { opacity: 0, duration: 0.3 }, exitAt - 0.05);
    tl.to(rings, { scale: 0.05, opacity: 0, duration: 0.65, ease: "power3.in", stagger: -0.06 }, exitAt);
    tl.to(logo, { scale: 1.25, duration: 0.55, ease: "power2.in" }, exitAt + 0.1);
    tl.to(burst, { scale: 45, duration: 0.6, ease: "power3.in" }, exitAt + 0.5);
    tl.to(root, { opacity: 0, duration: 0.45, ease: "power1.inOut" }, exitAt + 1.0);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden bg-charcoal">
      <div
        data-glow
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% 50%, rgba(243.0,55.0,22.0,0.16) 0%, rgba(243.0,55.0,22.0,0) 55%)" }}
      />

      <div className="pointer-events-none absolute inset-0">
        {RINGS.map((r, ri) => (
          <div
            key={ri}
            data-ring
            className="absolute inset-0 m-auto rounded-full border border-cream/15"
            style={{ width: `${r.size}vmin`, height: `${r.size}vmin` }}
          >
            {r.nodes.map(({ Icon, pos }, ni) => (
              <div
                key={ni}
                className={`absolute left-1/2 -translate-x-1/2 ${pos === "top" ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2"}`}
              >
                <div data-upright>
                  <div
                    data-node
                    className="flex h-[clamp(34px,5.4vmin,46px)] w-[clamp(34px,5.4vmin,46px)] items-center justify-center rounded-full bg-[#2a2a2a] text-cream ring-1 ring-cream/20"
                  >
                    <Icon size={18} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div data-logo>
            <BrandMark className="h-[clamp(52px,10vmin,88px)]" />
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-[clamp(28px,7vh,64px)] flex flex-col items-center gap-4">
        <div data-name>
          <BrandWordmark dark className="h-[clamp(18px,3.2vmin,28px)]" />
        </div>
        <p data-meta className="font-display text-xs tabular-nums text-cream/80">
          <span data-count>00</span>
          <span className="text-amber">%</span>
        </p>
      </div>

      <div data-burst className="pointer-events-none absolute inset-0 m-auto h-[10vmin] w-[10vmin] rounded-full bg-amber" />
    </div>
  );
}

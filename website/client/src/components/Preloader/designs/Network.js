import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandMark, BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

const NODES = [[400, 250], [260, 160], [540, 150], [190, 300], [610, 320], [330, 410], [480, 400], [110, 180], [700, 200], [400, 70], [720, 380], [90, 350]];
const EDGES = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 7], [1, 9], [2, 9], [2, 8], [3, 7], [3, 11], [4, 8], [4, 10], [5, 11], [6, 10], [5, 6]];
const PULSES = [0, 3, 7, 10, 13, 15]; // which edges carry a travelling dot

/**
 * "Network" (~4s). Dark. Branches connect: lines draw outward from your logo
 * to eleven points, each node popping into place as its line arrives, and
 * pulses of data then travel along the links. The view finally flies
 * through the network and fades onto the homepage.
 */
export default function Network({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const lines = q("[data-edge]");
    const nodes = q("[data-node]");
    const dots = q("[data-pulse]");
    const [net] = q("[data-net]");
    const [logo] = q("[data-logo]");
    const [meta] = q("[data-meta]");
    const [halo] = q("[data-halo]");
    const [count] = q("[data-count]");

    lines.forEach((l) => {
      const len = l.getTotalLength();
      gsap.set(l, { strokeDasharray: len, strokeDashoffset: len });
    });
    gsap.set(nodes, { scale: 0, transformOrigin: "50% 50%" });
    gsap.set(dots, { opacity: 0 });
    gsap.set(logo, { scale: 0.6, opacity: 0 });
    gsap.set(meta, { opacity: 0 });
    gsap.fromTo(halo, { scale: 0.8, opacity: 0.5 }, { scale: 1.9, opacity: 0, duration: 1.8, ease: "sine.out", repeat: -1 });

    tl.to(logo, { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.6)" }, 0.1);
    tl.to(meta, { opacity: 1, duration: 0.6 }, 0.4);
    tl.add(countTo(count, { duration: 2.2 }), 0.4);

    EDGES.forEach(([a, b], i) => {
      const at = 0.45 + i * 0.1;
      tl.to(lines[i], { strokeDashoffset: 0, duration: 0.7, ease: "power2.inOut" }, at);
      const nodeIdx = a === 0 ? b : b; // the far end of each edge
      const n = nodes[nodeIdx - 1];
      if (n && !n.dataset.shown) {
        n.dataset.shown = "1";
        tl.to(n, { scale: 1, duration: 0.5, ease: "back.out(2.4)" }, at + 0.55);
      }
    });

    // data pulses along the links
    PULSES.forEach((ei, k) => {
      const [a, b] = EDGES[ei];
      const [x1, y1] = NODES[a];
      const [x2, y2] = NODES[b];
      const dot = dots[k];
      const o = { t: 0 };
      // park each dot at the start of its link so it never shows at the corner
      dot.setAttribute("cx", x1);
      dot.setAttribute("cy", y1);
      tl.to(dot, { opacity: 1, duration: 0.2 }, 1.7 + k * 0.3);
      gsap.to(o, {
        t: 1,
        duration: 1.1,
        ease: "sine.inOut",
        repeat: -1,
        delay: 1.7 + k * 0.3,
        onUpdate: () => {
          dot.setAttribute("cx", x1 + (x2 - x1) * o.t);
          dot.setAttribute("cy", y1 + (y2 - y1) * o.t);
        },
      });
    });

    const exitAt = 3.0;
    tl.to([meta, logo], { opacity: 0, duration: 0.35, ease: "power1.in" }, exitAt - 0.05);
    tl.to(net, { scale: 2.8, svgOrigin: "400 250", opacity: 0, duration: 1.0, ease: "power3.in" }, exitAt);
    tl.to(root, { opacity: 0, duration: 0.5, ease: "power1.inOut" }, exitAt + 0.6);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden bg-[#0e0e0e]">
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% 50%, rgba(243.0,55.0,22.0,0.12) 0%, rgba(243.0,55.0,22.0,0) 55%)" }}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative w-[min(94vw,1000px)]">
          <svg data-net viewBox="0 0 800 500" className="w-full overflow-visible">
            {EDGES.map(([a, b], i) => (
              <line key={i} data-edge x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
            ))}
            {NODES.slice(1).map(([x, y], i) => (
              <g key={i} data-node>
                <circle cx={x} cy={y} r="13" fill="rgba(243.0,55.0,22.0,0.16)" />
                <circle cx={x} cy={y} r="5.5" fill="#ffffff" />
              </g>
            ))}
            {PULSES.map((_, k) => (
              <circle key={k} data-pulse r="4.5" fill="#f33716" />
            ))}
          </svg>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div data-halo className="absolute inset-0 m-auto h-[clamp(70px,12vmin,110px)] w-[clamp(70px,12vmin,110px)] rounded-full border border-amber/70" />
            <div data-logo className="relative">
              <BrandMark className="h-[clamp(48px,8.5vmin,72px)]" />
            </div>
          </div>
        </div>
      </div>

      <div data-meta className="pointer-events-none absolute inset-x-0 bottom-[clamp(24px,6vh,52px)] flex flex-col items-center gap-3">
        <BrandWordmark dark className="h-[clamp(16px,2.8vmin,24px)]" />
        <p className="font-display text-xs tabular-nums text-cream">
          <span className="uppercase tracking-[0.2em] text-cream/55">Connecting branches</span>
          <span className="ml-3">
            <span data-count>00</span>
            <span className="text-amber">%</span>
          </span>
        </p>
      </div>
    </div>
  );
}

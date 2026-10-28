import React from "react";
import { gsap } from "../../../animations/gsapSetup.js";
import { BrandWordmark } from "../../Brand/Brand.js";
import { usePreloader, countTo } from "./common.js";

const INK = "#e4290c";

/**
 * "Ice cream" (~3.9s). LIGHT, pastel. A waffle cone slides up and three
 * scoops (strawberry, pistachio, vanilla) pop onto it with a springy
 * wobble, a cherry drops on top, sprinkles burst out and the bottom scoop
 * starts to drip. The cone sways, then the whole screen is swiped away to
 * the right.
 */
export default function IceCream({ onComplete }) {
  const rootRef = usePreloader(onComplete, ({ tl, q, root }) => {
    const [cone] = q("[data-cone]");
    const scoops = q("[data-scoop]");
    const [cherry] = q("[data-cherry]");
    const sprinkles = q("[data-sprinkle]");
    const drips = q("[data-drip]");
    const [sway] = q("[data-sway]");
    const [meta] = q("[data-meta]");
    const [count] = q("[data-count]");

    gsap.set(cone, { y: 90, opacity: 0 });
    // set each scoop's pivot (its bottom centre) BEFORE collapsing it to scale 0;
    // changing the pivot of an already-collapsed element would shift it
    [146, 106, 72].forEach((y, i) => gsap.set(scoops[i], { svgOrigin: `120 ${y}` }));
    gsap.set(scoops, { scale: 0, opacity: 0 });
    gsap.set(cherry, { y: -130, opacity: 0 });
    sprinkles.forEach((s) => gsap.set(s, { x: 120 - Number(s.dataset.x), y: 24 - Number(s.dataset.y), scale: 0, opacity: 0, transformOrigin: "50% 50%" }));
    gsap.set(drips, { scaleY: 0, transformOrigin: "50% 0%" });
    gsap.set(meta, { opacity: 0 });

    tl.to(cone, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, 0.1);
    tl.to(meta, { opacity: 1, duration: 0.6 }, 0.3);
    scoops.forEach((s, i) => {
      tl.to(s, { scale: 1, opacity: 1, duration: 1.0, ease: "elastic.out(1, 0.55)" }, 0.65 + i * 0.4);
    });
    tl.to(cherry, { y: 0, opacity: 1, duration: 0.7, ease: "bounce.out" }, 1.95);
    tl.to(sprinkles, { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.55, ease: "back.out(2)", stagger: 0.025 }, 2.3);
    tl.to(drips, { scaleY: 1, duration: 0.9, ease: "sine.out", stagger: 0.2 }, 2.55);
    tl.add(countTo(count, { duration: 2.2 }), 0.5);
    tl.fromTo(sway, { rotation: -2.2, svgOrigin: "120 290", immediateRender: false }, { rotation: 2.2, svgOrigin: "120 290", duration: 0.5, ease: "sine.inOut", yoyo: true, repeat: 3, immediateRender: false }, 2.4);

    const exitAt = 3.2;
    tl.to(meta, { opacity: 0, duration: 0.3 }, exitAt - 0.1);
    tl.to(cone, { y: -16, duration: 0.4, ease: "power2.in" }, exitAt - 0.1);
    tl.to(root, { xPercent: 105, skewX: -10, duration: 0.95, ease: "expo.inOut" }, exitAt);
  });

  return (
    <div ref={rootRef} aria-hidden="true" className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#fde8e6]">
      <div data-cone className="w-[clamp(180px,34vmin,290px)]">
        <svg viewBox="0 0 240 300" className="w-full overflow-visible">
          <defs>
            <clipPath id="dkConeClip">
              <path d="M80 138 L160 138 L120 290 Z" />
            </clipPath>
          </defs>
          <g data-sway>
            <path d="M80 138 L160 138 L120 290 Z" fill="#f5604a" />
            <g clipPath="url(#dkConeClip)" stroke="#f33214" strokeWidth="2.5">
              <path d="M-38 130 L132 300" /><path d="M-16 130 L154 300" /><path d="M6 130 L176 300" /><path d="M28 130 L198 300" /><path d="M50 130 L220 300" /><path d="M72 130 L242 300" /><path d="M94 130 L264 300" /><path d="M116 130 L286 300" /><path d="M138 130 L308 300" /><path d="M160 130 L330 300" /><path d="M182 130 L352 300" /><path d="M278 130 L108 300" /><path d="M256 130 L86 300" /><path d="M234 130 L64 300" /><path d="M212 130 L42 300" /><path d="M190 130 L20 300" /><path d="M168 130 L-2 300" /><path d="M146 130 L-24 300" /><path d="M124 130 L-46 300" /><path d="M102 130 L-68 300" /><path d="M80 130 L-90 300" /><path d="M58 130 L-112 300" />
            </g>

            <g data-drip>
              <rect x="101" y="146" width="8" height="22" rx="4" fill="#faaea2" />
            </g>
            <g data-drip>
              <rect x="134" y="146" width="8" height="15" rx="4" fill="#faaea2" />
            </g>

            <g data-scoop>
              <path d="M78 140 A42 42 0 0 1 162 140 q-8 12 -16 0 q-8 12 -16 0 q-8 12 -16 0 q-8 12 -16 0 q-8 12 -20 0 Z" fill="#faaea2" />
              <ellipse cx="97" cy="118" rx="9" ry="5" fill="#ffffff" opacity="0.4" transform="rotate(-30 97 118)" />
            </g>
            <g data-scoop>
              <path d="M83 100 A37 37 0 0 1 157 100 q-8 11 -15 0 q-8 11 -15 0 q-8 11 -15 0 q-8 11 -15 0 q-7 11 -14 0 Z" fill="#f99d8f" />
              <ellipse cx="102" cy="80" rx="8" ry="4.5" fill="#ffffff" opacity="0.4" transform="rotate(-30 102 80)" />
            </g>
            <g data-scoop>
              <path d="M88 66 A32 32 0 0 1 152 66 q-7 10 -13 0 q-7 10 -13 0 q-7 10 -13 0 q-7 10 -13 0 q-6 10 -12 0 Z" fill="#e4e4e4" />
              <ellipse cx="106" cy="48" rx="7" ry="4" fill="#ffffff" opacity="0.55" transform="rotate(-30 106 48)" />
            </g>

          <g transform="rotate(12 100 56)"><g data-sprinkle data-x="100" data-y="56"><rect x="96" y="54.5" width="8" height="3" rx="1.5" fill="#f66b56" /></g></g>
          <g transform="rotate(-32 112 46)"><g data-sprinkle data-x="112" data-y="46"><rect x="108" y="44.5" width="8" height="3" rx="1.5" fill="#f6654e" /></g></g>
          <g transform="rotate(31 126 44)"><g data-sprinkle data-x="126" data-y="44"><rect x="122" y="42.5" width="8" height="3" rx="1.5" fill="#f55c45" /></g></g>
          <g transform="rotate(-58 140 54)"><g data-sprinkle data-x="140" data-y="54"><rect x="136" y="52.5" width="8" height="3" rx="1.5" fill="#f4472c" /></g></g>
          <g transform="rotate(-52 108 62)"><g data-sprinkle data-x="108" data-y="62"><rect x="104" y="60.5" width="8" height="3" rx="1.5" fill="#ffffff" /></g></g>
          <g transform="rotate(67 132 62)"><g data-sprinkle data-x="132" data-y="62"><rect x="128" y="60.5" width="8" height="3" rx="1.5" fill="#f66b56" /></g></g>
          <g transform="rotate(-46 120 54)"><g data-sprinkle data-x="120" data-y="54"><rect x="116" y="52.5" width="8" height="3" rx="1.5" fill="#f6654e" /></g></g>
          <g transform="rotate(23 96 88)"><g data-sprinkle data-x="96" data-y="88"><rect x="92" y="86.5" width="8" height="3" rx="1.5" fill="#f55c45" /></g></g>
          <g transform="rotate(-56 110 80)"><g data-sprinkle data-x="110" data-y="80"><rect x="106" y="78.5" width="8" height="3" rx="1.5" fill="#f4472c" /></g></g>
          <g transform="rotate(59 130 82)"><g data-sprinkle data-x="130" data-y="82"><rect x="126" y="80.5" width="8" height="3" rx="1.5" fill="#ffffff" /></g></g>
          <g transform="rotate(-16 144 90)"><g data-sprinkle data-x="144" data-y="90"><rect x="140" y="88.5" width="8" height="3" rx="1.5" fill="#f66b56" /></g></g>
          <g transform="rotate(-61 104 98)"><g data-sprinkle data-x="104" data-y="98"><rect x="100" y="96.5" width="8" height="3" rx="1.5" fill="#f6654e" /></g></g>
          <g transform="rotate(-48 138 100)"><g data-sprinkle data-x="138" data-y="100"><rect x="134" y="98.5" width="8" height="3" rx="1.5" fill="#f55c45" /></g></g>
          <g transform="rotate(41 92 128)"><g data-sprinkle data-x="92" data-y="128"><rect x="88" y="126.5" width="8" height="3" rx="1.5" fill="#f4472c" /></g></g>
          <g transform="rotate(37 120 114)"><g data-sprinkle data-x="120" data-y="114"><rect x="116" y="112.5" width="8" height="3" rx="1.5" fill="#ffffff" /></g></g>
          <g transform="rotate(-53 146 126)"><g data-sprinkle data-x="146" data-y="126"><rect x="142" y="124.5" width="8" height="3" rx="1.5" fill="#f66b56" /></g></g>
          <g transform="rotate(-9 108 130)"><g data-sprinkle data-x="108" data-y="130"><rect x="104" y="128.5" width="8" height="3" rx="1.5" fill="#f6654e" /></g></g>

            <g data-cherry>
              <path d="M120 22 Q126 6 140 2" fill="none" stroke="#e4290c" strokeWidth="3" strokeLinecap="round" />
              <circle cx="120" cy="28" r="10" fill="#f12b0d" />
              <ellipse cx="116.5" cy="24" rx="3" ry="2" fill="#ffffff" opacity="0.6" />
            </g>
          </g>
        </svg>
      </div>

      <div data-meta className="mt-4 flex flex-col items-center gap-3">
        <BrandWordmark className="h-[clamp(18px,3.2vmin,28px)]" />
        <p className="font-display text-xs tabular-nums" style={{ color: INK, opacity: 0.7 }}>
          <span className="uppercase tracking-[0.2em]">Scooping</span>
          <span className="ml-3">
            <span data-count>00</span>
            <span className="text-amber">%</span>
          </span>
        </p>
      </div>
    </div>
  );
}

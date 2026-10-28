import React, { useLayoutEffect, useRef, useState } from "react";
import {
  ClipboardList, BookOpen, Package, Users, ChefHat, CalendarDays, Heart, Wallet, BarChart3, Smartphone,
} from "lucide-react";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import { Photo } from "../ui/kit.js";
import { images } from "../../assets/images/imageUrls.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";

const items = [
  [ClipboardList, "Orders", "Paper pad"], [ChefHat, "Kitchen", "Shouting"], [Package, "Stock", "Notebook"],
  [Users, "Staff", "WhatsApp"], [CalendarDays, "Bookings", "Phone calls"], [Heart, "Guests", "Memory"],
  [Wallet, "Payments", "Manual tally"], [BarChart3, "Reports", "Spreadsheet"],
];
const tilt = [-4, 3, -2, 5, -5, 2, -3, 4];

/** Drag (or arrow-key) between scattered tools and one connected platform. */
export default function BeforeAfterSection() {
  const ref = useRef(null);
  const [pos, setPos] = useState(50);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(el.querySelector("[data-ba-stage]"), { opacity: 0, y: 70, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, ease: "none", scrollTrigger: { trigger: el, start: "top 80%", end: "top 40%", scrub: 0.8 } });
    }, el);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={ref} className="bg-beige" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="container-dishky">
        <SectionHeading title={"BEFORE.\nAFTER."} align="center" />
        <div data-ba-stage className="relative mx-auto mt-10 h-[460px] max-w-5xl select-none overflow-hidden rounded-[2rem] shadow-2xl md:mt-14 md:h-[520px]">
          {/* Before */}
          <div className="absolute inset-0 bg-[#cfcfcf]">
            <Photo src={images.restaurantInterior1} art="chaos" artDark={false} className="absolute inset-0 opacity-70" />
            <p className="absolute left-5 top-4 z-10 rounded-full bg-ink px-3 py-1 text-xs font-bold text-cream">Before</p>
            <div className="absolute inset-0 grid grid-cols-2 content-center gap-3 p-5 pt-14 sm:grid-cols-4 md:gap-5 md:p-10">
              {items.map(([Icon, a, b], i) => (
                <div key={a} className="rounded-xl bg-white p-3 shadow-lg" style={{ transform: `rotate(${tilt[i]}deg)` }}>
                  <Icon size={18} className="text-ink/50" />
                  <p className="mt-2 text-sm font-bold text-ink">{a}</p>
                  <p className="text-xs text-ink/50 line-through">{b}</p>
                </div>
              ))}
            </div>
          </div>
          {/* After */}
          <div className="absolute inset-0 bg-ink" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
            <Photo src={images.kitchenAction} art="calm" className="absolute inset-0 opacity-50" />
            <p className="absolute right-5 top-4 z-10 rounded-full bg-amber px-3 py-1 text-xs font-bold text-white">After</p>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6">
              <div className="flex items-center gap-3 rounded-2xl bg-amber px-6 py-4 text-white shadow-[0_20px_60px_-10px_rgba(243,55,22,0.7)]">
                <Smartphone size={22} /><span className="font-display text-xl font-extrabold">One Dishky</span>
              </div>
              <ul className="flex max-w-xl flex-wrap justify-center gap-2">
                {items.map(([Icon, a]) => (
                  <li key={a} className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-cream">
                    <Icon size={14} className="text-amberLight" /> {a}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-cream/70">Connected. Live. In one place.</p>
            </div>
          </div>
          {/* Handle */}
          <div className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-white" style={{ left: `${pos}%` }}>
            <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-bold text-ink shadow-xl">⇆</span>
          </div>
          <input
            type="range" min={0} max={100} value={pos} aria-label="Compare before and after Dishky"
            onChange={(e) => setPos(+e.target.value)}
            className="absolute inset-0 z-30 h-full w-full cursor-ew-resize opacity-0"
          />
        </div>
        <div className="mt-5 flex justify-center gap-3">
          <button type="button" onClick={() => setPos(100)} className="btn-secondary !min-h-[44px]">Before</button>
          <button type="button" onClick={() => setPos(0)} className="btn-primary !min-h-[44px]">After</button>
        </div>
      </div>
    </section>
  );
}

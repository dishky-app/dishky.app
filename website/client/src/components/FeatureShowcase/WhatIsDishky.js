import React, { useLayoutEffect, useRef } from "react";
import { Smile, Workflow, LineChart, QrCode, Star, Bell, ChefHat, Boxes, Users, TrendingUp, Layers, Building2 } from "lucide-react";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";

const pillars = [
  { label: "Customer Experience", icon: Smile, line: "Guests order, pay and come back.", chips: [[QrCode, "QR ordering"], [Star, "Loyalty"], [Bell, "Live updates"]] },
  { label: "Restaurant Operations", icon: Workflow, line: "Every station on the same page.", chips: [[ChefHat, "Kitchen"], [Boxes, "Inventory"], [Users, "Staff"]] },
  { label: "Business Intelligence", icon: LineChart, line: "Numbers that tell you what to do.", chips: [[TrendingUp, "Live sales"], [Layers, "Reports"], [Building2, "Branches"]] },
];

/** Three pillars feed one glowing core. Light beams run from each pillar into DISHKY as you scroll. */
export default function WhatIsDishky() {
  const sectionRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || reducedMotion) return undefined;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: section.querySelector("[data-wd-grid]"), start: "top 80%", end: "bottom 55%", scrub: 1 } });
      tl.fromTo("[data-wd-pillar]", { opacity: 0, y: 40 }, { opacity: 1, y: 0, stagger: 0.25, duration: 1 });
      tl.fromTo("[data-wd-beam]", { scaleY: 0 }, { scaleY: 1, stagger: 0.15, duration: 0.6 }, "-=0.2");
      tl.fromTo("[data-wd-core]", { opacity: 0, scale: 0.75 }, { opacity: 1, scale: 1, duration: 0.6 }, "-=0.2");
    }, section);
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section id="what" ref={sectionRef} data-nav-theme="dark" className="relative overflow-hidden bg-ink text-cream" style={{ paddingBlock: "var(--section-space)" }}>
      <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-500/10 blur-3xl" />
      <div className="container-dishky relative">
        <SectionHeading title={"YOUR RESTAURANT'S\nDIGITAL CORE."} align="center" dark />

        <div data-wd-grid className="mx-auto mt-12 max-w-6xl md:mt-16">
          <div className="grid divide-y divide-white/10 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] md:grid-cols-3 md:divide-x md:divide-y-0">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.label} data-wd-pillar className="group p-6 text-center transition-colors duration-300 hover:bg-white/[0.05] md:p-8">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber text-white transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                    <Icon size={26} />
                  </span>
                  <p className="mt-4 font-display text-xl font-bold">{p.label}</p>
                  <p className="mt-1 text-sm text-cream/60">{p.line}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {p.chips.map(([C, t]) => (
                      <span key={t} className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-cream/80">
                        <C size={12} className="text-amber" /> {t}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center"><span data-wd-beam aria-hidden="true" className="dk-beam h-10 w-px origin-top" /></div>
        </div>

        <div data-wd-core className="relative mx-auto flex max-w-xl items-center justify-center rounded-full border border-amber/40 bg-gradient-to-r from-amber/20 via-amber/30 to-amber/20 px-8 py-5 shadow-[0_0_60px_rgba(243,55,22,0.35)] md:mt-0">
          <span className="font-display text-3xl font-extrabold tracking-wide text-white md:text-4xl">DISHKY</span>
          <span className="ml-4 hidden text-sm font-semibold text-cream/70 sm:block">one platform, one source of truth</span>
        </div>
      </div>
    </section>
  );
}

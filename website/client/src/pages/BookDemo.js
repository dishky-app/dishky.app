import React, { useLayoutEffect, useRef } from "react";
import PageBackdrop from "../components/ReactBits/PageBackdrop.js";
import { Calendar, ClipboardList, MonitorPlay, Rocket } from "lucide-react";
import { gsap } from "../animations/gsapSetup.js";
import useReducedMotion from "../hooks/useReducedMotion.js";
import { DemoRequestForm } from "../components/CTA/FinalCTASection.js";

const steps = [
  [ClipboardList, "Tell us about your place", "A few lines: what you run and how many branches."],
  [Calendar, "We find a time", "Our team replies to set up a slot that suits you."],
  [MonitorPlay, "See both panels, live", "The guest app and the admin panel, set around how you operate."],
  [Rocket, "Decide at your pace", "If it fits, we help you set up and go live."],
];

/** Book a demo: a timeline that draws itself on the left, the form on a floating card on the right. */
export default function BookDemo() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(el.querySelector("[data-tl]"), { scaleY: 0 }, { scaleY: 1, transformOrigin: "top", duration: 1.6, ease: "power2.inOut", delay: 0.3 });
      gsap.fromTo(el.querySelectorAll("[data-step]"), { x: -30, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.28, duration: 0.8, ease: "power3.out", delay: 0.35 });
      gsap.fromTo(el.querySelector("[data-form]"), { y: 60, opacity: 0, rotate: 1.5 }, { y: 0, opacity: 1, rotate: 0, duration: 1, ease: "power3.out", delay: 0.2 });
      gsap.to(el.querySelectorAll("[data-orb]"), { y: (i) => (i ? 30 : -30), duration: 5, repeat: -1, yoyo: true, ease: "sine.inOut" });
    }, el);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <div ref={ref} data-nav-theme="dark" className="relative isolate min-h-screen-safe overflow-x-clip bg-[#0c0c0c] text-cream" style={{ paddingTop: "calc(var(--header-clearance) + clamp(24px, 6vw, 64px))", paddingBottom: "var(--section-space)" }}>
      <PageBackdrop tone="dark" />
      <div data-orb aria-hidden="true" className="glow -left-24 top-20 h-[380px] w-[380px] bg-amber/25" />
      <div data-orb aria-hidden="true" className="glow -right-24 bottom-10 h-[320px] w-[320px] bg-amber/15" />
      <div className="container-dishky relative grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-stretch lg:gap-16">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-amber">Book a demo</p>
          <h1 className="heading-lg mt-3">See Dishky running for a restaurant like yours.</h1>
          <p className="text-lead mt-4 max-w-md text-cream/60">Tell us a little about your restaurant and our team will walk you through the User Panel and Admin Panel, tailored to how you operate.</p>
          <ol className="relative mt-10 space-y-7 pl-14">
            <span aria-hidden="true" data-tl className="absolute bottom-3 left-[1.35rem] top-3 w-px bg-gradient-to-b from-amber to-amber/10" />
            {steps.map(([Icon, t, d], i) => (
              <li key={t} data-step className="relative">
                <span className="absolute -left-14 top-0 flex h-11 w-11 items-center justify-center rounded-full border border-amber/60 bg-[#0c0c0c] text-amber"><Icon size={18} /></span>
                <p className="font-display text-lg font-bold">{i + 1}. {t}</p>
                <p className="mt-0.5 text-sm text-cream/60">{d}</p>
              </li>
            ))}
          </ol>
        </div>
        <div data-form className="h-full min-w-0">
          <DemoRequestForm />
        </div>
      </div>
    </div>
  );
}

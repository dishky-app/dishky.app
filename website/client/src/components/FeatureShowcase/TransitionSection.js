import React, { useLayoutEffect, useRef } from "react";
import { BellRing, ChefHat, Boxes, Wallet, LayoutDashboard } from "lucide-react";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import useMediaQuery from "../../hooks/useMediaQuery.js";

// What happens on the restaurant side, in the order it happens, while the
// guest is still on their phone. Timestamps are illustrative.
const events = [
  {
    icon: BellRing,
    time: "0:00",
    title: "Order lands",
    text: "#e4290c11 · Table 12",
  },
  {
    icon: ChefHat,
    time: "0:02",
    title: "Kitchen ticket",
    text: "Queued for the chef",
  },
  {
    icon: Boxes,
    time: "0:03",
    title: "Stock adjusts",
    text: "Low items flagged",
  },
  {
    icon: Wallet,
    time: "0:20",
    title: "Payment recorded",
    text: "Paid · ₹1,240",
  },
  {
    icon: LayoutDashboard,
    time: "0:21",
    title: "Numbers update",
    text: "Live, no reload",
  },
];

export default function TransitionSection() {
  const sectionRef = useRef(null);
  const lineOneRef = useRef(null);
  const lineTwoRef = useRef(null);
  const cardRefs = useRef([]);
  const reducedMotion = useReducedMotion();
  cardRefs.current = [];

  // Pinned headline-swap is a large-screen, pointer-driven moment. Everywhere
  // else (phones, tablets, short landscape) the section is a normal flowing
  // layout: both headline lines are visible, and the events form a numbered
  // vertical timeline that fades in as each item scrolls into view.
  const isDesktop = useMediaQuery("(min-width: 1024px) and (min-height: 640px) and (hover: hover) and (pointer: fine)");
  const pinned = isDesktop && !reducedMotion;

  const addCardRef = (el) => {
    if (el) cardRefs.current.push(el);
  };

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    if (!pinned) {
      gsap.set([lineOneRef.current, lineTwoRef.current, ...cardRefs.current], { clearProps: "all" });

      if (reducedMotion) return;

      // Light per-item reveal for the stacked layout. No pin, no scrub.
      const ctx = gsap.context(() => {
        cardRefs.current.forEach((card) => {
          gsap.from(card, {
            opacity: 0,
            y: 24,
            duration: 0.6,
            ease: "power2.out",
            scrollTrigger: { trigger: card, start: "top 88%", once: true },
          });
        });
      }, section);
      return () => ctx.revert();
    }

    const ctx = gsap.context(() => {
      gsap.set(lineTwoRef.current, { opacity: 0, y: 24 });
      gsap.set(cardRefs.current, { opacity: 0, y: 40 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=220%",
          scrub: 1,
          pin: true,
          anticipatePin: 1,
        },
      });

      tl.to(lineOneRef.current, { opacity: 0, y: -24, duration: 0.8 })
        .to(lineTwoRef.current, { opacity: 1, y: 0, duration: 0.8 }, "-=0.3");

      cardRefs.current.forEach((card, i) => {
        tl.to(card, { opacity: 1, y: 0, duration: 0.6 }, `>${i === 0 ? "-0.1" : "-0.35"}`);
      });

      tl.to({}, { duration: 0.6 });
    }, section);

    return () => ctx.revert();
  }, [pinned, reducedMotion]);

  return (
    <section
      ref={sectionRef}
      data-nav-theme="dark"
      className="relative flex items-center overflow-x-clip bg-ink text-cream lg:min-h-screen"
      style={{ paddingBlock: "var(--section-space)" }}
    >
      <div className="glow left-1/2 top-1/4 h-[320px] w-[320px] -translate-x-1/2 bg-amber/10 md:top-1/3 md:h-[420px] md:w-[620px]" />

      <div className="container-dishky relative">
        {/* Both lines share one grid cell, so the taller one sets the height:
            they can never overlap the cards below, however the text wraps. */}
        <div className="mx-auto grid max-w-3xl text-center">
          <p ref={lineOneRef} className="heading-md col-start-1 row-start-1 max-lg:mb-2">
            WHILE YOUR GUEST <span className="br-desktop"><br /></span>PLACES AN ORDER...
          </p>
          <p
            ref={lineTwoRef}
            className="heading-md col-start-1 text-amber max-lg:row-start-2 lg:row-start-1"
          >
            YOUR RESTAURANT <span className="br-desktop"><br /></span>IS ALREADY IN CONTROL.
          </p>
        </div>

        {/* Numbered timeline (phones/tablet) -> 5-up board (desktop) */}
        <ol className="mx-auto mt-10 grid max-w-5xl gap-3 sm:grid-cols-2 md:mt-14 md:gap-4 lg:grid-cols-5">
          {events.map((e, i) => {
            const Icon = e.icon;
            return (
              <li
                key={e.title}
                ref={addCardRef}
                className="group rounded-2xl border border-cream/10 bg-cream/[0.04] p-5 text-left transition-colors duration-500 hover:border-amber/50 hover:bg-amber/10"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2.5">
                    <span className="dk-ping flex h-9 w-9 items-center justify-center rounded-xl bg-amber/15 text-amberLight transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
                      <Icon size={18} />
                    </span>
                    <span className="font-display text-xs font-bold text-cream/40 lg:hidden">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </span>
                  <span className="font-display text-[11px] text-cream/40">+{e.time}</span>
                </div>
                <p className="mt-4 font-display text-sm font-bold text-cream">{e.title}</p>
                <p className="mt-1.5 font-display text-xs text-cream/55">{e.text}</p>
                <span className="mt-4 block h-1 overflow-hidden rounded-full bg-cream/10" aria-hidden="true">
                  <span className="dk-shimmer block h-full w-full rounded-full bg-gradient-to-r from-amber/30 via-amber to-amber/30" />
                </span>
              </li>
            );
          })}
        </ol>

        <p className="mx-auto mt-8 text-center text-xs text-cream/40 md:mt-10">Illustrative timings.</p>
      </div>
    </section>
  );
}

import React, { useLayoutEffect, useRef } from "react";
import { motion } from "framer-motion";
import { QrCode, ScanLine, UtensilsCrossed, ShoppingCart, CreditCard } from "lucide-react";
import { slideRight, staggerChildren, fadeUp } from "../../animations/variants.js";
import { viewportOnce } from "../../animations/transitions.js";
import ParallaxImage from "../ParallaxImage/ParallaxImage.js";
import { images } from "../../assets/images/imageUrls.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";

const steps = [
  { icon: ScanLine, title: "Scan the table QR", text: "No app. No login." },
  { icon: UtensilsCrossed, title: "Browse and choose", text: "Photos, ingredients, live stock." },
  { icon: ShoppingCart, title: "Place the order", text: "Straight to the kitchen." },
  { icon: CreditCard, title: "Pay and track", text: "Watch it move to ready." },
];

export default function QrOrderingSection() {
  const sectionRef = useRef(null);
  const stepRefs = useRef([]);
  const lineRef = useRef(null);
  const reducedMotion = useReducedMotion();
  stepRefs.current = [];

  const addStepRef = (el) => {
    if (el) stepRefs.current.push(el);
  };

  // The connecting line fills as you scroll, and each step lights up in turn.
  // Scrub over the *list*, not the whole section, so the range is right at
  // every height (the section is far taller on a phone than on desktop).
  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || reducedMotion) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section.querySelector("[data-steps]"),
          start: "top 70%",
          end: "bottom 55%",
          scrub: 1,
        },
      });

      tl.fromTo(lineRef.current, { scaleY: 0 }, { scaleY: 1, ease: "none", duration: steps.length });

      stepRefs.current.forEach((el, i) => {
        const badge = el.querySelector("[data-badge]");
        tl.to(badge, { backgroundColor: "#f33716", color: "#ffffff", scale: 1.08, duration: 0.4 }, i);
      });
    }, section);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section data-feature-rail="QR Ordering" ref={sectionRef} className="bg-beige" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="container-dishky split split-wide-left">
        {/* min-w-0: a grid child defaults to min-width:auto and would grow to
            fit its content, which is what pushed this section past the
            viewport on phones. */}
        <motion.div
          variants={slideRight}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="min-w-0"
        >
          <h2 className="heading-lg text-ink">
            One scan. <span className="br-desktop"><br /></span>
            <span className="text-amber">Your restaurant is open.</span>
          </h2>

          <div data-steps className="relative mt-8 md:mt-10">
            {/* Vertical connector: faint track + scroll-filled bar.
                Centered on the 40px badge column: left = (2.5rem / 2) - 1px */}
            <div className="absolute bottom-6 left-[19px] top-6 w-[2px] bg-ink/10" aria-hidden="true" />
            <div
              ref={lineRef}
              aria-hidden="true"
              className="absolute bottom-6 left-[19px] top-6 w-[2px] origin-top bg-amber"
            />

            <motion.ol
              variants={staggerChildren(0.1)}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              className="relative space-y-6 md:space-y-7"
            >
              {steps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.li key={s.title} ref={addStepRef} variants={fadeUp} className="flex gap-4 md:gap-5">
                    <span
                      data-badge
                      className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white font-display text-sm font-bold text-ink shadow-md ring-1 ring-ink/10"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="flex items-center gap-2 font-display text-base font-bold text-ink">
                        <Icon size={16} className="shrink-0 text-amber" />
                        {s.title}
                      </p>
                      <p className="text-body mt-1 max-w-md text-ink/60">{s.text}</p>
                    </div>
                  </motion.li>
                );
              })}
            </motion.ol>
          </div>
        </motion.div>

        {/* QR card on top, two equal dish photos aligned beneath it */}
        <div className="flex min-w-0 justify-center">
          <div className="w-full max-w-[380px]">
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-[2.25rem] border-[7px] border-ink bg-white shadow-2xl">
              {/* scales with the card instead of a fixed 150px */}
              <div className="relative h-[40%] w-[40%]">
                <QrCode className="h-full w-full text-ink" strokeWidth={1.5} aria-hidden="true" />
                <span className="dk-scan absolute inset-x-0 h-0.5 bg-amber shadow-[0_0_12px_2px_rgba(243,55,22,0.7)]" aria-hidden="true" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/50">
                Table 12
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:gap-5">
              <div className="min-w-0">
                <ParallaxImage
                  src={images.dishCurry}
                  art="order"
                  alt="A guest scans the table QR code and orders"
                  className="aspect-[4/3] w-full rounded-2xl shadow-xl ring-4 ring-white sm:rounded-3xl"
                  strength={6}
                />
                <p className="mt-2.5 px-1 text-xs font-semibold text-ink/70">Order</p>
              </div>
              <div className="min-w-0">
                <ParallaxImage
                  src={images.dishDessert}
                  art="cook"
                  alt="The kitchen receives the ticket"
                  className="aspect-[4/3] w-full rounded-2xl shadow-xl ring-4 ring-white sm:rounded-3xl"
                  strength={6}
                />
                <p className="mt-2.5 px-1 text-xs font-semibold text-ink/70">Kitchen</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

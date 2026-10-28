import React, { useLayoutEffect, useRef } from "react";
import { motion } from "framer-motion";
import { slideRight, staggerChildren, fadeUp } from "../../animations/variants.js";
import { viewportOnce } from "../../animations/transitions.js";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import PhoneMockup from "./PhoneMockup.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import useMediaQuery from "../../hooks/useMediaQuery.js";

const features = [
  "QR access", "Digital menu", "Categories", "Dish details",
  "Ingredients", "Cart", "Orders", "Payment",
  "Order tracking", "Offers", "Order history",
];

export default function UserPanelSection() {
  const sectionRef = useRef(null);
  const phoneWrapRef = useRef(null);
  const reducedMotion = useReducedMotion();
  // 3D tilt is decorative and only worthwhile where there is room + a cursor.
  const tilt = useMediaQuery("(min-width: 1024px) and (hover: hover) and (pointer: fine)");

  // Subtle scroll-tied tilt/lift on the phone mockup as the section passes
  // through the viewport — reads as the phone "presenting itself" to the
  // visitor rather than a static image.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || reducedMotion || !tilt) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        phoneWrapRef.current,
        { rotateY: -10, rotateX: 4, y: 40 },
        {
          rotateY: 0,
          rotateX: 0,
          y: -20,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, [reducedMotion, tilt]);

  return (
    <section data-feature-rail="Guest App" ref={sectionRef} className="bg-cream" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="container-dishky split">
        <motion.div variants={slideRight} initial="hidden" whileInView="visible" viewport={viewportOnce} className="order-2 min-w-0 lg:order-1">
          <SectionHeading
            title={"A BETTER\nGUEST EXPERIENCE."}
          />
          <motion.div
            variants={staggerChildren(0.05)}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="mt-6 flex flex-wrap gap-2 md:mt-8"
          >
            {features.map((f) => (
              <motion.span
                key={f}
                variants={fadeUp}
                className="cursor-default rounded-full bg-white px-3.5 py-2 text-xs font-medium text-ink/70 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-amber hover:text-white sm:px-4"
              >
                {f}
              </motion.span>
            ))}
          </motion.div>
        </motion.div>

        <div className="order-1 flex min-w-0 justify-center lg:order-2" style={{ perspective: 1200 }}>
          <div ref={phoneWrapRef}>
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

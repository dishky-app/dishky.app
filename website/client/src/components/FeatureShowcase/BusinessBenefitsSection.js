import React, { lazy, useLayoutEffect, useRef } from "react";
import Enhanced from "../ReactBits/Enhanced.js";
import {
  Layers, Smile, Workflow, Users, GitBranch, BarChart3,
} from "lucide-react";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import { Photo } from "../ui/kit.js";
import { images } from "../../assets/images/imageUrls.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";

const BenefitsFlex = lazy(() => import("./BenefitsFlex.js"));

// Photo cards: grey and calm at rest, full colour with the icon lifting on hover.
const benefits = [
  { icon: Layers, title: "Everything in one place", img: images.restaurantInterior1, art: "platform" },
  { icon: Smile, title: "Happier guests", img: images.friends, art: "b-guests" },
  { icon: Workflow, title: "A kitchen that flows", img: images.kitchenAction, art: "b-flow" },
  { icon: Users, title: "Organised service", img: images.serviceServe, art: "serve" },
  { icon: GitBranch, title: "Every branch, one view", img: images.dining, art: "p-branches" },
  { icon: BarChart3, title: "Numbers that guide you", img: images.chefPlating, art: "analytics" },
];

export default function BusinessBenefitsSection() {
  const sectionRef = useRef(null);
  const cardRefs = useRef([]);
  const reducedMotion = useReducedMotion();
  cardRefs.current = [];

  const addCardRef = (el) => {
    if (el) cardRefs.current.push(el);
  };

  // Cards scrub in as a diagonal "wave", staggered by grid position.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || reducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.set(cardRefs.current, { opacity: 0, scale: 0.92, rotate: 0, y: 32 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top 75%",
          end: "bottom 45%",
          scrub: 1,
        },
      });

      tl.to(cardRefs.current, {
        opacity: 1,
        scale: 1,
        rotate: 0,
        y: 0,
        stagger: { each: 0.12, from: "start" },
        duration: 1,
      });
    }, section);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} className="overflow-x-clip bg-cream" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="container-dishky">
        <SectionHeading title={"MORE CONTROL.\nLESS COMPLEXITY."} align="center" />

        <div className="mt-10 md:mt-14">
          <Enhanced
            webgl
            fallback={
        <div className="grid-auto-3">
          {benefits.map(({ icon: Icon, title, img, art }) => (
            <div key={title} ref={addCardRef} className="group relative h-56 overflow-hidden rounded-3xl md:h-64">
              <Photo src={img} art={art} className="absolute inset-0 transition-all duration-700" zoom />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber text-white transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-12">
                  <Icon size={20} />
                </span>
                <p className="font-display text-lg font-extrabold text-white">{title}</p>
                <span className="mt-2 block h-0.5 w-0 bg-amber transition-all duration-700 group-hover:w-16" aria-hidden="true" />
              </div>
            </div>
          ))}
        </div>
            }
          >
            <BenefitsFlex />
          </Enhanced>
        </div>
      </div>
    </section>
  );
}

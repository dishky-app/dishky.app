import React, { useLayoutEffect, useRef, useState } from "react";
import { UserRound, ChefHat, ConciergeBell, CreditCard } from "lucide-react";
import { images } from "../../assets/images/imageUrls.js";
import RevealImage from "../ParallaxImage/RevealImage.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";

/**
 * The four stages of a table's visit, each a photo that wipes in as you
 * scroll. Hover (or focus) a photo and its stage icon pops up over it.
 * If a photo fails to load, the frame falls back to an icon tile.
 */
const stages = [
  { key: "order", n: "01", title: "Order", icon: UserRound, src: images.serviceOrder, art: "order", dir: "left", lift: "" },
  { key: "cook", n: "02", title: "Cook", icon: ChefHat, src: images.serviceCook, art: "cook", dir: "left", lift: "lg:mt-14" },
  { key: "serve", n: "03", title: "Serve", icon: ConciergeBell, src: images.serviceServe, art: "serve", dir: "right", lift: "" },
  { key: "pay", n: "04", title: "Pay", icon: CreditCard, src: images.servicePay, art: "pay", dir: "right", lift: "lg:mt-14" },
];

function Stage({ stage }) {
  const [broken, setBroken] = useState(false);
  const Icon = stage.icon;
  return (
    <li className={`group min-w-0 ${stage.lift}`}>
      <div className="relative">
        {broken ? (
          <div className="flex aspect-[4/5] items-center justify-center rounded-2xl bg-charcoal sm:rounded-3xl lg:aspect-auto lg:h-[420px]">
            <Icon size={44} className="text-amber" />
          </div>
        ) : (
          <RevealImage
            src={stage.src}
            art={stage.art}
            alt={stage.title}
            direction={stage.dir}
            onError={() => setBroken(true)}
            className="aspect-[4/5] rounded-2xl sm:rounded-3xl lg:aspect-auto lg:h-[420px]"
          />
        )}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-black/35 opacity-0 transition-opacity duration-500 group-hover:opacity-100 sm:rounded-3xl">
          <span className="flex h-16 w-16 translate-y-4 items-center justify-center rounded-full bg-amber text-white transition-transform duration-500 group-hover:translate-y-0">
            <Icon size={28} />
          </span>
        </span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="font-display text-sm font-extrabold text-amber">{stage.n}</span>
        <p className="font-display text-lg font-bold text-cream">{stage.title}</p>
        <span className="h-px flex-1 origin-left scale-x-0 bg-amber transition-transform duration-700 group-hover:scale-x-100" aria-hidden="true" />
      </div>
    </li>
  );
}

export default function ImageStorySection() {
  const sectionRef = useRef(null);
  const captionRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || reducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        captionRef.current,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          ease: "none",
          scrollTrigger: { trigger: section, start: "top 75%", end: "top 35%", scrub: 1 },
        }
      );
    }, section);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} data-nav-theme="dark" className="bg-ink" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="container-dishky">
        <h2 ref={captionRef} className="heading-lg mb-10 max-w-xl text-cream md:mb-14">
          From first order to final bill.
        </h2>

        <ol className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-5">
          {stages.map((st) => (
            <Stage key={st.key} stage={st} />
          ))}
        </ol>
      </div>
    </section>
  );
}

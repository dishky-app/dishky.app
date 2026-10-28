import React, { useLayoutEffect, useRef } from "react";
import { motion } from "framer-motion";
import { QrCode } from "lucide-react";
import { cardHover } from "../../animations/variants.js";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import ParallaxImage from "../ParallaxImage/ParallaxImage.js";
import { Photo, CountUp } from "../ui/kit.js";
import { images } from "../../assets/images/imageUrls.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import useMediaQuery from "../../hooks/useMediaQuery.js";

const branches = [
  { city: "Chennai", slug: "chennai", revenue: 4.2, orders: 1240, speed: -14, img: images.dining, art: "city-chennai", bars: [40, 65, 50, 85, 70, 95], share: 41 },
  { city: "Madurai", slug: "madurai", revenue: 3.1, orders: 984, speed: 10, img: images.restaurantInterior2, art: "city-madurai", bars: [30, 45, 60, 50, 75, 65], share: 31 },
  { city: "Coimbatore", slug: "coimbatore", revenue: 2.8, orders: 812, speed: -8, img: images.cafeInterior, art: "city-coimbatore", bars: [25, 40, 35, 60, 55, 70], share: 28 },
];

/** A smooth sparkline with a soft fill and a glowing end point. */
function Spark({ data, id }) {
  const w = 120, h = 48, pad = 4;
  const pts = data.map((v, i) => [pad + (i * (w - pad * 2)) / (data.length - 1), h - pad - (v / 100) * (h - pad * 2)]);
  const d = pts.reduce((a, [x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${a} C${cx},${py} ${cx},${y} ${x},${y}`;
  }, "");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 min-w-0 flex-1" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f33716" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#f33716" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${last[0]},${h} L${pts[0][0]},${h} Z`} fill={`url(#sp-${id})`} />
      <path d={d} fill="none" stroke="#f33716" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function MultiBranchSection() {
  const sectionRef = useRef(null);
  const cardRefs = useRef([]);
  const reducedMotion = useReducedMotion();
  // Staggered card drift only makes sense side-by-side (sm+) with a pointer.
  const drift = useMediaQuery("(min-width: 640px) and (hover: hover) and (pointer: fine)");
  cardRefs.current = [];

  const addCardRef = (el) => {
    if (el) cardRefs.current.push(el);
  };

  // Each branch card drifts at a different vertical speed as the section
  // scrolls through, a card-level parallax "shelf" effect.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || reducedMotion || !drift) return;

    const ctx = gsap.context(() => {
      cardRefs.current.forEach((card, i) => {
        gsap.to(card, {
          yPercent: branches[i].speed,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      });
    }, section);

    return () => ctx.revert();
  }, [reducedMotion, drift]);

  return (
    <section data-feature-rail="Multi-Branch" ref={sectionRef} data-nav-theme="dark" className="relative overflow-hidden bg-charcoal text-cream" style={{ paddingBlock: "var(--section-space)" }}>
      <ParallaxImage
        src={images.restaurantInterior2}
        art="p-branches"
        alt=""
        className="absolute inset-0 opacity-20 md:opacity-25"
        strength={12}
      />
      <div className="absolute inset-0 bg-charcoal/70" />

      <div className="container-dishky relative">
        <SectionHeading title={"ONE BRAND.\nMULTIPLE BRANCHES."} align="center" dark />

        <div className="mt-10 grid gap-4 sm:grid-cols-3 md:mt-14 md:gap-6">
          {branches.map((b) => (
            <motion.div
              key={b.city}
              ref={addCardRef}
              variants={cardHover}
              initial="rest"
              whileHover="hover"
              className="group overflow-hidden rounded-3xl border border-cream/10 bg-cream/5"
            >
              <div className="relative h-36">
                <Photo src={b.img} art={b.art} className="absolute inset-0" zoom />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <p className="absolute bottom-3 left-5 font-display text-lg font-bold">{b.city}</p>
              </div>
              <div className="p-5 md:p-6">
                <p className="font-display text-3xl font-extrabold text-amber">
                  ₹<CountUp to={b.revenue} decimals={1} suffix="L" />
                </p>
                <p className="mt-1 text-sm text-cream/60">
                  <CountUp to={b.orders} /> orders
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <Spark data={b.bars} id={b.slug} />
                  <div className="relative h-14 w-14 shrink-0" title={`${b.share}% of revenue`}>
                    <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#f33716" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(b.share / 100) * 94.2} 94.2`} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">{b.share}%</span>
                  </div>
                </div>
                <p className="mt-4 flex items-center gap-1.5 truncate font-mono text-[11px] text-cream/50">
                  <QrCode size={12} className="shrink-0 text-amber" /> dishky.com/your-restaurant/{b.slug}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

import React, { useLayoutEffect, useRef } from "react";
import {
  ClipboardList, BookOpen, Package, Users, ChefHat, CalendarDays, Heart, Wallet, BarChart3, Truck,
} from "lucide-react";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import { Photo } from "../ui/kit.js";
import { images } from "../../assets/images/imageUrls.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import useMediaQuery from "../../hooks/useMediaQuery.js";

const fragmentedSystems = [
  "Orders", "Menu", "Inventory", "Staff", "Kitchen",
  "Bookings", "Guests", "Payments", "Reports", "Delivery",
];

// Fixed scatter offsets (not random) so the layout is stable across
// re-renders and identical on every load.
const systemIcons = [ClipboardList, BookOpen, Package, Users, ChefHat, CalendarDays, Heart, Wallet, BarChart3, Truck];

const scatterOffsets = [
  { x: -60, y: -30, r: -8 }, { x: 40, y: -50, r: 6 }, { x: -90, y: 20, r: 10 },
  { x: 70, y: 10, r: -5 }, { x: -30, y: 50, r: 4 }, { x: 100, y: -20, r: -10 },
  { x: -70, y: -60, r: 8 }, { x: 30, y: 60, r: -6 }, { x: -110, y: -10, r: 5 },
  { x: 60, y: 40, r: -4 },
];

export default function ProblemSection() {
  const sectionRef = useRef(null);
  const tagsRef = useRef([]);
  const dishkyRef = useRef(null);
  const subtitleRef = useRef(null);
  const reducedMotion = useReducedMotion();

  // The pinned, scrubbed sequence is a desktop experience. On touch / narrow
  // screens a 180%-viewport pin fights native momentum scrolling, and the
  // scattered start positions (+/-110px) were the cause of page-wide
  // horizontal overflow on phones. Below `lg` the section is a static,
  // fully-visible layout that reveals with a simple fade instead.
  const isDesktop = useMediaQuery("(min-width: 1024px) and (hover: hover) and (pointer: fine)");
  const animate = isDesktop && !reducedMotion;

  tagsRef.current = [];
  const addTagRef = (el) => {
    if (el) tagsRef.current.push(el);
  };

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    if (!animate) {
      // Static end-state: clear any inline transforms a previous (desktop)
      // run may have left behind, e.g. after a resize across the breakpoint.
      gsap.set(tagsRef.current, { clearProps: "all" });
      gsap.set([dishkyRef.current, subtitleRef.current], { clearProps: "all" });
      return;
    }

    const ctx = gsap.context(() => {
      tagsRef.current.forEach((tag, i) => {
        const o = scatterOffsets[i % scatterOffsets.length];
        gsap.set(tag, { x: o.x, y: o.y, rotate: o.r, opacity: 0 });
      });
      gsap.set(dishkyRef.current, { opacity: 0, scale: 0.85 });
      gsap.set(subtitleRef.current, { opacity: 0, y: 20 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=180%",
          scrub: 1,
          pin: true,
          anticipatePin: 1,
        },
      });

      // Pills fly in and stay fully bright, then light up in the brand colour
      // as DISHKY (below them) resolves the chaos.
      tl.to(tagsRef.current, { x: 0, y: 0, rotate: 0, opacity: 1, stagger: 0.05, duration: 1 });
      tl.to(
        tagsRef.current,
        {
          borderColor: "#f33716",
          backgroundColor: "rgba(243.0,55.0,22.0,0.14)",
          color: "#ffffff",
          stagger: 0.03,
          duration: 0.6,
        },
        "+=0.3"
      );
      tl.to(dishkyRef.current, { opacity: 1, scale: 1, duration: 0.6 }, "<");
      tl.to(subtitleRef.current, { opacity: 1, y: 0, duration: 0.5 }, "-=0.3");
    }, section);

    return () => ctx.revert();
  }, [animate]);

  return (
    <section
      ref={sectionRef}
      data-nav-theme="dark"
      className="relative overflow-x-clip bg-charcoal text-cream lg:min-h-screen"
      style={{ paddingBlock: "var(--section-space)" }}
    >
      <Photo art="chaos" artDark src={images.kitchenAction} className="absolute inset-0 opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-charcoal/80 via-charcoal/70 to-charcoal" />
      <div className="container-dishky relative">
        {/* Heading on the left, the fragmented-systems pills on the right.
            Stacks on phones/tablets (heading, then pills). */}
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-[var(--gap-lg)]">
          <SectionHeading
            title={"RUNNING A RESTAURANT\nSHOULD NOT MEAN\nRUNNING TEN SYSTEMS."}
            size="xl"
            dark
          />

          <div className="min-w-0">
            <ul className="flex flex-wrap gap-2.5 md:gap-3 lg:justify-end" aria-label="Systems most restaurants juggle">
              {fragmentedSystems.map((system, i) => {
                const Icon = systemIcons[i % systemIcons.length];
                return (
                <li key={system}>
                  <span
                    ref={addTagRef}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-cream/45 bg-cream/[0.07] px-4 text-sm font-semibold text-cream md:px-5 md:text-base"
                  >
                    <Icon size={16} />
                    {system}
                  </span>
                </li>
                );
              })}
            </ul>

            {/* DISHKY resolves the pills: sits right below them */}
            <div className="mt-10 border-t border-cream/10 pt-8 md:mt-12 md:pt-10 lg:text-right">
              <p ref={dishkyRef} className="font-display text-4xl font-extrabold text-amber md:text-6xl">
                DISHKY
              </p>
              <p ref={subtitleRef} className="mt-3 font-display text-lg font-bold text-cream/80 lg:ml-auto">
                Ten systems. One platform.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

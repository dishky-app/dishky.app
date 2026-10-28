import React, { useLayoutEffect, useRef } from "react";
import PageBackdrop from "../ReactBits/PageBackdrop.js";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, ArrowDown, ArrowUp, Smartphone, Monitor } from "lucide-react";
import { fadeUp, staggerChildren } from "../../animations/variants.js";
import useMouseParallax from "../../hooks/useMouseParallax.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import useMediaQuery, { QUERIES } from "../../hooks/useMediaQuery.js";
import { Marquee } from "../ui/kit.js";
import { modules } from "../../data/modules.js";

/** One of the two "panels" in the customer -> Dishky -> restaurant diagram.
    The admin card is dark and larger (about 60/40): owners are the buyers. */
function PanelCard({ icon: Icon, iconClass, top, bottom, note, parallax, dark = false, grow = "" }) {
  return (
    <div
      data-parallax={parallax}
      className={`group card-surface relative z-10 !bg-white flex w-full min-w-0 flex-col items-center gap-3 overflow-hidden !p-0 shadow-xl ${grow} ${
        dark ? "hero-admin-card" : ""
      }`}
    >
      <div className="flex flex-col items-center gap-2 px-5 py-6 sm:px-6 sm:py-8">
        <Icon className={`${iconClass} transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-6`} size={28} />
        <p className={`text-center text-xs font-semibold sm:text-sm ${dark ? "text-ink" : "text-ink/70"}`}>
          {top}
          <br />
          {bottom}
        </p>
        {note && <p className="text-center text-[11px] leading-snug text-ink/55 sm:text-xs">{note}</p>}
      </div>
    </div>
  );
}

export default function Hero() {
  const parallaxRef = useMouseParallax();
  const sectionRef = useRef(null);
  const contentRef = useRef(null);
  const orb1Ref = useRef(null);
  const orb2Ref = useRef(null);
  const mockupRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const finePointer = useMediaQuery(QUERIES.finePointer);
  const shortLandscape = useMediaQuery(QUERIES.shortLandscape);

  // Scroll-driven exit (layered parallax). It is the heaviest thing in the
  // hero, so it only runs on devices that can afford it: a real pointer, and
  // not a short landscape screen where it would fade the copy out almost
  // immediately. Phones get the static composition, which is also more legible.
  const enableExitParallax = !reducedMotion && finePointer && !shortLandscape;

  useLayoutEffect(() => {
    if (!enableExitParallax) return;
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const trigger = { trigger: section, start: "top top", end: "bottom top", scrub: true };
      gsap.to(contentRef.current, { yPercent: -18, opacity: 0.2, ease: "none", scrollTrigger: trigger });
      gsap.to(mockupRef.current, { yPercent: -30, ease: "none", scrollTrigger: { ...trigger } });
      gsap.to(orb1Ref.current, { yPercent: 40, ease: "none", scrollTrigger: { ...trigger } });
      gsap.to(orb2Ref.current, { yPercent: -25, ease: "none", scrollTrigger: { ...trigger } });
    }, section);

    return () => ctx.revert();
  }, [enableExitParallax]);

  return (
    <section
      ref={(el) => {
        sectionRef.current = el;
        parallaxRef.current = el;
      }}
      className="relative isolate flex items-center overflow-hidden bg-gradient-to-b from-cream via-cream to-beige"
      style={{
        minHeight: "100svh",
        paddingTop: "calc(var(--header-clearance) + clamp(4px, 2vh, 32px))",
        paddingBottom: "clamp(24px, 4vh, 72px)",
      }}
    >
      <PageBackdrop tone="light" />
      <div
        ref={orb1Ref}
        className="glow -top-24 right-[-20%] h-[320px] w-[320px] bg-amber/10 md:-top-40 md:right-[-10%] md:h-[500px] md:w-[500px]"
      />
      <div
        ref={orb2Ref}
        className="glow bottom-[-8%] left-[-15%] h-[260px] w-[260px] bg-cocoa/10 md:left-[-5%] md:h-[400px] md:w-[400px]"
      />

      <div className="container-dishky relative grid items-center gap-[var(--gap-xl)] lg:grid-cols-[1.1fr_0.9fr]">
        {/* Copy — always first in reading order */}
        <motion.div ref={contentRef} variants={staggerChildren(0.12)} initial="hidden" animate="visible">

          <motion.h1 variants={fadeUp} className="heading-hero text-ink" style={{ fontSize: "clamp(2rem, min(5.4vw, 9vh), 4.75rem)" }}>
            YOUR ENTIRE RESTAURANT.{" "}
            <span className="block text-amber">ONE INTELLIGENT PLATFORM.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="text-lead max-w-lg text-ink/65" style={{ marginTop: "clamp(12px, 2vh, 28px)" }}>
            From QR ordering and guest experiences to kitchen, inventory, events, staff and business management, Dishky brings your restaurant workflows together.
          </motion.p>

          <motion.div variants={fadeUp} className="cta-row" style={{ marginTop: "clamp(16px, 3vh, 40px)" }}>
            <Link to="/book-demo" className="btn-primary">
              Book a Demo <ArrowRight size={18} />
            </Link>
            <Link to="/features" className="btn-secondary">
              Explore Dishky
            </Link>
          </motion.div>
        </motion.div>

        {/* Product story: Customer -> Dishky -> Restaurant.
            Stacks vertically (with a downward flow) until there is room for
            the horizontal version, so the cards are never squeezed and can
            never force the page wider than the viewport. */}
        <motion.div
          ref={mockupRef}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          className="relative mx-auto w-full max-w-md sm:max-w-xl lg:max-w-none"
        >
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-5">
            <PanelCard
              icon={Smartphone}
              iconClass="text-amber"
              top="Customer"
              bottom="User Panel"
              parallax="14"
              grow="sm:flex-[2]"
            />

            <div
              aria-hidden="true"
              className="flex shrink-0 flex-row items-center justify-center gap-2 text-amber sm:flex-col sm:gap-1"
            >
              <ArrowDown size={20} className="sm:hidden" />
              <ArrowRight size={22} className="dk-nudge-r hidden sm:block" />
              <span className="text-[10px] font-bold tracking-widest">DISHKY</span>
              <ArrowUp size={20} className="sm:hidden" />
              <ArrowLeft size={22} className="dk-nudge-l hidden sm:block" />
            </div>

            <PanelCard
              icon={Monitor}
              iconClass="text-amberLight"
              top="Restaurant"
              bottom="Admin Panel"
              note="Orders · stock · staff · payments · branches"
              parallax="-14"
              dark
              grow="sm:flex-[3]"
            />
          </div>
        </motion.div>
      </div>

      {/* Every module, scrolling by. Hover pauses it; each chip opens its page. */}
      <div className="absolute inset-x-0 bottom-0 hidden border-t border-ink/10 bg-white/70 py-3 md:block">
        <Marquee speed={60}>
          {modules.map((m) => (
            <Link
              key={m.slug}
              to={m.path}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-ink/10 bg-white px-4 py-1.5 text-sm font-semibold text-ink/75 transition-colors hover:border-amber hover:text-amber"
            >
              <m.icon size={14} /> {m.name}
            </Link>
          ))}
        </Marquee>
      </div>
    </section>
  );
}

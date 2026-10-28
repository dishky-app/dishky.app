import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bell, Wallet, AlertTriangle, Ticket, ChefHat, Play } from "lucide-react";
import { fadeUp, staggerChildren } from "../../animations/variants.js";
import useMouseParallax from "../../hooks/useMouseParallax.js";
import { Photo, Marquee, useInterval } from "../ui/kit.js";
import { images } from "../../assets/images/imageUrls.js";
import { modules } from "../../data/modules.js";

const PINGS = [
  { icon: Bell, text: "New order #e4290c · Table 6", c: "#f33716" },
  { icon: ChefHat, text: "Ticket #e4290c ready", c: "#e4290c" },
  { icon: Wallet, text: "Table 3 paid ₹1,240", c: "#e4290c" },
  { icon: AlertTriangle, text: "Low stock: Mozzarella", c: "#f44125" },
  { icon: Ticket, text: "Chef's table: 9 seats left", c: "#f66a55" },
];

export default function Hero() {
  const parallaxRef = useMouseParallax();
  const [i, setI] = useState(0);
  useInterval(() => setI((v) => (v + 1) % PINGS.length), 2600);
  const P = PINGS[i];

  return (
    <section ref={parallaxRef} className="relative overflow-hidden bg-gradient-to-b from-cream via-cream to-beige">
      <div aria-hidden="true" className="hero-grid" />
      <div className="glow -top-24 right-[-15%] h-[420px] w-[420px] bg-amber/15" />
      <div
        className="container-dishky relative grid items-center gap-[var(--gap-xl)] lg:grid-cols-[1.05fr_0.95fr]"
        style={{ minHeight: "100svh", paddingTop: "calc(var(--header-clearance) + 16px)", paddingBottom: "clamp(32px, 6vh, 80px)" }}
      >
        <motion.div variants={staggerChildren(0.12)} initial="hidden" animate="visible">
          <motion.h1 variants={fadeUp} className="heading-hero text-ink">
            RUN YOUR <span className="br-desktop"><br /></span>RESTAURANT.{" "}
            <span className="block text-amber">NOT YOUR SOFTWARE.</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="text-lead mt-6 max-w-md text-ink/65">
            Orders, kitchen, staff, stock, events and promotion. One platform.
          </motion.p>
          <motion.div variants={fadeUp} className="cta-row mt-8">
            <Link to="/book-demo" className="btn-primary">Book a Demo <ArrowRight size={18} /></Link>
            <a href="#what" className="btn-secondary"><Play size={14} /> See it work</a>
          </motion.div>
        </motion.div>

        {/* Photo collage with live pings */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto h-[420px] w-full max-w-[520px] sm:h-[500px]"
        >
          <div data-parallax="16" className="absolute left-0 top-6 h-[62%] w-[56%] overflow-hidden rounded-3xl shadow-2xl">
            <Photo src={images.kitchenAction} className="h-full w-full" />
          </div>
          <div data-parallax="-22" className="absolute right-0 top-0 h-[48%] w-[42%] overflow-hidden rounded-3xl shadow-2xl">
            <Photo src={images.dishCurry} className="h-full w-full" />
          </div>
          <div data-parallax="24" className="absolute bottom-0 right-4 h-[50%] w-[58%] overflow-hidden rounded-3xl shadow-2xl">
            <Photo src={images.dining} className="h-full w-full" />
          </div>
          <div data-parallax="-12" className="absolute bottom-6 left-2 h-[30%] w-[34%] overflow-hidden rounded-3xl shadow-2xl">
            <Photo src={images.chefPlating} className="h-full w-full" />
          </div>
          <div className="absolute left-1/2 top-1/2 z-10 w-[min(88%,300px)] -translate-x-1/2 -translate-y-1/2">
            <AnimatePresence mode="wait">
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -24, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/95 p-3.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)] backdrop-blur"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: P.c }}>
                  <P.icon size={18} />
                </span>
                <span className="font-display text-sm font-bold text-ink">{P.text}</span>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      <div className="relative border-y border-ink/10 bg-white/60 py-4 backdrop-blur">
        <Marquee speed={55}>
          {modules.map((m) => (
            <Link key={m.slug} to={m.path} className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink/80 transition-colors hover:border-amber hover:text-amber">
              <m.icon size={15} /> {m.name}
            </Link>
          ))}
        </Marquee>
      </div>
    </section>
  );
}

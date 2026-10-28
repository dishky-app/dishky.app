import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import PromoFeed from "../components/Promotions/PromoFeed.js";
import SectionHeading from "../components/SectionHeading/SectionHeading.js";
import { promoOfferings, promoSteps, promoFormats } from "../components/Promotions/promotionsData.js";
import { fadeUp, staggerChildren } from "../animations/variants.js";
import { viewportOnce } from "../animations/transitions.js";

export default function Promotions() {
  return (
    <div className="bg-cream">
      {/* ---- Hero --------------------------------------------------------- */}
      <section style={{ paddingTop: "calc(var(--header-clearance) + clamp(24px, 6vw, 64px))", paddingBottom: "var(--section-space)" }}>
        <div className="container-dishky grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-[var(--gap-lg)]">
          <motion.div variants={staggerChildren(0.1)} initial="hidden" animate="visible" className="min-w-0">
            <motion.p variants={fadeUp} className="eyebrow mb-5">Promotions &amp; Collaborations</motion.p>
            <motion.h1 variants={fadeUp} className="heading-xl text-ink">
              SOFTWARE THAT RUNS YOUR RESTAURANT. A STAGE THAT FILLS IT.
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lead mt-5 max-w-xl text-ink/60 md:mt-6">
              Besides the platform, Dishky promotes the restaurants it works with and collaborates with them on
              Dishky&rsquo;s own social media platform, so more people discover you, and can order from you straight away.
            </motion.p>
            <motion.div variants={fadeUp} className="cta-row mt-8 md:mt-10">
              <Link to="/book-demo" className="btn-primary group">
                Get your restaurant featured
                <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link to="/contact" className="btn-secondary">Talk to us</Link>
              <Link to="/events" className="btn-secondary">Event collaborations</Link>
            </motion.div>
          </motion.div>
          <div className="min-w-0">
            <PromoFeed />
            <p className="mt-2 text-center text-[11px] text-ink/40">Illustrative posts.</p>
          </div>
        </div>
      </section>

      {/* ---- What we do --------------------------------------------------- */}
      <section className="bg-charcoal text-cream" data-nav-theme="dark" style={{ paddingBlock: "var(--section-space)" }}>
        <div className="container-dishky">
          <SectionHeading eyebrow="What Dishky does" title={"PROMOTION,\nDONE WITH YOU."} dark />
          <motion.ul
            variants={staggerChildren(0.08)}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="mt-10 grid gap-4 sm:grid-cols-2 md:mt-14 lg:grid-cols-4"
          >
            {promoOfferings.map(({ icon: Icon, title, text }) => (
              <motion.li key={title} variants={fadeUp} className="rounded-3xl border border-cream/12 bg-cream/[0.04] p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber text-ink">
                  <Icon size={20} />
                </span>
                <p className="mt-5 font-display text-base font-bold leading-snug">{title}</p>
                <p className="mt-2.5 text-sm leading-relaxed text-cream/60">{text}</p>
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </section>

      {/* ---- How it works ------------------------------------------------- */}
      <section style={{ paddingBlock: "var(--section-space)" }}>
        <div className="container-dishky">
          <SectionHeading eyebrow="How it works" title={"FROM HELLO\nTO FEATURED."} />
          <motion.ol
            variants={staggerChildren(0.1)}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="mt-10 grid gap-4 md:mt-14 md:grid-cols-2 lg:grid-cols-4"
          >
            {promoSteps.map((s) => (
              <motion.li key={s.n} variants={fadeUp} className="rounded-3xl border border-ink/10 bg-white p-6">
                <span className="font-display text-sm font-extrabold text-amber">{s.n}</span>
                <p className="mt-3 font-display text-base font-bold leading-snug text-ink">{s.title}</p>
                <p className="mt-2.5 text-sm leading-relaxed text-ink/60">{s.text}</p>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </section>

      {/* ---- Formats + CTA ------------------------------------------------ */}
      <section className="bg-beige" style={{ paddingBlock: "var(--section-space)" }}>
        <div className="container-dishky grid items-start gap-10 lg:grid-cols-2 lg:gap-[var(--gap-lg)]">
          <SectionHeading eyebrow="Ways to be featured" title={"MANY WAYS\nTO BE SEEN."} subtitle="We shape the promotion around what your restaurant wants to be known for." />
          <motion.ul variants={staggerChildren(0.06)} initial="hidden" whileInView="visible" viewport={viewportOnce} className="grid gap-3 sm:grid-cols-2">
            {promoFormats.map((f) => (
              <motion.li key={f} variants={fadeUp} className="flex items-center gap-3 rounded-2xl bg-white p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber text-white">
                  <Check size={15} strokeWidth={3} />
                </span>
                <span className="text-sm font-semibold text-ink">{f}</span>
              </motion.li>
            ))}
          </motion.ul>
        </div>
        <div className="container-dishky mt-12 md:mt-16">
          <div className="rounded-[2rem] bg-ink p-8 text-cream md:p-12">
            <h2 className="heading-lg max-w-xl">Want Dishky to promote your restaurant?</h2>
            <p className="text-lead mt-4 max-w-xl text-cream/60">Tell us about your restaurant and what you would like to promote. We will take it from there.</p>
            <div className="cta-row mt-7">
              <Link to="/book-demo" className="btn-primary group">
                Book a Demo
                <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link to="/contact" className="btn-secondary !border-cream/25 !text-cream">Contact us</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

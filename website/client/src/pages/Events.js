import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Plus, Minus } from "lucide-react";
import EventTimeline from "../components/Events/EventTimeline.js";
import SectionHeading from "../components/SectionHeading/SectionHeading.js";
import {
  eventTypes, eventSteps, dishkyHandles, youHandle, eventPowers, eventFaqs,
} from "../components/Events/eventsData.js";
import { fadeUp, staggerChildren } from "../animations/variants.js";
import { viewportOnce } from "../animations/transitions.js";

function FaqItem({ item, id, isOpen, onClick }) {
  const panelId = `events-faq-panel-${id}`;
  const buttonId = `events-faq-button-${id}`;
  return (
    <div className="border-b border-ink/10">
      <h3>
        <button
          id={buttonId}
          type="button"
          onClick={onClick}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex min-h-[64px] w-full items-center justify-between gap-4 py-4 text-left"
        >
          <span className="min-w-0 font-display text-base font-semibold text-ink md:text-lg">{item.q}</span>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            {isOpen ? <Minus size={18} className="text-amber" aria-hidden="true" /> : <Plus size={18} className="text-ink/40" aria-hidden="true" />}
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <p className="pb-5 pr-12 text-sm leading-relaxed text-ink/60 md:text-base">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Events() {
  const [open, setOpen] = useState(0);

  return (
    <div className="bg-cream">
      {/* ---- Hero --------------------------------------------------------- */}
      <section style={{ paddingTop: "calc(var(--header-clearance) + clamp(24px, 6vw, 64px))", paddingBottom: "var(--section-space)" }}>
        <div className="container-dishky grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-[var(--gap-lg)]">
          <motion.div variants={staggerChildren(0.1)} initial="hidden" animate="visible" className="min-w-0">
            <motion.p variants={fadeUp} className="eyebrow mb-5">Event Collaboration</motion.p>
            <motion.h1 variants={fadeUp} className="heading-xl text-ink">
              YOUR EVENT. PLANNED WITH US. FILLED BY DISHKY.
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lead mt-5 max-w-xl text-ink/60 md:mt-6">
              Dishky collaborates with restaurants on events, from tasting nights and festive menus to pop-ups and launches.
              We plan them with you, promote them on Dishky&rsquo;s own social media, and your guests order through Dishky on the night.
            </motion.p>
            <motion.div variants={fadeUp} className="cta-row mt-8 md:mt-10">
              <Link to="/book-demo" className="btn-primary group">
                Plan an event with Dishky
                <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link to="/contact" className="btn-secondary">Talk to us</Link>
            </motion.div>
          </motion.div>
          <div className="min-w-0">
            <EventTimeline />
            <p className="mt-3 text-center text-[11px] text-ink/40">Illustrative event.</p>
          </div>
        </div>
      </section>

      {/* ---- Event types -------------------------------------------------- */}
      <section className="bg-charcoal text-cream" data-nav-theme="dark" style={{ paddingBlock: "var(--section-space)" }}>
        <div className="container-dishky">
          <SectionHeading eyebrow="Event types" title={"EVENTS WE\nCOLLABORATE ON."} subtitle="Bring your own idea, or let us suggest one that fits your restaurant and the season." dark />
          <motion.ul variants={staggerChildren(0.08)} initial="hidden" whileInView="visible" viewport={viewportOnce} className="mt-10 grid gap-4 sm:grid-cols-2 md:mt-14 lg:grid-cols-3">
            {eventTypes.map(({ icon: Icon, title, text }) => (
              <motion.li key={title} variants={fadeUp} className="rounded-3xl border border-cream/12 bg-cream/[0.04] p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber text-ink"><Icon size={20} /></span>
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
          <SectionHeading eyebrow="How it works" title={"FROM IDEA\nTO EVENT NIGHT."} />
          <motion.ol variants={staggerChildren(0.1)} initial="hidden" whileInView="visible" viewport={viewportOnce} className="mt-10 grid gap-4 md:mt-14 md:grid-cols-2 lg:grid-cols-5">
            {eventSteps.map((s) => (
              <motion.li key={s.n} variants={fadeUp} className="rounded-3xl border border-ink/10 bg-white p-6">
                <span className="font-display text-sm font-extrabold text-amber">{s.n}</span>
                <p className="mt-3 font-display text-base font-bold leading-snug text-ink">{s.title}</p>
                <p className="mt-2.5 text-sm leading-relaxed text-ink/60">{s.text}</p>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </section>

      {/* ---- Who handles what -------------------------------------------- */}
      <section className="bg-beige" style={{ paddingBlock: "var(--section-space)" }}>
        <div className="container-dishky">
          <SectionHeading eyebrow="Shared effort" title={"WHO HANDLES\nWHAT."} subtitle="A real collaboration: Dishky brings creative and promotion, you bring the room and the food." />
          <div className="mt-10 grid gap-4 md:mt-14 md:grid-cols-2">
            {[{ heading: "Dishky handles", items: dishkyHandles, dark: true }, { heading: "You handle", items: youHandle, dark: false }].map(({ heading, items, dark }) => (
              <motion.div key={heading} variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewportOnce}
                className={`rounded-3xl p-7 md:p-9 ${dark ? "bg-ink text-cream" : "border border-ink/10 bg-white text-ink"}`}>
                <h3 className="font-display text-lg font-bold">{heading}</h3>
                <ul className="mt-5 space-y-3">
                  {items.map((it) => (
                    <li key={it} className="flex items-center gap-3 text-sm font-semibold">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber text-white"><Check size={15} strokeWidth={3} /></span>
                      {it}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Powered by Dishky ------------------------------------------- */}
      <section style={{ paddingBlock: "var(--section-space)" }}>
        <div className="container-dishky">
          <SectionHeading eyebrow="Powered by Dishky" title={"THE EVENT NIGHT,\nRUNNING SMOOTHLY."} subtitle="The same platform that runs your restaurant every day runs your event." />
          <motion.ul variants={staggerChildren(0.08)} initial="hidden" whileInView="visible" viewport={viewportOnce} className="mt-10 grid gap-4 md:mt-14 md:grid-cols-3">
            {eventPowers.map(({ icon: Icon, title, text }) => (
              <motion.li key={title} variants={fadeUp} className="rounded-3xl border border-ink/10 bg-white p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber text-white"><Icon size={20} /></span>
                <p className="mt-5 font-display text-base font-bold leading-snug text-ink">{title}</p>
                <p className="mt-2.5 text-sm leading-relaxed text-ink/60">{text}</p>
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </section>

      {/* ---- FAQ ---------------------------------------------------------- */}
      <section className="bg-beige" style={{ paddingBlock: "var(--section-space)" }}>
        <div className="container-dishky grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-[var(--gap-lg)]">
          <SectionHeading eyebrow="Questions" title={"EVENT\nQUESTIONS."} />
          <div>
            {eventFaqs.map((item, i) => (
              <FaqItem key={item.q} id={i} item={item} isOpen={open === i} onClick={() => setOpen(open === i ? -1 : i)} />
            ))}
          </div>
        </div>
      </section>

      {/* ---- Final CTA ---------------------------------------------------- */}
      <section style={{ paddingBlock: "var(--section-space)" }}>
        <div className="container-dishky">
          <div className="rounded-[2rem] bg-ink p-8 text-cream md:p-12">
            <h2 className="heading-lg max-w-xl">Plan an event with Dishky.</h2>
            <p className="text-lead mt-4 max-w-xl text-cream/60">Tell us your idea, or ask for ours. We will plan it together and fill the room.</p>
            <div className="cta-row mt-7">
              <Link to="/book-demo" className="btn-primary group">
                Book a Demo
                <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link to="/contact" className="btn-secondary !border-cream/25 !text-cream">Contact us</Link>
              <Link to="/promotions" className="btn-secondary !border-cream/25 !text-cream">See Promotions</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

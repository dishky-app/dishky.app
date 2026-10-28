import React, { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import EventTimeline from "../Events/EventTimeline.js";
import { eventTypes } from "../Events/eventsData.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";

/**
 * Homepage section: co-created events. Light band that follows the dark
 * Promotions band, so the page keeps alternating. Cards and the event card
 * scrub in with scroll.
 */
export default function EventCollabSection() {
  const sectionRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || reducedMotion) return undefined;
    const ctx = gsap.context(() => {
      gsap.utils.toArray("[data-event-chip]").forEach((chip, i) => {
        gsap.fromTo(
          chip,
          { opacity: 0, y: 40, x: i % 2 ? 24 : -24 },
          { opacity: 1, y: 0, x: 0, ease: "none", scrollTrigger: { trigger: chip, start: "top 96%", end: "top 70%", scrub: 0.8 } }
        );
      });
      gsap.fromTo(
        "[data-event-visual]",
        { opacity: 0, y: 60, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, ease: "none", scrollTrigger: { trigger: "[data-event-visual]", start: "top 98%", end: "top 55%", scrub: 1 } }
      );
    }, section);
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section data-feature-rail="Event Collaboration"
      ref={sectionRef}
      id="events"
      className="relative overflow-hidden bg-beige"
      style={{ paddingBlock: "var(--section-space)" }}
    >
      <div className="container-dishky relative">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-[var(--gap-lg)]">
          <div className="min-w-0">
            <SectionHeading
              title={"YOUR EVENT.\nPLANNED WITH US.\nFILLED BY DISHKY."}
            />

            <ul className="mt-9 grid gap-3 sm:grid-cols-2 md:mt-11">
              {eventTypes.slice(0, 4).map(({ icon: Icon, title, text }) => (
                <li key={title} data-event-chip className="group rounded-2xl border border-ink/10 bg-white p-5 transition-all duration-500 hover:-translate-y-1 hover:border-amber/50 hover:shadow-xl">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber text-white transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
                    <Icon size={18} />
                  </span>
                  <p className="mt-4 font-display text-[15px] font-bold leading-snug text-ink">{title}</p>
                  <p className="mt-1 text-sm text-ink/55">{text}</p>
                </li>
              ))}
            </ul>

            <div className="cta-row mt-9 md:mt-11">
              <Link to="/features/event-collaboration" className="btn-primary group">
                Explore event collaborations
                <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link to="/book-demo" className="btn-secondary">Plan an event with us</Link>
            </div>
          </div>

          <div data-event-visual className="min-w-0">
            <EventTimeline />
            <p className="mt-3 text-center text-[11px] text-ink/40">Tap a stage.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

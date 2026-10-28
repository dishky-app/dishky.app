import React, { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import PromoFeed from "../Promotions/PromoFeed.js";
import { promoOfferings } from "../Promotions/promotionsData.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";

/**
 * Homepage section: Dishky doesn't only run the restaurant, it helps fill it.
 * Dark band between the admin story and the guest story. Cards and the post
 * stack scrub in with scroll.
 */
export default function PromotionsSection() {
  const sectionRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || reducedMotion) return undefined;
    const ctx = gsap.context(() => {
      gsap.utils.toArray("[data-promo-card]").forEach((card, i) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 50, x: i % 2 ? 30 : -30 },
          { opacity: 1, y: 0, x: 0, ease: "none", scrollTrigger: { trigger: card, start: "top 96%", end: "top 66%", scrub: 0.8 } }
        );
      });
      gsap.fromTo(
        "[data-promo-feed]",
        { opacity: 0, y: 70, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, ease: "none", scrollTrigger: { trigger: "[data-promo-feed]", start: "top 98%", end: "top 55%", scrub: 1 } }
      );
    }, section);
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section data-feature-rail="Promotions & Collaborations"
      ref={sectionRef}
      id="promotions"
      data-nav-theme="dark"
      className="relative overflow-hidden bg-charcoal text-cream"
      style={{ paddingBlock: "var(--section-space)" }}
    >
      <div className="pointer-events-none absolute -left-40 bottom-0 h-[480px] w-[480px] rounded-full bg-neutral-500/10 blur-[110px]" aria-hidden="true" />
      <div className="container-dishky relative">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-[var(--gap-lg)]">
          <div className="min-w-0">
            <SectionHeading
              title={"WE DON'T JUST RUN\nYOUR RESTAURANT.\nWE HELP FILL IT."}
              dark
            />

            <ul className="mt-9 grid gap-3.5 sm:grid-cols-2 md:mt-11">
              {promoOfferings.map(({ icon: Icon, title, text }) => (
                <li key={title} data-promo-card className="group rounded-2xl border border-cream/12 bg-cream/[0.04] p-5 transition-colors duration-500 hover:border-amber/60 hover:bg-amber/10">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber text-ink transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110">
                    <Icon size={18} />
                  </span>
                  <p className="mt-4 font-display text-[15px] font-bold leading-snug text-cream">{title}</p>
                  <p className="mt-1 text-sm text-cream/55">{text}</p>
                </li>
              ))}
            </ul>

            <div className="cta-row mt-9 md:mt-11">
              <Link to="/features/promotions" className="btn-primary group">
                See how promotion works
                <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link to="/book-demo" className="btn-secondary !border-cream/25 !text-cream">
                Get your restaurant featured
              </Link>
              <Link to="/features/event-collaboration" className="btn-secondary !border-cream/25 !text-cream">
                Event collaborations
              </Link>
            </div>
          </div>

          <div data-promo-feed className="min-w-0">
            <PromoFeed />
            <p className="mt-2 text-center text-[11px] text-cream/40">Tap a heart. Hover a post.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

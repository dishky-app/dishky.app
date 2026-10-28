import React, { useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, ChevronDown, ChevronUp } from "lucide-react";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import { gsap, ScrollTrigger } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import { getLenis } from "../../hooks/useScrollAnimation.js";
import { EASE } from "../../animations/variants.js";

// How many questions show at first, and how many each "Show more" adds.
const PAGE_SIZE = 8;

const faqs = [
  { q: "What is Dishky?", a: "Dishky is a complete restaurant SaaS platform that connects customer QR ordering with the tools your restaurant team uses to run daily operations." },
  { q: "Is Dishky a restaurant ordering system?", a: "Ordering is one part of Dishky. It also covers kitchen management, service, guests, inventory, bookings, staff roles, branches, and payments." },
  { q: "How does QR ordering work?", a: "Guests scan a QR code at their table, which opens your restaurant's Dishky User Panel in their browser — no app download required." },
  { q: "Does the customer need to install an app?", a: "No. The User Panel opens directly in the browser after scanning the QR code." },
  { q: "What is the Dishky Admin Panel?", a: "It's the control center your restaurant team uses to manage menu, orders, inventory, staff, branches, bookings and more." },
  { q: "Can I manage multiple restaurant branches?", a: "Yes. Dishky supports centralized management across multiple branches from one account." },
  { q: "Can I create different roles for employees?", a: "Yes. Roles and permissions let you control exactly which modules each team member can access." },
  { q: "What is KMS?", a: "KMS is Dishky's Kitchen Management System — it organizes the kitchen order queue, preparation status and priority." },
  { q: "What is SMS?", a: "SMS is Dishky's Service Management System — it helps coordinate tables, staff assignment and service tasks." },
  { q: "What is GMS?", a: "GMS is Dishky's Guest Management System — guest profiles, visit history, preferences and spend." },
  { q: "Can Dishky manage reservations and events?", a: "Yes — reservations, events, catering, celebrations and pre-bookings are all supported." },
  { q: "Does Dishky manage inventory?", a: "Yes. You can track ingredients, stock levels and low-stock alerts." },
  { q: "Does Dishky promote restaurants?", a: "Yes. Besides the software, Dishky promotes the restaurants on its platform and collaborates with them on Dishky\u2019s own social media platform: spotlights, dish and menu features, offers, launches and events." },
  { q: "How do I get my restaurant featured?", a: "Book a demo or contact us and tell us about your restaurant and what you would like to promote. We plan the promotion together with you." },
  { q: "How does the subscription work?", a: "You choose a plan (Essential, Professional, Premium or Custom), billed monthly or yearly, and can upgrade as your restaurant grows." },
  { q: "Can I upgrade my plan?", a: "Yes, you can move between plans as your needs change." },
  { q: "Can I cancel my subscription?", a: "Yes, subscriptions can be cancelled; details are covered in your billing settings." },
  { q: "How do I get started?", a: "Book a demo or choose a plan directly from the pricing page to begin onboarding your restaurant." },
];

function FaqItem({ item, id, isOpen, onClick, itemRef }) {
  const panelId = `faq-panel-${id}`;
  const buttonId = `faq-button-${id}`;
  return (
    <div ref={itemRef} className="border-b border-ink/10">
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
            {isOpen ? (
              <Minus size={18} className="text-amber" aria-hidden="true" />
            ) : (
              <Plus size={18} className="text-ink/40" aria-hidden="true" />
            )}
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
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="text-body pb-5 pr-12 text-ink/60">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sectionRef = useRef(null);
  const listRef = useRef(null);
  const itemRefs = useRef([]);
  const reducedMotion = useReducedMotion();
  itemRefs.current = [];

  const addItemRef = (el) => {
    if (el) itemRefs.current.push(el);
  };

  // Each FAQ row slides in from the left as it approaches the viewport —
  // scroll-scrubbed per-row rather than a single container fade, so a
  // long list of 16 questions still feels alive as you scroll through it.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || reducedMotion) return;

    const ctx = gsap.context(() => {
      itemRefs.current.forEach((item) => {
        gsap.fromTo(
          item,
          { opacity: 0, y: 16 },
          {
            opacity: 1,
            y: 0,
            ease: "none",
            scrollTrigger: {
              trigger: item,
              start: "top 96%",
              end: "top 78%",
              scrub: true,
            },
          }
        );
      });
    }, section);

    return () => ctx.revert();
  }, [reducedMotion, visibleCount]);

  // The page got taller or shorter: re-measure the scroll triggers below.
  useLayoutEffect(() => {
    ScrollTrigger.refresh();
  }, [visibleCount]);

  const allShown = visibleCount >= faqs.length;
  const showMore = () => setVisibleCount((n) => Math.min(n + PAGE_SIZE, faqs.length));
  // "Show less": first glide up to the last question that stays (the 8th), then
  // fold away the rest. The questions being removed sit below that point, so
  // nothing jumps. Collapsing straight away would shrink the page under the
  // reader and drop them into the next section.
  const collapsing = useRef(false);
  const showLess = () => {
    if (collapsing.current) return;
    collapsing.current = true;

    const collapse = () => {
      setVisibleCount(PAGE_SIZE);
      if (openIndex >= PAGE_SIZE) setOpenIndex(-1); // its question is being removed
      collapsing.current = false;
    };

    const row = listRef.current?.children[PAGE_SIZE - 1];
    if (!row) return collapse();

    // Park the last staying question in the upper part of the screen, so the
    // "Show more" button that follows it is in view too.
    const target = Math.max(0, row.getBoundingClientRect().bottom + window.scrollY - window.innerHeight * 0.55);
    if (reducedMotion || Math.abs(target - window.scrollY) < 8) {
      window.scrollTo({ top: target });
      return collapse();
    }

    const lenis = getLenis();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      collapse();
    };
    if (lenis) {
      lenis.scrollTo(target, { duration: 1, force: true, onComplete: finish });
      setTimeout(finish, 1500); // safety net if the scroller never reports completion
    } else {
      window.scrollTo({ top: target, behavior: "smooth" });
      setTimeout(finish, 700);
    }
  };

  return (
    <section ref={sectionRef} className="bg-cream" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="container-dishky max-w-3xl">
        <SectionHeading eyebrow="FAQ" title="QUESTIONS RESTAURANT OWNERS ASK." align="left" />

        <div ref={listRef} className="mt-8 md:mt-10">
          <AnimatePresence initial={false}>
          {faqs.map((item, i) => {
            const row = (
              <FaqItem
                key={item.q}
                id={i}
                item={item}
                itemRef={addItemRef}
                isOpen={openIndex === i}
                onClick={() => setOpenIndex(openIndex === i ? -1 : i)}
              />
            );
            // The first page is always there.
            if (i < PAGE_SIZE) return row;
            // Every later question folds open / shut like an accordion panel:
            // height and opacity animate, with a small cascade so a batch
            // unrolls top-down on "Show more" and rolls up bottom-up on "Show less".
            if (i >= visibleCount) return null;
            const batchPos = (i - PAGE_SIZE) % PAGE_SIZE;
            return (
              <motion.div
                key={item.q}
                initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1, transition: { duration: reducedMotion ? 0 : 0.55, ease: EASE, delay: reducedMotion ? 0 : batchPos * 0.045 } }}
                exit={{ height: 0, opacity: 0, transition: { duration: reducedMotion ? 0 : 0.4, ease: EASE, delay: reducedMotion ? 0 : (visibleCount - 1 - i) * 0.03 } }}
                style={{ overflow: "hidden" }}
              >
                {row}
              </motion.div>
            );
          })}
          </AnimatePresence>
        </div>

        {faqs.length > PAGE_SIZE && (
          <div className="mt-8 flex justify-center">
            <button type="button" onClick={allShown ? showLess : showMore} className="btn-secondary">
              {allShown ? "Show less" : "Show more"}
              {allShown ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

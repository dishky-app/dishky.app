import React, { lazy, useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  BellRing, Boxes, ShieldCheck, Wallet, CalendarDays, GitBranch,
  ScanLine, ScrollText, Salad, Smartphone, ArrowRight, ArrowDown,
} from "lucide-react";
import { adminProblems, guestProblems } from "../../data/problems.js";
import Enhanced from "../ReactBits/Enhanced.js";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import { Photo } from "../ui/kit.js";
import { images } from "../../assets/images/imageUrls.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";

// The <li> carries the scroll animation; the inner div carries the hover
// effect, so the two transforms never fight each other. Hover (or tap) flips
// the pain to the fix: the photo brightens and the arrow drops.
function ProblemCard({ icon: Icon, pain, fix, img, art, dir = "up" }) {
  return (
    <li data-pcard data-dir={dir} className="will-change-transform">
      <div className="group relative h-64 overflow-hidden rounded-3xl bg-ink text-cream transition-transform duration-500 hover:-translate-y-1 md:h-72">
        <Photo src={img} art={art} className="absolute inset-0 opacity-75 transition-all duration-700 group-hover:opacity-100 group-hover:grayscale-0" zoom />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
        <span className="absolute left-5 top-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber text-ink transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
          <Icon size={20} />
        </span>
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
          <p className="font-display text-lg font-bold leading-snug text-cream/55 line-through decoration-amber decoration-2 transition-all duration-500 group-hover:text-cream/35">{pain}</p>
          <span data-line className="my-3 flex origin-left items-center gap-2 text-amber">
            <span className="block h-px w-10 bg-amber" aria-hidden="true" />
            <ArrowDown size={14} className="transition-transform duration-500 group-hover:translate-y-1" />
          </span>
          <p className="font-display text-xl font-extrabold text-cream">{fix}</p>
        </div>
      </div>
    </li>
  );
}

const AdminCylinder = lazy(() => import("./AdminCylinder.js"));
const GuestGallery = lazy(() => import("./GuestGallery.js"));

function BlockLabel({ children, note, dark = false }) {
  return (
    <div data-badge-row className="mb-5 flex items-center gap-3">
      <span
        className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] ${
          dark ? "bg-ink text-cream" : "border border-ink/20 text-ink"
        }`}
      >
        {children}
      </span>
      <span className="text-sm font-semibold text-ink/55">{note}</span>
    </div>
  );
}

/**
 * Scroll-scrubbed: every card rises, straightens and scales up as it enters
 * (the admin cards also slide in from alternating sides on wide screens), the
 * accent rule under each pain draws itself, the admin block drifts at a
 * slightly different speed to the rest of the page, and the labels slide in.
 * Everything is tied to scroll position, not to a one-off timer.
 */
export default function DailyProblemsSection() {
  const sectionRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || reducedMotion) return;
    const wide = window.innerWidth >= 1024;

    const ctx = gsap.context(() => {
      gsap.utils.toArray("[data-badge-row]").forEach((row) => {
        gsap.fromTo(
          row,
          { opacity: 0, x: -50 },
          { opacity: 1, x: 0, ease: "none", scrollTrigger: { trigger: row, start: "top 94%", end: "top 72%", scrub: true } }
        );
      });

      gsap.utils.toArray("[data-pcard]").forEach((card, i) => {
        const dir = card.dataset.dir;
        const x = wide ? (dir === "l" ? -70 : dir === "r" ? 70 : 0) : 0;
        gsap.fromTo(
          card,
          { opacity: 0, y: 100, x, scale: 0.9, rotate: i % 2 ? 3 : -3 },
          {
            opacity: 1, y: 0, x: 0, scale: 1, rotate: 0, ease: "none",
            scrollTrigger: { trigger: card, start: "top 100%", end: "top 62%", scrub: 0.8 },
          }
        );
        const line = card.querySelector("[data-line]");
        if (line) {
          gsap.fromTo(
            line,
            { scaleX: 0 },
            { scaleX: 1, ease: "none", scrollTrigger: { trigger: card, start: "top 78%", end: "top 52%", scrub: true } }
          );
        }
      });

      // Depth: the middle column of the admin grid drifts a little slower.
      if (wide) {
        gsap.utils.toArray("[data-admin-grid] > [data-pcard]").forEach((card, i) => {
          if (i % 3 !== 1) return;
          gsap.to(card, {
            yPercent: -7, ease: "none",
            scrollTrigger: { trigger: card, start: "top bottom", end: "bottom top", scrub: true },
          });
        });
      }
    }, section);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} className="overflow-x-clip bg-cream" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="container-dishky">
        <SectionHeading title={"EVERY DAY HAS ITS PROBLEMS.\nDISHKY FIXES THEM."} />

        <div className="mt-12 md:mt-16">
          <BlockLabel dark note="For you and your team">Admin Panel</BlockLabel>
          <Enhanced
            fallback={
              <ul data-admin-grid className="grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
                {adminProblems.map((p, i) => (
                  <ProblemCard key={p.pain} {...p} dir={i % 3 === 0 ? "l" : i % 3 === 2 ? "r" : "up"} />
                ))}
              </ul>
            }
          >
            <AdminCylinder />
          </Enhanced>
        </div>

        <div className="mt-12 md:mt-16">
          <BlockLabel note="For your guests">User Panel</BlockLabel>
          <Enhanced
            webgl
            fallback={
              <ul className="grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-4">
                {guestProblems.map((p) => (
                  <ProblemCard key={p.pain} {...p} />
                ))}
              </ul>
            }
          >
            <GuestGallery />
          </Enhanced>
        </div>

        <div className="mt-10 md:mt-14">
          <Link to="/admin-panel" className="btn-dark group">
            See the Admin Panel in action
            <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}

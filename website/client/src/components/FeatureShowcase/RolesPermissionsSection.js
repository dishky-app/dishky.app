import React, { useLayoutEffect, useRef, useState } from "react";
import { Lock, Check } from "lucide-react";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";

const roleChain = ["Super Admin", "Admin", "Manager", "Chef", "Service Manager", "Staff"];
const cols = ["Admin", "Chef", "Service"];
const modules = ["Orders", "Kitchen", "Staff", "Payments", "Guests"];
const initial = {
  Orders: [1, 1, 1],
  Kitchen: [1, 1, 0],
  Staff: [1, 0, 1],
  Payments: [1, 0, 0],
  Guests: [1, 0, 1],
};

/** The matrix is interactive: tap any cell to grant or revoke access. */
function Cell({ on, onToggle, label }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={!!on}
      aria-label={label}
      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 active:scale-90 ${
        on ? "bg-amber text-white shadow-[0_8px_20px_-8px_rgba(243,55,22,0.8)]" : "bg-ink/[0.05] text-ink/30 hover:bg-ink/10"
      }`}
      style={{ minHeight: 0 }}
    >
      {on ? <Check size={16} /> : <Lock size={14} />}
    </button>
  );
}

export default function RolesPermissionsSection() {
  const sectionRef = useRef(null);
  const chainRefs = useRef([]);
  const rowRefs = useRef([]);
  const reducedMotion = useReducedMotion();
  const [perm, setPerm] = useState(initial);
  chainRefs.current = [];
  rowRefs.current = [];

  const addChainRef = (el) => {
    if (el) chainRefs.current.push(el);
  };
  const addRowRef = (el) => {
    if (el) rowRefs.current.push(el);
  };
  const toggle = (m, i) =>
    setPerm((p) => ({ ...p, [m]: p[m].map((v, k) => (k === i ? 1 - v : v)) }));

  // Role chain links itself scrub-in one by one, then the permission
  // matrix rows sweep in below.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || reducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.set(chainRefs.current, { opacity: 0, scale: 0.7 });
      gsap.set(rowRefs.current, { opacity: 0, x: -30 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top 75%",
          end: "bottom 40%",
          scrub: 1,
        },
      });

      tl.to(chainRefs.current, { opacity: 1, scale: 1, stagger: 0.15, duration: 1 });
      tl.to(rowRefs.current, { opacity: 1, x: 0, stagger: 0.15, duration: 1 }, "-=0.3");
    }, section);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section data-feature-rail="Roles & Permissions" ref={sectionRef} className="bg-cream" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="container-dishky">
        <SectionHeading title={"EVERYONE HAS\nTHE RIGHT ACCESS."} align="center" />

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 md:mt-12 md:gap-3">
          {roleChain.map((role, i) => (
            <React.Fragment key={role}>
              <span ref={addChainRef} className="inline-flex min-h-[36px] items-center rounded-full bg-ink px-4 text-xs font-semibold text-cream transition-colors duration-300 hover:bg-amber md:px-5">
                {role}
              </span>
              {i < roleChain.length - 1 && <span aria-hidden="true" className="text-ink/30">→</span>}
            </React.Fragment>
          ))}
        </div>

        <div className="card-surface mx-auto mt-10 max-w-2xl overflow-x-auto md:mt-14" tabIndex={0} role="region" aria-label="Permissions by role">
          <table className="w-full min-w-[20rem] text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-xs font-semibold uppercase tracking-wide text-ink/40">
                <th scope="col" className="px-4 py-4 sm:px-5">Tap to change</th>
                {cols.map((c) => (
                  <th key={c} scope="col" className="px-3 py-4 text-center sm:px-5">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((m) => (
                <tr key={m} ref={addRowRef} className="border-b border-ink/5 last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium sm:px-5">{m}</th>
                  {cols.map((c, i) => (
                    <td key={c} className="px-3 py-3 text-center sm:px-5">
                      <Cell on={perm[m][i]} onToggle={() => toggle(m, i)} label={`${c} access to ${m}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

import React from "react";
import { modules } from "../../data/modules.js";

// Quick facts used to fill the lower part of a full-height hero. Every line restates something the site already says
// (27 modules, QR ordering, live kitchen, multi-branch, one subscription), so nothing new is claimed.
const facts = () => [
  { value: String(modules.length), label: "Modules in one platform" },
  { value: "QR", label: "Ordering for every table" },
  { value: "Live", label: "Kitchen board and order tracking" },
  { value: "1", label: "Subscription for everything" },
];

/** A row of facts for the bottom of a hero. `dark` = for dark backgrounds. */
export default function HeroFacts({ dark = false, className = "" }) {
  return (
    <dl className={`grid grid-cols-2 gap-x-6 gap-y-6 border-t pt-6 md:grid-cols-4 ${dark ? "border-white/15" : "border-ink/10"} ${className}`}>
      {facts().map((f) => (
        <div key={f.label}>
          <dt className={`text-[0.7rem] font-bold uppercase tracking-[0.18em] ${dark ? "text-cream/50" : "text-ink/50"}`}>{f.label}</dt>
          <dd className={`mt-1.5 font-display text-2xl font-extrabold tracking-tight md:text-3xl ${dark ? "text-white" : "text-ink"}`}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Side panel for the sign-in style pages: why Dishky, in the site's own words. Desktop only. */
export function AuthAside({ dark = false }) {
  const items = ["QR ordering for every table", "A live kitchen board and order tracking", "Menu, inventory and staff in one place", "Multi-branch ready from day one"];
  return (
    <aside aria-label="About Dishky" className={`hidden lg:block ${dark ? "text-cream" : "text-ink"}`}>
      <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-amber">The Dishky platform</p>
      <p className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight xl:text-4xl">Connected operations, from the first scan to the final bill.</p>
      <ul className={`mt-8 space-y-4 text-base ${dark ? "text-cream/75" : "text-ink/70"}`}>
        {items.map((t) => (
          <li key={t} className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber" />
            {t}
          </li>
        ))}
      </ul>
      <HeroFacts dark={dark} className="mt-10 !grid-cols-2" />
    </aside>
  );
}

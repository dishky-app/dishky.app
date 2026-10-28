import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, Calendar, Settings2, Rocket, UserRound } from "lucide-react";
import { Reveal } from "../ui/kit.js";
import { moduleExtras } from "../../data/moduleExtras.js";

/** "Built for": three real situations where the module earns its place. */
export function UseCases({ module: m }) {
  const x = moduleExtras[m.slug];
  if (!x) return null;
  return (
    <div className="grid gap-4 md:grid-cols-3 md:gap-6">
      {x.uses.map(([who, text], i) => (
        <Reveal key={who} delay={i * 0.08} className="h-full">
          <div className="group h-full rounded-3xl border border-ink/10 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl md:p-7">
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl text-white transition-transform duration-500 group-hover:rotate-6" style={{ background: m.color }}>
              <UserRound size={20} />
            </span>
            <p className="font-display text-lg font-bold text-ink">{who}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink/65">{text}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/** Three steps from "hello" to live. */
export function GettingStarted({ module: m }) {
  const steps = [
    [Calendar, "Book a demo", `See ${m.name} on your own menu and floor.`],
    [Settings2, "We set it up", "Your team is onboarded with your dishes, tables and roles."],
    [Rocket, "Go live", "Open the doors, with help on hand for the first week."],
  ];
  return (
    <ol className="relative mx-auto grid max-w-5xl gap-4 md:grid-cols-3 md:gap-8">
      {steps.map(([Icon, title, text], i) => (
        <li key={title} className="relative rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-center">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber px-3 py-0.5 text-xs font-bold text-white">{i + 1}</span>
          <Icon size={26} className="mx-auto text-amberLight" />
          <p className="mt-3 font-display text-lg font-bold">{title}</p>
          <p className="mt-1 text-sm text-cream/60">{text}</p>
        </li>
      ))}
    </ol>
  );
}

/** Common questions, one open at a time. */
export function ModuleFaq({ module: m }) {
  const x = moduleExtras[m.slug];
  const [open, setOpen] = useState(0);
  if (!x) return null;
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {x.faq.map(([q, a], i) => {
        const on = open === i;
        return (
          <div key={q} className={`overflow-hidden rounded-2xl border bg-white transition-colors ${on ? "border-amber/40" : "border-ink/10"}`}>
            <button type="button" aria-expanded={on} onClick={() => setOpen(on ? -1 : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-display text-base font-bold text-ink md:px-6">
              {q}
              <ChevronDown size={18} className={`shrink-0 text-amber transition-transform duration-300 ${on ? "rotate-180" : ""}`} />
            </button>
            <div className={`grid transition-all duration-300 ${on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-sm leading-relaxed text-ink/65 md:px-6">{a}</p>
              </div>
            </div>
          </div>
        );
      })}
      <p className="pt-3 text-center text-sm text-ink/55">
        Something else? <Link to="/contact" className="inline-flex items-center gap-1 font-semibold text-amber">Ask our team <ArrowRight size={14} /></Link>
      </p>
    </div>
  );
}

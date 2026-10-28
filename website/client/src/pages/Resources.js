import React, { useMemo, useState } from "react";
import PageBackdrop from "../components/ReactBits/PageBackdrop.js";
import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, Code2, LifeBuoy, Newspaper, Compass, Search } from "lucide-react";
import { modules } from "../data/modules.js";
import HeroFacts from "../components/ui/HeroFacts.js";

const kinds = [
  { id: "docs", label: "Documentation", icon: BookOpen, soon: false },
  { id: "help", label: "Help Center", icon: LifeBuoy, soon: true },
  { id: "guides", label: "Guides", icon: Compass, soon: true },
  { id: "blog", label: "Blog", icon: Newspaper, soon: true },
  { id: "api", label: "API Reference", icon: Code2, soon: true },
];

/** Resources: a docs hub. A big search, a sidebar of libraries, and every module as a readable row. */
export default function Resources() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("docs");
  const active = kinds.find((k) => k.id === kind);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return modules.filter((m) => !t || `${m.name} ${m.short} ${m.features.map((f) => f.title).join(" ")}`.toLowerCase().includes(t));
  }, [q]);

  return (
    <div className="bg-white" style={{ paddingBottom: "var(--section-space)" }}>
      <section className="hero-min relative isolate bg-[#101010] text-cream" data-nav-theme="dark" style={{ paddingTop: "calc(var(--header-clearance) + clamp(28px, 6vw, 72px))", paddingBottom: "clamp(56px, 8vw, 104px)" }}>
        <PageBackdrop tone="dark" />
        <div className="container-dishky max-w-3xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-amber">Resources</p>
          <h1 className="heading-lg mt-3">How can we help?</h1>
          <label className="relative mt-8 block">
            <span className="sr-only">Search resources</span>
            <Search size={20} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-cream/45" />
            <input value={q} maxLength={100} onChange={(e) => setQ(e.target.value)} placeholder="Search modules and features…" className="w-full rounded-2xl border border-white/15 bg-white/[0.07] py-4 pl-14 pr-24 text-base text-cream outline-none transition-colors placeholder:text-cream/40 focus:border-amber" />
            <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-white/20 px-2 py-0.5 text-xs text-cream/50 sm:block">{rows.length} results</kbd>
          </label>
          <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm text-cream/55">
            Popular: {["Kitchen", "Loyalty", "Reservations", "Payments"].map((w) => <button key={w} type="button" onClick={() => setQ(w)} className="rounded-full border border-white/15 px-3 py-0.5 text-cream/80 transition-colors hover:border-amber hover:text-amber">{w}</button>)}
          </div>
        </div>
        <div className="container-dishky mt-14 w-full md:mt-20"><HeroFacts dark /></div>
      </section>

      <div className="container-dishky -mt-8 grid gap-6 lg:grid-cols-[16rem_1fr] lg:gap-10">
        <aside className="rounded-3xl border border-ink/10 bg-white p-3 shadow-xl lg:sticky lg:top-28 lg:self-start">
          <nav aria-label="Libraries" className="flex gap-1 overflow-x-auto lg:flex-col">
            {kinds.map((k) => (
              <button key={k.id} onClick={() => setKind(k.id)} className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors ${kind === k.id ? "bg-ink text-white" : "text-ink/65 hover:bg-ink/5"}`}>
                <k.icon size={17} className={kind === k.id ? "text-amberLight" : "text-amber"} />
                {k.label}
                {k.soon && <span className="ml-auto rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-bold text-amber">Soon</span>}
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 pt-2 lg:pt-10">
          {active.soon ? (
            <div className="rounded-3xl border border-dashed border-ink/20 p-10 text-center">
              <active.icon size={32} className="mx-auto text-amber" />
              <p className="mt-3 font-display text-2xl font-extrabold">{active.label} is being organised.</p>
              <p className="mt-1 text-ink/60">Until then, every module has its own page with a live demo.</p>
              <button onClick={() => setKind("docs")} className="btn-secondary mt-5">Browse the module docs</button>
            </div>
          ) : (
            <ul className="divide-y divide-ink/10">
              {rows.map((m) => (
                <li key={m.slug}>
                  <Link to={m.path} className="group flex items-center gap-4 py-4 transition-colors md:py-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: m.color }}><m.icon size={20} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-lg font-bold text-ink transition-colors group-hover:text-amber">{m.name}</span>
                      <span className="block truncate text-sm text-ink/55">{m.features.map((f) => f.title).join(" · ")}</span>
                    </span>
                    <ArrowUpRight size={18} className="shrink-0 text-ink/25 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-amber" />
                  </Link>
                </li>
              ))}
              {rows.length === 0 && <li className="py-10 text-center text-ink/60">Nothing matches “{q}”. <Link to="/contact" className="font-semibold text-amber">Ask our team</Link>.</li>}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

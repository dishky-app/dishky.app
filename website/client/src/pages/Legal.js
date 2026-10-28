import React, { useEffect, useState } from "react";
import PageBackdrop from "../components/ReactBits/PageBackdrop.js";
import { Link, useLocation } from "react-router-dom";
import { LEGAL_DOCS, UPDATED } from "../data/legalDocs.js";

const titles = {
  "/legal/privacy": "Privacy Policy",
  "/legal/terms": "Terms of Service",
  "/legal/security": "Security",
  "/legal/cookies": "Cookie Policy",
};
const slug = (h) => h.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Legal: a reading layout with a sticky table of contents that follows where you are. */
export default function Legal() {
  const { pathname } = useLocation();
  const title = titles[pathname] || "Legal";
  const doc = pathname === "/legal/privacy" ? LEGAL_DOCS.privacy : pathname === "/legal/terms" ? LEGAL_DOCS.terms : null;
  const [active, setActive] = useState("");

  useEffect(() => {
    if (!doc || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-20% 0px -70% 0px" });
    doc.sections.forEach(([h]) => { const el = document.getElementById(slug(h)); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [doc]);

  return (
    <div className="relative isolate min-h-screen-safe bg-[#ffffff]" style={{ paddingTop: "calc(var(--header-clearance) + clamp(24px, 6vw, 64px))", paddingBottom: "var(--section-space)" }}>
      <PageBackdrop tone="light" />
      <div className="container-dishky">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {Object.entries(titles).map(([to, t]) => (
            <Link key={to} to={to} className={`rounded-full px-4 py-1.5 font-semibold transition-colors ${to === pathname ? "bg-ink text-white" : "bg-ink/[0.06] text-ink/65 hover:text-ink"}`}>{t}</Link>
          ))}
        </div>
        <h1 className="mt-8 font-display font-extrabold leading-[0.95] tracking-tight text-ink" style={{ fontSize: "clamp(2.5rem, 7vw, 5.5rem)" }}>{title}</h1>
        {doc && <p className="mt-3 text-sm text-ink/50">Last updated {UPDATED}. Sample text for demonstration only.</p>}

        {doc ? (
          <div className="mt-10 grid gap-10 lg:grid-cols-[15rem_minmax(0,42rem)] lg:gap-16">
            <nav aria-label="On this page" className="hidden lg:block">
              <div className="sticky top-28">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-ink/40">On this page</p>
                <ul className="space-y-1 border-l border-ink/10">
                  {doc.sections.map(([h]) => (
                    <li key={h}>
                      <a href={`#${slug(h)}`} onClick={(e) => { e.preventDefault(); document.getElementById(slug(h))?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className={`-ml-px block border-l-2 py-1.5 pl-4 text-sm transition-all ${active === slug(h) ? "border-amber font-semibold text-ink" : "border-transparent text-ink/50 hover:text-ink"}`}>{h}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
            <div className="space-y-10">
              {doc.sections.map(([heading, text]) => (
                <section key={heading} id={slug(heading)} className="dk-auto-h scroll-mt-28">
                  <h2 className="font-display text-xl font-extrabold text-ink md:text-2xl">{heading}</h2>
                  <p className="mt-3 text-[1.05rem] leading-[1.8] text-ink/70">{text}</p>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-lead mt-6 max-w-xl text-ink/60">This page is a placeholder. Final {title.toLowerCase()} content will be published here before launch.</p>
        )}
      </div>
    </div>
  );
}

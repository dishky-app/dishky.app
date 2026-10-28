import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

/** items: [{ label, to? }]; the last item is the current page. */
export default function Breadcrumbs({ items, dark = false }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className={`flex flex-wrap items-center gap-1.5 text-xs font-semibold ${dark ? "text-cream/60" : "text-ink/55"}`}>
        {items.map((it, i) => (
          <li key={it.label} className="flex items-center gap-1.5">
            {it.to ? (
              <Link to={it.to} className="rounded px-1 py-1 hover:text-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber">{it.label}</Link>
            ) : (
              <span aria-current="page" className={dark ? "text-cream" : "text-ink"}>{it.label}</span>
            )}
            {i < items.length - 1 && <ChevronRight size={12} aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

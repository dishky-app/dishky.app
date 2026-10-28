import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { bySlug } from "../../data/modules.js";

/** Small pieces shared by the "chapters" and "collage" spotlight layouts. */

export function SpotTitle({ m, dark, index, total }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber text-white shadow-[0_18px_40px_-10px_rgba(243,55,22,0.7)]">
        <m.icon size={26} />
      </span>
      {index && (
        <span className={`font-display text-sm font-extrabold tabular-nums ${dark ? "text-cream/50" : "text-ink/40"}`}>
          {String(index).padStart(2, "0")} / {total}
        </span>
      )}
    </div>
  );
}

export function SpotAlso({ also = [], dark }) {
  if (!also.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`text-xs font-semibold ${dark ? "text-cream/50" : "text-ink/50"}`}>Also in this family</span>
      {also.map((s) => {
        const o = bySlug[s];
        if (!o) return null;
        return (
          <Link key={s} to={o.path} className={`group flex min-h-[40px] items-center gap-2 rounded-full px-3.5 text-xs font-bold transition-all duration-300 hover:-translate-y-0.5 ${dark ? "bg-white/10 hover:bg-amber" : "bg-ink/5 hover:bg-amber hover:text-white"}`}>
            <o.icon size={14} className="text-amber transition-colors group-hover:text-current" /> {o.name}
          </Link>
        );
      })}
    </div>
  );
}

export function SpotCta({ m }) {
  return (
    <Link to={m.path} className="btn-primary group">
      Explore {m.name}
      <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
    </Link>
  );
}

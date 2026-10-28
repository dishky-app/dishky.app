import React from "react";

/** App-window chrome for interactive demos. */
export default function Window({ title, dark = false, children, className = "", right = null }) {
  return (
    <div
      className={`overflow-hidden rounded-[1.5rem] border shadow-2xl ${
        dark ? "border-cream/10 bg-[#0d0d0d] text-cream" : "border-ink/10 bg-white text-ink"
      } ${className}`}
    >
      <div className={`flex items-center gap-3 border-b px-4 py-3 ${dark ? "border-cream/10" : "border-ink/10"}`}>
        <span className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-full ${dark ? "bg-cream/20" : "bg-ink/15"}`} />
          ))}
        </span>
        <p className={`min-w-0 flex-1 truncate font-display text-xs font-bold ${dark ? "text-cream/70" : "text-ink/60"}`}>{title}</p>
        {right}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

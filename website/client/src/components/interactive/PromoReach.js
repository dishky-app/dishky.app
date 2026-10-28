import React, { useState } from "react";
import { motion } from "framer-motion";
import { Store, Users } from "lucide-react";

/** Your page alone, then with Dishky behind it. Ripples show the audience growing. */
export default function PromoReach() {
  const [on, setOn] = useState(false);
  return (
    <div className="rounded-[1.75rem] border border-cream/10 bg-cream/[0.04] p-5 sm:p-7">
      <div className="relative mx-auto flex h-64 w-full max-w-sm items-center justify-center sm:h-72">
        {[0, 1, 2, 3].map((r) => (
          <motion.span key={r} aria-hidden="true" className="absolute rounded-full border border-amber"
            animate={{ width: on ? 90 + r * 62 : r === 0 ? 90 : 90, height: on ? 90 + r * 62 : 90, opacity: on ? 0.75 - r * 0.15 : r === 0 ? 0.8 : 0 }}
            transition={{ type: "spring", stiffness: 90, damping: 16, delay: on ? r * 0.08 : 0 }} />
        ))}
        {on && [0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <motion.span key={n} className="absolute flex h-7 w-7 items-center justify-center rounded-full bg-cream text-ink"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, x: Math.cos((n / 9) * Math.PI * 2) * (70 + (n % 3) * 34), y: Math.sin((n / 9) * Math.PI * 2) * (70 + (n % 3) * 34) }}
            transition={{ delay: 0.15 + n * 0.06, type: "spring", stiffness: 160, damping: 14 }}>
            <Users size={13} />
          </motion.span>
        ))}
        <span className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber text-ink shadow-xl"><Store size={26} /></span>
      </div>
      <div className="mx-auto mt-2 flex w-fit rounded-full bg-cream/10 p-1">
        {[[false, "Your page"], [true, "With Dishky"]].map(([v, l]) => (
          <button key={l} type="button" onClick={() => setOn(v)} style={{ minHeight: 38 }} className={`rounded-full px-5 text-xs font-bold transition ${on === v ? "bg-amber text-ink" : "text-cream/60"}`}>{l}</button>
        ))}
      </div>
    </div>
  );
}

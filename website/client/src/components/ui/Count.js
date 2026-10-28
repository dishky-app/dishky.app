import React, { useEffect, useRef, useState } from "react";

/** Number that tweens to its new value. */
export default function Count({ value, prefix = "", suffix = "", duration = 700, className = "" }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (value - a) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={`tabular-nums ${className}`}>{prefix}{shown.toLocaleString("en-IN")}{suffix}</span>;
}

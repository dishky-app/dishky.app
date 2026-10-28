import React, { useEffect, useRef, useState } from "react";

/**
 * Mounts its children (a WebGL scene) only while the box is near the viewport.
 * Four or five WebGL scenes starting at once made the landing page hang, so each
 * one now boots when you scroll close to it and is released once you are far away.
 */
export default function LazyGL({ className = "", style, margin = "40% 0px", children }) {
  const ref = useRef(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === "undefined") { setNear(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return <div ref={ref} className={className} style={style}>{near ? children : null}</div>;
}

import React, { Suspense, useEffect, useState } from "react";

export function hasWebGL2() {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch (e) {
    return false;
  }
}

/**
 * Progressive enhancement: shows `fallback` (the plain v5 layout) until the
 * browser proves it can run the effect, and while its code is still loading.
 */
export default function Enhanced({ fallback, webgl = false, children }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(webgl ? hasWebGL2() : true);
  }, [webgl]);
  if (!ok) return fallback;
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

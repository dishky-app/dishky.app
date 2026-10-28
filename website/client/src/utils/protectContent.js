/**
 * Content protection for the public site: no dragging images, no text selection or copying, no
 * right-click menu. Form fields stay fully usable (typing, selecting and pasting your own input),
 * except password fields, which can't be copied or cut.
 */
const EDITABLE = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

const inEditable = (t) => !!(t && t.closest && t.closest(EDITABLE));
const inPassword = (t) => !!(t && t.closest && t.closest("input[type='password']"));

export default function protectContent() {
  if (typeof document === "undefined" || window.__dkProtected) return;
  window.__dkProtected = true;
  const stop = (e) => e.preventDefault();

  document.addEventListener("contextmenu", (e) => { if (!inEditable(e.target)) stop(e); });
  document.addEventListener("dragstart", stop);
  document.addEventListener("selectstart", (e) => { if (!inEditable(e.target)) stop(e); });
  document.addEventListener("copy", (e) => { if (!inEditable(e.target) || inPassword(e.target)) stop(e); });
  document.addEventListener("cut", (e) => { if (!inEditable(e.target) || inPassword(e.target)) stop(e); });
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (inEditable(e.target)) {
      if ((k === "c" || k === "x") && inPassword(e.target)) stop(e);
      return;
    }
    if (["a", "c", "x", "u", "s"].includes(k)) stop(e); // select all, copy, cut, view source, save page
  });

  // Images and links can't be picked up even where the browser skips dragstart.
  const lock = (root) => root.querySelectorAll?.("img, a").forEach((n) => { n.draggable = false; });
  lock(document);
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
    if (n.nodeType !== 1) return;
    if (n.matches?.("img, a")) n.draggable = false;
    lock(n);
  }))).observe(document.documentElement, { childList: true, subtree: true });
}

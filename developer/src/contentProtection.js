/**
 * contentProtection - installed once at start-up in every panel.
 *
 *   - images can't be grabbed / dragged out of the page (or saved from the right-click menu)
 *   - page text can't be selected or copied
 *
 * Fields you type into (input / textarea / select / contenteditable) keep working normally,
 * and anything marked data-allow-select stays selectable (e.g. an invitation link someone has
 * to copy).
 */
const ALLOW = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-allow-select], [data-allow-select] *, .tk-link-box';

const CSS = `
body, body * {
  -webkit-user-select: none !important;
  user-select: none !important;
  -webkit-touch-callout: none !important;
}
body input, body textarea, body select, body [contenteditable="true"],
body [data-allow-select], body [data-allow-select] *, body .tk-link-box {
  -webkit-user-select: text !important;
  user-select: text !important;
}
img, svg image, picture {
  -webkit-user-drag: none !important;
  user-drag: none !important;
}
`;

const asElement = (node) => (node && node.nodeType === 3 ? node.parentElement : node);
const isAllowed = (node) => {
  const el = asElement(node);
  return !!(el && el.closest && el.closest(ALLOW));
};

export function installContentProtection() {
  if (typeof document === "undefined" || window.__dishkyContentProtection) return;
  window.__dishkyContentProtection = true;

  const style = document.createElement("style");
  style.setAttribute("data-dishky", "content-protection");
  style.textContent = CSS;
  document.head.appendChild(style);

  // Dragging an image out of the page.
  document.addEventListener("dragstart", (e) => {
    const el = asElement(e.target);
    if (el && el.tagName === "IMG") e.preventDefault();
  }, true);

  // Saving / copying an image from the right-click menu.
  document.addEventListener("contextmenu", (e) => {
    const el = asElement(e.target);
    if (el && el.tagName === "IMG") e.preventDefault();
  }, true);

  // Starting a text selection (drag, double-click, Ctrl+A) outside the fields you type in.
  document.addEventListener("selectstart", (e) => {
    if (!isAllowed(e.target)) e.preventDefault();
  }, true);

  // Copy / cut of anything that isn't inside such a field.
  const blockCopy = (e) => {
    const active = document.activeElement;
    if (isAllowed(active)) return;
    const sel = window.getSelection && window.getSelection();
    if (sel && sel.anchorNode && isAllowed(sel.anchorNode)) return;
    e.preventDefault();
  };
  document.addEventListener("copy", blockCopy, true);
  document.addEventListener("cut", blockCopy, true);
}

export default installContentProtection;

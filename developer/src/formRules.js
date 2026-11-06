/**
 * formRules - field rules for every form, installed once at start-up (document-level listeners, no per-page work).
 *
 *   mobile / phone fields   digits only, at most 10
 *   name fields             first letter of every word capitalised as the person types
 *   password fields        a show / hide eye (skipped when the page already put its own button beside the field)
 *   limits (when asked)     text inputs: 100 characters and 5 words; textareas: 500 characters
 *
 * The 100-character / 5-word / 500-character caps are already enforced by enforceInputLimits in most panels, so they
 * are only switched on with installFormRules({ limits: true }). A field opts out with data-no-guard (rules) or
 * data-no-eye (password eye).
 */
const MAX_CHARS = 100, MAX_WORDS = 5, MAX_TEXTAREA = 500, MOBILE_LEN = 10;
const GUARDED_TYPES = ["", "text", "search", "tel"];

const titleCase = (v) => String(v ?? "").replace(/\s+/g, " ").replace(/^\s/, "").replace(/(^|\s)(\S)/g, (_, sep, ch) => sep + ch.toUpperCase());

function setNative(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value); // bypasses React's value tracker so onChange still fires
}

function hintOf(el) {
  const label = (el.labels && el.labels[0]) || (el.closest && el.closest(".mat, .admin-form-group, .form-group, .section, .field")?.querySelector("label"));
  return [el.name, el.id, el.placeholder, el.getAttribute("aria-label"), label && label.textContent].filter(Boolean).join(" ").toLowerCase();
}

/** The value the field may hold, or the same string when nothing needs changing. */
function guardValue(el, limits) {
  const v = el.value;
  if (el instanceof HTMLTextAreaElement) return limits && v.length > MAX_TEXTAREA ? v.slice(0, MAX_TEXTAREA) : v;
  const type = (el.getAttribute("type") || "").toLowerCase();
  if (!GUARDED_TYPES.includes(type)) return v;
  const hint = hintOf(el);
  if (type === "tel" || /(^|[^a-z])(mobile|phone|whatsapp)([^a-z]|$)/.test(hint)) return v.replace(/\D/g, "").slice(0, MOBILE_LEN);
  let out = v;
  const isSearch = type === "search" || /search/.test(hint);
  if (!isSearch && /(^|[^a-z])name([^a-z]|$)/.test(hint) && !/user ?name|file ?name|e-?mail|slug|password/.test(hint)) out = titleCase(out);
  if (limits) {
    const words = out.replace(/\s+/g, " ").trim();
    if (words.split(" ").filter(Boolean).length > MAX_WORDS) out = (out.match(/^\s*(?:\S+\s+){4}\S+\s?/) || [out])[0];
    if (out.length > MAX_CHARS) out = out.slice(0, MAX_CHARS);
  }
  return out;
}

const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
const CSS = ".pw-eye-btn{position:absolute;z-index:2;width:26px;height:26px;padding:0;border:0;background:transparent;color:#666;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}.pw-eye-btn:hover{color:#111}.pw-eye-btn svg{width:18px;height:18px}input[data-pw-eye]{padding-right:40px!important}";

function addEye(input) {
  if (input.dataset.pwEye || input.dataset.noEye !== undefined) return;
  const parent = input.parentElement;
  if (!parent || parent.querySelector("button, .pw-eye-btn")) return; // the page already has its own toggle
  input.dataset.pwEye = "1";
  if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "pw-eye-btn"; btn.tabIndex = -1; btn.setAttribute("aria-label", "Show password"); btn.innerHTML = EYE;
  const place = () => { btn.style.top = `${input.offsetTop + input.offsetHeight / 2 - 13}px`; btn.style.left = `${input.offsetLeft + input.offsetWidth - 34}px`; };
  btn.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.innerHTML = show ? EYE_OFF : EYE; btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });
  input.after(btn); place();
  input.addEventListener("focus", place); window.addEventListener("resize", place);
}

export function installFormRules({ limits = false } = {}) {
  if (typeof document === "undefined" || window.__dishkyFormRules) return;
  window.__dishkyFormRules = true;

  const style = document.createElement("style"); style.textContent = CSS; document.head.appendChild(style);

  document.addEventListener("input", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || el.dataset.noGuard !== undefined || el.readOnly) return;
    const next = guardValue(el, limits);
    if (next === el.value) return;
    const pos = el.selectionStart, sameLen = next.length === el.value.length;
    setNative(el, next);
    try { const p = sameLen ? pos : Math.min(pos ?? next.length, next.length); el.setSelectionRange(p, p); } catch (_e) { /* tel inputs have no selection */ }
  }, true);

  const scan = (root) => (root.querySelectorAll ? root.querySelectorAll('input[type="password"]') : []).forEach(addEye);
  const start = () => {
    scan(document);
    new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches && n.matches('input[type="password"]')) addEye(n); scan(n); } }))).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
}

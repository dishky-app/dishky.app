/**
 * GlobalFormEnhancers — behaviour that applies to every form in the admin panel, installed once in App:
 *
 *  1. Image picker → crop. Any <input type="file"> that accepts only images opens ImageCropModal (crop / move / resize,
 *     Confirm / Cancel) before the page's own onChange sees the file. Cancel discards the choice.
 *  2. Input rules, enforced as the user types or pastes:
 *       mobile / phone fields   digits only, at most 10
 *       name fields             first letter of every word capitalised
 *       text inputs             at most 100 characters and 5 words
 *       textareas               at most 500 characters
 *  3. Password fields get a show / hide eye (unless the page already put a button next to them).
 *
 * These run on document-level capture listeners so no page needs to opt in; an element opts out with data-no-guard
 * (rules) or data-no-crop (image crop).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import ImageCropModal from "./ImageCropModal";
import "./formEnhancers.css";

const MAX_CHARS = 100, MAX_WORDS = 5, MAX_TEXTAREA = 500, MOBILE_LEN = 10;
const GUARDED_TYPES = ["", "text", "search", "tel"];
const CROPPABLE = /^image\/(png|jpe?g|webp)$/i;

const titleCase = (v) => String(v ?? "").replace(/\s+/g, " ").replace(/^\s/, "").replace(/(^|\s)(\S)/g, (_, sep, ch) => sep + ch.toUpperCase());

function setNative(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value); // bypasses React's value tracker so onChange still fires
}

function hintOf(el) {
  const label = (el.labels && el.labels[0]) || el.closest(".mat, .admin-form-group, .form-group, .section")?.querySelector("label");
  return [el.name, el.id, el.placeholder, el.getAttribute("aria-label"), label && label.textContent].filter(Boolean).join(" ").toLowerCase();
}

/** The value the field is allowed to hold, or the same string when nothing needs changing. */
function guardValue(el) {
  const v = el.value;
  if (el instanceof HTMLTextAreaElement) return v.length > MAX_TEXTAREA ? v.slice(0, MAX_TEXTAREA) : v;
  const type = (el.getAttribute("type") || "").toLowerCase();
  if (!GUARDED_TYPES.includes(type)) return v;
  const hint = hintOf(el);
  if (type === "tel" || /(^|[^a-z])(mobile|phone|whatsapp)([^a-z]|$)/.test(hint)) return v.replace(/\D/g, "").slice(0, MOBILE_LEN);
  let out = v;
  const isSearch = type === "search" || /search/.test(hint);
  if (!isSearch && /(^|[^a-z])name([^a-z]|$)/.test(hint) && !/user ?name|file ?name|e-?mail|slug|password/.test(hint)) out = titleCase(out);
  const words = out.replace(/\s+/g, " ").trim();
  if (words.split(" ").filter(Boolean).length > MAX_WORDS) out = (out.match(/^\s*(?:\S+\s+){4}\S+\s?/) || [out])[0]; // first 5 words (+ the space after them)
  if (out.length > MAX_CHARS) out = out.slice(0, MAX_CHARS);
  return out;
}

const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

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

export default function GlobalFormEnhancers() {
  const [crop, setCrop] = useState(null); // { file, resolve }
  const cropRef = useRef(null);
  cropRef.current = crop;

  const askCrop = useCallback((file) => new Promise((resolve) => setCrop({ file, resolve })), []);

  useEffect(() => {
    // ── 1. image → crop ────────────────────────────────────────────────
    const onChange = async (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
      if (input.__cropDone) { input.__cropDone = false; return; }
      if (input.dataset.noCrop !== undefined) return;
      const accept = (input.getAttribute("accept") || "").split(",").map((t) => t.trim()).filter(Boolean);
      if (!accept.length || !accept.every((t) => /^(image\/|\.(png|jpe?g|webp|gif|bmp|svg))/i.test(t))) return; // not an image-only picker
      const files = Array.from(input.files || []);
      if (!files.some((f) => CROPPABLE.test(f.type))) return;
      e.stopImmediatePropagation();
      const out = [];
      for (const f of files) {
        if (!CROPPABLE.test(f.type)) { out.push(f); continue; }
        const cropped = await askCrop(f);
        if (cropped) out.push(cropped);
      }
      if (!out.length) { try { input.value = ""; } catch (_e) { /* ignore */ } return; }
      const dt = new DataTransfer(); out.forEach((f) => dt.items.add(f));
      input.files = dt.files; input.__cropDone = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    // ── 2. input rules ─────────────────────────────────────────────────
    const onInput = (e) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || el.dataset.noGuard !== undefined || el.readOnly) return;
      const next = guardValue(el);
      if (next === el.value) return;
      const pos = el.selectionStart, sameLen = next.length === el.value.length;
      setNative(el, next);
      try { const p = sameLen ? pos : Math.min(pos ?? next.length, next.length); el.setSelectionRange(p, p); } catch (_e) { /* tel/number inputs have no selection */ }
    };

    // ── 3. password eye ────────────────────────────────────────────────
    const scan = (root) => (root.querySelectorAll ? root.querySelectorAll('input[type="password"]') : []).forEach(addEye);
    scan(document);
    const mo = new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches && n.matches('input[type="password"]')) addEye(n); scan(n); } })));
    mo.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("change", onChange, true);
    document.addEventListener("input", onInput, true);
    return () => { document.removeEventListener("change", onChange, true); document.removeEventListener("input", onInput, true); mo.disconnect(); };
  }, [askCrop]);

  if (!crop) return null;
  const done = (result) => { crop.resolve(result); setCrop(null); };
  return <ImageCropModal key={crop.file.name + crop.file.size} file={crop.file} onConfirm={(f) => done(f)} onCancel={() => done(null)} />;
}

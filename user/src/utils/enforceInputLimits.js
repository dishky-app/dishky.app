/**
 * enforceInputLimits - app-wide input limits, installed once at start-up.
 *
 *   - every text-like <input>   : at most 100 characters and 5 words
 *   - every <textarea>          : at most 500 characters
 *
 * Fields that already set a smaller maxLength keep it. Number / date / file /
 * checkbox style inputs are left alone, and so is anything marked
 * data-no-limit. Characters are capped with the native maxLength (so pasted
 * text is cut too); the word cap trims whatever goes past the 5th word before
 * React's onChange runs, so controlled inputs stay in step.
 */
export const MAX_INPUT_CHARS = 100;
export const MAX_INPUT_WORDS = 5;
export const MAX_TEXTAREA_CHARS = 500;

const CHAR_TYPES = new Set(["text", "search", "email", "password", "url", "tel", ""]);
const WORD_TYPES = new Set(["text", "search", ""]);

/** Keeps the first `maxWords` words; spaces between them (and one trailing space) are untouched. */
export function limitWords(value, maxWords = MAX_INPUT_WORDS) {
  const re = new RegExp(`^(\\s*\\S+){${maxWords}}`);
  const text = String(value ?? "");
  const tokens = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  if (tokens <= maxWords) return text;
  const m = text.match(re);
  return m ? m[0] : text;
}

function capLength(el) {
  if (!el || el.hasAttribute("data-no-limit")) return;
  const tag = el.tagName;
  if (tag === "TEXTAREA") {
    const cur = el.maxLength;
    if (cur < 0 || cur > MAX_TEXTAREA_CHARS) el.maxLength = MAX_TEXTAREA_CHARS;
  } else if (tag === "INPUT") {
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (!CHAR_TYPES.has(type)) return;
    const cur = el.maxLength;
    if (cur < 0 || cur > MAX_INPUT_CHARS) el.maxLength = MAX_INPUT_CHARS;
  }
}

const nativeValueSetter = (el) =>
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;

export function installInputLimits() {
  if (typeof document === "undefined" || window.__dishkyInputLimits) return;
  window.__dishkyInputLimits = true;

  // Apply the character cap as soon as a field gets focus (covers fields rendered later).
  document.addEventListener("focusin", (e) => capLength(e.target), true);
  document.addEventListener("pointerdown", (e) => capLength(e.target), true);

  // Value and caret just before each edit, so a keystroke that would create a 6th word can be undone exactly.
  const before = new WeakMap();
  document.addEventListener(
    "beforeinput",
    (e) => {
      const el = e.target;
      if (el && el.tagName === "INPUT") before.set(el, { value: el.value, start: el.selectionStart, end: el.selectionEnd });
    },
    true
  );

  // Word cap, run before React's own listener on the root.
  document.addEventListener(
    "input",
    (e) => {
      const el = e.target;
      if (!el || el.tagName !== "INPUT" || e.isComposing || el.hasAttribute("data-no-limit")) return;
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (!WORD_TYPES.has(type)) return;
      const limited = limitWords(el.value);
      if (limited === el.value) return;

      const set = nativeValueSetter(el);
      const write = (v) => { if (set) set.call(el, v); else el.value = v; };
      const prev = before.get(el);
      const pasted = /paste|drop/i.test(e.inputType || "");
      if (prev && !pasted) {
        // Typing a 6th word: undo the keystroke; React never sees it.
        write(prev.value);
        try { el.setSelectionRange(prev.start, prev.end); } catch { /* not selectable */ }
        e.stopImmediatePropagation();
      } else {
        // Pasted / dropped text: keep the first 5 words and let React take that value.
        write(limited);
        try { el.setSelectionRange(limited.length, limited.length); } catch { /* not selectable */ }
      }
    },
    true
  );
}

export default installInputLimits;

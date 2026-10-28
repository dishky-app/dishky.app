/**
 * inputLimits.js
 * --------------
 * Shared input-limiting helpers, mirroring the admin panel's App.js
 * allowTextInput (same signature/behavior) so both panels enforce the
 * same rules: plain text inputs cap at 100 characters / 5 words, and
 * phone numbers are digit-only, capped at 10 digits.
 *
 * Usage:
 *   import { allowTextInput, sanitizePhoneInput } from "./shared/inputLimits";
 *   // or, if re-exported from ./shared/index.js:
 *   import { allowTextInput, sanitizePhoneInput } from "./shared";
 *
 *   onChange={(e) => setName(allowTextInput(name, e.target.value))}
 *   onChange={(e) => setMobile(sanitizePhoneInput(e.target.value))}
 */

/**
 * Blocks typing/pasting past maxChars characters or maxWords words —
 * returns currentValue unchanged (rejecting the keystroke/paste) once
 * either limit would be exceeded, otherwise returns nextValue as-is.
 */
export const allowTextInput = (
  currentValue,
  nextValue,
  maxChars = 100,
  maxWords = 5
) => {
  if (!nextValue) return "";

  // Normalize spaces only for validation
  const normalized = nextValue.replace(/\s+/g, " ").trim();

  const charCount = normalized.length;
  const wordCount =
    normalized === "" ? 0 : normalized.split(" ").length;

  // Block typing / paste if limit exceeded
  if (charCount > maxChars || wordCount > maxWords) {
    return currentValue;
  }

  return nextValue;
};

/**
 * Strips everything but digits and caps at 10 — for phone/mobile number
 * inputs. Doesn't take a currentValue: unlike allowTextInput, extra
 * digits are simply dropped (not rejected outright) since phone numbers
 * are pasted from all sorts of formats ("+91 98765 43210", "(987) 654-
 * 3210") and stripping non-digits then truncating handles all of them
 * the same way.
 */
export const sanitizePhoneInput = (nextValue) =>
  (nextValue || "").replace(/\D/g, "").slice(0, 10);

/** True once a sanitized phone value is exactly 10 digits. */
export const isValidPhone = (value) =>
  (value || "").replace(/\D/g, "").length === 10;

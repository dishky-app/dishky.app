/**
 * Shared form helpers: input formatters (run on every keystroke) and validators
 * (run on submit; each returns an error message or "").
 * Phone rule follows the admin panel: digits only, exactly 10.
 */

/** Digits only, capped at 10 (onChange transform for every mobile field). */
export const sanitizePhone = (raw) => String(raw ?? "").replace(/\D/g, "").slice(0, 10);
export const isValidPhone = (v) => sanitizePhone(v).length === 10;

export const MAX_WORDS = 5;
export const MAX_CHARS = 100;
/** Caps a text value at 5 words / 100 characters (a trailing space is kept while typing the next word). */
export const limitText = (raw, maxWords = MAX_WORDS, maxChars = MAX_CHARS) => {
  let s = String(raw ?? "").slice(0, maxChars);
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length > maxWords) s = words.slice(0, maxWords).join(" ");
  return s;
};

const CAP = /(^|[\s\-.(/&])(\p{L})/gu;
// Capitalise the first letter of each word; the rest is left as typed so "GTR" or "MRK Cafe" stay intact.
const cap = (s) => s.replace(CAP, (_, a, b) => a + b.toUpperCase());

/** Person name: letters, spaces, . ' - only, first letter of every word capitalised ("john doe" -> "John Doe", "GTR" stays "GTR"). */
export const formatName = (raw) =>
  cap(limitText(raw).replace(/[^\p{L}\s.'’-]/gu, "").replace(/^\s+/, "").replace(/\s{2,}/g, " "));

/** Business / place names: any characters, every word capitalised. */
export const formatTitle = (raw) =>
  cap(limitText(String(raw ?? "").replace(/^\s+/, "").replace(/\s{2,}/g, " ")));

export const formatEmail = (raw) => String(raw ?? "").replace(/\s/g, "").toLowerCase().slice(0, MAX_CHARS);
export const formatDigits = (raw, max = 6) => String(raw ?? "").replace(/\D/g, "").slice(0, max);

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? "").trim());

/* ---- validators: return "" when fine, else a message for the toast ---- */
export const vRequired = (v, label) => (String(v ?? "").trim() ? "" : `${label} is required.`);
export const vName = (v, label = "Name") =>
  !String(v ?? "").trim() ? `${label} is required.` : String(v).trim().length < 2 ? `${label} must be at least 2 characters.` : "";
export const vEmail = (v) =>
  !String(v ?? "").trim() ? "Email is required." : isEmail(v) ? "" : "Enter a valid email address.";
export const vPhone = (v, { required = false } = {}) => {
  if (!String(v ?? "").trim()) return required ? "Mobile number is required." : "";
  return isValidPhone(v) ? "" : "Mobile number must be exactly 10 digits.";
};
export const vPassword = (v, { strong = true } = {}) => {
  const s = String(v ?? "");
  if (!s) return "Password is required.";
  if (!strong) return "";
  if (s.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return "Password must contain at least one letter and one number.";
  return "";
};
export const vPincode = (v, { required = false } = {}) => {
  if (!String(v ?? "").trim()) return required ? "Pincode is required." : "";
  return /^\d{6}$/.test(v) ? "" : "Pincode must be exactly 6 digits.";
};

/**
 * Runs [[field, message], ...] and returns { fields: [names that failed], first: message }.
 * Empty messages are skipped.
 */
export function collect(checks) {
  const bad = checks.filter(([, msg]) => msg);
  return { fields: bad.map(([f]) => f), first: bad[0]?.[1] || "", messages: bad.map(([, m]) => m) };
}

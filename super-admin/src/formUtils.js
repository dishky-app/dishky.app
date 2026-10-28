/**
 * formUtils — small input helpers shared by every form (same file in the
 * Super Admin console and the Developer Panel).
 *
 *   toTitleCase("jOHN   doe ")  -> "JOHN Doe "   (first letter of each word upper-cased, the rest untouched; one trailing space is kept so typing a 2nd word works)
 *   digitsOnly10("98a76-54321") -> "9876543210"   (digits only, max 10)
 *   isValidMobile("9876543210") -> true
 *   isValidEmail("a@b.co")      -> true
 */
export const toTitleCase = (value) => {
  const s = String(value ?? "").replace(/\s+/g, " ").replace(/^\s/, "");
  // Only the first letter of each word is forced to upper case; the rest is left as typed, so GTR, MRK, McDonald stay intact.
  return s.replace(/(^|[\s'’-])([^\s'’-])/g, (_, sep, first) => sep + first.toUpperCase());
};

export const digitsOnly10 = (value) => String(value ?? "").replace(/\D/g, "").slice(0, 10);

export const isValidMobile = (value) => /^\d{10}$/.test(String(value ?? ""));

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value ?? "").trim());

export const MOBILE_ERROR = "Enter a valid 10-digit mobile number.";

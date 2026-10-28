/**
 * Shared date/time display formatting for the User Panel.
 * Mirrors admin/src/utils/dateUtils.js so both panels show dates and
 * times the same way everywhere except the custom pickers themselves
 * (UserDatePicker, UserTimePicker), which keep their own internal
 * formatting. This only changes what's shown on screen — values sent
 * to/from the database stay in their existing ISO / "HH:MM" shape.
 */

const pad = (n) => String(n).padStart(2, "0");

/**
 * Format an ISO date string (or "YYYY-MM-DD") → "31-07-2026" (DD-MM-YYYY).
 * Returns "—" for falsy/unparseable input.
 */
export const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
};

/**
 * Format a "HH:MM" (24-hour) string → "2:15 PM" (Indian 12-hour, no
 * leading zero on the hour). Returns "—" for falsy input.
 */
export const fmtTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "—";
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
};

/**
 * Format an ISO datetime string → "13-06-2026, 02:15 PM"
 * (DD-MM-YYYY + Indian 12-hour time). Returns "—" for falsy input.
 */
export const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${fmtDate(iso)}, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
};

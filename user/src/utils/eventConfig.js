/**
 * eventConfig.js
 * ─────────────────────────────────────────────────────────────
 * Shared event vocabulary + attendee / family helpers.
 * Kept byte-identical in admin/src/utils and user/src/utils so the
 * two apps always agree on event types and booking shape.
 *
 * BOOKING SHAPE (eventBookings)
 *   guests     total persons  (= male + female + third)  – kept for
 *              capacity / pricing code that already reads `guests`
 *   attendees  { male, female, third,                    ← gender split, must add up to `guests`
 *                kids, seniors, physicallyChallenged }   ← each person is in at most one of these,
 *                                                           so kids + seniors + physicallyChallenged ≤ guests
 *
 * Older bookings only have `guests`; normalizeAttendees() reports
 * those as "not specified" instead of guessing a split.
 */

// ─── Event types (no weddings / catering / celebrations) ─────────────────────
export const EVENT_TYPES = [
  { id: "concert", label: "Live Concert", gradient: "linear-gradient(135deg,#7c3aed,#db2777)" },
  { id: "singalong", label: "Sing-Along", gradient: "linear-gradient(135deg,#f59e0b,#ef4444)" },
  { id: "carnival", label: "Carnival", gradient: "linear-gradient(135deg,#16a34a,#65a30d)" },
  { id: "cultural", label: "Cultural Night", gradient: "linear-gradient(135deg,#8b5cf6,#ec4899)" },
  { id: "openmic", label: "Open Mic & Comedy", gradient: "linear-gradient(135deg,#1e40af,#0891b2)" },
  { id: "workshop", label: "Workshop", gradient: "linear-gradient(135deg,#0891b2,#0d9488)" },
  { id: "screening", label: "Movie Night", gradient: "linear-gradient(135deg,#334155,#0f172a)" },
];

// Types used by events created before this change. They still render, but
// are no longer offered when creating a new event.
const LEGACY_TYPE_LABEL = {
  dining: "Dining Experience", special: "Special Event", private: "Private Event",
  seasonal: "Seasonal Special", live: "Live Entertainment",
};
const FALLBACK_GRADIENT = "linear-gradient(135deg,#8b5cf6,#ec4899)";

export const eventTypeLabel = (type) =>
  EVENT_TYPES.find((t) => t.id === type)?.label || LEGACY_TYPE_LABEL[type] || type || "Event";

export const eventTypeGradient = (type) =>
  EVENT_TYPES.find((t) => t.id === type)?.gradient || FALLBACK_GRADIENT;

// ─── Attendee breakdown ──────────────────────────────────────────────────────
export const GENDER_FIELDS = [
  { key: "male", label: "Male" },
  { key: "female", label: "Female" },
  { key: "third", label: "Third gender" },
];
export const GROUP_FIELDS = [
  { key: "kids", label: "Kids", hint: "under 12" },
  { key: "seniors", label: "Elderly", hint: "60+" },
  { key: "physicallyChallenged", label: "Physically challenged", hint: "" },
];
export const EMPTY_ATTENDEES = { male: 1, female: 0, third: 0, kids: 0, seniors: 0, physicallyChallenged: 0 };

const n = (v) => Math.max(0, Math.floor(Number(v) || 0));

export const attendeeTotal = (a = {}) => n(a.male) + n(a.female) + n(a.third);

/** Kids + elderly + physically challenged, counted together. */
export const groupsTotal = (a = {}) => n(a.kids) + n(a.seniors) + n(a.physicallyChallenged);

/**
 * Returns an error message, or null when the breakdown is valid.
 * Kids, elderly and physically challenged are people taken out of the gender
 * total, and a person is counted in only one of them — so together they can
 * never be more than the total (2 male + 2 female = 4 → at most 4 across all three).
 */
export const validateAttendees = (a = {}) => {
  const total = attendeeTotal(a);
  if (total < 1) return "Add at least one person (male, female or third gender).";
  const groups = groupsTotal(a);
  if (groups > total)
    return `Kids, elderly and physically challenged add up to ${groups}, which is more than the ${total} person${total !== 1 ? "s" : ""} booked.`;
  return null;
};

/** Clean numeric copy that is safe to store. */
export const cleanAttendees = (a = {}) => ({
  male: n(a.male), female: n(a.female), third: n(a.third),
  kids: n(a.kids), seniors: n(a.seniors), physicallyChallenged: n(a.physicallyChallenged),
});

/**
 * Normalised breakdown for any booking, old or new.
 * `unspecified` is only > 0 for legacy bookings that stored just `guests`.
 */
export const normalizeAttendees = (b = {}) => {
  const a = b.attendees;
  if (a && typeof a === "object") {
    const c = cleanAttendees(a);
    return { ...c, unspecified: Math.max(0, n(b.guests) - attendeeTotal(c)) };
  }
  return { male: 0, female: 0, third: 0, kids: 0, seniors: 0, physicallyChallenged: 0, unspecified: n(b.guests) || 1 };
};

/** "2 M · 1 F · 1 TG" style summary, or "Not specified". */
export const genderSummary = (att) => {
  const parts = [];
  if (att.male) parts.push(`${att.male} M`);
  if (att.female) parts.push(`${att.female} F`);
  if (att.third) parts.push(`${att.third} TG`);
  if (att.unspecified) parts.push(`${att.unspecified} not specified`);
  return parts.join(" · ") || "—";
};

export const groupSummary = (att) => {
  const parts = [];
  if (att.kids) parts.push(`${att.kids} kid${att.kids > 1 ? "s" : ""}`);
  if (att.seniors) parts.push(`${att.seniors} elderly`);
  if (att.physicallyChallenged) parts.push(`${att.physicallyChallenged} physically challenged`);
  return parts.join(" · ") || "—";
};

// ─── Family grouping ─────────────────────────────────────────────────────────
const phoneKey = (p) => String(p || "").replace(/\D/g, "").slice(-10);

/**
 * Every booking made from one account (or one guest account) is one family.
 * Key order: userId → phone → email → name. Bookings added by an admin have
 * no userId, so one that shares a phone number with an account booking on
 * the same event joins that account's family.
 *
 * Cancelled bookings stay in the family's `bookings` list (so the history is
 * complete) but are left out of its persons / amount totals.
 *
 * @returns {Map<string, Family[]>} eventId → families, numbered 1..n by first booking time
 */
export const groupFamiliesByEvent = (bookings = []) => {
  const byEvent = new Map();
  bookings.forEach((b) => {
    const k = b.eventId || "unknown";
    if (!byEvent.has(k)) byEvent.set(k, []);
    byEvent.get(k).push(b);
  });

  const out = new Map();
  byEvent.forEach((list, eventId) => {
    const phoneToUser = new Map();
    list.forEach((b) => { if (b.userId && phoneKey(b.phone)) phoneToUser.set(phoneKey(b.phone), `u:${b.userId}`); });

    const fam = new Map();
    list.forEach((b) => {
      const ph = phoneKey(b.phone);
      const key = b.userId ? `u:${b.userId}`
        : ph && phoneToUser.has(ph) ? phoneToUser.get(ph)
        : ph ? `p:${ph}`
        : b.email ? `e:${String(b.email).toLowerCase()}`
        : `n:${String(b.name || b.id).toLowerCase()}`;
      if (!fam.has(key)) fam.set(key, { key, eventId, bookings: [] });
      fam.get(key).bookings.push(b);
    });

    const families = [...fam.values()].map((f) => {
      f.bookings.sort((a, b) => String(a.bookedAt || a.createdAt || "").localeCompare(String(b.bookedAt || b.createdAt || "")));
      const head = f.bookings[0];
      const active = f.bookings.filter((b) => b.status !== "cancelled");
      const tot = { male: 0, female: 0, third: 0, unspecified: 0, kids: 0, seniors: 0, physicallyChallenged: 0 };
      let persons = 0, amount = 0;
      active.forEach((b) => {
        const a = normalizeAttendees(b);
        Object.keys(tot).forEach((k) => { tot[k] += a[k]; });
        persons += n(b.guests) || 1;
        amount += Number(b.totalAmount) || 0;
      });
      return {
        ...f,
        head: head.name || "—",
        phone: head.phone || "",
        email: head.email || "",
        isAccount: f.key.startsWith("u:"),
        persons, amount, ...tot,
        activeCount: active.length,
        status: active.length === 0 ? "cancelled" : active.every((b) => b.status === "confirmed") ? "confirmed" : "pending",
        firstBookedAt: head.bookedAt || head.createdAt || "",
      };
    });
    families.sort((a, b) => String(a.firstBookedAt).localeCompare(String(b.firstBookedAt)));
    families.forEach((f, i) => { f.no = i + 1; });
    out.set(eventId, families);
  });
  return out;
};

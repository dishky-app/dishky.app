/**
 * guestInput.js — sanitisers for data that unauthenticated guests (customer app) can send
 * and that the server then re-broadcasts or acts on.
 */

/* ── table bell (Socket.IO "bell-ring" / "bell-off") ── */
const MAX_ACTIVE_BELLS_PER_RESTAURANT = 500;

/**
 * Bell payloads come from unauthenticated guest sockets and are re-broadcast to every
 * staff and guest screen of the restaurant, so they are reduced to plain short strings:
 * an object/array tableNo would otherwise reach other clients' React trees, a "|" would
 * corrupt the `rid|venue|table` key, and unbounded distinct values would grow the map forever.
 * Returns { tableNo, venueId } or null when the payload is unusable.
 */
function cleanBellPayload(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const raw = p.tableNo;
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const tableNo = String(raw).trim();
  if (!tableNo || tableNo.length > 20 || tableNo.includes("|")) return null;
  const v = typeof p.venueId === "string" && p.venueId.length <= 64 && !p.venueId.includes("|") ? p.venueId : null;
  return { tableNo, venueId: v };
}

/* ── order item ingredients (POST /orders) ── */
const MAX_INGREDIENTS_PER_ITEM = 60;
// Not a business rule: bulk/catering items legitimately use tens of kg per portion (stock is still clamped at 0
// by the order route). This only rejects absurd values and non-finite numbers.
const MAX_INGREDIENT_GRAMS_PER_PORTION = 1_000_000;

/**
 * Guest-supplied `item.ingredients` drive the server-side stock deduction after an order,
 * so they are reduced to a bounded list of { name: string, quantity: positive finite grams }.
 * NOTE: names/quantities are still client-supplied; deriving them from the dish catalogue
 * server-side is the complete fix (see audit backlog).
 */
function sanitizeOrderIngredients(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const ing of raw.slice(0, MAX_INGREDIENTS_PER_ITEM)) {
    if (!ing || typeof ing.name !== "string") continue;
    const name = ing.name.trim().slice(0, 120);
    const quantity = Number(ing.quantity);
    if (!name || !Number.isFinite(quantity) || quantity <= 0) continue;
    out.push({ ...ing, name, quantity: Math.min(quantity, MAX_INGREDIENT_GRAMS_PER_PORTION) });
  }
  return out;
}

module.exports = {
  MAX_ACTIVE_BELLS_PER_RESTAURANT,
  MAX_INGREDIENTS_PER_ITEM,
  MAX_INGREDIENT_GRAMS_PER_PORTION,
  cleanBellPayload,
  sanitizeOrderIngredients,
};

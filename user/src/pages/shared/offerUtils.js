/**
 * shared/offerUtils.js — user panel
 * Single source of truth for "is this dish currently on offer, and what
 * should it cost". Mirrors the exact validity check used in the admin
 * Offers page / OffersGrid: active === "yes" AND today falls inside
 * [startDate, endDate].
 */

/** Today as YYYY-MM-DD, matching the offer's startDate/endDate format. */
const todayStr = () => new Date().toISOString().split("T")[0];

/** Returns the currently-active offer for a dish, or null if none applies. */
export const getActiveOffer = (dishId, offers = []) => {
  if (!dishId) return null;
  const today = todayStr();
  return (
    (offers || []).find(
      (o) =>
        o.dishId === dishId &&
        o.active === "yes" &&
        o.startDate <= today &&
        o.endDate >= today
    ) || null
  );
};

/** The price to actually charge/display for a dish's base price, given
 *  its (possibly null) active offer. Uses the admin's precomputed
 *  offerPrice directly so it always matches what's shown in the admin
 *  panel, rather than re-deriving it from the percentage. */
export const getEffectiveBasePrice = (basePrice, offer) =>
  offer ? Number(offer.offerPrice) : Number(basePrice || 0);

/** For flattened/already-customized totals (e.g. a saved favourite) where
 *  we only have one combined number and no separate base/add-on split,
 *  apply the offer's percentage directly to that total instead. */
export const getDiscountedTotal = (total, offer) =>
  offer ? Math.round(Number(total || 0) * (1 - Number(offer.percentage || 0) / 100)) : Number(total || 0);

/** Stamps unitPrice/totalPrice + appliedOffer metadata (percentage +
 *  original price, same shape OffersGrid already uses) onto a bag item.
 *  Pass the item's already-computed unitPrice as `originalUnitPrice` —
 *  the discount is applied against whatever price the page had settled
 *  on (base, or base + customization), not blindly against offer.offerPrice,
 *  so customized dishes still get their add-on cost included. */
export const applyOfferToBagItem = (item, offer, originalUnitPrice) => {
  if (!offer) return item;
  const qty = Number(item.quantity) || 1;
  const baseUnit = Number(originalUnitPrice ?? item.unitPrice ?? 0);
  const discountedUnit = Math.round(baseUnit * (1 - Number(offer.percentage || 0) / 100));

  return {
    ...item,
    unitPrice: discountedUnit,
    totalPrice: discountedUnit * qty,
    appliedOffer: {
      percentage: offer.percentage,
      originalPrice: baseUnit
    }
  };
};

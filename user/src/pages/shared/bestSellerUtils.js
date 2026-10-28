/**
 * bestSellerUtils.js — shared helper for tagging a category's best-selling
 * dish on FoodGridList / FoodList / FoodListExpanded.
 *
 * This is deliberately scoped differently from BestSellers.js's own
 * deriveBestSellers(): that page finds ONE best dish per TOP-LEVEL
 * category (for its own dedicated cross-category page). Here, each of
 * these three pages is already showing a single category/sub-category's
 * dish list, so we just need the best seller WITHIN that already-scoped
 * list — same 7-day window and quantity-sum logic, narrower input.
 */

/**
 * @param {Array} dishes - the dish list currently being rendered on the page
 * @param {Array} orders - foodData.orders
 * @returns {string|null} the id of the best-selling dish in `dishes` over
 *   the last 7 days, or null if no dish in the list sold anything in that
 *   window.
 */
export function getBestSellerId(dishes, orders) {
  if (!Array.isArray(dishes) || dishes.length === 0) return null;
  if (!Array.isArray(orders) || orders.length === 0) return null;

  const dishIds = new Set(dishes.map((d) => d.id));

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const countByDish = new Map();

  for (const order of orders) {
    const orderDate = new Date(order.date || order.createdAt);
    if (isNaN(orderDate) || orderDate < weekAgo || orderDate > now) continue;

    for (const item of order.items || []) {
      const dishId = item.dishId || item.id;
      if (!dishId || !dishIds.has(dishId)) continue;
      const qty = item.quantity || 1;
      countByDish.set(dishId, (countByDish.get(dishId) || 0) + qty);
    }
  }

  let bestId = null;
  let bestCount = 0;
  for (const [dishId, count] of countByDish.entries()) {
    if (count > bestCount) {
      bestCount = count;
      bestId = dishId;
    }
  }

  return bestId;
}

export default getBestSellerId;

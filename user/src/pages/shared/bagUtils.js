/**
 * bagUtils
 * --------
 * Shared helpers for working with the shopping bag/cart, used by
 * FloatingBag, ThankYou, FoodList, FoodGridList, FoodListExpanded,
 * AppetizerBuilder, FavouriteCombo, FavouriteDishDetail, etc.
 */

/** Per-unit price of a bag line — combos use perComboFinalPrice, everything else uses unitPrice. */
export const getUnitPrice = (item) =>
  item?.isCombo ? Number(item.perComboFinalPrice || 0) : Number(item?.unitPrice || 0);

/** Total price for a bag line (unit price * quantity). */
export const getLineTotal = (item) => getUnitPrice(item) * Number(item?.quantity || 0);

/** Sum of getLineTotal across every line in the bag. */
export const getBagSubtotal = (bag) =>
  (Array.isArray(bag) ? bag : []).reduce((sum, item) => sum + getLineTotal(item), 0);

/** Total quantity of items in the bag. */
export const getBagItemCount = (bag) =>
  (Array.isArray(bag) ? bag : []).reduce((sum, item) => sum + Number(item?.quantity || 0), 0);

/**
 * Default grouping key: combos are grouped by id + comboItems signature,
 * regular dishes by id + customizationKey + customized flag.
 * (Used by FloatingBag.)
 */
export const defaultBagKey = (item) =>
  item.isCombo
    ? `${item.id}__${JSON.stringify(item.comboItems)}`
    : [item.id, item.customizationKey || "", item.isCustomized ? "custom" : "normal"].join("__");

/**
 * Alternate grouping key based on selectedSize + notes instead of
 * customizationKey. (Used by ThankYou.)
 */
export const sizeNotesBagKey = (item) =>
  [item.id, item.selectedSize || "", item.notes || "", item.isCustomized ? "custom" : "normal"].join("__");

/**
 * Groups bag line items that represent "the same thing" together,
 * summing their quantity/totalPrice and tracking the original
 * indices of each merged line (needed for +/- qty buttons and
 * edit/delete actions that operate on the raw bag array).
 *
 * @param {Array} bag    - raw bag array
 * @param {Function} keyFn - grouping key function (defaults to defaultBagKey)
 * @returns {Array} grouped items, each with an extra `indices: number[]`
 */
export const groupBagItems = (bag, keyFn = defaultBagKey) => {
  const safeBag = Array.isArray(bag) ? bag : [];

  return Object.values(
    safeBag.reduce((acc, item, index) => {
      const key = keyFn(item);

      if (!acc[key]) {
        acc[key] = { ...item, indices: [index] };
      } else {
        acc[key].quantity += item.quantity;
        acc[key].totalPrice += item.totalPrice;
        acc[key].indices.push(index);
      }

      return acc;
    }, {})
  );
};

/**
 * Builds a standard "add a plain (non-customized) dish to the bag" payload.
 * Pass `overrides` for anything dish-specific (selectedSize, notes, etc.)
 *
 * Example:
 *   addToBag(buildDishBagItem(dish, categoryId));
 *   addToBag(buildDishBagItem(dish, categoryId, { __pendingImage: true }));
 */
export const buildDishBagItem = (dish, categoryId, overrides = {}) => ({
  id: dish.id,
  name: dish.name,
  image: dish.image,
  categoryId,
  quantity: 1,
  unitPrice: dish.basePrice,
  totalPrice: dish.basePrice,
  isCustomized: false,
  notes: "",
  ...overrides
});

/**
 * Strips the "Customized " prefix from "Customized Make Your Own ..." dish
 * names so they display as "Make Your Own ..." in receipts/order summaries.
 */
export const stripCustomizedPrefix = (name) =>
  name?.startsWith("Customized Make Your Own")
    ? name.replace("Customized ", "")
    : name;

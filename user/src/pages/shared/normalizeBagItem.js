/**
 * normalizeBagItem
 * -----------------
 * Converts a raw "add to bag" payload (from any page — FoodList, ComboPage,
 * FavouriteCombo, customization screens, etc.) into the canonical bag item
 * shape stored in App's `bag` state.
 *
 * Extracted from App.js so the bag-shaping business logic can be tested and
 * reused independently of the component tree.
 */

/** Finds the category (or sub-category) that contains a dish with the given id. */
export const findCategoryByDish = (foodData, dishId) => {
  for (const cat of foodData.categories) {
    if (Array.isArray(cat.dishes) && cat.dishes.some(d => d.id === dishId)) {
      return cat;
    }

    if (Array.isArray(cat.subCategories)) {
      for (const sub of cat.subCategories) {
        if (Array.isArray(sub.dishes) && sub.dishes.some(d => d.id === dishId)) {
          return sub;
        }
      }
    }
  }

  return null;
};

/** Order-independent signature for an ingredient list, used to detect duplicate customizations. */
export const ingredientSignature = (ings = []) =>
  ings
    .map(i => `${i.name}:${i.quantity}`)
    .sort()
    .join("|");

export const normalizeBagItem = (rawItem, foodData) => {
  // ✅ HANDLE COMBO FIRST
  if (rawItem.isCombo) {
    const quantity = Number(rawItem.quantity || 1);
    const unitPrice = Number(rawItem.perComboFinalPrice || rawItem.unitPrice || 0);

    return {
      id: rawItem.id,
      name: rawItem.name,
      image:
        rawItem.comboItems?.main?.image ||
        rawItem.comboItems?.starter?.image ||
        rawItem.comboItems?.drink?.image ||
        "",
      categoryId: "combo",

      isCombo: true,
      comboItems: rawItem.comboItems || {},

      quantity,
      unitPrice,
      perComboFinalPrice: unitPrice,
      totalPrice: unitPrice * quantity,

      status: "placed",
      selectedSize: "regular",
      notes: "",
      ingredients: [],
      createdAt: new Date().toISOString()
    };
  }

  const category =
    foodData.categories.find(c => c.id === rawItem.categoryId) ||
    findCategoryByDish(foodData, rawItem.id);

  const dish =
    (Array.isArray(category?.dishes)
      ? category.dishes.find(d => d.id === rawItem.id)
      : null) || {};

  const defaultSize =
    category?.sizes?.[0]?.name?.toLowerCase() || "regular";

  const quantity = Number(rawItem.quantity || 1);
  const unitPrice = Number(rawItem.unitPrice || dish.basePrice || 0);
  const baseIngredients =
    Array.isArray(rawItem.ingredients) && rawItem.ingredients.length > 0
      ? rawItem.ingredients
      : (dish.ingredients || []).map(i => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        pricePer100g: i.pricePer100g || 0,
        totalPrice: 0
      }));

  return {
    id: rawItem.id,
    name: rawItem.name || dish.name,
    image: rawItem.image || dish.image,
    categoryId: category?.id || rawItem.categoryId,

    quantity,
    unitPrice,
    totalPrice: unitPrice * quantity,

    status: "placed",
    isCustomized: !!rawItem.isCustomized,
    selectedSize: rawItem.selectedSize || defaultSize,
    notes: rawItem.notes || "",
    ingredients: baseIngredients,
    createdAt: new Date().toISOString(),
    pickupAt: null
  };
};

/**
 * Finds the index of an existing bag entry that represents "the same thing"
 * as `item` (same dish/combo, same customization, size and notes), so a
 * repeat add-to-bag can merge quantities instead of creating a duplicate row.
 */
export const findMatchingBagIndex = (bag, item) =>
  bag.findIndex(p =>
    p.id === item.id &&
    p.isCombo === item.isCombo &&
    JSON.stringify(p.comboItems) === JSON.stringify(item.comboItems) &&
    p.selectedSize === item.selectedSize &&
    p.isCustomized === item.isCustomized &&
    ingredientSignature(p.ingredients) === ingredientSignature(item.ingredients) &&
    (p.notes || "") === (item.notes || "")
  );

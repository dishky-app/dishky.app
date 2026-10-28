import React from "react";
import vegIcon from "../../assets/icons/veg-icon.png";
import nonVegIcon from "../../assets/icons/non-veg-icon.png";

/**
 * VegBadge — small square veg/non-veg indicator (the standard Indian
 * green-dot / red-dot symbol) used on dish cards across FoodGridList,
 * FoodList, and FoodListExpanded.
 *
 * `isVeg` follows the same convention already used in the admin panel's
 * Dishes/DishDetails pages: `isVeg === false` means non-veg, anything
 * else (true, undefined, missing) defaults to veg — so dishes created
 * before this field existed still render sensibly.
 */
const VegBadge = ({ isVeg, className = "" }) => (
  <img
    src={isVeg === false ? nonVegIcon : vegIcon}
    alt={isVeg === false ? "Non-Veg" : "Veg"}
    className={`veg-icon-badge ${className}`}
  />
);

export default VegBadge;

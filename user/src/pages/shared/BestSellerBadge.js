import React from "react";
import "./BestSellerBadge.css";
import bestSellerBadge from "../../assets/best-seller.png";

/**
 * BestSellerBadge — Best Seller indicator used across FoodGridList,
 * FoodList, and FoodListExpanded.
 *
 *  - "rosette" — the round medal ribbon image, used on FoodGridList's
 *    card corner (top-right).
 *  - "ribbon"  — the angled arrow banner (crown icon | "BEST SELLER"),
 *    used inline next to the dish name on FoodList and
 *    FoodListExpanded. Built with pure CSS/SVG instead of an image so
 *    it scales crisply at any size and recolors with the theme's
 *    --color-red variable for free.
 */
const BestSellerBadge = ({ variant = "rosette", className = "" }) => {
  if (variant === "ribbon") {
    return (
      <span className={`best-seller-ribbon ${className}`}>
        <svg
          className="best-seller-ribbon-crown"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M3 8.5l4 2.3L12 5l5 5.8 4-2.3-1.6 8.8a1 1 0 01-1 .82H5.6a1 1 0 01-1-.82L3 8.5z" />
          <circle cx="3" cy="7" r="1.6" />
          <circle cx="12" cy="4" r="1.6" />
          <circle cx="21" cy="7" r="1.6" />
        </svg>
        <span className="best-seller-ribbon-divider" aria-hidden="true" />
        <span className="best-seller-ribbon-text">Best Seller</span>
      </span>
    );
  }

  return (
    <img
      src={bestSellerBadge}
      alt="Best Seller"
      className={`best-seller-badge best-seller-badge--rosette ${className}`}
    />
  );
};

export default BestSellerBadge;
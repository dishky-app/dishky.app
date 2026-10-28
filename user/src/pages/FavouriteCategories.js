import React from "react";
import { Link, useParams } from "react-router-dom";
import "./FoodCategory.css";
import "./FavouriteCategories.css";
import HomeButton from "./shared/HomeButton";
import PageHeader from "./shared/PageHeader";
import { handleImgFallback } from "../App";

const FavouriteCategories = ({
  foodData,
  currentUser,
  handleBack,
  handleHome
}) => {
  const { source } = useParams(); // "my" | "others"

  // 🔒 HARD BLOCK MY FAVOURITES FOR GUESTS
  if (source === "my" && !currentUser) {
    return null; // route is already protected, this is safety
  }

  const favourites =
    source === "my"
      ? currentUser?.favourites || []
      : foodData.favourites || [];

  // 🔧 FIX: filter invalid data
  const validFavourites = favourites.filter(
    (dish) => dish.categoryId
  );

  const grouped = validFavourites.reduce((acc, dish) => {
    acc[dish.categoryId] = acc[dish.categoryId] || [];
    acc[dish.categoryId].push(dish);
    return acc;
  }, {});

  const findCategoryOrSubCategory = (id) => {
    for (const cat of foodData.categories) {
      if (cat.id === id) return cat;
      const sub = (cat.subCategories || []).find((s) => s.id === id);
      if (sub) return sub;
    }
    return null;
  };

  const categories = Object.keys(grouped)
    .map((id) => findCategoryOrSubCategory(id))
    .filter(Boolean);

  return (
    <div className="no-padding">
      <PageHeader title="Favourites" onBack={handleBack} onHome={handleHome} />

      <div className="pl-body">
        <div className="food-category-container">
          {categories.length === 0 && (
            <div className="fav-empty fav-empty-page">
              <div className="fav-empty-icon">🍽️</div>
              <h3 className="fav-empty-title">No favourite categories yet</h3>
              <p className="fav-empty-sub">Dishes you favourite will show up here, grouped by category.</p>
            </div>
          )}

          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/favourites/${source}/category/${category.id}`}
              className="food-category-items"
            >
              <div className="food-category-image">
                <img src={category.image} alt={category.name} loading="lazy" decoding="async" onError={handleImgFallback} />
              </div>
              <div className="food-category-name">
                {category.name}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FavouriteCategories;
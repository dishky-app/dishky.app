import React from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import "./FavouriteDishDetail.css";
import { handleImgFallback } from "../App";
import caloriesIcon from "../assets/icons/calorie.png";
import proteinIcon from "../assets/icons/protein.png";
import fibreIcon from "../assets/icons/fiber.png";
import fatIcon from "../assets/icons/fat.png";
import { flyToBag } from "../components/flyToBag";
import PageHeader from "./shared/PageHeader";
import Button3D from "./shared/Button3D";
import { getActiveOffer, getDiscountedTotal } from "./shared/offerUtils";
import { useIsBelowWidth } from "./shared/useIsBelowWidth";

const NUTRITION_FIELDS = [
  [caloriesIcon, "Calories", "calories", "kcal"],
  [proteinIcon, "Protein", "protein", "g"],
  [fibreIcon, "Fibre", "fibre", "g"],
  [fatIcon, "Fat", "fat", "g"]
];

const FavouriteDishDetail = ({ foodData, addToBag, handleBack, handleHome, currentUser }) => {
  const { dishId, source } = useParams();
  const navigate = useNavigate();
  const isFixedActionsBar = useIsBelowWidth(576);

  // 🔒 Only block "my" favourites for guests
  if (source === "my" && !currentUser) {
    return null;
  }

  // ── Resolve dish ────────────────────────────────────────────────────────
  // "my"     → look in currentUser.favourites
  // "others" → look in foodData.favourites first, then scan all categories
  //            (crowd-picks / promo navigation sends dishes that may only
  //             exist in the menu, not yet in the favourites collection)
  let dish = null;

  if (source === "my") {
    dish = currentUser?.favourites?.find((d) => d.id === dishId) || null;
  } else {
    // 1. Check shared favourites list
    dish = foodData.favourites?.find((d) => d.id === dishId) || null;

    // 2. Fall back: scan all categories + subCategories
    if (!dish) {
      for (const cat of foodData.categories || []) {
        const found = cat.dishes?.find(d => d.id === dishId);
        if (found) { dish = { ...found, categoryId: cat.id }; break; }
        for (const sub of cat.subCategories || []) {
          const foundSub = sub.dishes?.find(d => d.id === dishId);
          if (foundSub) { dish = { ...foundSub, categoryId: sub.id }; break; }
        }
        if (dish) break;
      }
    }
  }

  if (!dish) {
    return (
      <div className="no-padding">
        <PageHeader
          title="Dish not found"
          wrapperClassName="food-header"
          titleClassName="food-list-title"
          onBack={handleBack}
          onHome={handleHome}
        />
        <div className="pl-body food-list">
          <div className="fav-empty fav-empty-page">
            <div className="fav-empty-icon">🍽️</div>
            <h3 className="fav-empty-title">Dish not found</h3>
            <p className="fav-empty-sub">This dish may have been removed from your favourites.</p>
          </div>
        </div>
      </div>
    );
  }

  const visibleIngredients = (dish.ingredients || []).filter((ing) => {
    const full = foodData.ingredients.find(i => i.id === ing.id);

    if (!full) return true;

    const isGloballyDisabled = full.isDisabledGlobally === true;
    const isDisabledForDish =
      Array.isArray(full.disabledForDishes) &&
      full.disabledForDishes.includes(dish.id);

    return !(isGloballyDisabled || isDisabledForDish);
  });

  const visibleNutrition = NUTRITION_FIELDS.filter(
    ([, , key]) => dish.benefits?.[key] !== undefined
  );

  const dishPrice = Math.round(dish.totalPrice ?? dish.basePrice ?? 0);

  // Favourites store one flattened total (base + any saved customization),
  // so there's no separate "base" to discount — apply the offer's
  // percentage against the whole saved price instead.
  const activeOffer = getActiveOffer(dish.originalDishId || dish.id, foodData.offers);
  const discountedPrice = getDiscountedTotal(dishPrice, activeOffer);

  const handleAddToBag = () => {
    const img = document.querySelector(
      `.fav-image[data-fav-dish-id="${dish.id}"]`
    );

    const price = dish.totalPrice ?? dish.basePrice ?? 0;
    const finalPrice = activeOffer ? getDiscountedTotal(price, activeOffer) : price;
    addToBag({
      ...dish,
      quantity: 1,
      unitPrice: finalPrice,
      totalPrice: finalPrice,
      isCustomized: false,
      isFromFavourite: true,
      ...(activeOffer ? { appliedOffer: { percentage: activeOffer.percentage, originalPrice: price } } : {})
    });
    flyToBag({
      imgEl: img,
      dishId: dish.id
    });
  };

  return (
    <div className="no-padding">
      {/* HEADER – same as FoodList */}
      <PageHeader
        title={dish.name}
        titleTag="h2"
        titleClassName="fav-title"
        wrapperClassName="food-header"
        onBack={handleBack}
        onHome={handleHome}
      />

      <div className="pl-body food-list">
        <div className="fav-detail-container">
          {/* LEFT PANEL */}
          <div className="fav-left">
            <div className="fav-image-container">
              <img
                src={dish.image}
                alt={dish.name}
                className="fav-image"
                data-fav-dish-id={dish.id}
                onError={handleImgFallback}
              />
            </div>

            <div className="fav-name-header">
              <h2 className="fav-title">{dish.name}</h2>

              <div className="fav-price">
                {activeOffer ? (
                  <>
                    ₹{discountedPrice}
                    <span className="dish-price-original">₹{dishPrice}</span>
                    <span className="dish-price-offer-badge">{activeOffer.percentage}% OFF</span>
                  </>
                ) : (
                  <>₹{dishPrice}</>
                )}
              </div>
            </div>

            {dish.customerName && (
              <div className="fav-customer-name">
                Saved by {dish.customerName}
              </div>
            )}

            {dish.description && (
              <p className="fav-description">
                {dish.description}
              </p>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div className="fav-right">
            <div className="fav-ingredient-container">
              <h4>Add-ons</h4>
              <ul className="fav-ingredients-grid">
                {visibleIngredients.map((ing) => (
                  <li
                    key={ing.name}
                    className="fav-ingredient-item"
                    onClick={() => navigate(`/ingredient/${ing.id}`)}
                  >
                    <div className="fav-ingredient-img" />
                    <div className="fav-ingredient-info">
                      <div className="fav-ingredient-name">{ing.name}</div>
                      <div className="fav-ingredient-qty">{ing.quantity} g</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {dish.benefits && visibleNutrition.length > 0 && (
              <div className="fav-nutrition-container">
                <h4>Nutritional Benefits</h4>
                <div className="fav-nutrition">
                  {visibleNutrition.map(([icon, label, key, unit]) => (
                    <div className="fav-nutrition-item" key={label}>
                      <div className="fav-nutrition-image">
                        <img src={icon} alt={label} />
                      </div>

                      <div className="fav-nutrition-value">
                        {dish.benefits[key]} {unit}
                      </div>

                      <div className="fav-nutrition-name">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ACTIONS */}
            {(() => {
              const actionsBar = (
                <div className="fav-actions">
                  <Button3D
                    className="btn-3d green"
                    onClick={() =>
                      navigate(`/food/${dish.id}`, {
                        state: {
                          fromFavouriteCustomize: true,
                          favouriteSnapshot: dish,
                          categoryId: dish.categoryId,
                          dishId: dish.id
                        }
                      })
                    }
                  >
                    Customize
                  </Button3D>

                  <Button3D className="btn-3d red" onClick={handleAddToBag}>
                    Add to Bag
                  </Button3D>
                </div>
              );

              // Below 576px .fav-actions becomes position: fixed (see
              // FavouriteDishDetail.css). At that width it must not live
              // inside the route's animated .page-transition-wrapper:
              // Framer Motion applies a CSS transform to that wrapper
              // while a page transition plays, and a transformed
              // ancestor becomes the containing block for any
              // fixed-position descendant — so .fav-actions would
              // suddenly be "fixed" relative to the sliding wrapper
              // instead of the viewport, jumping/glitching on every page
              // enter and exit. Portalling it straight to document.body
              // keeps it anchored to the viewport regardless of what the
              // route transition is doing. Above 576px it's a normal
              // in-flow element, so it renders inline as before.
              return isFixedActionsBar
                ? createPortal(actionsBar, document.body)
                : actionsBar;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FavouriteDishDetail;
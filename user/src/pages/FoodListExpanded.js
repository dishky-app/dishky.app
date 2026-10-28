import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "./FoodList.css"; // reuse same styles
import "./FoodListExpanded.css";
import AnimatedPrice from "./AnimatedPrice";
import IngredientsCarousel from "./IngredientsCarousel";
import caloriesIcon from "../assets/icons/calorie.png";
import proteinIcon from "../assets/icons/protein.png";
import { handleImgFallback } from "../App";
import fibreIcon from "../assets/icons/fiber.png";
import fatIcon from "../assets/icons/fat.png";
import { flyToBag } from "../components/flyToBag";
import PageHeader from "./shared/PageHeader";
import Button3D from "./shared/Button3D";
import { buildDishBagItem } from "./shared/bagUtils";
import { getActiveOffer, applyOfferToBagItem } from "./shared/offerUtils";
import WishlistButton from "./shared/WishlistButton";
import VegBadge from "./shared/VegBadge";
import BestSellerBadge from "./shared/BestSellerBadge";
import { getBestSellerId } from "./shared/bestSellerUtils";
import { useIsBelowWidth } from "./shared/useIsBelowWidth";

/* 🔁 SAME animation config */
const SOFT_SPRING = {
  type: "spring",
  stiffness: 90,
  damping: 22,
  mass: 1.2
};

const SLOW_SPRING = {
  type: "spring",
  stiffness: 55,
  damping: 26,
  mass: 1.4
};

const DETAIL_VARIANTS = {
  hidden: {
    y: 60,
    opacity: 0,
    filter: "blur(10px)"
  },
  show: {
    y: 0,
    opacity: 1,
    filter: "blur(0px)"
  }
};

const NUTRITION_FIELDS = [
  [caloriesIcon, "Calories", "calories", "kcal"],
  [proteinIcon, "protien", "protein", "g"],
  [fibreIcon, "fibre", "fibre", "g"],
  [fatIcon, "Fat", "fat", "g"]
];

const FoodListExpanded = ({ foodData, addToBag, handleHome, handleBack, currentUser, onToggleFavourite }) => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { dishId } = state || {};
  const isFixedBtnSection = useIsBelowWidth(576);

  // ── Resolve category + dish ──────────────────────────────────────────────
  // categoryId is optional in state — we resolve it by searching all categories
  // so navigation from PromoCard / Popular Dishes only needs to pass dishId.
  let category = null;
  let dish = null;

  // 1. Try exact categoryId match if provided
  if (state?.categoryId) {
    category = foodData.categories.find(c => c.id === state.categoryId);
    if (!category) {
      for (const cat of foodData.categories) {
        const sub = cat.subCategories?.find(s => s.id === state.categoryId);
        if (sub) { category = sub; break; }
      }
    }
    dish = category?.dishes?.find(d => d.id === dishId);
  }

  // 2. If categoryId not provided or dish not found yet — scan all categories by dishId
  if (!dish && dishId) {
    for (const cat of foodData.categories) {
      const found = cat.dishes?.find(d => d.id === dishId);
      if (found) { category = cat; dish = found; break; }
      for (const sub of cat.subCategories || []) {
        const foundSub = sub.dishes?.find(d => d.id === dishId);
        if (foundSub) { category = sub; dish = foundSub; break; }
      }
      if (dish) break;
    }
  }

  // 3. Also check foodData.favourites (crowd picks / my favs may have enriched copies)
  if (!dish && dishId && foodData.favourites) {
    dish = foodData.favourites.find(d => d.id === dishId);
    if (dish && !category) {
      category = foodData.categories.find(c => c.id === dish.categoryId);
    }
  }

  const resolvedCategoryId = category?.id || state?.categoryId || dish?.categoryId;

  const [steps, setSteps] = useState(["hidden", "hidden", "hidden", "hidden"]);

  /* 🔁 SAME stagger logic */
  useEffect(() => {
    setSteps(["hidden", "hidden", "hidden", "hidden"]);
    setTimeout(() => setSteps(["show", "hidden", "hidden", "hidden"]), 180);
    setTimeout(() => setSteps(["show", "show", "hidden", "hidden"]), 360);
    setTimeout(() => setSteps(["show", "show", "show", "hidden"]), 540);
    setTimeout(() => setSteps(["show", "show", "show", "show"]), 720);
  }, [dishId]);

  // Redirect only if we genuinely have no dishId at all
  useEffect(() => {
    if (!dishId) {
      navigate("/categories", { replace: true });
    }
  }, [dishId, navigate]);

  if (!dish) return null;

  const bestSellerId = getBestSellerId(category?.dishes || [], foodData?.orders);

  const filteredIngredients = (dish.ingredients || []).filter((ing) => {
    const full = foodData.ingredients.find(i =>
      i.id === ing.id ||
      i.name === ing.name
    );

    // If ingredient not found in master list → allow it
    if (!full) return true;

    // Treat undefined as false
    const isGloballyDisabled = full.isDisabledGlobally === true;
    const isDisabledForDish =
      Array.isArray(full.disabledForDishes) &&
      full.disabledForDishes.includes(dish.id);

    if (isGloballyDisabled) return false;
    if (isDisabledForDish) return false;

    return true;
  });

  const activeOffer = getActiveOffer(dish.id, foodData.offers);

  const handleAddToBag = () => {
    const img = document.querySelector(".dish-image.image-main");
    const item = buildDishBagItem(dish, resolvedCategoryId);
    addToBag(activeOffer ? applyOfferToBagItem(item, activeOffer, item.unitPrice) : item);
    flyToBag({ imgEl: img, dishId: dish.id });
  };

  return (
    <div className="no-padding">
      {/* HEADER */}
      <PageHeader
        title={dish.name}
        wrapperClassName="food-header"
        titleClassName="food-list-title"
        onBack={handleBack}
        onHome={handleHome}
      />

      <div className="pl-body food-list">
        {/* MAIN */}
        <div className="food-reel-expanded">

          {/* LEFT — IMAGE */}
          <div className="food-images-expanded">
            <motion.img
              src={dish.image}
              className="dish-image image-main"
              layoutId={`dish-${dish.id}`}
              transition={SLOW_SPRING}
              onError={handleImgFallback}
            />
            {currentUser && currentUser.id !== "guest" && onToggleFavourite && (
              <WishlistButton
                className="food-list-expanded-wishlist"
                size="md"
                dish={dish}
                categoryId={resolvedCategoryId}
                currentUser={currentUser}
                onToggleFavourite={onToggleFavourite}
              />
            )}
          </div>

          {/* RIGHT — DETAILS */}
          <div className="food-details-expanded">
            {/* Above 1200px, .food-details-expanded-scroll (below) is the
              only part that scrolls on overflow — .food-details-expanded
              itself stays a fixed-height frame so .btn-section (outside
              this wrapper) stays pinned in place instead of scrolling
              away with the rest of the content. Below 1200px
              FoodListExpanded.css resets this wrapper back to a plain
              block so the page scrolls as a whole, matching the existing
              mobile/tablet behavior. */}
            <div className="food-details-expanded-scroll">
              <motion.div
                className="food-details-expanded-header"
                initial="hidden"
                animate={steps[0]}
                variants={DETAIL_VARIANTS}
                transition={SOFT_SPRING}
              >
                <div className="food-list-veg-row">
                  <VegBadge isVeg={dish.isVeg} className="food-list-veg-badge" />
                  <h2 className="dish-name">
                    {dish.name}
                  </h2>
                  {dish.id === bestSellerId && (
                    <BestSellerBadge variant="ribbon" className="food-list-best-seller-badge" />
                  )}
                </div>
              </motion.div>

              <motion.div
                initial="hidden"
                animate={steps[0]}
                variants={DETAIL_VARIANTS}
                transition={SOFT_SPRING}
              >
                <div className="dish-price">
                  {activeOffer ? (
                    <>
                      <AnimatedPrice value={activeOffer.offerPrice} />
                      <span className="dish-price-original">₹{activeOffer.originalPrice}</span>
                      <span className="dish-price-offer-badge">{activeOffer.percentage}% OFF</span>
                    </>
                  ) : (
                    <AnimatedPrice value={dish.basePrice} />
                  )}
                </div>
              </motion.div>

              <motion.div
                initial="hidden"
                className="dish-nutrition"
                animate={steps[0]}
                variants={DETAIL_VARIANTS}
                transition={SOFT_SPRING}
              >
                {NUTRITION_FIELDS.map(([icon, label, key, unit], i) => (
                  <div className="dish-nutrition-item" key={i}>
                    <div className="dish-nutrition-image">
                      <img src={icon} alt="" />
                    </div>
                    <div className="dish-nutrition-name">{label}</div>
                    <div className="dish-nutrition-value">{dish.benefits?.[key]}{unit}</div>
                  </div>
                ))}
              </motion.div>

              <motion.p
                initial="hidden"
                className="dish-description"
                animate={steps[1]}
                variants={DETAIL_VARIANTS}
                transition={SOFT_SPRING}
              >
                {dish.description}
              </motion.p>

              {dish.ingredients &&
                <motion.div
                  initial="hidden"
                  animate={steps[2]}
                  variants={DETAIL_VARIANTS}
                  transition={SOFT_SPRING}
                >
                  <div className="ingredient-head">Add-ons</div>
                  {Array.isArray(dish.ingredients) && dish.ingredients.length > 0 && (
                    <IngredientsCarousel
                      ingredients={filteredIngredients}
                      allIngredients={foodData.ingredients || []}
                    />
                  )}
                </motion.div>
              }
            </div>

            {(() => {
              const btnSection = (
                <motion.div
                  initial="hidden"
                  className="btn-section food-details-expanded-btn-section"
                  animate={steps[3]}
                  variants={DETAIL_VARIANTS}
                  transition={SOFT_SPRING}
                >
                  <Button3D
                    className="btn-3d green"
                    onClick={() => {
                      navigate("/food/customize", {
                        state: {
                          categoryId: resolvedCategoryId,
                          dishId: dish.id
                        }
                      });
                    }}
                  >
                    Customize
                  </Button3D>

                  <Button3D
                    type="button"
                    className="btn-3d red"
                    onClick={handleAddToBag}
                  >
                    Add to Bag
                  </Button3D>
                </motion.div>
              );

              // Below 576px .food-details-expanded .btn-section becomes
              // position: fixed (see FoodListExpanded.css). At that width
              // it must not live inside the route's animated
              // .page-transition-wrapper: Framer Motion applies a CSS
              // transform to that wrapper while a page transition plays,
              // and a transformed ancestor becomes the containing block
              // for any fixed-position descendant — so .btn-section would
              // suddenly be "fixed" relative to the sliding wrapper
              // instead of the viewport, jumping/glitching on exit (and
              // entry) of this page. Portalling it straight to
              // document.body keeps it anchored to the viewport
              // regardless of what the route transition is doing. Above
              // 576px it's a normal in-flow flex child of
              // .food-details-expanded, so it renders inline as before.
              return isFixedBtnSection
                ? createPortal(btnSection, document.body)
                : btnSection;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoodListExpanded;
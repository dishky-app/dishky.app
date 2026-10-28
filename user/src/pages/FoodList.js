import React, { useState, useRef, useEffect, useMemo } from "react";
import "./FoodList.css";
import AnimatedPrice from "./AnimatedPrice";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import PageHeader from "./shared/PageHeader";
import Button3D from "./shared/Button3D";
import { buildDishBagItem } from "./shared/bagUtils";
import { getActiveOffer, applyOfferToBagItem } from "./shared/offerUtils";
import { flyToBag } from "../components/flyToBag";
import WishlistButton from "./shared/WishlistButton";
import VegBadge from "./shared/VegBadge";
import BestSellerBadge from "./shared/BestSellerBadge";
import { getBestSellerId } from "./shared/bestSellerUtils";
import { handleImgFallback } from "../App";

const SLOT_X = [-1000, 0, 420, 700, 900];
const FOODLIST_EXIT_DURATION = 750;

const SLOW_SPRING = {
  type: "spring",
  stiffness: 55,
  damping: 26,
  mass: 1.4
};

const SOFT_SPRING = {
  type: "spring",
  stiffness: 90,
  damping: 22,
  mass: 1.2
};

const DETAIL_VARIANTS = {
  hidden: {
    opacity: 0,
    y: 0,
    filter: "blur(10px)"
  },
  show: {
    opacity: 1,
    y: [-60, 0],
    filter: "blur(0px)"
  }
};

const DETAIL_EXIT_VARIANT = {
  opacity: 0,
  y: -60,
  filter: "blur(10px)"
};

const FoodList = ({ foodData, addToBag, handleBack, handleHome, currentUser, onToggleFavourite }) => {
  const { categoryId } = useParams();
  const location = useLocation();
  const initialDishId = location.state?.dishId;
  const navigate = useNavigate();
  let category = foodData.categories.find(c => c.id === categoryId);

  if (!category) {
    for (const cat of foodData.categories) {
      const sub = cat.subCategories?.find(s => s.id === categoryId);
      if (sub) {
        category = sub;
        break;
      }
    }
  }

  const [detailKey, setDetailKey] = useState(0);
  const [isGlidingOut, setIsGlidingOut] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const exitTimerRef = useRef(null);
  const isNavigatingRef = useRef(false);
  const isPointerDown = useRef(false);
  const slides = category?.dishes || [];
  const imageRefs = useRef({});

  const bestSellerId = useMemo(
    () => getBestSellerId(slides, foodData?.orders),
    [slides, foodData?.orders]
  );

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  const initialIndex = (() => {
    if (!slides.length || !initialDishId) return 0;

    const idx = slides.findIndex(d => d.id === initialDishId);
    return idx !== -1 ? idx : 0;
  })();

  const [logicalIndex, setLogicalIndex] = useState(initialIndex);
  const [renderIndex, setRenderIndex] = useState(initialIndex);

  useEffect(() => {
    setDetailKey(k => k + 1);
  }, [renderIndex]);

  // Build the 5-slot conveyor, but only include a slot if it maps to a
  // dish DIFFERENT from every slot already placed. With few dishes (e.g.
  // a category with just 1 or 2 items), naive modulo wrapping would repeat
  // the same dish into slot 2/3 ("next" blurred images), making a single
  // dish appear to duplicate itself 2-3 times in the conveyor. Instead we
  // stop reusing a dish once it's already occupying another slot.
  const slotOffsets = [-1, 0, 1, 2, 3]; // slot 0..4 respectively
  const seenIds = new Set([slides[renderIndex].id]);
  const visible = slotOffsets.map((offset) => {
    if (offset === 0) return slides[renderIndex];

    const idx = (renderIndex + offset + slides.length) % slides.length;
    const dish = slides[idx];

    if (seenIds.has(dish.id)) return null; // would be a visual duplicate

    seenIds.add(dish.id);
    return dish;
  });

  // FoodList should only render REAL menu categories with at least one dish
  if (!category || slides.length === 0) {
    return (
      <div className="no-padding">
        <PageHeader
          title={category ? "No dishes available" : "Category not found"}
          wrapperClassName="food-header"
          titleClassName="food-list-title"
          onBack={handleBack}
          onHome={handleHome}
        />
        <div className="pl-body">
          <div className="fav-empty fav-empty-page">
            <div className="fav-empty-icon">🍽️</div>
            <h3 className="fav-empty-title">{category ? "No dishes available" : "Category not found"}</h3>
            <p className="fav-empty-sub">
              {category
                ? "There aren't any dishes in this category right now."
                : "This category may have been removed or renamed."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const goNext = () => {
    setLogicalIndex(i => (i + 1) % slides.length);
    setRenderIndex(i => (i + 1) % slides.length);
  };

  const goPrev = () => {
    setLogicalIndex(i => (i - 1 + slides.length) % slides.length);
    setRenderIndex(i => (i - 1 + slides.length) % slides.length);
  };

  const handleAddToBag = () => {
    const dish = visible[1];
    const img = document.querySelector(
      `.dish-image[data-active-dish="${dish.id}"]`
    );

    const item = buildDishBagItem(dish, category.id, { selectedSize: null, isCombo: false });
    const offer = getActiveOffer(dish.id, foodData.offers);
    addToBag(offer ? applyOfferToBagItem(item, offer, item.unitPrice) : item);
    flyToBag({ imgEl: img, dishId: dish.id });
  };

  return (
    <div className="no-padding">
      {/* HEADER */}
      <PageHeader
        title={category.name}
        wrapperClassName="food-header"
        titleClassName="food-list-title"
        onBack={(e) => handleBack(e)}
        onHome={handleHome}
      />

      <div className="pl-body">
        {/* MAIN AREA */}
        <div
          className="food-reel"
          onPointerDown={(e) => {
            // ❗ ignore clicks on buttons
            if (e.target.closest("button") || e.target.closest(".reel-cta")) {
              return;
            }

            e.currentTarget.setPointerCapture(e.pointerId);
            startX.current = e.clientX;
            startY.current = e.clientY;
            isPointerDown.current = true;
          }}

          onPointerUp={(e) => {
            if (!isPointerDown.current || isGlidingOut) return;
            const dx = startX.current - e.clientX;
            const dy = Math.abs(startY.current - e.clientY);

            if (dy > Math.abs(dx)) {
              isPointerDown.current = false;
              return;
            }

            if (dx > 25) goNext();
            else if (dx < -25) goPrev();

            isPointerDown.current = false;
          }}
        >
          {/* LEFT — DETAILS */}
          <div
            className="food-details"
            transition={SOFT_SPRING}
          >
            <motion.div
              key={detailKey}
              className="food-details-container"
              initial="hidden"
              animate={isGlidingOut ? DETAIL_EXIT_VARIANT : "show"}
              variants={DETAIL_VARIANTS}
              transition={isGlidingOut ? SLOW_SPRING : SOFT_SPRING}
            >
              <div className="dish-name-div">
                <VegBadge isVeg={visible[1].isVeg} className="food-list-veg-badge" />
                <h2 className="dish-name">
                  {visible[1].name}
                </h2>
                {visible[1].id === bestSellerId && (
                  <BestSellerBadge variant="ribbon" className="food-list-best-seller-badge" />
                )}
                {currentUser && currentUser.id !== "guest" && onToggleFavourite && (
                  <WishlistButton
                    className="food-list-wishlist"
                    size="md"
                    dish={visible[1]}
                    categoryId={category.id}
                    currentUser={currentUser}
                    onToggleFavourite={onToggleFavourite}
                  />
                )}
              </div>

              <div className="dish-price">
                {(() => {
                  const offer = getActiveOffer(visible[1].id, foodData.offers);
                  if (!offer) return <AnimatedPrice value={visible[1].basePrice} />;
                  return (
                    <>
                      <AnimatedPrice value={offer.offerPrice} />
                      <span className="dish-price-original">₹{offer.originalPrice}</span>
                      <span className="dish-price-offer-badge">{offer.percentage}% OFF</span>
                    </>
                  );
                })()}
              </div>

              <p className="dish-description">
                {visible[1].description}
              </p>
            </motion.div>

            <div className="btn-section">
              <Button3D
                className="btn-3d green"
                onClick={() => {
                  if (isNavigatingRef.current) return;
                  isNavigatingRef.current = true;
                  setIsGlidingOut(true);

                  exitTimerRef.current = setTimeout(() => {
                    navigate(`/foods/${category.id}/expanded`, {
                      state: {
                        categoryId: category.id,
                        dishId: visible[1].id,
                        disablePageAnimation: true
                      }
                    });
                  }, FOODLIST_EXIT_DURATION);
                }}
              >
                Show more
              </Button3D>

              <Button3D className="btn-3d red" onClick={handleAddToBag}>
                Add to Bag
              </Button3D>
            </div>

          </div>

          {/* RIGHT — IMAGE CONVEYOR */}
          <div className="food-images">
            {visible.map((item, slot) => {
              if (!item) return null; // slot deduped — same dish already shown elsewhere

              return (
                <motion.div
                  key={item.id}
                  className="dish-image-wrapper"
                  initial={
                    slot === 2 || slot === 3
                      ? { x: SLOT_X[slot] + 500 }
                      : false
                  }
                  animate={
                    isGlidingOut
                      ? slot === 1
                        ? { x: SLOT_X[1], scale: 1, zIndex: 5 }
                        : slot === 2
                          ? { x: SLOT_X[2] + 800, scale: 0.7 }
                          : slot === 3
                            ? { x: SLOT_X[3] + 1600, scale: 0.4 }
                            : { x: SLOT_X[slot], scale: 0.3 }
                      : {
                        x: SLOT_X[slot],
                        scale:
                          slot === 1 ? 1 :
                            slot === 2 ? 0.7 :
                              slot === 3 ? 0.4 : 0.3,
                        zIndex:
                          slot === 1 ? 3 :
                            slot === 2 ? 2 :
                              slot === 3 ? 1 : 0
                      }
                  }
                  transition={isGlidingOut ? SLOW_SPRING : SOFT_SPRING}
                >
                  <motion.img
                    data-active-dish={slot === 1 ? item.id : undefined}
                    ref={(el) => {
                      if (slot === 1 && el) {
                        imageRefs.current[visible[1].id] = el;
                      }
                    }}
                    layoutId={slot === 1 ? `dish-${item.id}` : undefined}
                    src={item.image}
                    className="dish-image"
                    style={{ position: "relative", width: "100%", height: "100%" }}
                    animate={{
                      filter:
                        slot === 1
                          ? "blur(0px)"
                          : slot === 2
                            ? "blur(6px)"
                            : slot === 3
                              ? "blur(10px)"
                              : "blur(14px)"
                    }}
                    transition={isGlidingOut ? SLOW_SPRING : SOFT_SPRING}
                    onError={handleImgFallback}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>

        {slides.length > 1 && (
          <div className="carousel-controls">
            <button
              className="image-nav-btn backward-btn"
              onClick={goPrev}
            />

            <button className="image-nav-btn forward-btn" onClick={goNext}>
            </button>
          </div>
        )}
      </div>
    </div >
  );
};

export default FoodList;
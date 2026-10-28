import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "./FoodGridList.css";
import "./BestSellers.css";
import PageHeader from "./shared/PageHeader";
import { handleImgFallback } from "../App";
import WishlistButton from "./shared/WishlistButton";
import { getActiveOffer } from "./shared/offerUtils";

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 22, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
};

/** Flatten every dish from categories + subCategories into a Map keyed by id,
 *  tagged with the TOP-LEVEL category id/name it belongs to. */
function buildDishIndex(categories = []) {
  const map = new Map();
  for (const cat of categories) {
    for (const d of cat.dishes || []) {
      map.set(d.id, { ...d, _topCatId: cat.id, _topCatName: cat.name, _catId: cat.id });
    }
    for (const sub of cat.subCategories || []) {
      for (const d of sub.dishes || []) {
        map.set(d.id, { ...d, _topCatId: cat.id, _topCatName: cat.name, _catId: sub.id });
      }
    }
  }
  return map;
}

/** For each top-level category, find the dish with the highest order
 *  quantity across orders placed in the last 7 days. */
function deriveBestSellers({ categories, orders }) {
  const dishIndex = buildDishIndex(categories);

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  // dishId -> total quantity sold in the last 7 days
  const countByDish = new Map();

  for (const order of orders || []) {
    const orderDate = new Date(order.date || order.createdAt);
    if (isNaN(orderDate) || orderDate < weekAgo || orderDate > now) continue;

    for (const item of order.items || []) {
      const dishId = item.dishId || item.id;
      if (!dishId) continue;
      const qty = item.quantity || 1;
      countByDish.set(dishId, (countByDish.get(dishId) || 0) + qty);
    }
  }

  // Group best count per top-level category
  const bestByCategory = new Map(); // topCatId -> { dish, count }

  for (const [dishId, count] of countByDish.entries()) {
    const dish = dishIndex.get(dishId);
    if (!dish?.name || !dish?.image || !dish?.basePrice) continue;

    const existing = bestByCategory.get(dish._topCatId);
    if (!existing || count > existing.count) {
      bestByCategory.set(dish._topCatId, { dish, count });
    }
  }

  return [...bestByCategory.values()].sort((a, b) => b.count - a.count);
}

const BestSellers = ({ foodData, currentUser, onToggleFavourite, handleBack, handleHome }) => {
  const navigate = useNavigate();

  const bestSellers = useMemo(
    () => deriveBestSellers({ categories: foodData?.categories || [], orders: foodData?.orders || [] }),
    [foodData]
  );

  return (
    <div className="no-padding">
      <PageHeader title="Best Sellers" onBack={handleBack} onHome={handleHome} />

      <div className="pl-body food-grid-page best-sellers-page">
      <div className="best-sellers-subtitle">
        Last week&rsquo;s most-ordered dish from every category
      </div>

      {bestSellers.length === 0 ? (
        <div className="food-grid-empty">
          <div className="food-grid-empty-icon">🏆</div>
          <div>Not enough orders in the last 7 days yet.</div>
        </div>
      ) : (
        <motion.div className="food-grid" variants={gridVariants} initial="hidden" animate="show">
          {bestSellers.map(({ dish, count }) => (
            <BestSellerCard
              key={dish._topCatId}
              dish={dish}
              count={count}
              offer={getActiveOffer(dish.id, foodData.offers)}
              currentUser={currentUser}
              onToggleFavourite={onToggleFavourite}
              onView={() =>
                navigate(`/foods/${dish._catId}/expanded`, {
                  state: { categoryId: dish._catId, dishId: dish.id },
                })
              }
            />
          ))}
        </motion.div>
      )}
      </div>
    </div>
  );
};

const BestSellerCard = ({ dish, count, offer, onView, currentUser, onToggleFavourite }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const isAuthenticatedUser = currentUser && currentUser.id !== "guest";

  return (
    <motion.div
      className="food-grid-card"
      variants={cardVariants}
      onClick={onView}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onView()}
      whileHover={{ y: -6, scale: 1.025, transition: { duration: 0.22, ease: [0.34, 1.56, 0.64, 1] } }}
      whileTap={{ scale: 0.97, transition: { duration: 0.1 } }}
    >
      <div className="food-grid-card-img-wrap">
        {!imgLoaded && <div className="food-grid-img-skeleton" />}
        <img
          className={`food-grid-card-img ${imgLoaded ? "loaded" : ""}`}
          src={dish.image}
          alt={dish.name}
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={handleImgFallback}
        />
        <span className="best-seller-badge">{dish._topCatName}</span>
        {isAuthenticatedUser && onToggleFavourite && (
          <WishlistButton
            className="food-grid-card-wishlist"
            dish={dish}
            categoryId={dish._catId}
            currentUser={currentUser}
            onToggleFavourite={onToggleFavourite}
          />
        )}
      </div>

      <div className="food-grid-card-body">
        <div className="food-grid-card-name">{dish.name}</div>
        <div className="best-seller-count">{count} sold this week</div>
        <div className="food-grid-card-footer">
          <div className="food-grid-card-price">
            {offer ? (
              <>
                <span>₹{offer.offerPrice}</span>
                <span className="food-grid-card-price-original">₹{offer.originalPrice}</span>
              </>
            ) : (
              <>₹{dish.basePrice}</>
            )}
          </div>
        </div>
      </div>

      <div className="food-grid-card-view-hint">View →</div>
    </motion.div>
  );
};

export default BestSellers;

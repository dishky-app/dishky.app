import React, { useState, useMemo } from "react";
import "./FoodGridList.css";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { flyToBag } from "../components/flyToBag";
import PageHeader from "./shared/PageHeader";
import Button3D from "./shared/Button3D";
import MatField from "./shared/MatField";
import { handleImgFallback } from "../App";
import { buildDishBagItem } from "./shared/bagUtils";
import { getActiveOffer, applyOfferToBagItem } from "./shared/offerUtils";
import WishlistButton from "./shared/WishlistButton";
import VegBadge from "./shared/VegBadge";
import BestSellerBadge from "./shared/BestSellerBadge";
import { getBestSellerId } from "./shared/bestSellerUtils";

/* ─── Grid container: staggers children on mount/key change ── */
const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
  exit: { transition: { staggerChildren: 0.02, staggerDirection: -1 } }
};

/* ─── Each card: slides up + fades in ────────────────────── */
const cardVariants = {
  hidden: { opacity: 0, y: 22, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }
};

const SORT_OPTIONS = [
  { val: "default", label: "Default" },
  { val: "price_asc", label: "↑ Price" },
  { val: "price_desc", label: "↓ Price" },
  { val: "name", label: "A → Z" }
];

const VEG_FILTER_OPTIONS = [
  { val: "all", label: "All" },
  { val: "veg", label: "🟢 Veg" },
  { val: "nonveg", label: "🔴 Non-Veg" },
];

const FoodGridList = ({ foodData, addToBag, handleBack, handleHome, currentUser, onToggleFavourite }) => {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("default"); // default | price_asc | price_desc | name
  const [vegFilter, setVegFilter] = useState("all"); // all | veg | nonveg

  const category = (() => {
    let cat = foodData.categories.find(c => c.id === categoryId);
    if (!cat) {
      for (const c of foodData.categories) {
        const sub = c.subCategories?.find(s => s.id === categoryId);
        if (sub) return sub;
      }
    }
    return cat;
  })();

  const dishes = category?.dishes || [];

  const bestSellerId = useMemo(
    () => getBestSellerId(dishes, foodData?.orders),
    [dishes, foodData?.orders]
  );

  const filtered = useMemo(() => {
    if (!category) return [];

    let list = dishes;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q));
    }

    if (vegFilter === "veg") list = list.filter(d => d.isVeg !== false);
    if (vegFilter === "nonveg") list = list.filter(d => d.isVeg === false);

    if (sortBy === "price_asc") list = [...list].sort((a, b) => a.basePrice - b.basePrice);
    if (sortBy === "price_desc") list = [...list].sort((a, b) => b.basePrice - a.basePrice);
    if (sortBy === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));

    return list;
  }, [category, dishes, search, sortBy, vegFilter]);

  // AFTER hooks
  if (!category) return null;

  const handleAdd = (dish) => (e) => {
    e.stopPropagation();
    const img = e.currentTarget.closest(".food-grid-card")?.querySelector(".food-grid-card-img");
    const item = buildDishBagItem(dish, categoryId, { __pendingImage: true });
    const offer = getActiveOffer(dish.id, foodData.offers);
    addToBag(offer ? applyOfferToBagItem(item, offer, item.unitPrice) : item);
    flyToBag({ imgEl: img, dishId: dish.id, customizationKey: "" });
  };

  return (
    <div className="no-padding">
      {/* HEADER */}
      <PageHeader title={category.name} onBack={handleBack} onHome={handleHome} />

      <div className="pl-body">
      {/* TOOLBAR: search + sort */}
      <div className="food-grid-toolbar">
        <div className="food-grid-search-wrap">
          <MatField
            wrapperClassName="field-group"
            label="Search dishes"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="food-grid-search-clear" onClick={() => setSearch("")} aria-label="Clear">✕</button>
          )}
        </div>

        <div className="food-grid-sort">
          {SORT_OPTIONS.map(opt => (
            <Button3D
              key={opt.val}
              className={`sort-btn ${sortBy === opt.val ? "active" : ""}`}
              onClick={() => setSortBy(opt.val)}
            >
              {opt.label}
            </Button3D>
          ))}
          <span className="food-grid-sort-divider" aria-hidden="true" />
          {VEG_FILTER_OPTIONS.map(opt => (
            <Button3D
              key={opt.val}
              className={`sort-btn ${vegFilter === opt.val ? "active" : ""}`}
              onClick={() => setVegFilter(opt.val)}
            >
              {opt.label}
            </Button3D>
          ))}
        </div>

        <div className="food-grid-count">
          {filtered.length} of {dishes.length} dishes
        </div>
      </div>

      {/* GRID — AnimatePresence re-mounts grid when sort/search key changes,
                 triggering staggered card entrance animation                    */}
      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            className="food-grid-empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <div className="food-grid-empty-icon">🍽</div>
            <div>No dishes found for &ldquo;{search}&rdquo;</div>
          </motion.div>
        ) : (
          <motion.div
            key={sortBy + "|" + search + "|" + vegFilter}
            className="food-grid"
            variants={gridVariants}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {filtered.map(dish => (
              <DishCard
                key={dish.id}
                dish={dish}
                categoryId={categoryId}
                offer={getActiveOffer(dish.id, foodData.offers)}
                isBestSeller={dish.id === bestSellerId}
                onView={() => navigate(`/foods/${categoryId}`, { state: { dishId: dish.id } })}
                onAdd={handleAdd(dish)}
                currentUser={currentUser}
                onToggleFavourite={onToggleFavourite}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
};

/* ── Dish card ──────────────────────────────────────────── */
const DishCard = ({ dish, categoryId, offer, isBestSeller, onView, onAdd, currentUser, onToggleFavourite }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const isAuthenticatedUser = currentUser && currentUser.id !== "guest";

  return (
    <motion.div
      className="food-grid-card"
      variants={cardVariants}
      onClick={onView}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onView()}
      whileHover={{ y: -6, scale: 1.025, transition: { duration: 0.22, ease: [0.34, 1.56, 0.64, 1] } }}
      whileTap={{ scale: 0.97, transition: { duration: 0.1 } }}
    >
      <div className="food-grid-card-img-wrap">
        <div className="food-grid-card-view-hint food-grid-card-view-hint--top">
          View →
        </div>

        {isAuthenticatedUser && onToggleFavourite && (
          <WishlistButton
            className="food-grid-card-wishlist"
            dish={dish}
            categoryId={categoryId}
            currentUser={currentUser}
            onToggleFavourite={onToggleFavourite}
          />
        )}

        {!imgLoaded && <div className="food-grid-img-skeleton" />}
        <img
          className={`food-grid-card-img ${imgLoaded ? "loaded" : ""}`}
          src={dish.image}
          alt={dish.name}
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={handleImgFallback}
        />

        {offer && <span className="food-grid-card-offer-badge">{offer.percentage}% OFF</span>}
        <VegBadge isVeg={dish.isVeg} />
        {isBestSeller && (
          <BestSellerBadge variant="rosette" className="food-grid-card-best-seller" />
        )}
      </div>

      <div className="food-grid-card-body">
        <div className="food-grid-card-name">{dish.name}</div>
        {dish.description && (
          <div className="food-grid-card-desc">{dish.description}</div>
        )}
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
          <button
            className="food-grid-card-add"
            onClick={onAdd}
            aria-label={`Add ${dish.name} to bag`}
          >
            +
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default FoodGridList;
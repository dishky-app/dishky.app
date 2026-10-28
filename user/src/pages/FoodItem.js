import "./FoodItem.css";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import trash from "../assets/icons/trash.png";
import mild from "../assets/icons/mild.png";
import hot from "../assets/icons/hot.png";
import extreme from "../assets/icons/extreme.png";
import notesIcon from "../assets/icons/notes.png";
import { flyToBag } from "../components/flyToBag";
import { useScrollHeader } from "./shared/useScrollHeader";
import HomeButton from "./shared/HomeButton";
import Button3D from "./shared/Button3D";
import { RED_EDGE_GRADIENT, RED_FRONT_STYLE } from "./shared/styles";
import { getActiveOffer, getEffectiveBasePrice } from "./shared/offerUtils";
import { useToast } from "../components/Usetoast";
import { useIsBelowWidth } from "./shared/useIsBelowWidth";
import ConfirmDialog from "./shared/ConfirmDialog";
import ModalTransition from "./shared/ModalTransition";
import "./shared/ModalTransition.css";
import { FALLBACK_IMAGE, handleImgFallback } from "../App";

/* ─── Constants ───────────────────────────────────────────── */
const STEP = 10;
const MIN_GRAMS = STEP;

const SPICINESS_OPTIONS = [
  { id: "mild", name: "Mild", icon: mild },
  { id: "hot", name: "Hot", icon: hot },
  { id: "extreme", name: "Extreme", icon: extreme }
];

/* ─── Helpers ─────────────────────────────────────────────── */
const isOutOfStock = (ingredient) =>
  Number(ingredient.stockRemaining || 0) * 1000 < MIN_GRAMS;

const isIngredientEnabled = (master, dishId) => {
  if (!master) return true;
  if (master.isDisabledGlobally === true) return false;
  if (Array.isArray(master.disabledForDishes) && master.disabledForDishes.includes(dishId)) return false;
  return true;
};

/* ─── Component ───────────────────────────────────────────── */
const FoodItem = ({ handleHome, foodData, updateBagItem, onToggleFavourite, addToBag, handleBack, toCamelCase, currentUser, isWishlistEnabled = true }) => {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { headerRef, scrolled } = useScrollHeader();
  const isFixedBottomBar = useIsBelowWidth(576);
  const { categoryId, dishId, fromBag, bagIndex, bagItem, fromFavouriteCustomize } = location.state || {};
  const { favouriteSnapshot } = location.state || {};

  const isEditMode = fromBag === true && typeof bagIndex === "number";

  const safeIngredients = useMemo(() => (
    Array.isArray(foodData?.ingredients) ? foodData.ingredients : []
  ), [foodData?.ingredients]);

  /* ── Find category & dish ── */
  const category = useMemo(() => {
    const top = foodData.categories.find(c => c.id === categoryId);
    if (top) return top;
    for (const cat of foodData.categories) {
      const sub = cat.subCategories?.find(s => s.id === categoryId);
      if (sub) return sub;
    }
    return null;
  }, [foodData.categories, categoryId]);

  const dish = useMemo(() => (
    category && dishId ? (category.dishes || []).find(d => d.id === dishId) : null
  ), [category, dishId]);

  const originalCategory = useMemo(() => {
    if (!dish) return category;
    let found = foodData.categories.find(c => Array.isArray(c.dishes) && c.dishes.some(d => d.id === dish.id));
    if (!found) {
      for (const cat of foodData.categories) {
        const sub = cat.subCategories?.find(s => Array.isArray(s.dishes) && s.dishes.some(d => d.id === dish.id));
        if (sub) { found = sub; break; }
      }
    }
    return found || category;
  }, [dish, category, foodData.categories]);

  const favouriteDish = fromFavouriteCustomize ? favouriteSnapshot : null;

  // Only the "as-is" base dish price is discounted — ingredient add-ons,
  // sizing, and variant surcharges still stack on top as usual, so a
  // heavily customized order isn't silently discounted along with it.
  const activeOffer = useMemo(() => getActiveOffer(dish?.id, foodData?.offers), [dish?.id, foodData?.offers]);

  const effectiveDish = useMemo(() => {
    if (isEditMode) return { ...dish, ingredients: bagItem?.ingredients || [] };
    if (fromFavouriteCustomize) return { ...dish, ingredients: favouriteDish?.ingredients || dish?.ingredients };
    return dish || { id: "__custom__", name: category ? `Make Your Own ${category.name}` : "Custom Dish", basePrice: 200, ingredients: [] };
  }, [isEditMode, fromFavouriteCustomize, dish, bagItem, favouriteDish, category]);

  const wishlistDish = dish || effectiveDish || { id: "__custom__", name: `Make Your Own ${category?.name || ""}`, image: FALLBACK_IMAGE, basePrice: originalCategory?.basePrice ?? 200 };

  /* Stable id for the simple (non-customized) wishlist toggle — does NOT
     include Date.now() so the same dish/size can be added and removed. */


  /* ── State ── */
  const [quantity, setQuantity] = useState(1);
  const [spiciness, setSpiciness] = useState("mild");
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const favouriteId = `${wishlistDish.id}_${selectedSize || "regular"}`;
  const [ingredientQuantities, setIngredientQuantities] = useState({});
  const [selectedOrder, setSelectedOrder] = useState([]);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showFavouriteForm, setShowFavouriteForm] = useState(false);
  const [showRemoveFavouriteConfirm, setShowRemoveFavouriteConfirm] = useState(false);
  const [favName, setFavName] = useState("");
  const [favDescription, setFavDescription] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [blinkIngredient, setBlinkIngredient] = useState(null);
  const [pricePulse, setPricePulse] = useState(false);
  const [scrollToIngredient, setScrollToIngredient] = useState(null);
  const calcRefs = useRef({});

  /* ── Size & multiplier ── */
  const selectedSizeObj = useMemo(() => (
    originalCategory?.sizes?.find(s => s.name.toLowerCase() === selectedSize) || originalCategory?.sizes?.[0]
  ), [originalCategory, selectedSize]);

  const sizeMultiplier = Number(selectedSizeObj?.priceMultiplier ?? 1);

  /* ── Variant ── */
  const dishVariants = dish?.variants || effectiveDish?.variants || [];

  const selectedVariantObj = useMemo(() => (
    dishVariants.find(v => v.name === selectedVariant) || null
  ), [dishVariants, selectedVariant]);

  const variantExtraCharge = Number(selectedVariantObj?.extraCharge ?? 0);

  /* ── Allowed category ingredients ── */
  const categoryIngredients = useMemo(() => {
    return safeIngredients.filter(ing => {
      if (!ing.usedInCategories?.includes(originalCategory?.id)) return false;
      return isIngredientEnabled(ing, dish?.id);
    });
  }, [safeIngredients, originalCategory?.id, dish?.id]);

  /* ── Ordered: available first, out-of-stock last ── */
  const orderedIngredients = useMemo(() => {
    const available = [], unavailable = [];
    categoryIngredients.forEach(ing => (isOutOfStock(ing) ? unavailable : available).push(ing));
    return [...available, ...unavailable];
  }, [categoryIngredients]);

  /* ── Initialise state from dish/bag ── */
  useEffect(() => {
    if (originalCategory?.sizes?.length) setSelectedSize(originalCategory.sizes[0].name.toLowerCase());

    const dishIngredientNames = new Set((dish?.ingredients || []).map(i => i.name));
    const allowedIngredients = dishIngredientNames.size > 0
      ? safeIngredients.filter(ing => dishIngredientNames.has(ing.name) && isIngredientEnabled(ing, dish?.id))
      : categoryIngredients;

    const initial = {};
    allowedIngredients.forEach(ing => { initial[ing.name] = 0; });

    const source = isEditMode && bagItem ? bagItem.ingredients : effectiveDish.ingredients || [];
    const selected = [];

    source.forEach(ing => {
      const master = safeIngredients.find(i => i.id === ing.id || i.name === ing.name);
      if (!isIngredientEnabled(master, dish?.id)) return;
      initial[ing.name] = Number(ing.quantity) || 0;
      if (Number(ing.quantity) > 0) selected.push(ing.name);
    });

    setSelectedOrder(selected);
    setIngredientQuantities(initial);

    if (isEditMode && bagItem) {
      setQuantity(Number(bagItem.quantity) || 1);
      setSelectedSize(bagItem.selectedSize || selectedSizeObj?.name?.toLowerCase());
      setSpiciness(bagItem.spiciness || "mild");
      setNotes(bagItem.notes || "");
      setSelectedVariant(bagItem.selectedVariant || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIngredients.length, effectiveDish.id, bagItem?.id, fromFavouriteCustomize]);

  useEffect(() => {
    const favs = currentUser?.favourites || [];
    setIsWishlisted(favs.some(f => f.id === favouriteId));
  }, [favouriteId, currentUser]);

  /* ── Keep selectedOrder in sync ── */
  useEffect(() => {
    setSelectedOrder(prev => {
      let updated = [...prev];
      Object.entries(ingredientQuantities).forEach(([name, qty]) => {
        const has = updated.includes(name);
        if (Number(qty) > 0 && !has) updated = [name, ...updated.filter(n => n !== name)];
        if (Number(qty) === 0 && has) updated = updated.filter(n => n !== name);
      });
      return updated;
    });
  }, [ingredientQuantities]);

  const increaseQty = () => setQuantity(q => q + 1);
  const decreaseQty = () => setQuantity(q => (q > 1 ? q - 1 : 1));

  const handleIngredientAdjust = useCallback((name, delta) => {
    setIngredientQuantities(prev => {
      const next = Math.max(0, Number(prev[name] || 0) + delta);
      return { ...prev, [name]: next };
    });
    setBlinkIngredient(name);
    setTimeout(() => setBlinkIngredient(null), 600);

    // On mobile (stacked layout), jump to the matching row in the
    // "Selected Ingredients" calculation list on the right panel.
    if (window.innerWidth <= 576) {
      setScrollToIngredient(name);
    }
  }, []);

  /* ── Scroll the matching ingredient-item-calculation into view (mobile) ── */
  useEffect(() => {
    if (!scrollToIngredient) return;

    const el = calcRefs.current[scrollToIngredient];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    setScrollToIngredient(null);
  }, [scrollToIngredient, ingredientQuantities]);

  const hasIngredientChanges = useCallback(() => {
    const base = dish?.ingredients || [];
    const baseMap = {};
    base.forEach(ing => { baseMap[ing.name] = Number(ing.quantity || 0); });
    return Object.entries(ingredientQuantities).some(([name, qty]) => Number(qty) !== Number(baseMap[name] || 0));
  }, [dish?.ingredients, ingredientQuantities]);

  /* ── Build bag item (memoized) ── */
  const previewItem = useMemo(() => {
    const rawBasePrice = Number(dish?.basePrice ?? originalCategory?.basePrice ?? 200);
    const effectiveBasePrice = getEffectiveBasePrice(rawBasePrice, activeOffer);
    const base = effectiveBasePrice * sizeMultiplier;

    const ingredients = Object.entries(ingredientQuantities)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([name, qty]) => {
        const master = safeIngredients.find(i => i.name === name) || {};
        const pricePer100g = Number(master.pricePer100g || 0);
        return { id: master.id, name, quantity: Number(qty), pricePer100g, totalPrice: Math.round((pricePer100g * qty) / 100) };
      });

    const selectedTotal = ingredients.reduce((s, i) => s + i.totalPrice, 0);
    const baseTotal = (dish?.ingredients || []).reduce((s, ing) => {
      const master = safeIngredients.find(i => i.name === ing.name) || {};
      return s + Math.round((Number(master.pricePer100g || 0) * Number(ing.quantity || 0)) / 100);
    }, 0);

    const delta = selectedTotal - baseTotal;
    const ingredientModified = selectedTotal !== baseTotal;
    const unitPrice = Math.max(0, Math.round(base + delta + variantExtraCharge));
    const qty = Number(quantity || 1);

    const customizationKey = (() => {
      if (!ingredientModified && !notes?.trim() && !selectedSize && !selectedVariant) return null;
      const ingSig = ingredients.map(i => `${i.name}:${i.quantity}`).sort().join("|");
      return [selectedSize || "", spiciness || "", notes?.trim() || "", selectedVariant || "", ingSig].join("__");
    })();

    const baseName = dish?.name || favouriteDish?.name || effectiveDish?.name || "Custom Dish";

    return {
      id: dish?.id || effectiveDish.id,
      customizationKey,
      name: fromBag && bagItem?.name ? bagItem.name : ingredientModified ? `Customized ${baseName}` : baseName,
      image: dish?.image || effectiveDish.image,
      categoryId: originalCategory?.id,
      quantity: qty,
      selectedSize,
      selectedVariant,
      variantExtraCharge,
      spiciness,
      ingredients,
      unitPrice,
      totalPrice: unitPrice * qty,
      notes: notes?.trim() || "",
      isCustomized: fromFavouriteCustomize ? false : ingredientModified,
      isFromFavourite: fromFavouriteCustomize === true,
      ...(activeOffer ? { appliedOffer: { percentage: activeOffer.percentage, originalPrice: rawBasePrice * sizeMultiplier } } : {})
    };
  }, [ingredientQuantities, quantity, selectedSize, selectedVariant, variantExtraCharge, spiciness, notes, dish, effectiveDish, originalCategory, safeIngredients, sizeMultiplier, fromBag, bagItem, fromFavouriteCustomize, favouriteDish, activeOffer]);

  const totalPrice = previewItem.totalPrice || 0;

  /* ── Price pulse on change ── */
  useEffect(() => {
    if (!totalPrice) return;
    setPricePulse(true);
    const t = setTimeout(() => setPricePulse(false), 500);
    return () => clearTimeout(t);
  }, [totalPrice]);

  /* ── Nutrition ── */
  const baseDishBenefits = dish?.benefits || effectiveDish?.benefits || { calories: 200, protein: 20, fat: 10, fibre: 6 };

  const round = (n, d = 1) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;

  const calculateNutrition = useCallback((ingredientList) => {
    const totals = { calories: 0, protein: 0, fat: 0, fibre: 0 };
    (ingredientList || []).forEach(ing => {
      const master = safeIngredients.find(i => i.name === ing.name);
      if (!master?.nutritionPer100g) return;
      const factor = ing.quantity / 100;
      const n = master.nutritionPer100g;
      totals.calories += (n.kcal || 0) * factor;
      totals.protein += (n.protein || 0) * factor;
      totals.fat += (n.fat || 0) * factor;
      totals.fibre += (n.fibre || 0) * factor;
    });
    return totals;
  }, [safeIngredients]);

  const calculateFinalBenefits = useCallback(({ baseDishBenefits, baseIngredients, selectedIngredients }) => {
    const baseNut = calculateNutrition(baseIngredients || []);
    const selNut = calculateNutrition(selectedIngredients || []);
    const delta = { calories: selNut.calories - baseNut.calories, protein: selNut.protein - baseNut.protein, fat: selNut.fat - baseNut.fat, fibre: selNut.fibre - baseNut.fibre };
    return {
      calories: round((baseDishBenefits?.calories || 0) + delta.calories),
      protein: round((baseDishBenefits?.protein || 0) + delta.protein),
      fat: round((baseDishBenefits?.fat || 0) + delta.fat),
      fibre: round((baseDishBenefits?.fibre || 0) + delta.fibre)
    };
  }, [calculateNutrition]);

  if (!category) return <p>Category not found</p>;

  /* ── JSX ── */
  return (
    <div className="food-item">
      <div className="left-panel">
        {/* HEADER */}
        <div
          ref={headerRef}
          className={`pl-header${scrolled ? " header-scrolled" : ""}`}
        >
          <button className="back-button" onClick={handleBack} />
          <div className="food-item-name">
            {fromBag && bagItem?.name ? bagItem.name
              : fromFavouriteCustomize && favouriteDish ? favouriteDish.name
                : dish ? dish.name
                  : `Make Your Own ${category.name}`}
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <HomeButton onClick={handleHome} />
            {!fromBag && !fromFavouriteCustomize && currentUser && currentUser.id !== "guest" && isWishlistEnabled && (
              <div
                className={`wishlist-btn ${isWishlisted ? "active" : ""}`}
                onClick={() => {
                  if (isWishlisted) {
                    setShowRemoveFavouriteConfirm(true);
                    return;
                  }
                  setFavName(wishlistDish.name);
                  setFavDescription("");
                  setShowFavouriteForm(true);
                }}
                role="button"
                aria-label="Add to wishlist"
              >
                <span className="shadow" />
                <span className="edge" />
                <span className="front">♥</span>
              </div>
            )}
          </div>
        </div>

        {/* Remove-favourite confirmation — portalled so .food-item's
            overflow:hidden can't clip it, same reasoning as the
            wishlist form portal just below. */}
        {createPortal(
          <ConfirmDialog
            open={showRemoveFavouriteConfirm}
            title="Remove Favourite"
            message={<>Are you sure you want to remove <strong>{wishlistDish.name}</strong> from your favourites?</>}
            onConfirm={() => {
              onToggleFavourite({ id: favouriteId, _remove: true });
              setIsWishlisted(false);
              toast.info(`${wishlistDish.name} removed from favourites`);
              setShowRemoveFavouriteConfirm(false);
            }}
            onCancel={() => setShowRemoveFavouriteConfirm(false)}
          />,
          document.body
        )}

        {/* Wishlist form — portal so .food-item overflow:hidden can't clip it */}
        {createPortal(
          <ModalTransition
            open={showFavouriteForm}
            onClose={() => setShowFavouriteForm(false)}
            overlayClassName="user-overlay"
            panelClassName="user-modal"
          >
                  <div className="user-modal-body">
                    <h3>Save to Wishlist</h3>
                    <label>Name</label>
                    <input
                      autoFocus
                      required
                      placeholder="e.g. My Spicy Margherita"
                      value={favName}
                      onChange={e => setFavName(toCamelCase(e.target.value))}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (!favName.trim()) return;
                          const benefits = calculateFinalBenefits({ baseDishBenefits, baseIngredients: dish?.ingredients || [], selectedIngredients: previewItem.ingredients });
                          const ingredientsChanged = hasIngredientChanges();
                          const id = ingredientsChanged ? `${wishlistDish.id}_${selectedSize}_${Date.now()}` : favouriteId;
                          const ingredients = ingredientsChanged ? previewItem.ingredients : (dish?.ingredients || []);
                          onToggleFavourite({ id, originalDishId: wishlistDish.id, savedBy: currentUser?.name || currentUser?.id || "guest", name: favName.trim(), description: favDescription.trim(), image: wishlistDish.image, categoryId: category.id, selectedSize, basePrice: wishlistDish.basePrice, totalPrice: previewItem.totalPrice, ingredients, benefits });
                          setIsWishlisted(true);
                          setShowFavouriteForm(false);
                          toast.success(`${favName.trim()} added to favourites`);
                        }
                      }}
                    />
                    <label>Description</label>
                    <textarea
                      placeholder="Describe your custom dish..."
                      value={favDescription}
                      onChange={e => setFavDescription(e.target.value)}
                    />
                    <div className="btn-section">
                      <Button3D
                        className="btn-3d white"
                        onClick={() => setShowFavouriteForm(false)}
                      >Cancel</Button3D>
                      <Button3D
                        className="btn-3d red"
                        edgeStyle={RED_EDGE_GRADIENT}
                        frontStyle={RED_FRONT_STYLE}
                        disabled={!favName.trim()}
                        onClick={() => {
                          if (!favName.trim()) return;
                          const benefits = calculateFinalBenefits({ baseDishBenefits, baseIngredients: dish?.ingredients || [], selectedIngredients: previewItem.ingredients });
                          const ingredientsChanged = hasIngredientChanges();
                          const id = ingredientsChanged ? `${wishlistDish.id}_${selectedSize}_${Date.now()}` : favouriteId;
                          const ingredients = ingredientsChanged ? previewItem.ingredients : (dish?.ingredients || []);
                          onToggleFavourite({ id, originalDishId: wishlistDish.id, savedBy: currentUser?.name || currentUser?.id || "guest", name: favName.trim(), description: favDescription.trim(), image: wishlistDish.image, categoryId: category.id, selectedSize, basePrice: wishlistDish.basePrice, totalPrice: previewItem.totalPrice, ingredients, benefits });
                          setIsWishlisted(true);
                          setShowFavouriteForm(false);
                          toast.success(`${favName.trim()} added to favourites`);
                        }}
                      >Save</Button3D>
                    </div>
                  </div>
          </ModalTransition>,
          document.body
        )}

        {/* IMAGE + SELECTORS */}
        <div className="image-header">
          <div className="image-header-left">
            <div className="food-item-image">
              <img src={dish?.image || FALLBACK_IMAGE} alt={dish?.name || "Make Your Own"} loading="eager" decoding="async" draggable={false} onError={handleImgFallback} />
            </div>
          </div>

          <div className="image-header-right">
            {selectedSizeObj && (
              <div className="size-selector">
                <div>Sizes</div>
                <div className="size-selector-container">
                  {originalCategory?.sizes?.map(size => (
                    <div
                      key={size.name}
                      className={`size-selector-item ${selectedSize === size.name.toLowerCase() ? "active" : ""}`}
                      onClick={() => setSelectedSize(size.name.toLowerCase())}
                      role="button"
                    >
                      <span className="size-tick" />
                      <div className="size-selector-item-name">{size.name}</div>
                      <div className="size-selector-item-description">{size.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="hot-selector">
              <div>Spiciness</div>
              <div className="hot-selector-container">
                {SPICINESS_OPTIONS.map(opt => (
                  <div key={opt.id} className={`hot-selector-icon ${spiciness === opt.id ? "active" : ""}`} onClick={() => setSpiciness(opt.id)} role="button">
                    <img src={opt.icon} alt={opt.name} />
                    <div>{opt.name}</div>
                  </div>
                ))}
              </div>
            </div>

            {dishVariants.length > 0 && (
              <div className="size-selector">
                <div>Variants</div>
                <div className="size-selector-container">
                  {dishVariants.map(v => (
                    <div
                      key={v.name}
                      className={`size-selector-item ${selectedVariant === v.name ? "active" : ""}`}
                      onClick={() => setSelectedVariant(prev => (prev === v.name ? null : v.name))}
                      role="button"
                    >
                      <span className="size-tick" />
                      <div className="size-selector-item-name">{v.name}</div>
                      <div className="size-selector-item-description">
                        {v.extraCharge ? `+₹${v.extraCharge}` : "No extra charge"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* INGREDIENT LIST */}
        <div className="ingredient-section">
          <div className="ingredients">All Ingredients</div>
          <div className="ingredient-list">
            {orderedIngredients.map(ing => {
              const qty = ingredientQuantities[ing.name] || 0;
              const disabled = isOutOfStock(ing);

              return (
                <div
                  key={ing.id}
                  className={`ingredient-item ${qty > 0 ? "selected" : ""} ${disabled ? "disabled" : ""}`}
                  onClick={() => navigate(`/ingredient/${ing.id}`)}
                  role="button"
                >
                  <div className="ingredient-item-image">
                    <img src={ing.image} alt="" loading="lazy" decoding="async"  onError={handleImgFallback} />
                  </div>
                  <div className="ingredient-item-name">{ing.name}</div>
                  <div className="ingredient-item-price-container">
                    <div className="ingredient-item-price">₹{ing.pricePer100g}/100g</div>
                    <div className="stepper-ctrl">
                      <button className="stepper-btn" disabled={disabled} onClick={e => { e.stopPropagation(); !disabled && handleIngredientAdjust(ing.name, -STEP); }}>−</button>
                      <div className="stepper-val">{qty}g</div>
                      <button className="stepper-btn" disabled={disabled} onClick={e => { e.stopPropagation(); !disabled && handleIngredientAdjust(ing.name, +STEP); }}>+</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="right-panel">
        <div className="top">
          <div className="ingredients-calculation">
            <span>Selected Ingredients</span>
          </div>

          {previewItem.ingredients.map(ing => {
            const master = safeIngredients.find(i => i.name === ing.name);
            const out = !master || Number(master.stockRemaining || 0) * 1000 < STEP;

            return (

              <div
                key={ing.name}
                ref={el => { calcRefs.current[ing.name] = el; }}
                className={`ingredient-item-calculation ${out ? "out-of-stock" : ""} ${blinkIngredient === ing.name ? "blink" : ""}`}
                onClick={() => { const m = safeIngredients.find(i => i.name === ing.name); if (m) navigate(`/ingredient/${m.id}`); }}
                role="button"
              >
                <div className="ingredient-item-image-calculation">
                  <img src={master?.image} alt=""  onError={handleImgFallback} />
                </div>
                <div className="ingredient-item-name-calculation">
                  {out ? <s>{ing.name}</s> : ing.name}
                </div>
                <div className="ingredient-item-quantity-calculation">{ing.quantity}g</div>
                <div className="ingredient-item-price-calculation">₹{ing.totalPrice.toFixed(0)}</div>
                <Button3D
                  as="div"
                  className="home-btn"
                  onClick={e => { e.stopPropagation(); !out && handleIngredientAdjust(ing.name, -ing.quantity); }}
                  edgeStyle={RED_EDGE_GRADIENT}
                  frontStyle={RED_FRONT_STYLE}
                >
                  <img
                    src={trash}
                    alt="remove"
                    style={{
                      height: "18px",
                      width: "18px",
                      filter: "var(--opp-img-theme-filter)",
                    }}
                  />
                </Button3D>
              </div>
            );
          })}
        </div>

        {(() => {
          const bottomBar = (
            <div className="bottom">
              <div className={`notes-wrapper ${showNotes ? "open" : ""}`}>
                <textarea
                  className="notes-box"
                  placeholder="Add preparation notes..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <div className="price-section">
                <div className="price-label">Total Price</div>
                <div className={`food-item-total-amount ${pricePulse ? "price-pulse" : ""}`}>
                  ₹{totalPrice.toFixed(0)}
                  {activeOffer && (
                    <span className="dish-price-offer-badge">{activeOffer.percentage}% OFF</span>
                  )}
                </div>
              </div>

              <div className="quantity-section">
                <div className="qty-label">Quantity</div>
                <div className="stepper-ctrl">
                  <button className="stepper-btn" onClick={decreaseQty} disabled={quantity === 1}>−</button>
                  <div className="stepper-val">{quantity}x</div>
                  <button className="stepper-btn" onClick={increaseQty}>+</button>
                </div>
              </div>

              <div className="add-to-bag-row">
                <Button3D
                  className="btn-3d green"
                  onClick={() => {
                    if (showNotes) {
                      // Currently open — "Save Notes" was clicked. Trim and
                      // close; the button's own label switches to "Edit
                      // Notes" once notes.trim() is non-empty (see label
                      // logic below), or back to "Add Notes" if left blank.
                      setNotes((n) => n.trim());
                      setShowNotes(false);
                    } else {
                      // Currently closed — "Add Notes" or "Edit Notes" was
                      // clicked. Either way, open the textarea for input.
                      setShowNotes(true);
                    }
                  }}
                >
                  {showNotes ? "Save Notes" : notes.trim() ? "Edit Notes" : "Add Notes"}
                </Button3D>

                <Button3D
                  className="btn-3d red"
                  onClick={() => {
                    const img = document.querySelector(".food-item-image img");
                    const item = { ...previewItem, isCustomized: previewItem.isCustomized === true, isFromFavourite: fromFavouriteCustomize === true };
                    if (isEditMode) updateBagItem(bagIndex, item);
                    else addToBag(item);
                    flyToBag({
                      imgEl: img,
                      dishId: previewItem.id,
                      customizationKey: previewItem.customizationKey || ""
                    });
                  }}
                >
                  {isEditMode ? "Update Bag" : "Add to Bag"}
                </Button3D>
              </div>
            </div>
          );

          // Below 576px .bottom becomes position: fixed (see FoodItem.css).
          // At that width it must not live inside the route's animated
          // .page-transition-wrapper: Framer Motion applies a CSS transform
          // to that wrapper while a page transition plays, and a
          // transformed ancestor becomes the containing block for any
          // fixed-position descendant — so .bottom would suddenly be
          // "fixed" relative to the sliding wrapper instead of the
          // viewport, jumping/glitching on every page enter and exit.
          // Portalling it straight to document.body keeps it anchored to
          // the viewport regardless of what the route transition is
          // doing. Above 576px .bottom is a normal-flow flex child of
          // .right-panel, so it renders inline as before.
          return isFixedBottomBar ? createPortal(bottomBar, document.body) : bottomBar;
        })()}
      </div>
    </div >
  );
};

export default FoodItem;
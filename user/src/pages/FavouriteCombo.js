import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./FavouriteCombo.css";
import { flyToBag } from "../components/flyToBag";
import { handleImgFallback } from "../App";
import Button3D from "./shared/Button3D";
import { useToast } from "../components/Usetoast";

const listVariants = {
  hidden: { opacity: 0, y: 60 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.16, 1, 0.3, 1], // smoother spring-like ease
      when: "beforeChildren",
      staggerChildren: 0.12,
      delayChildren: 0.08
    }
  }
};

const SLOT_ORDER = ["starter", "main", "drink"];

const FavouriteCombo = ({
  currentUser,
  setCurrentUser,
  addToBag,
  handleBack
}) => {

  const { toast } = useToast();
  const navigate = useNavigate();
  const goBack = handleBack || (() => navigate(-1));

  const favCombos = [...(currentUser?.combo || [])]
    .sort((a, b) =>
      new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

  const handleDelete = async (comboId) => {
    if (!currentUser) return;

    const previousCombos = favCombos;
    const updatedCombos = favCombos.filter(c => c.id !== comboId);

    // Remove it from the list immediately — the card was previously stuck
    // on screen for the full PATCH+GET round trip (two sequential requests)
    // before anything visibly changed. Roll back on failure.
    setCurrentUser((prev) => (prev ? { ...prev, combo: updatedCombos } : prev));

    try {
      // PATCH /users/me already returns the fully updated user document
      // (findOneAndUpdate ... returnDocument: "after"), so the follow-up
      // GET /users/me was a wasted second round trip — use the PATCH
      // response directly instead.
      const res = await api.patch(`/users/me`, { combo: updatedCombos });
      setCurrentUser(res.data);
    } catch (err) {
      setCurrentUser((prev) => (prev ? { ...prev, combo: previousCombos } : prev));
      console.error("Failed to delete favourite combo", err);
      toast.error("Failed to delete favourite combo");
    }
  };

  const handleAddToBag = (combo) => {
    const qty = qtyMap[combo.id] || 1;
    const perUnitFinalPrice =
      combo.perComboFinalPrice ??
      combo.totalPrice ??
      combo.originalPrice ??
      0;

    // ✅ Resolve image at CLICK TIME (bulletproof)
    const img = document.querySelector(
      `.fav-combo-image[data-combo-id="${combo.id}"]`
    );

    addToBag({
      id: combo.id,
      name: combo.title,
      categoryId: "combo",
      quantity: qty,
      perComboFinalPrice: perUnitFinalPrice,
      unitPrice: perUnitFinalPrice,
      originalPrice: perUnitFinalPrice * qty,
      totalPrice: perUnitFinalPrice * qty,
      appliedOffer: combo.appliedOffer,
      comboItems: combo.comboItems,
      isCombo: true,
      isFromFavourite: true
    });

    // ✅ Trigger animation
    flyToBag({
      imgEl: img,
      dishId: combo.id
    });
  };

  const [qtyMap, setQtyMap] = useState({});
  const increaseQty = (id) =>
    setQtyMap(prev => ({ ...prev, [id]: (prev[id] || 1) + 1 }));

  const decreaseQty = (id) =>
    setQtyMap(prev => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) - 1)
    }));

  return (
    <div className="no-padding">
      {/* HEADER */}
      <div className="pl-header">
        <motion.button className="back-button" onClick={goBack} aria-label="Back" whileTap={{ scale: 0.85, x: -2 }} />
        <div className="fav-combo-header-text">
          <h1>Favourite Combos</h1>
          <p>
            {favCombos.length > 0
              ? `${favCombos.length} combo${favCombos.length > 1 ? "s" : ""} saved`
              : "Your saved combos will show up here"}
          </p>
        </div>
      </div>

      <div className="pl-body">
        {/* CONTENT */}
        <motion.section
          className="fav-combo-content"
          variants={listVariants}
          initial="hidden"
          animate="show"
        >
          <AnimatePresence>
            {favCombos.length === 0 ? (
              <motion.div
                key="fav-combo-empty"
                className="fav-combo-empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <div className="empty-icon">🍽️</div>
                <h3>No favourite combos yet</h3>
                <p>Build a combo you love and save it to see it here.</p>
              </motion.div>
            ) : (
              favCombos.map(combo => {
                const qty = qtyMap[combo.id] || 1;
                const unitPrice = combo.perComboFinalPrice || combo.totalPrice || combo.originalPrice || 0;
                const items = SLOT_ORDER
                  .map(slot => combo.comboItems?.[slot])
                  .filter(Boolean);

                return (
                  <motion.article
                    key={combo.id}
                    className="fav-combo-card"

                    /* SAME AS THANK YOU */
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -80 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}

                    whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  >
                    <div className="fav-combo-main">
                      {items.length > 0 && (
                        <div className="fav-combo-thumbs">
                          {items.map((item, i) => (
                            <span className="fav-combo-thumb" key={`${combo.id}-${i}`} style={{ zIndex: items.length - i }}>
                              <img
                                className={i === 0 ? "fav-combo-image" : ""}
                                data-combo-id={i === 0 ? combo.id : undefined}
                                src={item.image}
                                alt={item.name || ""}
                                draggable={false}
                                onError={handleImgFallback}
                              />
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="fav-combo-info">
                        <div className="fav-combo-title">
                          {combo.title}
                        </div>

                        {combo.items && (
                          <div className="fav-combo-chips">
                            {combo.items.starter && <span className="fav-combo-chip">🥗 {combo.items.starter}</span>}
                            {combo.items.main && <span className="fav-combo-chip">🍛 {combo.items.main}</span>}
                            {combo.items.drink && <span className="fav-combo-chip">🥤 {combo.items.drink}</span>}
                          </div>
                        )}

                        <div className="fav-combo-meta">
                          <span className="fav-combo-price">₹{unitPrice}</span>
                          {combo.appliedOffer && (
                            <span className="fav-combo-badge">
                              Offer Applied
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="fav-combo-actions">
                      <div className="stepper-ctrl">
                        <button className="stepper-btn" onClick={() => decreaseQty(combo.id)}>-</button>
                        <span className="stepper-val">{qty}x</span>
                        <button className="stepper-btn" onClick={() => increaseQty(combo.id)}>+</button>
                      </div>

                      <div className="price-section">
                        <div className="price-section-label">Total price:</div>
                        <div className="price-section-price">
                          ₹{qty * unitPrice}
                        </div>
                      </div>

                      <Button3D
                        className="btn-3d red width100"
                        frontStyle={{ padding: "0 10px" }}
                        onClick={() => handleDelete(combo.id)}
                      >
                        Delete
                      </Button3D>

                      <Button3D
                        className="btn-3d green width100"
                        frontStyle={{ padding: "0 10px" }}
                        onClick={() => handleAddToBag(combo)}
                      >
                        Add to Bag
                      </Button3D>
                    </div>
                  </motion.article>
                );
              })
            )}
          </AnimatePresence>
        </motion.section>
      </div>
    </div>
  );
};

export default FavouriteCombo;
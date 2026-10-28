import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import "./FoodCategory.css";
import "./FavouriteDishList.css";
import PageHeader from "./shared/PageHeader";
import Button3D from "./shared/Button3D";
import ConfirmDialog from "./shared/ConfirmDialog";
import { useToast } from "../components/Usetoast";
import { getActiveOffer, getDiscountedTotal } from "./shared/offerUtils";
import { flyToBag } from "../components/flyToBag";

import trashIcon from "../assets/icons/trash1.png"
import { handleImgFallback } from "../App";

const FavouriteDishList = ({
  foodData,
  currentUser,
  setCurrentUser,
  handleBack,
  handleHome,
  addToBag
}) => {
  const navigate = useNavigate();
  const { source, categoryId } = useParams();
  const { toast } = useToast();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dishToDelete, setDishToDelete] = useState(null);

  const isMyFavourites = source === "my";

  // BLOCK GUEST ACCESS
  if (source === "my" && !currentUser) {
    return null;
  }

  const favourites =
    source === "my"
      ? currentUser?.favourites || []
      : foodData.favourites || [];

  const dishes = favourites.filter(
    (dish) => dish.categoryId === categoryId
  );

  const findCategoryOrSubCategory = (id) => {
    for (const cat of foodData.categories) {
      if (cat.id === id) return cat;
      const sub = (cat.subCategories || []).find((s) => s.id === id);
      if (sub) return sub;
    }
    return null;
  };

  const category = findCategoryOrSubCategory(categoryId);

  /* ---------------- ADD TO BAG LOGIC ---------------- */

  const handleAddToBag = (dish, e) => {
    e.stopPropagation();

    const activeOffer = getActiveOffer(dish.originalDishId || dish.id, foodData.offers);
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

    const img = e.currentTarget
      .closest(".fav-food-category-items")
      ?.querySelector(".fav-food-category-image img");
    flyToBag({ imgEl: img, dishId: dish.id });

    toast.success(`${dish.name} added to bag`);
  };

  /* ---------------- DELETE LOGIC ---------------- */

  const confirmDeleteFavourite = () => {
    if (!dishToDelete || !currentUser) return;

    const removedDish = dishToDelete;
    // Snapshot the pre-delete favourites list so we can roll back in
    // place if the request fails below — currentUser will have already
    // moved on by then, so we can't just recompute this from it.
    const previousFavourites = currentUser.favourites || [];

    // Close the dialog and update the UI immediately (optimistic
    // update) instead of waiting on the PATCH request below — that
    // request can take a while, and the person shouldn't be staring at
    // an open "Remove Favourite" modal for it. The list re-filters off
    // currentUser.favourites, so removing the dish here makes it
    // disappear from the page right away.
    setShowDeleteConfirm(false);
    setDishToDelete(null);
    setCurrentUser({
      ...currentUser,
      favourites: previousFavourites.filter((f) => f.id !== removedDish.id)
    });

    // PATCH /users/me/favourites is customer-auth-gated and returns the
    // updated user doc directly — no need for the separate PUT-then-GET
    // round trip the admin-gated /users/:id route would have required
    // (and which a customer session can't reach anyway). Runs in the
    // background now; on success we reconcile with the server's copy,
    // and on failure we roll back to the pre-delete snapshot and let
    // the person know so the favourite doesn't just silently reappear
    // on next refresh with no explanation.
    api.patch("/users/me/favourites", { id: removedDish.id, _remove: true })
      .then((res) => {
        setCurrentUser(res.data);
      })
      .catch((err) => {
        console.error("Failed to delete favourite", err);
        toast.error("Failed to remove favourite dish. Restoring it.");
        setCurrentUser((current) => ({
          ...current,
          favourites: previousFavourites
        }));
      });
  };

  /* ---------------- RENDER ---------------- */

  return (
    <div className="no-padding">
      {/* HEADER */}
      <PageHeader
        title={category?.name || "Favourites"}
        wrapperClassName="food-header"
        titleClassName="food-list-title"
        onBack={handleBack}
        onHome={handleHome}
      />

      <div className="pl-body food-list fav-dish-page">
        {/* LIST */}
        <div className="food-category" style={{ padding: "0px" }}>
          <div className="food-category-container">
            {dishes.length === 0 && (
              <div className="fav-empty fav-empty-page">
                <div className="fav-empty-icon">🍽️</div>
                <h3 className="fav-empty-title">No favourite dishes yet</h3>
                <p className="fav-empty-sub">Dishes you favourite in this category will show up here.</p>
              </div>
            )}

            {dishes.map((dish) => (
              <div
                key={dish.id}
                className="fav-food-category-items"
                role="button"
                onClick={() =>
                  navigate(`/favourites/${source}/dish/${dish.id}`, {
                    state: {
                      favouriteSnapshot: dish,
                      categoryId: dish.categoryId
                    }
                  })
                }
              >
                <div className="fav-food-category-image">
                  <img src={dish.image} alt={dish.name} loading="lazy" decoding="async"  onError={handleImgFallback} />
                </div>
                <div className="fav-food-category-name">
                  {dish.name}
                </div>

                {dish.customerName && (
                  <div className="fav-customer-name">
                    By {dish.customerName}
                  </div>
                )}

                <div className="fav-food-category-actions">
                  {isMyFavourites && (
                    <Button3D
                      className="btn-3d red icon-width"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDishToDelete(dish);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      <img alt=""
                        src={trashIcon}
                      />
                    </Button3D>
                  )}

                  <Button3D
                    className="btn-3d green"
                    onClick={(e) => handleAddToBag(dish, e)}
                    frontStyle={{ padding: "0 5px" }}
                  >
                    Add to Cart
                  </Button3D>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DELETE CONFIRM OVERLAY */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Remove Favourite"
        message={<>Are you sure you want to remove <strong>{dishToDelete?.name}</strong>?</>}
        onConfirm={confirmDeleteFavourite}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};

export default FavouriteDishList;
import { useState } from "react";
import { createPortal } from "react-dom";
import "./WishlistButton.css";
import { useToast } from "../../components/Usetoast";
import ConfirmDialog from "./ConfirmDialog";

/**
 * WishlistButton
 * ---------------
 * Lightweight heart toggle for use on food list / grid / expanded pages
 * where a full "name your custom dish" form isn't needed — clicking simply
 * adds or removes the dish (as-is, base size) from currentUser.favourites.
 *
 * Reuses the same favourite id convention as FoodItem.js's simple wishlist
 * toggle (`${dishId}_regular`) so a dish favourited from a list page shows
 * as already-wishlisted if opened in FoodItem, and vice versa.
 *
 * Removing an existing favourite asks for confirmation first (via
 * ConfirmDialog) — the same "are you sure?" pattern FavouriteDishList.js
 * already uses for its own delete button — since this heart toggle is a
 * single click with no undo.
 *
 * Props:
 *  - dish: the dish object (id, name, image, basePrice, description...)
 *  - categoryId: id of the category/subCategory the dish belongs to
 *  - currentUser: current user object (or null/guest)
 *  - onToggleFavourite: (dish) => void — from App.js
 *  - size: "sm" | "md" — visual size, defaults to "sm"
 *  - className: extra classes for positioning within a card
 */
const WishlistButton = ({
  dish,
  categoryId,
  currentUser,
  onToggleFavourite,
  size = "sm",
  className = "",
}) => {
  const { toast } = useToast();
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  if (!dish || !onToggleFavourite) return null;

  const favouriteId = `${dish.id}_regular`;
  const favourites = currentUser?.favourites || [];
  const isWishlisted = favourites.some((f) => f.id === favouriteId);

  const confirmRemove = () => {
    onToggleFavourite({ id: favouriteId, _remove: true });
    toast.info(`${dish.name} removed from favourites`);
    setShowRemoveConfirm(false);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (isWishlisted) {
      setShowRemoveConfirm(true);
      return;
    }

    onToggleFavourite({
      id: favouriteId,
      originalDishId: dish.id,
      name: dish.name,
      description: dish.description || "",
      image: dish.image,
      categoryId: categoryId || dish.categoryId,
      selectedSize: "regular",
      basePrice: dish.basePrice,
      totalPrice: dish.basePrice,
      ingredients: dish.ingredients || [],
      benefits: dish.benefits || {},
    });
    toast.success(`${dish.name} added to favourites`);
  };

  return (
    <>
      <button
        type="button"
        className={`wishlist-toggle-btn wishlist-toggle-btn--${size} ${isWishlisted ? "active" : ""} ${className}`}
        onClick={handleClick}
        aria-label={isWishlisted ? `Remove ${dish.name} from wishlist` : `Add ${dish.name} to wishlist`}
        aria-pressed={isWishlisted}
      >
        <span className="wishlist-toggle-shadow" />
        <span className="wishlist-toggle-edge" />
        <span className="wishlist-toggle-front">♥</span>
      </button>

      {/* Portalled to document.body — this button can render inside
          transformed/animated ancestors (page transitions, layout
          animations), and ConfirmDialog needs to sit above all of that
          as a true full-screen overlay rather than being clipped or
          mispositioned by them. */}
      {createPortal(
        <ConfirmDialog
          open={showRemoveConfirm}
          title="Remove Favourite"
          message={<>Are you sure you want to remove <strong>{dish.name}</strong> from your favourites?</>}
          onConfirm={confirmRemove}
          onCancel={() => setShowRemoveConfirm(false)}
        />,
        document.body
      )}
    </>
  );
};

export default WishlistButton;

import { useEffect, useMemo, useRef } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { useNavigate } from "react-router-dom";
import "./IngredientsCarousel.css";
import { handleImgFallback } from "../App";

const ITEM_WIDTH = 84;
const GAP = 14;

const ITEMS_PER_SWIPE = 4;          // ✅ NEW
const SLIDE_DISTANCE =
  ITEMS_PER_SWIPE * (ITEM_WIDTH + GAP);

const AUTO_SLIDE_MS = 4000;
const DRAG_THRESHOLD = 60;

export default function IngredientsCarousel({
  ingredients = [],
  allIngredients = []
}) {
  const navigate = useNavigate();
  const safe = Array.isArray(ingredients) ? ingredients : [];
  const fullList = Array.isArray(allIngredients) ? allIngredients : [];

  const x = useMotionValue(0);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const autoTimer = useRef(null);

  const items = useMemo(() => {
    if (!Array.isArray(safe) || safe.length === 0) return [];

    const validItems = safe.filter((ing) => {
      const full = fullList.find(item =>
        item.id === ing.id ||
        item.name === ing.name
      );

      if (!full) return false;

      const isGloballyDisabled = full.isDisabledGlobally === true;
      return !isGloballyDisabled;
    });

    if (validItems.length === 0) return [];

    return [...validItems, ...validItems, ...validItems];
  }, [safe, fullList]);

  const totalWidth =
    (items.length / 3) * (ITEM_WIDTH + GAP);

  /* ---------------- AUTO SLIDE ---------------- */

  const slideBy = (distance, animated = true) => {
    const target = x.get() - distance;

    if (!animated) {
      x.set(target);
      return;
    }

    animate(x, target, {
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1]
    });
  };

  const normalizePosition = () => {
    const current = x.get();

    if (current <= -totalWidth * 2) {
      x.set(current + totalWidth);
    }

    if (current >= -totalWidth) {
      x.set(current - totalWidth);
    }
  };

  const startAutoSlide = () => {
    stopAutoSlide();
    autoTimer.current = setInterval(() => {
      slideBy(SLIDE_DISTANCE);
    }, AUTO_SLIDE_MS);
  };

  const stopAutoSlide = () => {
    if (autoTimer.current) {
      clearInterval(autoTimer.current);
      autoTimer.current = null;
    }
  };

  /* ---------------- EFFECTS ---------------- */

  useEffect(() => {
    const originalLength = items.length / 3;

    if (originalLength <= 5) return;

    // start from middle copy
    x.set(-totalWidth);

    startAutoSlide();
    return stopAutoSlide;
  }, [items.length]);

  /* ---------------- RENDER ---------------- */

  if (items.length === 0) return null;

  return (
    <div className="ingredients-carousel">
      <button
        className="carousel-arrow ingredient-left-btn"
        onClick={() => {
          stopAutoSlide();
          slideBy(-SLIDE_DISTANCE);
          startAutoSlide();
        }}
      />

      <div
        className="carousel-viewport"
        onPointerDown={(e) => {
          isDragging.current = true;
          startX.current = e.clientX;
          stopAutoSlide();
        }}
        onPointerUp={(e) => {
          if (!isDragging.current) return;

          const diff = startX.current - e.clientX;

          if (diff > DRAG_THRESHOLD) {
            slideBy(SLIDE_DISTANCE);
          } else if (diff < -DRAG_THRESHOLD) {
            slideBy(-SLIDE_DISTANCE);
          }

          isDragging.current = false;
          startAutoSlide();
        }}
        onPointerLeave={() => {
          isDragging.current = false;
          startAutoSlide();
        }}
      >
        <motion.div
          className="carousel-track"
          style={{ x }}
          onUpdate={normalizePosition}
        >
          {items.map((ing, i) => {
            const full = fullList.find(
              (item) =>
                item.id === ing.id ||
                item.name === ing.name
            );

            return (
              <div
                key={`${ing.id}-${i}`}
                className="dish-ingredient-item"
                onClick={() =>
                  navigate(`/ingredient/${full.id}`)
                }
              >
                <div className="dish-ingredient-image">
                  <img
                    src={full.image}
                    alt={ing.name}
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    onError={handleImgFallback}
                  />
                </div>
                <div className="dish-ingredient-name">
                  {ing.name}
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      <button
        className="carousel-arrow ingredient-right-btn"
        onClick={() => {
          stopAutoSlide();
          slideBy(SLIDE_DISTANCE);
          startAutoSlide();
        }}
      />
    </div>
  );
}

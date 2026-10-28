export const flyToBag = ({ imgEl, dishId, customizationKey = "" }) => {
  if (!imgEl || !dishId) return;

  // ─── Parabolic fly animation ───────────────────────────────────────────────
  // imgEl   : the source <img> on the dish card (used for position + clone)
  // targetEl: destination element (bag row img or floating button)
  const animateParabolicToTarget = (imgEl, targetEl) => {
    const imgRect = imgEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    // Clone the dish image and pin it to the viewport with position:fixed
    // so it renders at exactly the right screen coordinates regardless of
    // scroll position or any ancestor transform.
    const clone = imgEl.cloneNode(true);
    clone.className = "fly-img";
    clone.style.position = "fixed";           // ✅ must be fixed, not static
    clone.style.left = imgRect.left + "px";
    clone.style.top = imgRect.top + "px";
    clone.style.width = imgRect.width + "px";
    clone.style.height = imgRect.height + "px";
    clone.style.margin = "0";
    clone.style.padding = "0";
    clone.style.borderRadius = "12px";
    clone.style.objectFit = "cover";
    clone.style.pointerEvents = "none";
    clone.style.zIndex = "9999";
    clone.style.transform = "translate3d(0,0,0) scale(1)";
    clone.style.opacity = "1";
    clone.style.transition = "none";
    document.body.appendChild(clone);

    // Centre-points of source and destination
    const startCX = imgRect.left + imgRect.width / 2;
    const startCY = imgRect.top + imgRect.height / 2;
    const endCX = targetRect.left + targetRect.width / 2;
    const endCY = targetRect.top + targetRect.height / 2;

    const dx = endCX - startCX;
    const dy = endCY - startCY;

    // Arc peak: always curve upward on screen (negative Y = up).
    // Use 40% of horizontal distance as arc height, min 140px so short
    // flights still look nice.
    const arcHeight = Math.max(140, Math.abs(dx) * 0.4);
    const peak = -arcHeight; // always goes up regardless of target position

    const duration = 750;          // ms — snappy but readable
    let startTime = null;

    const startScale = 1.0;
    const endScale = Math.min(
      targetRect.width / imgRect.width,
      targetRect.height / imgRect.height
    );

    const animate = (now) => {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);

      // Ease-out quartic for position, linear for scale so it shrinks steadily
      const easedT = 1 - Math.pow(1 - t, 4);

      // Quadratic bezier: P(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
      // P0 = (0, 0), P1 = (dx/2, peak), P2 = (dx, dy)
      const mt = 1 - easedT;
      const x = 2 * mt * easedT * (dx / 2) + easedT * easedT * dx;
      const y = 2 * mt * easedT * peak + easedT * easedT * dy;

      const scale = startScale + (endScale - startScale) * easedT;
      const opacity = t > 0.85 ? 1 - ((t - 0.85) / 0.15) : 1; // fade out at the end

      clone.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
      clone.style.opacity = opacity;

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        clone.remove();
        // Reveal the destination image now that the clone has landed
        targetEl.classList.remove("pending-img");
        targetEl.classList.add("visible-img");
      }
    };

    requestAnimationFrame(animate);
  };

  // ─── Destination resolution ────────────────────────────────────────────────
  const sheetOpen = document.querySelector(".bag-sheet");

  if (sheetOpen) {
    // The bag sheet is open — fly to the matching row's image.
    // The row may not exist yet (React hasn't re-rendered) so we poll
    // with rAF up to ~60 frames (~1 s) before giving up.
    let attempts = 0;
    const MAX_ATTEMPTS = 60;

    const waitForRow = () => {
      attempts++;
      if (attempts > MAX_ATTEMPTS) {
        // Fallback: fly to the floating button if row never appeared
        const bagBtn = document.getElementById("floating-bag-btn");
        if (bagBtn) animateParabolicToTarget(imgEl, bagBtn);
        return;
      }

      const selector = customizationKey
        ? `.bag-item-row[data-dish-id="${dishId}"][data-custom-key="${customizationKey}"]`
        : `.bag-item-row[data-dish-id="${dishId}"]`;

      const row = document.querySelector(selector);

      if (!row) {
        // Row not in DOM yet — wait another frame
        requestAnimationFrame(waitForRow);
        return;
      }

      const imgInRow = row.querySelector("img");
      if (!imgInRow) {
        requestAnimationFrame(waitForRow);
        return;
      }

      // Scroll the row into view first, then start the flight so the
      // destination rect is accurate (not off-screen).
      const container = document.getElementById("bag-items-container");
      if (container) {
        row.scrollIntoView({ behavior: "smooth", block: "nearest" });
        // Give the smooth scroll a frame to settle before reading rects
        requestAnimationFrame(() => {
          animateParabolicToTarget(imgEl, imgInRow);
        });
      } else {
        animateParabolicToTarget(imgEl, imgInRow);
      }
    };

    waitForRow();
    return;
  }

  // Sheet is closed — fly to the floating bag button
  const bagBtn = document.getElementById("floating-bag-btn");
  if (bagBtn) {
    animateParabolicToTarget(imgEl, bagBtn);
  }
};
import React from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * ModalTransition
 * ----------------
 * The one animation used by every overlay in the app: modals, confirm
 * dialogs, bottom sheets, the date picker, and the time picker all
 * render through this component so they open/close identically —
 * a soft zoom in from the center, with the backdrop fading in behind
 * it. Replaces the old per-component CSS keyframe + closing-class-with-
 * a-timer pattern, and the various one-off Framer Motion variants that
 * used to differ from screen to screen.
 *
 * Framer Motion's AnimatePresence handles the exit animation itself —
 * it keeps the component mounted for the duration of `exit`, then
 * unmounts it, so callers just flip `open` and don't need their own
 * closing-state/timeout bookkeeping.
 *
 * Props:
 *  - open:              whether the overlay is visible
 *  - onClose:            called when the backdrop is clicked (pass
 *                        undefined to make the backdrop non-dismissing)
 *  - children:           the panel content
 *  - overlayClassName:   extra class(es) for the backdrop element, e.g.
 *                        "ep-sheet-overlay" — for any layout rules
 *                        (position, background, flex alignment) that
 *                        vary between call sites. "modal-transition-overlay"
 *                        is always applied too.
 *  - panelClassName:     extra class(es) for the panel element, e.g.
 *                        "rf-modal" or "ep-sheet" — same idea.
 *                        "modal-transition-panel" is always applied.
 *  - panelProps:         extra props spread onto the panel's motion.div
 *                        (e.g. onClick to stopPropagation, role, etc.)
 *
 * Example:
 *   <ModalTransition
 *     open={showPreview}
 *     onClose={() => setShowPreview(false)}
 *     panelClassName="rf-modal"
 *     overlayClassName="rf-modal-overlay"
 *   >
 *     <div className="rf-modal-title">Confirm Your Order</div>
 *     ...
 *   </ModalTransition>
 */

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.22, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.18, ease: "easeIn" } },
};

const panelVariants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.28, ease: [0.34, 1.4, 0.64, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.18, ease: "easeIn" },
  },
};

export default function ModalTransition({
  open,
  onClose,
  children,
  overlayClassName = "",
  panelClassName = "",
  panelProps = {},
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`modal-transition-overlay ${overlayClassName}`.trim()}
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className={`modal-transition-panel ${panelClassName}`.trim()}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            {...panelProps}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { createPortal } from "react-dom";
import { useIsBelowWidth } from "./useIsBelowWidth";

/**
 * FormBtnRowPortal — wraps .form-btn-row (the Cancel/Submit bar on
 * Catering/Reservation/PreBooking/Celebration).
 *
 * Below 600px .form-btn-row becomes `position: fixed` (see
 * .form-btn-row's @media (max-width: 600px) block in
 * ReservationForm.css). At that width it must not live inside the
 * route's animated .page-transition-wrapper: Framer Motion applies a
 * CSS transform to that wrapper while a page transition plays (see
 * pageVariants/motionProps in App.js), and a transformed ancestor
 * becomes the containing block for any fixed-position descendant —
 * so .form-btn-row would suddenly be "fixed" relative to the sliding
 * wrapper instead of the viewport, appearing mid-page in normal flow
 * for the ~300ms the transition plays and only jumping to its real
 * fixed-to-viewport bottom position once the transform settles.
 * Portalling it straight to document.body at that width keeps it
 * anchored to the viewport regardless of what the route transition is
 * doing. Above 600px .form-btn-row is a normal-flow flex child of
 * each page's own form column, so it renders inline as before — same
 * split FoodItem.js already uses for its own `.bottom` bar.
 */
export default function FormBtnRowPortal({ children }) {
  const isFixedBar = useIsBelowWidth(600);
  return isFixedBar ? createPortal(children, document.body) : children;
}

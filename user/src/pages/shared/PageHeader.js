import HomeButton from "./HomeButton";
import './PageLayout.css';
import { useScrollHeader } from "./useScrollHeader";

/**
 * PageHeader
 * ----------
 * Standard page header: a back button on the left, a title in the
 * middle, and the home button on the right. Used by virtually every
 * top-level page (FoodList, FoodGridList, Favourites, Events, Catering,
 * Celebration, Reservation, PreBooking, AppetizerBuilder, etc).
 *
 * Props:
 *  - title:            string | node — header title content
 *  - onBack:           click handler for the back button
 *  - onHome:           click handler for the home button
 *  - wrapperClassName: className for the outer header container
 *                       (default: "food-grid-header")
 *  - backClassName:    className for the back button
 *                       (default: "back-button")
 *  - titleTag:         tag used to render the title (default: "div")
 *  - titleClassName:   className for the title element
 *                       (default: "food-grid-title")
 *  - rightExtra:       optional node rendered between the title and the
 *                       home button (e.g. a compact "+ Add" action)
 *
 * Example:
 *   <PageHeader title="Catering" onBack={handleBack} onHome={handleHome} />
 *
 *   <PageHeader
 *     title={dish.name}
 *     titleTag="h2"
 *     titleClassName="dish-name"
 *     wrapperClassName="food-header"
 *     onBack={handleBack}
 *     onHome={handleHome}
 *   />
 *
 * Starts fully transparent and picks up a solid, blurred background
 * once the page is actually scrolled (see useScrollHeader) — so it
 * never sits as an opaque bar over the title before there's anything
 * behind it to hide, but also never lets scrolled content bleed
 * through once it's pinned to the top.
 */
const PageHeader = ({
  title,
  onBack,
  onHome,
  wrapperClassName = "food-grid-header",
  backClassName = "back-button",
  titleTag = "div",
  titleClassName = "food-grid-title",
  rightExtra
}) => {
  const TitleTag = titleTag;
  const { headerRef, scrolled } = useScrollHeader();

  return (
    <div
      ref={headerRef}
      className={`pl-header${scrolled ? " header-scrolled" : ""}`}
    >
      <button className={backClassName} onClick={onBack} />
      <TitleTag className={titleClassName}>{title}</TitleTag>
      {rightExtra && <div className="pl-header-extra">{rightExtra}</div>}
      <HomeButton onClick={onHome} />
    </div>
  );
};

export default PageHeader;
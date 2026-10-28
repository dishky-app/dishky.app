import { useScrollHeader } from "./useScrollHeader";
import "./PageLayout.css";

/**
 * PageLayout
 * ────────────────────────────────────────────────────────────────
 * The single shared page skeleton: header, then body, then an
 * optional footer — replacing the ad-hoc "every page defines its
 * own `.xyz-page` container with its own padding/overflow rules"
 * pattern that had drifted into ~15 near-duplicate copies across
 * the codebase (all `padding: 36px` on every side, no responsive
 * sizing, and each page picking its own mix of `overflow: hidden` /
 * `height: 100vh` / a nested scrolling div, which is exactly why the
 * sticky header's "clip content behind it" behaviour was inconsistent
 * from page to page — some pages didn't even have a real scrolling
 * ancestor for the header to sit in front of).
 *
 * PageLayout now OWNS the one real scroll container (`.pl-body`) for
 * every page that uses it. The header sits above it, sticky, and
 * because `.pl-body` is always the thing that actually scrolls,
 * `useScrollHeader` reliably finds it as the nearest scrolling
 * ancestor — no more per-page guessing.
 *
 * Padding rules (this is what "responsive padding" means here):
 *   - Header: responsive padding on TOP and SIDES (clamp-based, see
 *     PageLayout.css) — the header reserves its own breathing room
 *     above the title/buttons regardless of viewport width.
 *   - Body: responsive padding on SIDES ONLY, no top padding — the
 *     header already occupies that space, and content should start
 *     flush under it rather than doubling up on vertical gap.
 *
 * Usage — pass existing header JSX through the `header` prop
 * (e.g. a <PageHeader/> call, or a page's own bespoke topbar markup)
 * unchanged; page-specific content becomes `children`:
 *
 *   <PageLayout header={<PageHeader title="Catering" onBack={handleBack} onHome={handleHome} />}>
 *     ...page body...
 *   </PageLayout>
 *
 * For pages with a footer-ish action bar (sticky bottom buttons etc.)
 * that should sit OUTSIDE the scrolling body, pass `footer`.
 *
 * `bodyClassName` lets a page add its own class alongside `.pl-body`
 * for page-specific body styling (grid layouts, etc.) without losing
 * the shared padding/scroll rules. `noBodyPadding` opts a page out of
 * the default side padding entirely, for pages that need edge-to-edge
 * content (an image grid that should touch the viewport edge, say).
 *
 * `fixedHeight` is for pages that need a locked-to-viewport layout
 * with their OWN internal scrolling regions instead of letting the
 * page/body scroll normally — e.g. ReservationForm's two-column
 * form, where each column scrolls independently and the submit
 * buttons stay fixed at the bottom rather than scrolling away. With
 * `fixedHeight`, `.pl-body` becomes `overflow: hidden` and doesn't
 * scroll itself; the page's own content is responsible for its own
 * `overflow-y: auto` region(s) inside it (as ReservationForm's
 * `.rf-col` already does). The header's scroll-clipping behaviour
 * still works correctly in this mode — useScrollHeader finds
 * whichever inner element is actually scrolling.
 */
const PageLayout = ({
  header,
  children,
  footer,
  className = "",
  bodyClassName = "",
  noBodyPadding = false,
  fixedHeight = false,
}) => {
  return (
    <div className={`pl-page${fixedHeight ? " pl-page--fixed" : ""}${className ? ` ${className}` : ""}`}>
      {header}
      <main
        className={`pl-body${fixedHeight ? " pl-body--fixed" : ""}${noBodyPadding ? " pl-body--no-padding" : ""}${bodyClassName ? ` ${bodyClassName}` : ""}`}
      >
        {children}
      </main>
      {footer}
    </div>
  );
};

/**
 * PageLayoutHeader
 * ────────────────────────────────────────────────────────────────
 * For pages whose header is more than the standard back/title/home
 * row (e.g. a two-line title+subtitle, or extra action buttons) and
 * so can't just reuse <PageHeader/> as-is. Provides the same sticky/
 * transparent-then-solid/responsive-padding shell as every other
 * header, with arbitrary children instead of a fixed title prop.
 *
 *   <PageLayout header={
 *     <PageLayoutHeader>
 *       <button className="back-button" onClick={handleBack} />
 *       <div style={{ flex: 1 }}>
 *         <div className="rf-page-title">Table Reservation</div>
 *         <div className="rf-page-sub">Reserve your perfect dining experience</div>
 *       </div>
 *       <HomeButton onClick={handleHome} />
 *     </PageLayoutHeader>
 *   }>
 */
export const PageLayoutHeader = ({ children, className = "" }) => {
  const { headerRef, scrolled } = useScrollHeader();
  return (
    <header
      ref={headerRef}
      className={`pl-header${scrolled ? " header-scrolled" : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
    </header>
  );
};

export default PageLayout;

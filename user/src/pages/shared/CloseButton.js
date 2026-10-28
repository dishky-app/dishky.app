import ButtonFace from "./ButtonFace";
import closeIcon from "../../assets/icons/close.png";

/**
 * CloseButton
 * ----------
 * The recurring "Close" pill used for some pages.
 *
 * Example:
 *   <CloseButton onClick={handleClose} />
 */
const CloseButton = ({ onClick }) => (
  <div className="home-btn home-btn-icon" onClick={onClick} role="button" aria-label="close">
    <ButtonFace frontStyle={{ padding: "clamp(4px, 1.6vw, 6px) clamp(6px, 2.4vw, 9px)", backgroundColor: "var(--bg-surface)" }}>
      <img src={closeIcon} alt="close" style={{ width: "clamp(12px, 3.6vw, 16px)", height: "clamp(12px, 3.6vw, 16px)" }} />
    </ButtonFace>
  </div>
);

export default CloseButton;

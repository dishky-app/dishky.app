import ButtonFace from "./ButtonFace";
import homeIcon from "../../assets/icons/home.png";

/**
 * HomeButton
 * ----------
 * The recurring "go home" pill used in every page header.
 *
 * Example:
 *   <HomeButton onClick={handleHome} />
 */
const HomeButton = ({ onClick }) => (
  <div className="home-btn home-btn-icon" onClick={onClick} role="button" aria-label="Home">
    <ButtonFace>
      <img src={homeIcon} alt="home-btn" />
    </ButtonFace>
  </div>
);

export default HomeButton;

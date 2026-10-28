import "./ProfileButton.css";
import { useLocation, useNavigate } from "react-router-dom";
import Button3D from "./shared/Button3D";

/**
 * ProfileButton
 * -------------
 * Floating button that sits just above the FloatingBag pill, visible
 * only to logged-in (non-guest) customers. Tapping it opens /profile.
 * Hidden on the same routes FloatingBag hides on (Welcome + ThankYou),
 * plus anywhere FloatingBag itself is hidden (event pages), so the two
 * floating controls always appear/disappear together.
 */
const ProfileButton = ({ currentUser }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthenticatedUser = currentUser && currentUser.id !== "guest";
  if (!isAuthenticatedUser) return null;

  if (location.pathname === "/" || location.pathname === "/thank-you" || location.pathname === "/scan-table")
    return null;

  const initial = (currentUser.name || "").trim().charAt(0).toUpperCase() || "👤";

  return (
    <Button3D
      id="floating-profile-btn"
      className="floating-btn floating-profile-btn"
      onClick={() => navigate("/profile")}
      aria-label="My Profile"
    >
      {initial}
    </Button3D>
  );
};

export default ProfileButton;

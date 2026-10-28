import FavouriteCombo from "./FavouriteCombo";
import ModalTransition from "./shared/ModalTransition";
import "./shared/ModalTransition.css";

const FavouriteComboOverlay = ({
  open,
  onClose,
  currentUser,
  setCurrentUser,
  addToBag
}) => {
  return (
    <ModalTransition open={open} onClose={onClose} overlayClassName="combo-my-fav-overlay" panelClassName="combo-my-fav-modal">
            <div className="combo-my-fav-header">
              <h3 className="combo-my-fav-title">My Favourite Combos</h3>
              <button
                className="combo-my-fav-close-btn"
                onClick={onClose}
              >
                ✕
              </button>
            </div>

            <div className="combo-my-fav-list">
              <FavouriteCombo
                currentUser={currentUser}
                setCurrentUser={setCurrentUser}
                addToBag={addToBag}
                handleBack={onClose}
              />
            </div>
    </ModalTransition>
  );
};

export default FavouriteComboOverlay;

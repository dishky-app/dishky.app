import Button3D from "./Button3D";
import ModalTransition from "./ModalTransition";
import "./ModalTransition.css";

/**
 * ConfirmDialog
 * -------------
 * Reusable "are you sure?" confirmation overlay used for destructive
 * actions (e.g. removing a favourite, deleting a saved combo).
 *
 * Props:
 *  - open:        whether the dialog is visible
 *  - title:       dialog heading
 *  - message:     node rendered as the body text
 *  - confirmLabel / cancelLabel: button labels (defaults: "Remove" / "Cancel")
 *  - onConfirm:   called when the confirm button is clicked
 *  - onCancel:    called when the cancel button is clicked
 *
 * Example:
 *   <ConfirmDialog
 *     open={showDeleteConfirm}
 *     title="Remove Favourite"
 *     message={<>Are you sure you want to remove <strong>{dishToDelete?.name}</strong>?</>}
 *     onConfirm={confirmDeleteFavourite}
 *     onCancel={() => setShowDeleteConfirm(false)}
 *   />
 */
const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = "Remove",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel
}) => (
  <ModalTransition open={open} onClose={onCancel} overlayClassName="confirm-overlay" panelClassName="confirm-box">
    {title && <h3>{title}</h3>}
    {message && <p>{message}</p>}

    <div className="btn-section">
      <Button3D className="btn-3d white" onClick={onCancel}>
        {cancelLabel}
      </Button3D>
      <Button3D className="btn-3d red" onClick={onConfirm}>
        {confirmLabel}
      </Button3D>
    </div>
  </ModalTransition>
);

export default ConfirmDialog;

/**
 * CancelReasonModal.js  —  Dishky Admin Panel
 * ─────────────────────────────────────────────────────────────────────────
 * Shared "why are you cancelling this?" prompt used by every module that
 * lets an admin cancel a booking/order (Events, Celebrations, PreBookings,
 * Reservations, Catering, Subscriptions). Same shell as Orders.js's
 * cancel-order popup (.pickup-modal, modal-anim-in/out via
 * usePopupAnimation), but with a single free-text reason field instead of
 * Orders' radio-button reason list, per spec.
 *
 * USAGE
 * -----
 *   import usePopupAnimation from "../hooks/usePopupAnimation";
 *   import CancelReasonModal from "../components/CancelReasonModal";
 *
 *   const cancelPopup = usePopupAnimation({
 *     duration: MODAL_ANIM_EXIT_DURATION,
 *     inClass: "modal-anim-in",
 *     outClass: "modal-anim-out",
 *   });
 *
 *   <Button3D variant="danger" onClick={() => cancelPopup.open(record)}>
 *     Cancel
 *   </Button3D>
 *
 *   <CancelReasonModal
 *     popup={cancelPopup}
 *     title="Cancel Booking"
 *     itemLabel={cancelPopup.data?.name}
 *     onConfirm={(reason) => handleCancel(cancelPopup.data, reason)}
 *   />
 *
 * `onConfirm` is only ever called with a non-empty, trimmed reason — the
 * modal validates locally (visible inline error + disabled confirm button)
 * and won't call back until the textbox has real content. The modal closes
 * itself and resets its own field after a successful confirm; `onConfirm`
 * can be async (e.g. the caller's own api.patch) — the modal awaits it and
 * keeps the Confirm button in a "Cancelling…" state meanwhile, and on
 * rejection stays open (with the reason preserved) so the admin can retry.
 */
import { useState } from "react";
import Button3D from "./Button3D";

const MAX_REASON_LENGTH = 300;

export default function CancelReasonModal({
  popup,
  title = "Cancel",
  itemLabel,
  confirmLabel = "Confirm Cancel",
  backLabel = "Back",
  onConfirm,
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!popup.shouldRender) return null;

  const trimmed = reason.trim();
  const hasError = touched && !trimmed;

  const resetAndClose = () => {
    popup.close(() => {
      setReason("");
      setTouched(false);
      setSubmitting(false);
    });
  };

  const handleConfirm = async () => {
    if (!trimmed) {
      setTouched(true);
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(trimmed);
      resetAndClose();
    } catch (err) {
      // Leave the modal open with the reason intact so the admin can
      // retry — the caller is responsible for surfacing its own error
      // toast, same as every other action in this app.
      setSubmitting(false);
    }
  };

  return (
    <div className={`pickup-overlay ${popup.animClass}`}>
      <div
        className={`pickup-modal cancel-reason-modal ${popup.animClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{title}{itemLabel ? ` — ${itemLabel}` : ""}</h3>
        <p>Please enter a reason for cancelling. This will be shown on the details page.</p>

        <div className="admin-form-group cancel-reason-field">
          <div className="mat">
            <textarea
              className={`mat-input mat-textarea${hasError ? " mat-error" : ""}`}
              placeholder=" "
              autoFocus
              value={reason}
              maxLength={MAX_REASON_LENGTH}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
            />
            <label className={`mat-label${hasError ? " mat-label-error" : ""}`}>
              Cancellation Reason<span className="rf-req">*</span>
            </label>
            <span className={`mat-bar${hasError ? " mat-bar-error" : ""}`} />
          </div>
          {hasError && <div className="field-error-msg">A reason is required to cancel.</div>}
        </div>

        <div className="pickup-actions">
          <Button3D variant="cancel" onClick={resetAndClose} disabled={submitting}>
            {backLabel}
          </Button3D>
          <Button3D
            variant="danger"
            onClick={handleConfirm}
            disabled={submitting || !trimmed}
          >
            {submitting ? "Cancelling…" : confirmLabel}
          </Button3D>
        </div>
      </div>
    </div>
  );
}

/**
 * TrialStatusModal.js  —  Dishky Admin Panel   (prefix: td-)
 * "Update Status" dialog shared by the Trial Dish list and the trial page. It only offers the moves the workflow allows from
 * the trial's current status (meta.transitions) and asks for what each move needs:
 *   Approve → final remarks · Reject / Retest → reason + recommended modifications · On hold → reason.
 * Approve / Reject / Retest are limited to managers and super admins (the server enforces it too).
 */
import React, { useEffect, useState } from "react";

import api from "../api";
import closeIcon from "../icon/close-icon.png";
import { allowTextInput } from "../App";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";
import CustomDropdown from "../components/CustomDropdown";
import { CustomDatePicker } from "../components/CustomDatePicker";
import { errMsg, Mat, statusClass } from "./TrialDishShared";

const MOVE_LABEL = {
  in_progress: "Start / resume trial",
  under_review: "Submit for review",
  on_hold: "Put on hold",
  pending: "Move back to pending",
  approved: "Approve",
  rejected: "Reject",
  retest: "Send for retest",
};
const REVIEWER_ONLY = new Set(["approved", "rejected", "retest"]);

/** Moves the current user may make from `status`. */
export function allowedMoves(meta, status, isReviewer) {
  const raw = (meta && meta.transitions && meta.transitions[status]) || [];
  return raw
    .filter((m) => isReviewer || !REVIEWER_ONLY.has(m))
    .filter((m) => !(status === "rejected" && m === "pending" && !isReviewer));
}

export default function TrialStatusModal({ modal, trial, meta, isReviewer, onDone, initialMove = "" }) {
  const { toast } = useToast();
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [recs, setRecs] = useState("");
  const [remarks, setRemarks] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (modal.shouldRender) { setTo(initialMove || ""); setReason(""); setRecs(""); setRemarks(""); setNextDate(""); setErrors({}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal.shouldRender, trial && trial.id]);

  if (!modal.shouldRender || !trial || !meta) return null;
  const moves = allowedMoves(meta, trial.status, isReviewer);
  const reopen = trial.status === "rejected" && to === "pending";
  const label = (m) => (trial.status === "rejected" && m === "pending" ? "Reopen for a new attempt" : MOVE_LABEL[m] || m);

  const submit = async () => {
    const e = {};
    if (!to) e.to = "Choose what happens next";
    if ((to === "on_hold" || to === "rejected" || to === "retest") && !reason.trim()) e.reason = to === "on_hold" ? "Give a reason for the hold" : "A reason is required";
    if ((to === "rejected" || to === "retest") && !recs.trim()) e.recs = "Recommended modifications are required";
    if (to === "approved" && !remarks.trim()) e.remarks = "Add the final approval remarks";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await api.post(`/trial-dishes/${trial.id}/status`, { to, reason, recommendations: recs, remarks, nextTrialDate: nextDate });
      toast.success(`${trial.trialId}: ${label(to)} done`);
      modal.close();
      onDone && onDone();
    } catch (err) { toast.error(errMsg(err, "Could not update the status")); }
    finally { setSaving(false); }
  };

  const text = (key, val, setVal, lbl, req, max = 600) => (
    <Mat label={lbl} required={req} error={errors[key]}>
      <textarea className={`mat-input mat-textarea${errors[key] ? " mat-error" : ""}`} placeholder=" " value={val}
        onChange={(e) => { setVal(allowTextInput(val, e.target.value, max, 150)); setErrors((p) => ({ ...p, [key]: "" })); }} />
    </Mat>
  );

  return (
    <div className={`modal-overlay ${modal.overlayClass}`}>
      <form className={`admin-modal ${modal.modalClass}`} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="admin-modal-header">
          <h3>Update Status — {trial.trialId}</h3>
          <Button3D variant="cancel" iconOnly aria-label="Close" onClick={() => modal.close()}><img src={closeIcon} alt="" /></Button3D>
        </div>
        <div className="admin-modal-body">
          <div className="td-status-now">
            <span className="td-muted">{trial.name} is currently</span> <span className={statusClass(trial.status)}>{trial.statusLabel}</span>
            {trial.attempt > 1 && <span className="td-muted"> · attempt {trial.attempt}</span>}
          </div>

          {moves.length === 0 ? (
            <p className="td-muted">
              {["approved", "rejected"].includes(trial.status)
                ? "This trial has a final decision. Only a manager can reopen a rejected trial."
                : "No status change is available to you right now."}
            </p>
          ) : (
            <>
              <div className="admin-form-group">
                <CustomDropdown label="Next step" required value={to} onChange={(v) => { setTo(v); setErrors({}); }}
                  options={moves.map((m) => ({ value: m, label: label(m) }))} placeholder="Choose next step" hasError={!!errors.to} />
                {errors.to && <div className="field-error-msg">{errors.to}</div>}
              </div>

              {to === "under_review" && <p className="td-hint">Needs at least one evaluation for the current attempt. Managers are notified when it is submitted.</p>}
              {reopen && <p className="td-hint">Reopening starts a new attempt; the earlier attempt stays in the trial history.</p>}

              {(to === "on_hold" || to === "rejected" || to === "retest") && text("reason", reason, setReason, to === "on_hold" ? "Reason for hold" : to === "rejected" ? "Reason for rejection" : "Reason for retest", true)}
              {(to === "rejected" || to === "retest") && text("recs", recs, setRecs, "Recommended modifications", true)}
              {to === "approved" && text("remarks", remarks, setRemarks, "Final approval remarks", true)}
              {to === "retest" && (
                <div className="admin-form-group">
                  <label className="td-field-label">Next trial date (optional)</label>
                  <CustomDatePicker value={nextDate} onChange={setNextDate} placeholder="Schedule the next trial" />
                </div>
              )}
            </>
          )}
        </div>
        <div className="admin-modal-footer">
          <Button3D variant="cancel" onClick={() => modal.close()}>Cancel</Button3D>
          {moves.length > 0 && <Button3D type="submit" disabled={saving}>{saving ? "Saving…" : "Update Status"}</Button3D>}
        </div>
      </form>
    </div>
  );
}

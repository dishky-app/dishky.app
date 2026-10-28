import React, { useCallback, useEffect, useState } from "react";
import Button3D from "../components/Button3D.js";
import closeIcon from "../icon/close-icon.png";

// Same dialog as the Admin Panel: .modal-overlay > .admin-modal (header / body / footer, enter + exit animation).
export default function Modal({ title, children, onClose, onSubmit, submitLabel = "Save", busy, danger, wide, hideSubmit }) {
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    if (busy || closing) return;
    setClosing(true);
    setTimeout(onClose, 180);
  }, [busy, closing, onClose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  const anim = closing ? "modal-anim-out" : "modal-anim-in";
  return (
    <div className={`modal-overlay ${anim}`} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <form
        className={`admin-modal tk-modal${wide ? " tk-modal-wide" : ""} ${anim}`}
        onSubmit={(e) => { e.preventDefault(); if (onSubmit && !busy) onSubmit(); }}
        noValidate
      >
        <div className="admin-modal-header">
          <h3 style={danger ? { color: "var(--color-red, #dc2626)" } : undefined}>{title}</h3>
          <Button3D variant="cancel" iconOnly title="Close" onClick={close}><img src={closeIcon} alt="Close" /></Button3D>
        </div>
        <div className="admin-modal-body">{children}</div>
        <div className="admin-modal-footer">
          <Button3D variant="cancel" onClick={close} disabled={busy}>{hideSubmit ? "Close" : "Cancel"}</Button3D>
          {!hideSubmit && <Button3D type="submit" variant={danger ? "danger" : "save"} disabled={busy}>{busy ? "Working…" : submitLabel}</Button3D>}
        </div>
      </form>
    </div>
  );
}

/**
 * Admin-style field. A single <input> / <textarea> child becomes a floating-label `.mat` field
 * (mat-input + mat-label + mat-bar); any other child (CustomDropdown, date/time picker …) is shown as is.
 */
export function Field({ label, children, hint, required, error }) {
  const child = React.Children.only(children);
  const isText = child && (child.type === "input" || child.type === "textarea");
  return (
    <div className="admin-form-group form-group">
      {isText ? (
        <div className="mat">
          {React.cloneElement(child, {
            className: `mat-input${child.type === "textarea" ? " mat-textarea" : ""}${error ? " mat-error" : ""}`,
            placeholder: " ",
          })}
          <label className={`mat-label${error ? " mat-label-error" : ""}`}>{label}{required && <span className="rf-req">*</span>}</label>
          <span className={`mat-bar${error ? " mat-bar-error" : ""}`} />
        </div>
      ) : (
        <>
          {label && <span className="tk-label">{label}{required && <span className="rf-req">*</span>}</span>}
          {child}
        </>
      )}
      {error && <div className="field-error-msg">{error}</div>}
      {hint && <span className="subtitle">{hint}</span>}
    </div>
  );
}

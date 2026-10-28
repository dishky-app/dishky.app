/**
 * Button3D — same markup and classes as admin/src/components/Button3D.js,
 * so the buttons are styled by the Admin Panel's Common.css unchanged.
 * (The Admin version's Bootstrap tooltip is left out: this app has no
 * Bootstrap.)
 */
import React from "react";

const VARIANT_CLASS = {
  save: "modal-save-btn",
  cancel: "modal-cancel-btn",
  danger: "modal-danger-btn",
  confirm: "modal-confirm-btn",
  prev: "modal-prev-btn",
  next: "modal-next-btn",
};

export default function Button3D({
  variant = "save",
  type = "button",
  disabled = false,
  className = "",
  style,
  onClick,
  children,
}) {
  const baseClass = VARIANT_CLASS[variant] ?? VARIANT_CLASS.save;
  return (
    <button type={type} className={[baseClass, className].filter(Boolean).join(" ")} style={style} disabled={disabled} onClick={onClick}>
      <span className="shadow" />
      <span className="edge" />
      <span className="front">{children}</span>
    </button>
  );
}

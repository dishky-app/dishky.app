/**
 * Button3D — same 3-D push button as the Admin Panel
 * (shadow / edge / front spans, styled by Common.css .modal-*-btn).
 */
import React from "react";

const VARIANT_CLASS = {
  save: "modal-save-btn",
  cancel: "modal-cancel-btn",
  danger: "modal-danger-btn",
};

export default function Button3D({
  variant = "save",
  iconOnly = false,
  type = "button",
  disabled = false,
  className = "",
  style,
  title,
  onClick,
  children,
}) {
  const baseClass = VARIANT_CLASS[variant] ?? VARIANT_CLASS.save;
  return (
    <button
      type={type}
      className={[baseClass, className].filter(Boolean).join(" ")}
      style={style}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      <span className="shadow" />
      <span className="edge" />
      <span className={iconOnly ? "front close-padding" : "front"}>{children}</span>
    </button>
  );
}

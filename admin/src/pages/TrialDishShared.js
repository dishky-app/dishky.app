/**
 * TrialDishShared.js  —  Dishky Admin Panel   (prefix: td-)
 * Helpers shared by TrialDishes.js (list + add / edit) and TrialDishDetails.js (single trial):
 * badge classes, the dish-image reader (shrinks big photos before upload), the date helper and a star-rating control.
 */
import React from "react";

export const errMsg = (e, fallback) => e?.response?.data?.error || fallback;

export const statusClass = (key) => `td-badge td-status-${String(key || "").replace(/_/g, "-")}`;
export const priorityClass = (p) => `td-badge td-priority-${String(p || "").toLowerCase()}`;
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const money = (v) => (v === null || v === undefined || v === "" ? "—" : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);
export const pct = (v) => (v === null || v === undefined ? "—" : `${v}%`);

/** Local "YYYY-MM-DD" for today (no UTC shift). */
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Reads an image file as a JPEG/PNG data URL no larger than 900 px on its long side (keeps the request small). */
export function readDishImage(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { reject(new Error("Choose a JPG, PNG or WEBP picture.")); return; }
    if (file.size > 12 * 1024 * 1024) { reject(new Error("That picture is too large (max 12 MB).")); return; }
    const r = new FileReader();
    r.onerror = () => reject(new Error("Could not read the picture."));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file is not a valid picture."));
      img.onload = () => {
        const scale = Math.min(1, 900 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

/** Material-style field wrapper (same as SupportShared.Mat). */
export const Mat = ({ label, required, error, children }) => (
  <div className="admin-form-group">
    <div className="mat">
      {children}
      <label className={`mat-label${error ? " mat-label-error" : ""}`}>{label}{required && <span className="rf-req">*</span>}</label>
      <span className={`mat-bar${error ? " mat-bar-error" : ""}`} />
    </div>
    {error && <div className="field-error-msg">{error}</div>}
  </div>
);

/** 1–5 star control. `value` 0 = none; read-only when no onChange. */
export const Stars = ({ value = 0, onChange, size = 22 }) => (
  <span className="td-stars" role={onChange ? "radiogroup" : "img"} aria-label={`${value} out of 5`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n} type="button" disabled={!onChange}
        className={`td-star${n <= Math.round(value) ? " on" : ""}`}
        style={{ fontSize: size }}
        onClick={() => onChange && onChange(n === value ? 0 : n)}
        aria-label={`${n} star${n > 1 ? "s" : ""}`}
      >★</button>
    ))}
  </span>
);

/** Colour band for a 0–100 overall score. */
export const scoreTone = (s) => (s >= 75 ? "good" : s >= 50 ? "mid" : "low");

import React, { useEffect, useMemo, useRef } from "react";

/**
 * MediaPicker - the Admin Panel's file / image picker (.file-wrap > input.file-input + .file-label),
 * as one component. Same markup and look as the Categories page picker, including its preview.
 *
 *   <MediaPicker label="Change image" accept="image/*" preview={imageUrl} onPick={(files) => ...} />
 *
 * `onPick` receives an array of File objects (already limited by `maxFiles`); the input is reset afterwards
 * so picking the same file twice still fires. `error` outlines the picker the way the admin does (.file-error).
 * `preview` (an image URL / data URL) shows the current image under the picker (.staff-image-preview);
 * image files listed in `picked` get a thumbnail too.
 */
const NO_FILES = [];

export default function MediaPicker({ label = "Choose file", accept, multiple = false, maxFiles, onPick, disabled, error, hint, picked = NO_FILES, onRemove, preview }) {
  const ref = useRef(null);

  // Thumbnails for picked image files (object URLs are released when the list changes).
  const thumbs = useMemo(
    () => picked.map((f) => (f && typeof f.type === "string" && f.type.startsWith("image/") ? URL.createObjectURL(f) : "")),
    [picked]
  );
  useEffect(() => () => thumbs.forEach((u) => u && URL.revokeObjectURL(u)), [thumbs]);

  return (
    <div className="admin-form-group">
      <div className={`file-wrap${error ? " file-error" : ""}`} aria-disabled={disabled || undefined}>
        <input
          ref={ref}
          type="file"
          className="file-input"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) onPick && onPick(maxFiles ? files.slice(0, maxFiles) : files);
            e.target.value = "";
          }}
        />
        <div className={`file-label${error ? " file-label-error" : ""}`}>{label}</div>
      </div>
      {preview && <img src={preview} alt="Preview" className="staff-image-preview" />}
      {picked.length > 0 && (
        <ul className="file-chip-list">
          {picked.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              {thumbs[i] && <img src={thumbs[i]} alt="" className="file-chip-thumb" />}
              <span>{f.name}</span>
              {onRemove && <button type="button" className="details-link clickable" onClick={() => onRemove(i)}>Remove</button>}
            </li>
          ))}
        </ul>
      )}
      {hint && <p className="file-hint">{hint}</p>}
      {error && <div className="field-error-msg">{error}</div>}
    </div>
  );
}

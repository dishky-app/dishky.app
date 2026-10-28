/**
 * SupportShared.js  —  Dishky Admin Panel
 * Helpers shared by Support.js (list + create) and SupportDetails.js
 * (single ticket): badge class helpers, progress stages, file validation
 * / reading, and the two small form pieces (Mat wrapper, FilePicker).
 * Same role MemoShared.js plays for Memos / MemoDetails.
 */

import React, { useState } from "react";

export const errMsg = (e, fallback) => e?.response?.data?.error || fallback;
export const bytes = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export const ALLOWED_EXT = /\.(png|jpe?g|webp|gif|pdf|txt|log|json|csv)$/i;
export const ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.log,.json,.csv";

export const STATUS_OPTIONS = [
  ["received", "Received"],
  ["in_review", "In review"],
  ["awaiting_you", "Needs your reply"],
  ["in_progress", "In progress"],
  ["testing", "Testing"],
  ["fix_ready", "Fix ready"],
  ["awaiting_your_confirmation", "Awaiting your confirmation"],
  ["resolved", "Resolved"],
  ["closed", "Closed"],
];

/** Badge class helpers — same pattern as memoStatusClass / memoPriorityClass. */
export const supportStatusClass = (key) =>
  `sp-status-badge sp-status-${String(key || "").toLowerCase().replace(/[\s_]+/g, "-")}`;
export const supportPriorityClass = (p) =>
  `sp-priority-badge sp-priority-${String(p || "").toLowerCase()}`;

/** Progress tracker shown on the details page (same idea as the memo story stages). */
export const PROGRESS_STAGES = ["Received", "In review", "In progress", "Testing", "Fix ready", "Resolved", "Closed"];
const STAGE_BY_STATUS = {
  received: 0,
  in_review: 1,
  awaiting_you: 1,
  in_progress: 2,
  reopened: 2,
  testing: 3,
  fix_ready: 4,
  awaiting_your_confirmation: 4,
  resolved: 5,
  closed: 6,
};
export const stageIndex = (status) => STAGE_BY_STATUS[status] ?? 0;

export const readFile = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ name: file.name, dataUrl: r.result });
    r.onerror = () => reject(new Error("Could not read the file."));
    r.readAsDataURL(file);
  });

/** Validates picked files against the same limits the server enforces (the server re-checks everything). */
export function checkFiles(files, meta, existing = 0) {
  if (existing + files.length > meta.maxAttachments) return `Attach at most ${meta.maxAttachments} files at a time.`;
  for (const f of files) {
    if (!ALLOWED_EXT.test(f.name)) return `"${f.name}" is not an allowed file type (images, PDF or text/log files only).`;
    if (f.size > meta.maxAttachmentBytes) return `"${f.name}" is too large (max ${bytes(meta.maxAttachmentBytes)}).`;
  }
  return "";
}

/** Material-style field wrapper (label + bar + inline error), as used by the Memos forms. */
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

export function FilePicker({ meta, files, setFiles, label = "Attachments (optional)", emptyText = "Attach screenshots, PDFs or log files" }) {
  const [err, setErr] = useState("");
  return (
    <div className="admin-form-group">
      <label htmlFor="">{label}</label>
      <div className="border form-group">
        <div className="file-wrap">
          <input
            type="file"
            multiple
            accept={ACCEPT}
            className="file-input"
            onChange={(e) => {
              const picked = Array.from(e.target.files || []);
              const m = checkFiles(picked, meta, 0);
              setErr(m);
              setFiles(m ? [] : picked);
              e.target.value = "";
            }}
          />
          <div className="file-label">{files.length ? `✔ ${files.length} file(s) selected` : emptyText}</div>
        </div>
        {files.length > 0 && (
          <ul className="sp-file-preview-list">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                <span>{f.name} <span className="sp-muted">({bytes(f.size)})</span></span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="sp-hint">Up to {meta.maxAttachments} files, {bytes(meta.maxAttachmentBytes)} each. Never include passwords, tokens or customer card details.</p>
      {err && <div className="field-error-msg">{err}</div>}
    </div>
  );
}

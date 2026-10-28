/**
 * MemoShared.js  —  Dishky Admin Panel
 * Constants + small shared pieces for the Memo Management module
 * (Memos.js, MemoDetails.js). Mirrors the enum lists in the backend's
 * memos.js — kept as plain arrays here (not fetched) the same way
 * Documents.js hardcodes DOCUMENT_DEPARTMENTS, since these are fixed,
 * rarely-changing lists, not per-venue configurable data.
 */

import React from "react";
import { fmtDate } from "../utils/dateUtils";
import { createPortal } from "react-dom";
import usePopupAnimation from "../hooks/usePopupAnimation";
import { todayStr as _todayStr } from "../components/CustomDatePicker";
import { CustomDatePicker as OrderPickerDatePicker } from "../components/CustomDatePicker";
export { CustomDatePicker, todayStr } from "../components/CustomDatePicker";
export { CustomTimePicker } from "../components/CustomTimePicker";

/** Current local time as "HH:MM" — the latest selectable incident time when the date is today. */
export const nowTimeStr = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** True when the given incident date/time is later than right now (local clock). */
export const isFutureIncident = (date, time) => {
  if (!date) return false;
  const today = _todayStr();
  if (date > today) return true;
  if (date === today && time && time > nowTimeStr()) return true;
  return false;
};

export const MAX_STORY_LENGTH = 5000;

// Problem-solving stages shown as a tracker above the story.
export const STORY_STAGES = ["Reported", "Investigating", "Acting", "Resolved", "Verified"];

/** Which stage of the problem-solving flow a memo is at (index into STORY_STAGES). */
export const memoStageIndex = (memo) => {
  if (!memo) return 0;
  if (["Closed"].includes(memo.status) || memo.resolutionStatus === "Verified") return 4;
  if (["Resolved", "Awaiting Verification"].includes(memo.status)) return 3;
  if (["Action Required", "In Progress"].includes(memo.status)) return 2;
  if (memo.status === "Under Investigation") return 1;
  return 0;
};

export const MEMO_TYPES = [
  "Incident", "Customer Complaint", "Service Issue", "Kitchen Issue",
  "Food Quality Issue", "Staff Issue", "Equipment Issue", "Hygiene Issue",
  "Safety Issue", "Billing Issue", "Inventory Issue", "Maintenance Issue",
  "Delivery Issue", "Other",
];

export const LOCATIONS = ["Kitchen", "Dining Area", "Cash Counter", "Store", "Delivery Area", "Restaurant Entrance", "Other"];

export const DEPARTMENTS = ["Kitchen", "Service", "Housekeeping", "Accounts", "Purchase", "Maintenance", "Delivery", "Management"];

export const PRIORITIES = ["Low", "Normal", "High", "Critical"];

export const MEMO_STATUSES = [
  "Open", "Under Investigation", "Action Required", "In Progress",
  "Awaiting Verification", "Resolved", "Closed", "Cancelled",
];

export const RESOLUTION_STATUSES = [
  "Not Started", "Investigating", "Action Taken", "Fixed", "Solved",
  "Completed", "Verified", "Closed",
];

export const ROOT_CAUSES = [
  "Human Error", "Communication Failure", "Training Issue", "Equipment Failure",
  "System Error", "Stock Issue", "Supplier Issue", "Process Failure",
  "Customer-related", "Unknown", "Other",
];

export const CORRECTIVE_ACTION_STATUSES = ["Pending", "In Progress", "Completed", "Overdue", "Cancelled"];

export const CUSTOMER_IMPACTS = ["No Impact", "Minor", "Moderate", "Major", "Severe"];
export const OPERATIONAL_IMPACTS = ["None", "Minor Delay", "Service Disruption", "Major Disruption", "Temporary Closure"];

export const STAFF_ACTION_TYPES = ["Verbal Warning", "Written Warning", "Training Required", "Counseling", "Process Correction", "No Action", "Other"];

export const COMPENSATION_TYPES = ["Refund", "Partial Refund", "Full Refund", "Replacement", "Free Item", "Discount", "Coupon", "Complimentary Meal", "Complimentary Service", "Other"];
export const COMPENSATION_STATUSES = ["Pending", "Approved", "Issued", "Rejected"];

export const RESOLUTION_TYPES = ["Fixed", "Solved", "Completed", "Replaced", "Refunded", "Corrected", "No Further Action", "Other"];

export const VERIFICATION_RESULTS = ["Pass", "Fail"];

/**
 * CustomMultiDropdown — multi-select counterpart to the app's shared
 * CustomDropdown (Involved Staff / Witnesses). CustomDropdown itself
 * is single-value only, so this mirrors its exact overlay/popup
 * pattern and CSS classes (cdd-overlay/cdd-popup/cdd-option, the same
 * portal-rendered centered popup used everywhere else) rather than
 * introducing a different-looking control — the difference is just
 * that each option row has a checkbox and picking one doesn't close
 * the popup, since more than one selection is expected.
 *
 * value: [{ id, name }]   options: [{ value, label }]  (label = "Name — RoleTitle")
 */
export const CustomMultiDropdown = ({ options = [], value = [], onChange, label, placeholder = "None selected" }) => {
  const popup = usePopupAnimation();
  const open = popup.shouldRender;
  const selectedIds = new Set(value.map((v) => v.id));

  const toggle = (opt) => {
    const name = opt.label.split(" — ")[0];
    if (selectedIds.has(opt.value)) {
      onChange(value.filter((v) => v.id !== opt.value));
    } else {
      onChange([...value, { id: opt.value, name }]);
    }
  };

  const displayLabel = value.length === 0
    ? ""
    : value.length === 1
      ? value[0].name
      : `${value.length} selected`;

  const wrapperCls = ["mat-select", value.length > 0 ? "has-value" : "", popup.isOpen ? "is-open" : ""].filter(Boolean).join(" ");

  return (
    <div className={wrapperCls}>
      {label && <label className="mat-label">{label}</label>}

      <div className="dishes-dropdown-wrapper">
        <button
          type="button"
          className="dishes-status-dropdown"
          onClick={(e) => { e.stopPropagation(); popup.toggle(); }}
        >
          {displayLabel || placeholder}
        </button>

        {open && createPortal(
          <div className={`cdd-overlay ${popup.animClass}`}>
            <div className={`cdd-popup cdd-popup-multi ${popup.animClass}`} onMouseDown={(e) => e.stopPropagation()}>
              <div className="cdd-popup-title">{label || placeholder}</div>
              <div className="cdd-options">
                {options.length === 0 ? (
                  <div className="cdd-option cdd-option-placeholder">No staff available</div>
                ) : (
                  options.map((opt) => {
                    const checked = selectedIds.has(opt.value);
                    return (
                      <div
                        key={opt.value}
                        className={`cdd-option${checked ? " cdd-sel" : ""}`}
                        onClick={(e) => { e.stopPropagation(); toggle(opt); }}
                      >
                        {opt.label}
                      </div>
                    );
                  })
                )}
              </div>
              <button type="button" className="cdd-multi-done" onClick={() => popup.close()}>
                Done{value.length > 0 ? ` (${value.length} selected)` : ""}
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>

      <span className="mat-bar" />
    </div>
  );
};

/** Reads a list of File objects into base64 data-URL evidence payload items. */
export function evidenceFilesToPayload(files) {
  return Promise.all(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const mediaType = file.type.startsWith("image/")
              ? "Photo"
              : file.type.startsWith("video/")
                ? "Video"
                : file.type === "application/pdf"
                  ? "PDF"
                  : "Document";
            resolve({
              fileName: file.name,
              fileType: file.type,
              fileData: reader.result,
              mediaType,
              description: "",
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    )
  );
}

/**
 * OrderPickerModal — Section 10 ("retrieve available order information
 * rather than requiring unnecessary manual duplication"). A searchable
 * modal over adminData.orders (id, userName, items, status, date) —
 * Dishky's Order model has no table-number field, so only order id
 * and customer name are auto-filled; table number stays a manual
 * field on the memo form.
 *
 * Props:
 *   open          boolean — whether to render
 *   onClose()     — dismiss without picking
 *   orders        array — adminData.orders
 *   onPick(order) — called with the chosen order; caller closes the modal
 */

export const OrderPickerModal = ({ open, onClose, orders = [], onPick }) => {
  const [search, setSearch] = React.useState("");
  const [onDate, setOnDate] = React.useState("");
  if (!open) return null;

  const term = search.trim().toLowerCase();
  const orderDateStr = (o) => {
    const d = o.createdAt || o.date;
    return d ? new Date(d).toISOString().slice(0, 10) : "";
  };
  const filtered = orders.filter((o) => {
    if (term && ![o.id, o.userName, o.status].some((f) => (f || "").toLowerCase().includes(term))) return false;
    if (onDate && orderDateStr(o) !== onDate) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));

  return (
    <div className="modal-overlay modal-anim-in">
      <div className="admin-modal memo-order-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>Select Order</h3>
          <button type="button" className="memo-order-picker-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="mat" style={{ marginBottom: 10 }}>
            <input
              className="mat-input"
              placeholder=" "
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label className="mat-label">Search by order ID, customer, status</label>
            <span className="mat-bar" />
          </div>
          <div className="memo-order-picker-date-row">
            <OrderPickerDatePicker label="Order Date" value={onDate} onChange={setOnDate} />
            {onDate && (
              <button type="button" className="memo-order-picker-clear-dates" onClick={() => setOnDate("")}>
                Clear date
              </button>
            )}
          </div>
          <div className="memo-order-picker-list">
            {sorted.length === 0 ? (
              <div className="memo-picker-empty">No matching orders</div>
            ) : (
              sorted.slice(0, 100).map((o) => (
                <button
                  type="button"
                  key={o.id}
                  className="memo-order-picker-row"
                  onClick={() => onPick(o)}
                >
                  <div className="memo-order-picker-row-main">
                    <span className="memo-order-picker-id">{o.id}</span>
                    <span className="memo-order-picker-customer">{o.userName || "—"}</span>
                  </div>
                  <div className="memo-order-picker-row-meta">
                    <span>{(o.items || []).length} item(s)</span>
                    <span>{o.status || ""}</span>
                    <span>{o.createdAt || o.date ? fmtDate(o.createdAt || o.date) : ""}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/** Status pill class helper shared by list + details pages. */
export const memoStatusClass = (status) => `memo-status-badge memo-status-${(status || "").toLowerCase().replace(/\s+/g, "-")}`;
export const memoResolutionClass = (status) => `memo-resolution-badge memo-resolution-${(status || "").toLowerCase().replace(/\s+/g, "-")}`;
export const memoPriorityClass = (priority) => `memo-priority-badge memo-priority-${(priority || "").toLowerCase()}`;

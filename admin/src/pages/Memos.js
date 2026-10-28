/**
 * Memos.js  —  Dishky Admin Panel
 * Restaurant incident / issue / complaint / corrective-action tracking
 * system. Not a staff-announcement board — every memo is an
 * operational problem tracked from creation to closure. Self-fetching
 * (like Documents.js) since it isn't part of the app-start global
 * preload. Only Super Admin / Chef / Service Manager can create a
 * memo — enforced server-side; here we just hide the button for
 * everyone else, matching the documents.js/Documents.js convention of
 * never relying on the frontend gate alone.
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";
import closeIcon from "../icon/close-icon.png";
import { allowTextInput, EmptyRow, formatDisplayDate } from "../App";
import { useToast } from "../useToast";
import { useAuth } from "../context/AuthContext";
import Button3D from "../components/Button3D";
import useAnimatedModal from "../hooks/useAnimatedModal";
import CollapseChevron from "../components/CollapseChevron";
import CollapseSection from "../components/CollapseSection";
import CustomDropdown from "../components/CustomDropdown";
import { CustomDatePicker, CustomTimePicker, todayStr, nowTimeStr, isFutureIncident, MAX_STORY_LENGTH } from "./MemoShared";
import { FilterBar } from "../components/FilterBar";
import PageLoader from "../components/PageLoader";
import useInfiniteScroll from "../components/useInfiniteScroll";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader";
import {
  MEMO_TYPES, LOCATIONS, DEPARTMENTS, PRIORITIES, MEMO_STATUSES,
  RESOLUTION_STATUSES, CustomMultiDropdown, evidenceFilesToPayload, OrderPickerModal,
} from "./MemoShared";

import "./Memos.css";
import "./ModalCSS.css";
import { toTitleCase } from "../utils/formUtils";

const EMPTY_FORM = {
  memoType: "",
  title: "",
  description: "",
  story: "",
  incidentDate: todayStr(),
  incidentTime: "",
  location: "",
  department: "",
  priority: "Normal",
  orderId: "",
  customerName: "",
  tableNumber: "",
  primaryResponsible: "",
  primaryResponsibleName: "",
  involvedStaff: [],
  witnesses: [],
  departmentResponsible: "",
  immediateAction: "",
  immediateResult: "",
};

const Memos = ({ adminData, sortConfig, handleSort }) => {
  const { toast } = useToast();
  const { admin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const canCreate = isSuperAdmin || ["Chef", "Service Manager"].includes(admin?.roleTitle);

  const [memos, setMemos] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // true only for the very first load (gates the whole page)
  const [isFiltering, setIsFiltering] = useState(false); // true for every subsequent filter/search fetch (gates the table only)
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const firstLoadDone = React.useRef(false);

  // Filters
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [preset, setPreset] = useState("");
  const [memoType, setMemoType] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [resolutionStatus, setResolutionStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [compensationFilter, setCompensationFilter] = useState("");
  const [evidenceFilter, setEvidenceFilter] = useState("");

  const staffOptions = useMemo(() => {
    const accounts = adminData?.staffAccounts || [];
    return accounts.map((a) => ({ value: a.id, label: `${a.name} — ${a.roleTitle || ""}`.trim() }));
  }, [adminData]);

  const [showForm, setShowForm] = useState(false);
  const memoFormModal = useAnimatedModal("memos-add");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showOrderPicker, setShowOrderPicker] = useState(false);

  const load = async () => {
    // Only the very first fetch shows the full-page loader; every
    // subsequent fetch (triggered by a filter/search change) only
    // dims the table itself, so the header/filter bar/create button
    // stay put instead of the whole page flashing to a loading state.
    if (!firstLoadDone.current) setIsLoading(true);
    else setIsFiltering(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (memoType) params.memoType = memoType;
      if (priority) params.priority = priority;
      if (status) params.status = status;
      if (resolutionStatus) params.resolutionStatus = resolutionStatus;
      if (department) params.department = department;
      if (compensationFilter) params.compensationRequired = compensationFilter;
      if (evidenceFilter) params.evidenceAvailable = evidenceFilter;

      const res = await api.get("/memos", { params });
      setMemos(res.data || []);
    } catch (err) {
      console.error("Failed to load memos:", err);
      toast.error("Failed to load memos");
    } finally {
      firstLoadDone.current = true;
      setIsLoading(false);
      setIsFiltering(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, fromDate, toDate, memoType, priority, status, resolutionStatus, department, compensationFilter, evidenceFilter]);

  const clearFormFields = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEvidenceFiles([]);
  };

  const resetForm = () => {
    memoFormModal.close(() => setShowForm(false));
    clearFormFields();
  };

  const clearFilters = () => {
    setSearch(""); setFromDate(""); setToDate(""); setPreset("");
    setMemoType(""); setPriority(""); setStatus(""); setResolutionStatus("");
    setDepartment(""); setCompensationFilter(""); setEvidenceFilter("");
  };
  const filtersActive = !!(search || fromDate || toDate || memoType || priority || status || resolutionStatus || department || compensationFilter || evidenceFilter);

  const handleSave = async () => {
    const e = {};
    if (!form.memoType) e.memoType = true;
    if (!form.title.trim()) e.title = true;
    if (Object.keys(e).length) { setFormErrors(e); return; }
    if (isFutureIncident(form.incidentDate, form.incidentTime)) {
      toast.error("Incident date and time cannot be in the future");
      return;
    }

    setSaving(true);
    try {
      const evidence = await evidenceFilesToPayload(evidenceFiles);
      const res = await api.post("/memos", { ...form, evidence });
      setMemos((prev) => [res.data, ...prev]);
      toast.success(`Memo ${res.data.id} created`);
      resetForm();
      navigate(`/memos/${res.data.id}`, { state: { memo: res.data } });
    } catch (err) {
      console.error("Failed to create memo:", err);
      toast.error(err?.response?.data?.error || "Failed to create memo");
    } finally {
      setSaving(false);
    }
  };

  const filteredMemos = memos; // filtering is server-side

  const { displayLimit, sentinelRef, containerRef, hasMore, isLoadingMore } =
    useInfiniteScroll(filteredMemos.length, 30);

  if (isLoading) {
    return (
      <div className="inner-page">
        <PageLoader fill label="Loading memos…" />
      </div>
    );
  }

  return (
    <div className="inner-page">
      {/* HEADER */}
      <div className="header">
        <div className="header-title-row">
          <div className="header-collapse-col">
            <button
              type="button"
              className="header-collapse-btn"
              onClick={() => setHeaderCollapsed((prev) => !prev)}
              data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={headerCollapsed ? "Expand filters" : "Collapse filters"}
              aria-expanded={!headerCollapsed}
            >
              <CollapseChevron collapsed={headerCollapsed} />
            </button>
          </div>
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Memo Management</h2>
              <span className="result-count">{filteredMemos.length} memo(s)</span>
            </div>
          </div>
        </div>

        {canCreate && (
          <Button3D onClick={() => { clearFormFields(); setShowForm(true); memoFormModal.open(); }}>
            + Create Memo
          </Button3D>
        )}
      </div>

      {/* FILTER BAR */}
      <CollapseSection collapsed={headerCollapsed}>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder=" Search ID, issue, customer, staff, order…"
          dateRange={{
            from: fromDate,
            to: toDate,
            onChangeFrom: setFromDate,
            onChangeTo: setToDate,
            preset,
            onChangePreset: setPreset,
          }}
          secondRow
          groups={[
            { label: "Priority", options: PRIORITIES.map((p) => [p, p]), value: priority, onChange: setPriority },
            { label: "Status", options: MEMO_STATUSES.map((s) => [s, s]), value: status, onChange: setStatus },
          ]}
          onClear={clearFilters}
          active={filtersActive}
          rightContent={
            <>
              <CustomDropdown
                label="Memo Type"
                value={memoType}
                onChange={setMemoType}
                options={MEMO_TYPES.map((t) => ({ value: t, label: t }))}
                placeholder="All types"
              />
              <CustomDropdown
                label="Resolution Status"
                value={resolutionStatus}
                onChange={setResolutionStatus}
                options={RESOLUTION_STATUSES.map((s) => ({ value: s, label: s }))}
                placeholder="All resolution states"
              />
              <CustomDropdown
                label="Department"
                value={department}
                onChange={setDepartment}
                options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
                placeholder="All departments"
              />
              <CustomDropdown
                label="Compensation"
                value={compensationFilter}
                onChange={setCompensationFilter}
                options={[{ value: "true", label: "Required" }, { value: "false", label: "Not Required" }]}
                placeholder="Any"
              />
              <CustomDropdown
                label="Evidence"
                value={evidenceFilter}
                onChange={setEvidenceFilter}
                options={[{ value: "true", label: "Available" }, { value: "false", label: "None" }]}
                placeholder="Any"
              />
            </>
          }
        />
      </CollapseSection>

      {/* CREATE MEMO MODAL */}
      {memoFormModal.shouldRender && (
        <div className={`modal-overlay ${memoFormModal.overlayClass}`}>
          <form
            className={`admin-modal memo-form-modal ${memoFormModal.modalClass}`}
            onSubmit={(e) => { e.preventDefault(); handleSave(); }}
          >
            <div className="admin-modal-header">
              <h3>Create Memo</h3>
              <Button3D variant="cancel" iconOnly aria-label="Close" onClick={resetForm}>
                <img src={closeIcon} alt="" />
              </Button3D>
            </div>

            <div className="admin-modal-body">
              {/* BASIC INFORMATION */}
              <div className="admin-form-group">
                <CustomDropdown
                  label="Memo Type"
                  value={form.memoType}
                  onChange={(val) => { setForm((p) => ({ ...p, memoType: val })); setFormErrors((p) => ({ ...p, memoType: false })); }}
                  options={MEMO_TYPES.map((t) => ({ value: t, label: t }))}
                  placeholder="Select memo type"
                  hasError={formErrors.memoType}
                  required
                />
                {formErrors.memoType && <div className="field-error-msg">Memo type is required</div>}
              </div>

              {/* ISSUE DETAILS */}
              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className={`mat-input${formErrors.title ? " mat-error" : ""}`}
                    placeholder=" "
                    autoFocus
                    type="text"
                    value={form.title}
                    onChange={(e) => { setForm((p) => ({ ...p, title: allowTextInput(p.title, e.target.value, 100, 15) })); setFormErrors((p) => ({ ...p, title: false })); }}
                  />
                  <label className={`mat-label${formErrors.title ? " mat-label-error" : ""}`}>
                    Issue Title<span className="rf-req">*</span>
                  </label>
                  <span className={`mat-bar${formErrors.title ? " mat-bar-error" : ""}`} />
                </div>
                {formErrors.title && <div className="field-error-msg">Issue title is required</div>}
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <textarea
                    className="mat-input mat-textarea"
                    placeholder=" "
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: allowTextInput(p.description, e.target.value, 2000, 400) }))}
                  />
                  <label className="mat-label">What Happened? (when / where / how / expected vs actual)</label>
                  <span className="mat-bar" />
                </div>
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <textarea
                    className="mat-input mat-textarea memo-story-input"
                    placeholder=" "
                    maxLength={MAX_STORY_LENGTH}
                    value={form.story}
                    onChange={(e) => setForm((p) => ({ ...p, story: e.target.value }))}
                  />
                  <label className="mat-label">Story / Summary (what led to it, who was affected, what should happen next)</label>
                  <span className="mat-bar" />
                </div>
                <div className="memo-story-hint">Tip: write it as a short story — situation → problem → impact. It appears on the timeline when you hover the entry.</div>
              </div>

              <div className="horizontal-form-group">
                <div className="admin-form-group">
                  <CustomDatePicker
                    label="Incident Date"
                    value={form.incidentDate}
                    max={todayStr()}
                    onChange={(v) => setForm((p) => ({
                      ...p,
                      incidentDate: v,
                      // moving to today: drop a time that would now be in the future
                      incidentTime: v === todayStr() && p.incidentTime > nowTimeStr() ? "" : p.incidentTime,
                    }))}
                  />
                </div>
                <div className="admin-form-group">
                  <CustomTimePicker
                    label="Incident Time"
                    value={form.incidentTime}
                    maxTime={form.incidentDate === todayStr() ? nowTimeStr() : undefined}
                    onChange={(v) => setForm((p) => ({ ...p, incidentTime: v }))}
                  />
                </div>
              </div>

              <div className="horizontal-form-group">
                <div className="admin-form-group">
                  <CustomDropdown label="Location" value={form.location} onChange={(v) => setForm((p) => ({ ...p, location: v }))} options={LOCATIONS.map((l) => ({ value: l, label: l }))} placeholder="Select location" />
                </div>
                <div className="admin-form-group">
                  <CustomDropdown label="Department" value={form.department} onChange={(v) => setForm((p) => ({ ...p, department: v }))} options={DEPARTMENTS.map((d) => ({ value: d, label: d }))} placeholder="Select department" />
                </div>
              </div>

              <div className="admin-form-group">
                <CustomDropdown
                  label="Priority"
                  value={form.priority}
                  onChange={(v) => setForm((p) => ({ ...p, priority: v }))}
                  options={PRIORITIES.map((p) => ({ value: p, label: p }))}
                  placeholder={null}
                />
              </div>

              {/* ORDER / CUSTOMER INFO */}
              <div className="admin-form-group">
                <label htmlFor="">Order / Customer Information (optional)</label>
                {form.orderId ? (
                  <div className="memo-selected-order">
                    <div>
                      <div className="memo-selected-order-id">{form.orderId}</div>
                      <div className="memo-selected-order-customer">{form.customerName || "—"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button3D variant="cancel" onClick={() => setShowOrderPicker(true)}>Change</Button3D>
                      <Button3D
                        variant="cancel"
                        onClick={() => setForm((p) => ({ ...p, orderId: "", customerName: "" }))}
                      >
                        Clear
                      </Button3D>
                    </div>
                  </div>
                ) : (
                  <Button3D variant="cancel" onClick={() => setShowOrderPicker(true)}>Select Order</Button3D>
                )}
              </div>
              <div className="horizontal-form-group">
                <div className="admin-form-group">
                  <div className="mat">
                    <input className="mat-input" placeholder=" " value={form.customerName} onChange={(e) => setForm((p) => ({ ...p, customerName: toTitleCase(allowTextInput(p.customerName, e.target.value, 80, 10)) }))} />
                    <label className="mat-label">Customer Name</label>
                    <span className="mat-bar" />
                  </div>
                </div>
                <div className="admin-form-group">
                  <div className="mat">
                    <input className="mat-input" placeholder=" " value={form.tableNumber} onChange={(e) => setForm((p) => ({ ...p, tableNumber: allowTextInput(p.tableNumber, e.target.value, 20, 5) }))} />
                    <label className="mat-label">Table Number</label>
                    <span className="mat-bar" />
                  </div>
                </div>
              </div>

              {/* RESPONSIBLE PERSON */}
              <div className="admin-form-group">
                <CustomDropdown
                  label="Primary Responsible"
                  value={form.primaryResponsible}
                  onChange={(val) => {
                    const opt = staffOptions.find((o) => o.value === val);
                    setForm((p) => ({ ...p, primaryResponsible: val, primaryResponsibleName: opt ? opt.label.split(" — ")[0] : "" }));
                  }}
                  options={staffOptions}
                  placeholder="Select responsible person"
                />
              </div>
              <div className="admin-form-group">
                <label className="memo-picker-label">Involved Staff</label>
                <CustomMultiDropdown options={staffOptions} value={form.involvedStaff} onChange={(v) => setForm((p) => ({ ...p, involvedStaff: v }))} placeholder="Select involved staff" />
              </div>
              <div className="admin-form-group">
                <label className="memo-picker-label">Witnesses (optional)</label>
                <CustomMultiDropdown options={staffOptions} value={form.witnesses} onChange={(v) => setForm((p) => ({ ...p, witnesses: v }))} placeholder="Select witnesses" />
              </div>

              {/* EVIDENCE */}
              <div className="admin-form-group">
                <label htmlFor="">Evidence / Media</label>
                <div className="border form-group">
                  <div className="file-wrap">
                    <input
                      type="file"
                      multiple
                      onChange={(e) => setEvidenceFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
                      className="file-input"
                    />
                    <div className="file-label">
                      {evidenceFiles.length ? `✔ ${evidenceFiles.length} file(s) selected` : "Attach photos, videos, PDFs, documents"}
                    </div>
                  </div>
                  {evidenceFiles.length > 0 && (
                    <ul className="memo-evidence-preview-list">
                      {evidenceFiles.map((f, i) => (
                        <li key={i}>
                          {f.name}
                          <button type="button" onClick={() => setEvidenceFiles((prev) => prev.filter((_, idx) => idx !== i))}>✕</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* IMMEDIATE ACTION */}
              <div className="admin-form-group">
                <div className="mat">
                  <textarea className="mat-input mat-textarea" placeholder=" " value={form.immediateAction} onChange={(e) => setForm((p) => ({ ...p, immediateAction: allowTextInput(p.immediateAction, e.target.value, 500, 100) }))} />
                  <label className="mat-label">Immediate Action Taken</label>
                  <span className="mat-bar" />
                </div>
              </div>
              <div className="admin-form-group">
                <div className="mat">
                  <input className="mat-input" placeholder=" " value={form.immediateResult} onChange={(e) => setForm((p) => ({ ...p, immediateResult: allowTextInput(p.immediateResult, e.target.value, 200, 40) }))} />
                  <label className="mat-label">Immediate Result</label>
                  <span className="mat-bar" />
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={resetForm}>Cancel</Button3D>
              <Button3D type="submit" disabled={saving}>{saving ? "Creating…" : "Create Memo"}</Button3D>
            </div>
          </form>
        </div>
      )}

      <OrderPickerModal
        open={showOrderPicker}
        onClose={() => setShowOrderPicker(false)}
        orders={adminData?.orders || []}
        onPick={(order) => {
          setForm((p) => ({ ...p, orderId: order.id, customerName: order.userName || p.customerName }));
          setShowOrderPicker(false);
        }}
      />

      {/* TABLE */}
      <div className="table-wrapper" ref={containerRef}>
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort("id")} className={sortConfig.key === "id" ? "sorted" : ""}>
                <span className="th-content sort-th"><span>Memo ID</span></span>
              </th>
              <th onClick={() => handleSort("createdAt")} className={sortConfig.key === "createdAt" ? "sorted" : ""}>
                <span className="th-content sort-th"><span>Date</span></span>
              </th>
              <th>Issue</th>
              <th>Category</th>
              <th onClick={() => handleSort("priority")} className={sortConfig.key === "priority" ? "sorted" : ""}>
                <span className="th-content sort-th"><span>Priority</span></span>
              </th>
              <th>Created By</th>
              <th>Responsible</th>
              <th>Status</th>
              <th>Resolution</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMemos.length === 0 ? (
              <EmptyRow colSpan={10} message="No memos found" />
            ) : (
              filteredMemos.slice(0, displayLimit).map((memo) => (
                <tr key={memo.id}>
                  <td>
                    <span className="clickable" onClick={() => navigate(`/memos/${memo.id}`, { state: { memo } })}>{memo.id}</span>
                  </td>
                  <td>{formatDisplayDate(memo.createdAt)}</td>
                  <td className="memo-issue-cell" title={memo.title}>{memo.title}</td>
                  <td>{memo.memoType}</td>
                  <td>
                    <span className={`memo-priority-badge memo-priority-${memo.priority?.toLowerCase()}`}>
                      {memo.priority === "Critical" ? "⚠ " : ""}{memo.priority}
                    </span>
                  </td>
                  <td>{memo.createdByName}</td>
                  <td>{memo.primaryResponsibleName || "—"}</td>
                  <td>
                    <span className={`memo-status-badge memo-status-${(memo.status || "").toLowerCase().replace(/\s+/g, "-")}`}>
                      {memo.status}
                    </span>
                  </td>
                  <td>
                    <span className={`memo-resolution-badge memo-resolution-${(memo.resolutionStatus || "").toLowerCase().replace(/\s+/g, "-")}`}>
                      {memo.resolutionStatus}
                    </span>
                  </td>
                  <td className="icon-width">
                    <Button3D variant="cancel" onClick={() => navigate(`/memos/${memo.id}`, { state: { memo } })}>View</Button3D>
                  </td>
                </tr>
              ))
            )}
            <InfiniteScrollLoader sentinelRef={sentinelRef} hasMore={hasMore} colSpan={10} />
          </tbody>
        </table>
        <InfiniteScrollOverlay isLoading={isLoadingMore || isFiltering} label={isFiltering ? "Updating…" : undefined} />
      </div>
    </div>
  );
};

export default Memos;
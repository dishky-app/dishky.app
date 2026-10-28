/**
 * Support.js  —  Dishky Admin Panel
 * Support & Complaints — ticket LIST + create form. Laid out exactly like
 * Memos.js: header with collapsible filters, FilterBar (chip groups +
 * dropdowns), sortable table with status / priority badges and a View
 * button, infinite scroll, and the animated "create" modal.
 *
 * The single-ticket page now lives in SupportDetails.js (like
 * MemoDetails.js). Shared helpers are in SupportShared.js.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";
import socket from "../socket";
import closeIcon from "../icon/close-icon.png";
import { EmptyRow, formatDisplayDate } from "../App";
import { fmtDateTime } from "../utils/dateUtils";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";
import useAnimatedModal from "../hooks/useAnimatedModal";
import CollapseChevron from "../components/CollapseChevron";
import CollapseSection from "../components/CollapseSection";
import CustomDropdown from "../components/CustomDropdown";
import { FilterBar } from "../components/FilterBar";
import PageLoader from "../components/PageLoader";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader";
import useServerInfinite, { makeSorter } from "../hooks/useServerInfinite";
import {
  errMsg, readFile, STATUS_OPTIONS, supportStatusClass, supportPriorityClass, Mat, FilePicker,
} from "./SupportShared";

import "./Support.css";
import "./ModalCSS.css";

// Backwards compatible: App.js can keep importing { SupportList, SupportDetail } from "./pages/Support".
export { SupportDetail } from "./SupportDetails";

const EMPTY = { title: "", category: "", module: "", description: "", expected: "", actual: "", steps: "", impact: "", suggestedPriority: "medium", venueId: "" };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function SupportList() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const modal = useAnimatedModal("support-create");
  const [meta, setMeta] = useState(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [moduleF, setModuleF] = useState("");
  const [priority, setPriority] = useState("");

  // Column sort — applied by the API so it covers every ticket, not just the pages loaded so far.
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });
  const handleSort = (key) => {
    setSortConfig((prev) => (prev.key === key
      ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "asc" }));
  };

  // Create form
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 250); return () => clearTimeout(t); }, [search]);

  // Infinite scroll: tickets are fetched 25 at a time as the end of the table scrolls into view; changing a filter starts again.
  const list = useServerInfinite(async (page, limit) => {
    const params = { page, limit };
    if (debouncedSearch) params.search = debouncedSearch;
    if (status) params.status = status;
    if (category) params.category = category;
    if (moduleF) params.module = moduleF;
    if (priority) params.priority = priority;
    params.sort = sortConfig.key;
    params.dir = sortConfig.direction;
    return (await api.get("/support/tickets", { params })).data;
  }, JSON.stringify([debouncedSearch, status, category, moduleF, priority]), {
    pageSize: 25,
    // sort changes re-order the loaded rows in place (no loader), like the Categories / Dishes / Memos pages
    sort: { id: `${sortConfig.key}:${sortConfig.direction}`, compare: makeSorter((r) => r[sortConfig.key], sortConfig.direction) },
  });
  const { rows, total, loaded, busy, loadingMore, hasMore, sentinelRef, containerRef } = list;
  const load = list.refresh;
  useEffect(() => { if (list.error) toast.error(list.error); /* eslint-disable-next-line */ }, [list.error]);

  useEffect(() => { api.get("/support/meta").then((r) => setMeta(r.data)).catch((e) => { toast.error(errMsg(e, "Failed to load")); }); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const onTicket = () => load();
    socket.on("support:ticket", onTicket);
    return () => socket.off("support:ticket", onTicket);
  }, [load]);

  const clearFilters = () => { setSearch(""); setStatus(""); setCategory(""); setModuleF(""); setPriority(""); };
  const filtersActive = !!(search || status || category || moduleF || priority);

  const clearFormFields = () => { setForm({ ...EMPTY, venueId: meta?.myVenueId || "" }); setFiles([]); setErrors({}); };
  const openCreate = () => { clearFormFields(); modal.open(); };
  const closeCreate = () => { modal.close(); clearFormFields(); };
  const set = (k) => (v) => { setForm((p) => ({ ...p, [k]: v && v.target ? v.target.value : v })); setErrors((p) => ({ ...p, [k]: "" })); };

  const submit = async () => {
    const e = {};
    if (form.title.trim().length < 5) e.title = "Enter a title (at least 5 characters)";
    if (!form.category) e.category = "Choose a category";
    if (!form.module) e.module = "Choose the affected module";
    if (form.description.trim().length < 10) e.description = "Describe the problem (at least 10 characters)";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const attachments = await Promise.all(files.map(readFile));
      const res = await api.post("/support/tickets", { ...form, attachments });
      toast.success(`Ticket ${res.data.ticketId} created`);
      modal.close();
      navigate(`/support/${res.data.ticketId}`);
    } catch (err) {
      toast.error(errMsg(err, "Could not create the ticket"));
    } finally { setSaving(false); }
  };

  if (!loaded && !list.error) {
    return <div className="inner-page"><PageLoader fill label="Loading tickets…" /></div>;
  }
  const catLabel = (v) => meta?.categories.find((c) => c.value === v)?.label || v;
  const openTicket = (id) => navigate(`/support/${id}`);

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
              <h2 className="title">Support &amp; Complaints</h2>
              <span className="result-count">{total} ticket(s)</span>
            </div>
          </div>
        </div>

        {meta?.canWrite && <Button3D onClick={openCreate}>+ New Ticket</Button3D>}
      </div>

      {/* FILTER BAR */}
      <CollapseSection collapsed={headerCollapsed}>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder=" Search ticket ID, title…"
          secondRow
          groups={[
            { label: "Priority", options: (meta?.priorities || []).map((p) => [p, cap(p)]), value: priority, onChange: setPriority },
            { label: "Status", options: STATUS_OPTIONS, value: status, onChange: setStatus },
          ]}
          onClear={clearFilters}
          active={filtersActive}
          rightContent={meta && (
            <>
              <CustomDropdown label="Category" value={category} onChange={setCategory} options={meta.categories} placeholder="All categories" />
              <CustomDropdown label="Module" value={moduleF} onChange={setModuleF} options={meta.modules.map((m) => ({ value: m, label: m }))} placeholder="All modules" />
            </>
          )}
        />
      </CollapseSection>

      {/* CREATE TICKET MODAL */}
      {modal.shouldRender && meta && (
        <div className={`modal-overlay ${modal.overlayClass}`}>
          <form className={`admin-modal ${modal.modalClass}`} onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="admin-modal-header">
              <h3>New Support Ticket</h3>
              <Button3D variant="cancel" iconOnly aria-label="Close" onClick={closeCreate}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <Mat label="Title" required error={errors.title}>
                <input className={`mat-input${errors.title ? " mat-error" : ""}`} placeholder=" " autoFocus maxLength={200} value={form.title} onChange={set("title")} />
              </Mat>
              <div className="horizontal-form-group">
                <div className="admin-form-group">
                  <CustomDropdown label="Category" required value={form.category} onChange={set("category")} options={meta.categories} placeholder="Select category" hasError={!!errors.category} />
                  {errors.category && <div className="field-error-msg">{errors.category}</div>}
                </div>
                <div className="admin-form-group">
                  <CustomDropdown label="Affected module" required value={form.module} onChange={set("module")} options={meta.modules.map((m) => ({ value: m, label: m }))} placeholder="Select module" hasError={!!errors.module} />
                  {errors.module && <div className="field-error-msg">{errors.module}</div>}
                </div>
              </div>
              <Mat label="Description" required error={errors.description}>
                <textarea className={`mat-input mat-textarea${errors.description ? " mat-error" : ""}`} placeholder=" " maxLength={8000} value={form.description} onChange={set("description")} />
              </Mat>
              <Mat label="Expected behaviour"><textarea className="mat-input mat-textarea" placeholder=" " maxLength={4000} value={form.expected} onChange={set("expected")} /></Mat>
              <Mat label="Actual behaviour"><textarea className="mat-input mat-textarea" placeholder=" " maxLength={4000} value={form.actual} onChange={set("actual")} /></Mat>
              <Mat label="Steps to reproduce"><textarea className="mat-input mat-textarea" placeholder=" " maxLength={6000} value={form.steps} onChange={set("steps")} /></Mat>
              <Mat label="Business impact"><textarea className="mat-input mat-textarea" placeholder=" " maxLength={3000} value={form.impact} onChange={set("impact")} /></Mat>
              <div className="horizontal-form-group">
                <div className="admin-form-group">
                  <CustomDropdown label="Suggested priority" value={form.suggestedPriority} onChange={set("suggestedPriority")} options={meta.priorities.map((p) => ({ value: p, label: cap(p) }))} placeholder={null} />
                  <p className="sp-hint">Dishky&apos;s team sets the final priority.</p>
                </div>
                <div className="admin-form-group">
                  <CustomDropdown label="Branch" value={form.venueId} onChange={set("venueId")} options={meta.venues.map((v) => ({ value: v.id, label: v.name }))} placeholder={meta.isSuperAdmin ? "Select branch" : null} />
                </div>
              </div>
              <FilePicker meta={meta} files={files} setFiles={setFiles} />
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={closeCreate}>Cancel</Button3D>
              <Button3D type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit Ticket"}</Button3D>
            </div>
          </form>
        </div>
      )}

      {/* TABLE */}
      <div className="table-wrapper" ref={containerRef}>
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort("ticketId")} className={sortConfig.key === "ticketId" ? "sorted" : ""}>
                <span className="th-content sort-th"><span>Ticket ID</span></span>
              </th>
              <th onClick={() => handleSort("createdAt")} className={sortConfig.key === "createdAt" ? "sorted" : ""}>
                <span className="th-content sort-th"><span>Date</span></span>
              </th>
              <th onClick={() => handleSort("title")} className={sortConfig.key === "title" ? "sorted" : ""}>
                <span className="th-content sort-th"><span>Title</span></span>
              </th>
              <th onClick={() => handleSort("category")} className={sortConfig.key === "category" ? "sorted" : ""}>
                <span className="th-content sort-th"><span>Category</span></span>
              </th>
              <th onClick={() => handleSort("module")} className={sortConfig.key === "module" ? "sorted" : ""}>
                <span className="th-content sort-th"><span>Module</span></span>
              </th>
              <th onClick={() => handleSort("priority")} className={sortConfig.key === "priority" ? "sorted" : ""}>
                <span className="th-content sort-th"><span>Priority</span></span>
              </th>
              <th onClick={() => handleSort("status")} className={sortConfig.key === "status" ? "sorted" : ""}>
                <span className="th-content sort-th"><span>Status</span></span>
              </th>
              <th onClick={() => handleSort("updatedAt")} className={sortConfig.key === "updatedAt" ? "sorted" : ""}>
                <span className="th-content sort-th"><span>Updated</span></span>
              </th>
              <th>Latest Response</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loaded && rows.length === 0 ? (
              <EmptyRow colSpan={10} message="No tickets found" />
            ) : (
              rows.map((t) => (
                <tr key={t.ticketId}>
                  <td><span className="clickable" onClick={() => openTicket(t.ticketId)}>{t.ticketId}</span></td>
                  <td>{formatDisplayDate(t.createdAt)}</td>
                  <td className="sp-title-cell" title={t.title}>{t.title}</td>
                  <td>{catLabel(t.category)}</td>
                  <td>{t.module}</td>
                  <td>
                    {t.priority
                      ? <span className={supportPriorityClass(t.priority)}>{t.priority === "critical" ? "⚠ " : ""}{t.priority}</span>
                      : <span className="sp-muted">Pending</span>}
                  </td>
                  <td><span className={supportStatusClass(t.status)}>{t.statusLabel}</span></td>
                  <td>{fmtDateTime(t.updatedAt)}</td>
                  <td className="sp-title-cell" title={t.latestResponse || ""}>{t.latestResponse || "—"}</td>
                  <td className="icon-width">
                    <Button3D variant="cancel" onClick={() => openTicket(t.ticketId)}>View</Button3D>
                  </td>
                </tr>
              ))
            )}
            <InfiniteScrollLoader sentinelRef={sentinelRef} hasMore={hasMore} colSpan={10} />
          </tbody>
        </table>
        <InfiniteScrollOverlay isLoading={loadingMore || busy} label={busy ? "Updating…" : undefined} />
      </div>
    </div>
  );
}

export default SupportList;

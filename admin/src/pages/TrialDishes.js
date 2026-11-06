/**
 * TrialDishes.js  —  Dishky Admin Panel   (prefix: td-)
 * Trial Dish Tracking — overview cards, filterable / sortable / infinite-scroll table, and the Add / Edit / Update Status /
 * Delete dialogs. Laid out like Memos.js and Support.js. A single trial (timeline, evaluation, cost, history…) lives in
 * TrialDishDetails.js. All data comes from /trial-dishes — nothing is mocked.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";
import socket from "../socket";
import closeIcon from "../icon/close-icon.png";
import { EmptyRow, formatDisplayDate } from "../App";
import { useToast } from "../useToast";
import { useAuth } from "../context/AuthContext";
import { useVenue } from "../context/VenueContext";
import { exportToExcel } from "../utils/excelUtils";
import Button3D from "../components/Button3D";
import useAnimatedModal from "../hooks/useAnimatedModal";
import CollapseChevron from "../components/CollapseChevron";
import CollapseSection from "../components/CollapseSection";
import CustomDropdown from "../components/CustomDropdown";
import { FilterBar } from "../components/FilterBar";
import PageLoader from "../components/PageLoader";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader";
import useServerInfinite, { makeSorter } from "../hooks/useServerInfinite";
import TrialFormModal from "./TrialFormModal";
import TrialStatusModal, { allowedMoves } from "./TrialStatusModal";
import FilePreviewLink from "../components/FilePreviewLink";
import { errMsg, statusClass, priorityClass, cap } from "./TrialDishShared";

import "./Payments.css";
import "./TrialDishes.css";
import "./ModalCSS.css";

const CARDS = [
  { key: "total", label: "Total Trials", filter: "", color: "#111" },
  { key: "pending", label: "Pending", filter: "pending", color: "#ca8a04" },
  { key: "testing", label: "Currently Testing", filter: "in_progress", color: "#2563eb" },
  { key: "approved", label: "Approved", filter: "approved", color: "#16a34a" },
  { key: "rejected", label: "Rejected", filter: "rejected", color: "#dc2626" },
  { key: "expired", label: "Expired", filter: "expired", color: "#ea580c" },
];

const COLS = [
  ["trialId", "Trial ID"], [null, "Dish Image"], ["name", "Dish Name"], ["category", "Category"], ["assignedStaffName", "Chef / Staff"],
  ["trialStartDate", "Trial Start"], ["expectedCompletion", "Expected Completion"], ["status", "Trial Status"], ["priority", "Priority"], [null, "Actions"],
];

export default function TrialDishes({ adminData }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { admin, isSuperAdmin, hasModulePermission } = useAuth();
  const { venueId, venueParam } = useVenue();
  const canWrite = hasModulePermission("trialDishes", "write");
  const isReviewer = isSuperAdmin || admin?.roleGroup === "Manager";

  const [meta, setMeta] = useState(null);
  const [summary, setSummary] = useState(null);
  const [staff, setStaff] = useState([]);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  // filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [chef, setChef] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [preset, setPreset] = useState("");

  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });
  const handleSort = (key) => {
    if (!key) return;
    setSortConfig((p) => (p.key === key ? { key, direction: p.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
  };

  // dialogs
  const formModal = useAnimatedModal("td-form");
  const statusModal = useAnimatedModal("td-status");
  const deleteModal = useAnimatedModal("td-delete");
  const [target, setTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 250); return () => clearTimeout(t); }, [search]);

  const filterParams = useCallback(() => {
    const p = { ...venueParam() };
    if (debouncedSearch) p.search = debouncedSearch;
    if (status) p.status = status;
    if (priority) p.priority = priority;
    if (category) p.category = category;
    if (chef) p.assignedTo = chef;
    if (fromDate) p.from = fromDate;
    if (toDate) p.to = toDate;
    return p;
  }, [venueParam, debouncedSearch, status, priority, category, chef, fromDate, toDate]);

  const list = useServerInfinite(async (page, limit) => (
    (await api.get("/trial-dishes", { params: { ...filterParams(), page, limit, sort: sortConfig.key, dir: sortConfig.direction } })).data
  ), JSON.stringify([debouncedSearch, status, priority, category, chef, fromDate, toDate, venueId]), {
    pageSize: 25,
    sort: { id: `${sortConfig.key}:${sortConfig.direction}`, compare: makeSorter((r) => r[sortConfig.key], sortConfig.direction) },
  });
  const { rows, total, loaded, busy, loadingMore, hasMore, sentinelRef, containerRef } = list;
  useEffect(() => { if (list.error) toast.error(list.error); /* eslint-disable-next-line */ }, [list.error]);

  const loadSummary = useCallback(() => {
    const p = { ...venueParam() };
    if (fromDate) p.from = fromDate;
    if (toDate) p.to = toDate;
    api.get("/trial-dishes/summary", { params: p }).then((r) => setSummary(r.data)).catch(() => {});
  }, [venueParam, fromDate, toDate]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  useEffect(() => { api.get("/trial-dishes/meta").then((r) => setMeta(r.data)).catch((e) => toast.error(errMsg(e, "Failed to load"))); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    api.get("/staff", { params: venueParam() }).then((r) => setStaff(Array.isArray(r.data) ? r.data : [])).catch(() => setStaff([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  const refreshAll = useCallback(() => { list.refresh(); loadSummary(); }, [list, loadSummary]);
  useEffect(() => {
    const on = (e) => { if (e && e.resource === "trialDishes") refreshAll(); };
    socket.on("data-change", on);
    return () => socket.off("data-change", on);
  }, [refreshAll]);

  const staffOptions = useMemo(() => staff.map((s) => ({ value: s.id, label: s.role ? `${s.name} — ${s.role}` : s.name })), [staff]);
  const categoryOptions = useMemo(() => (adminData?.categories || []).map((c) => ({ value: c.name, label: c.name })), [adminData]);

  const clearFilters = () => { setSearch(""); setStatus(""); setPriority(""); setCategory(""); setChef(""); setFromDate(""); setToDate(""); setPreset(""); };
  const filtersActive = !!(search || status || priority || category || chef || fromDate || toDate);

  const openAdd = () => { setTarget(null); formModal.open(); };
  const openEdit = (t) => { setTarget(t); formModal.open(); };
  const openStatus = (t) => { setTarget(t); statusModal.open(); };
  const openDelete = (t) => { setTarget(t); deleteModal.open(); };
  const view = (t) => navigate(`/trial-dishes/${t.id}`);

  const confirmDelete = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      await api.delete(`/trial-dishes/${target.id}`, { params: venueParam() });
      toast.success(`${target.trialId} deleted`);
      deleteModal.close();
      refreshAll();
    } catch (e) { toast.error(errMsg(e, "Could not delete the trial")); }
    finally { setDeleting(false); }
  };

  const exportList = async () => {
    setExporting(true);
    try {
      const all = [];
      for (let page = 1; page <= 40; page += 1) {
        const r = (await api.get("/trial-dishes", { params: { ...filterParams(), page, limit: 100, sort: sortConfig.key, dir: sortConfig.direction } })).data;
        all.push(...r.rows);
        if (all.length >= r.total || !r.rows.length) break;
      }
      const ok = exportToExcel({
        sheetName: "Trial Dishes",
        fileName: "trial-dishes",
        rows: all.map((t) => ({
          "Trial ID": t.trialId, "Dish Name": t.name, Category: t.category, "Chef / Staff": t.assignedStaffName,
          "Trial Start": t.trialStartDate, "Expected Completion": t.expectedCompletion, Status: t.statusLabel + (t.expired ? " (Expired)" : ""),
          Priority: cap(t.priority), Attempt: t.attempt, "Latest Score": t.latestScore ?? "", "Estimated Cost": t.estimatedCost, "Selling Price": t.sellingPrice,
        })),
      });
      if (!ok) toast.warning("No data to export");
    } catch (e) { toast.error(errMsg(e, "Export failed")); }
    finally { setExporting(false); }
  };

  const cardClick = (c) => setStatus((cur) => (cur === c.filter ? "" : c.filter));

  if (!loaded && !list.error) return <div className="inner-page"><PageLoader fill label="Loading trial dishes…" /></div>;

  return (
    <div className="inner-page">
      {/* HEADER */}
      <div className="header">
        <div className="header-title-row">
          <div className="header-collapse-col">
            <button type="button" className="header-collapse-btn" onClick={() => setHeaderCollapsed((p) => !p)}
              data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={headerCollapsed ? "Expand filters" : "Collapse filters"} aria-expanded={!headerCollapsed}>
              <CollapseChevron collapsed={headerCollapsed} />
            </button>
          </div>
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Trial Dishes</h2>
              <span className="result-count">{total} trial(s)</span>
            </div>
          </div>
        </div>
        <div className="td-header-actions">
          <Button3D variant="cancel" onClick={exportList} disabled={exporting || total === 0}>{exporting ? "Exporting…" : "Export"}</Button3D>
          {canWrite && <Button3D onClick={openAdd}>+ Add Trial Dish</Button3D>}
        </div>
      </div>

      {/* OVERVIEW — same KPI cards as Payments / Reservations */}
      <div className="pay-kpi-row">
        {CARDS.map((c) => (
          <div key={c.key} className={`pay-kpi td-kpi${status === c.filter && (c.filter || !status) ? " td-kpi-active" : ""}`}
            style={{ borderTopColor: c.color }} role="button" tabIndex={0} onClick={() => cardClick(c)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") cardClick(c); }}>
            <div className="pay-kpi-val" style={{ color: c.color }}>{summary ? summary[c.key] : "—"}</div>
            <div className="pay-kpi-label">{c.label}</div>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <CollapseSection collapsed={headerCollapsed}>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder=" Search dish name or Trial ID…"
          dateRange={{ from: fromDate, to: toDate, onChangeFrom: setFromDate, onChangeTo: setToDate, preset, onChangePreset: setPreset, noMax: true }}
          secondRow
          groups={[
            { label: "Priority", options: (meta?.priorities || []).map((p) => [p, cap(p)]), value: priority, onChange: setPriority },
            {
              label: "Status",
              options: [...(meta?.statuses || []).map((s) => [s.key, s.label]), ["expired", "Expired"]],
              value: status, onChange: setStatus,
            },
          ]}
          onClear={clearFilters}
          active={filtersActive}
          rightContent={(
            <>
              <CustomDropdown label="Category" value={category} onChange={setCategory} options={categoryOptions} placeholder="All categories" />
              <CustomDropdown label="Chef" value={chef} onChange={setChef} options={staffOptions} placeholder="All chefs" />
            </>
          )}
        />
      </CollapseSection>

      {/* ADD / EDIT / STATUS / DELETE */}
      <TrialFormModal modal={formModal} trial={target} meta={meta} staffOptions={staffOptions} categoryOptions={categoryOptions} onSaved={refreshAll} />
      <TrialStatusModal modal={statusModal} trial={target} meta={meta} isReviewer={isReviewer} onDone={refreshAll} />
      {deleteModal.shouldRender && target && (
        <div className={`modal-overlay ${deleteModal.overlayClass}`}>
          <div className={`admin-modal ${deleteModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Delete Trial Dish</h3>
              <Button3D variant="cancel" iconOnly aria-label="Close" onClick={() => deleteModal.close()}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <p>Delete <strong>{target.name}</strong> ({target.trialId}) together with its evaluations, comments and history? This cannot be undone.</p>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => deleteModal.close()}>Cancel</Button3D>
              <Button3D variant="danger" onClick={confirmDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</Button3D>
            </div>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="table-wrapper" ref={containerRef}>
        <table>
          <thead>
            <tr>
              {COLS.map(([key, label]) => (
                <th key={label} onClick={() => handleSort(key)} className={key && sortConfig.key === key ? "sorted" : ""}>
                  {key ? <span className="th-content sort-th"><span>{label}</span></span> : label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loaded && rows.length === 0 ? (
              <EmptyRow colSpan={COLS.length} message={filtersActive ? "No trial dishes match these filters" : "No trial dishes yet — add the first one"} />
            ) : (
              rows.map((t) => {
                const canStatus = canWrite && allowedMoves(meta, t.status, isReviewer).length > 0;
                return (
                  <tr key={t.id}>
                    <td><span className="clickable" onClick={() => view(t)}>{t.trialId}</span></td>
                    <td className="icon-width">
                      {t.image ? <FilePreviewLink href={t.image} download={`${t.name}.jpg`} label="" /> : <span className="td-noimg">—</span>}
                    </td>
                    <td className="td-name-cell" title={t.name}>{t.name}{t.attempt > 1 && <span className="td-attempt"> · attempt {t.attempt}</span>}</td>
                    <td>{t.category || "—"}</td>
                    <td>{t.assignedStaffName || "—"}</td>
                    <td>{formatDisplayDate(t.trialStartDate)}</td>
                    <td>
                      {formatDisplayDate(t.expectedCompletion)}
                      {t.expired && <span className="td-expired-flag">Expired</span>}
                    </td>
                    <td><span className={statusClass(t.status)}>{t.statusLabel}</span></td>
                    <td><span className={priorityClass(t.priority)}>{t.priority}</span></td>
                    <td className="td-actions">
                      <Button3D variant="cancel" onClick={() => view(t)}>View</Button3D>
                      {canWrite && <Button3D variant="cancel" onClick={() => openEdit(t)}>Edit</Button3D>}
                      {canStatus && <Button3D variant="cancel" onClick={() => openStatus(t)}>Update Status</Button3D>}
                      {canWrite && isReviewer && <Button3D variant="danger" onClick={() => openDelete(t)}>Delete</Button3D>}
                    </td>
                  </tr>
                );
              })
            )}
            <InfiniteScrollLoader sentinelRef={sentinelRef} hasMore={hasMore} colSpan={COLS.length} />
          </tbody>
        </table>
        <InfiniteScrollOverlay isLoading={loadingMore || busy} label={busy ? "Updating…" : undefined} />
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CustomDropdown from "../components/CustomDropdown.js";
import { CustomDatePicker } from "../components/CustomDatePicker.js";
import { Collapsible, EmptyRow, ErrorNote, ResultCount } from "../components.js";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader.js";
import useServerInfinite, { makeSorter } from "../hooks/useServerInfinite.js";
import PageLoader from "../components/PageLoader.js";
import { DeadlineText, PriorityTag, StatusTag, dateOnly, useTicketApi } from "./ui.js";

const LIMIT = 25;
const VIEWS = [
  { value: "", label: "All" },
  { value: "unassigned", label: "Unassigned" },
  { value: "critical", label: "Critical & high" },
  { value: "approaching", label: "Due within 24h" },
  { value: "overdue", label: "Overdue" },
];

/**
 * Filterable ticket table shared by the Super Admin console and the Developer Panel.
 * Filters live in the URL, so dashboard cards can deep-link ("?view=overdue") and a refresh keeps them.
 */
export default function TicketList({ basePath = "/tickets", admin = false, meta, restaurants = [], developers = [], showViews = true, collapsed = false }) {
  const api = useTicketApi();
  const [params, setParams] = useSearchParams();
  const q = {
    search: params.get("search") || "", status: params.get("status") || "", category: params.get("category") || "",
    module: params.get("module") || "", priority: params.get("priority") || "", restaurantId: params.get("restaurantId") || "",
    developerId: params.get("developerId") || "", testerId: params.get("testerId") || "", view: params.get("view") || "",
    from: params.get("from") || "", to: params.get("to") || "", dueFrom: params.get("dueFrom") || "", dueTo: params.get("dueTo") || "",
    unacknowledged: params.get("unacknowledged") || "",
    sort: params.get("sort") || "createdAt", dir: params.get("dir") || "desc", page: Number(params.get("page")) || 1,
  };
  const [searchText, setSearchText] = useState(q.search);

  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === "" || v === null ? next.delete(k) : next.set(k, v)));
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };
  useEffect(() => {
    const t = setTimeout(() => { if (searchText !== q.search) set({ search: searchText }); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  // Infinite scroll: pages are appended as the end of the table scrolls into view; filters / sort start again from page 1.
  const { page: _ignoredPage, ...filters } = q;
  // Filters/search only: the sort is passed separately so changing it never shows the loader.
  const filterKey = (() => { const p = new URLSearchParams(params); p.delete("sort"); p.delete("dir"); return p.toString(); })();
  const list = useServerInfinite((page, limit) => api.tickets({ ...filters, page, limit }), filterKey, {
    pageSize: LIMIT,
    pollMs: 30000,
    sort: { id: `${q.sort}:${q.dir}`, compare: makeSorter((r) => r[q.sort], q.dir) },
  });
  const { rows, total, loaded, busy, loadingMore, hasMore, error, sentinelRef, containerRef } = list;

  const Th = ({ k, children }) => (
    <th onClick={() => set({ sort: k, dir: q.sort === k && q.dir === "desc" ? "asc" : "desc" })} style={{ cursor: "pointer" }}>
      <span className="th-content sort-th">{children}{q.sort === k && <span className="sort-arrow">{q.dir === "desc" ? "▼" : "▲"}</span>}</span>
    </th>
  );
  const statusOptions = meta ? Object.entries(meta.statuses).map(([value, label]) => ({ value, label })) : [];
  const cols = admin ? 10 : 8;

  return (
    <>
      <Collapsible collapsed={collapsed}>
      {showViews && (
        <div className="tk-pills">
          {VIEWS.map((v) => (
            <button key={v.value} type="button" className={`filter-pill${q.view === v.value ? " active" : ""}`} onClick={() => set({ view: v.value })}>{v.label}</button>
          ))}
        </div>
      )}
      <div className="filter-bar">
        <input className="search-input" placeholder="Search ID, title, restaurant…" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        <div className="filter-groups">
          <CustomDropdown label="Status" value={q.status} onChange={(v) => set({ status: v })} options={statusOptions} placeholder="All statuses" />
          <CustomDropdown label="Priority" value={q.priority} onChange={(v) => set({ priority: v })} options={meta ? meta.priorities : []} placeholder="All priorities" />
          <CustomDropdown label="Category" value={q.category} onChange={(v) => set({ category: v })} options={meta ? meta.categories : []} placeholder="All categories" />
          <CustomDropdown label="Module" value={q.module} onChange={(v) => set({ module: v })} options={meta ? meta.modules : []} placeholder="All modules" />
          {admin && <CustomDropdown label="Restaurant" value={q.restaurantId} onChange={(v) => set({ restaurantId: v })} options={restaurants.map((r) => ({ value: r.id, label: r.name }))} placeholder="All restaurants" />}
          {admin && <CustomDropdown label="Developer" value={q.developerId} onChange={(v) => set({ developerId: v })} options={developers.map((d) => ({ value: d.id, label: d.name }))} placeholder="All developers" />}
          {admin && <CustomDropdown label="Tester" value={q.testerId} onChange={(v) => set({ testerId: v })} options={developers.filter((d) => d.canTest).map((d) => ({ value: d.id, label: d.name }))} placeholder="All testers" />}
          <CustomDatePicker label="From" value={q.from.slice(0, 10)} onChange={(v) => set({ from: v })} placeholder="Any date" />
          <CustomDatePicker label="To" value={q.to.slice(0, 10)} onChange={(v) => set({ to: v ? `${v}T23:59:59` : "" })} placeholder="Any date" />
        </div>
      </div>
      </Collapsible>
      <ErrorNote error={error} />
      {!loaded && !error ? <PageLoader /> : (
        <>
          <div className="table-wrapper" ref={containerRef}>
            <table>
              <thead>
                <tr>
                  <Th k="createdAt">Ticket</Th><th>Title</th>{admin && <th>Restaurant</th>}<th>Category</th><th>Module</th>
                  <Th k="priority">Priority</Th><Th k="status">Status</Th>{admin && <th>Developer</th>}<Th k="deadline">Deadline</Th><Th k="updatedAt">Updated</Th>
                </tr>
              </thead>
              <tbody>
                {loaded && rows.length === 0 && <EmptyRow colSpan={cols} message="No tickets match these filters" />}
                {rows.map((t) => (
                  <tr key={t.ticketId}>
                    <td><Link to={`${basePath}/${t.ticketId}`} className="clickable">{t.ticketId}</Link></td>
                    <td style={{ maxWidth: 280 }}>{t.title}</td>
                    {admin && <td>{t.restaurantName}</td>}
                    <td>{(meta && meta.categories.find((c) => c.value === t.category)?.label) || t.category}</td>
                    <td>{t.module}</td>
                    <td><PriorityTag priority={t.priority} suggested={t.suggestedPriority} /></td>
                    <td><StatusTag status={t.status} label={t.statusLabel} /></td>
                    {admin && <td>{t.developerName || <span className="subtitle">Unassigned</span>}</td>}
                    <td><DeadlineText ticket={t} /></td>
                    <td>{dateOnly(t.updatedAt)}</td>
                  </tr>
                ))}
              <InfiniteScrollLoader sentinelRef={sentinelRef} hasMore={hasMore} colSpan={cols} />
              </tbody>
            </table>
            <InfiniteScrollOverlay isLoading={loadingMore || busy} label={busy ? "Updating…" : undefined} />
          </div>
          {loaded && <ResultCount total={total} shown={rows.length} />}
        </>
      )}
    </>
  );
}

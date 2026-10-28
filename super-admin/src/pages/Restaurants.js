import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as api from "../api.js";
import Button3D from "../components/Button3D.js";
import CustomDropdown from "../components/CustomDropdown.js";
import PageLoader from "../components/PageLoader.js";
import { Collapsible, EmptyRow, ErrorNote, Expiry, PageHeader, ResultCount, useCollapse, PlanBadge, StatusBadge } from "../components.js";
import { bytes, date, inr } from "../format.js";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader.js";
import useServerInfinite, { makeSorter } from "../hooks/useServerInfinite.js";

const LIMIT = 25;

const PLAN_OPTIONS = [
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Sizzle" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Banquet (custom)" },
];
const STATUS_OPTIONS = [
  { value: "trialing", label: "Trial" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past due" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
  { value: "suspended", label: "Suspended" },
  { value: "comped", label: "Complimentary" },
];
const EXPIRY_OPTIONS = [
  { value: "7", label: "Expires within 7 days" },
  { value: "30", label: "Expires within 30 days" },
];

// Same ordering the API uses for each sortable column, so re-ordering the loaded rows in place gives the same result.
const PLAN_RANK = { starter: 1, growth: 2, pro: 3, enterprise: 4 };
const RESTAURANT_SORT_VALUE = {
  name: (r) => r.name || "",
  owner: (r) => (r.owner && r.owner.name) || "",
  plan: (r) => PLAN_RANK[r.plan] || 0,
  status: (r) => r.subscriptionStatus || "",
  expiresAt: (r) => (r.expiresAt ? new Date(r.expiresAt).getTime() : Number.MAX_SAFE_INTEGER),
  storage: (r) => r.storageBytes,
  createdAt: (r) => new Date(r.createdAt).getTime(),
  mrr: (r) => r.mrr,
};

export default function Restaurants() {
  const [collapsed, toggleCollapsed] = useCollapse();
  const [params, setParams] = useSearchParams();
  const q = {
    search: params.get("search") || "",
    plan: params.get("plan") || "",
    status: params.get("status") || "",
    expiringInDays: params.get("expiringInDays") || "",
    sort: params.get("sort") || "createdAt",
    dir: params.get("dir") || "desc",
    page: Number(params.get("page")) || 1,
  };
  const [searchText, setSearchText] = useState(q.search);

  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === "" || v === null ? next.delete(k) : next.set(k, v)));
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };

  // Filters/search only: the sort is passed separately so changing it never shows the loader.
  const filterKey = (() => { const p = new URLSearchParams(params); p.delete("sort"); p.delete("dir"); return p.toString(); })();
  const { page: _ignoredPage, ...filters } = q;
  const { rows, total, loaded, busy, loadingMore, hasMore, error, sentinelRef, containerRef } =
    useServerInfinite((page, limit) => api.restaurants({ ...filters, page, limit }), filterKey, {
      pageSize: LIMIT,
      sort: { id: `${q.sort}:${q.dir}`, compare: makeSorter((r) => RESTAURANT_SORT_VALUE[q.sort] ? RESTAURANT_SORT_VALUE[q.sort](r) : r.createdAt, q.dir) },
    });
  const data = loaded ? { total } : null;

  useEffect(() => {
    const t = setTimeout(() => { if (searchText !== q.search) set({ search: searchText }); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const sortBy = (key) => set({ sort: key, dir: q.sort === key && q.dir === "asc" ? "desc" : "asc" });
  const Th = ({ k, children, right }) => (
    <th className={`${q.sort === k ? "sorted" : ""}${right ? " sa-right" : ""}`} onClick={() => sortBy(k)} aria-label={`Sort by ${children}`}>
      <span className="th-content sort-th">
        <span>{children}</span>
        <span className="sort-arrow">{q.sort === k ? (q.dir === "asc" ? "▲" : "▼") : ""}</span>
      </span>
    </th>
  );

  const download = async () => {
    try {
      const blob = await api.exportCsv({ ...q, page: undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dishky-restaurants.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
  };

  const filtersActive = !!(q.search || q.plan || q.status || q.expiringInDays);
  const clearFilters = () => { setSearchText(""); set({ search: "", plan: "", status: "", expiringInDays: "" }); };

  return (
    <div className="inner-page">
      <PageHeader collapsed={collapsed} onToggle={toggleCollapsed} title="Restaurants" count={data ? `${data.total} restaurant${data.total === 1 ? "" : "s"}` : undefined}>
        <Button3D variant="cancel" onClick={download}>Export CSV</Button3D>
      </PageHeader>

      <Collapsible collapsed={collapsed}>
      <div className="filter-bar">
        <div className="filter-groups">
          <input className="search-input" placeholder="Search restaurant, owner, email, phone…" aria-label="Search" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          <CustomDropdown label="Plan" value={q.plan} onChange={(v) => set({ plan: v })} options={PLAN_OPTIONS} placeholder="All plans" />
          <CustomDropdown label="Status" value={q.status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} placeholder="All statuses" />
          <CustomDropdown label="Expiry" value={q.expiringInDays} onChange={(v) => set({ expiringInDays: v })} options={EXPIRY_OPTIONS} placeholder="Any expiry" />
          {filtersActive && <button type="button" className="ae-clear-filter" onClick={clearFilters}>Clear</button>}
        </div>
      </div>
      </Collapsible>

      <ErrorNote error={error} />
      {!data && !error ? <PageLoader /> : (
        <>
          <div className="table-wrapper" ref={containerRef}>
            <table>
              <thead>
                <tr>
                  <Th k="name">Restaurant</Th>
                  <Th k="owner">Owner</Th>
                  <Th k="plan">Plan</Th>
                  <Th k="status">Status</Th>
                  <Th k="expiresAt">Expires</Th>
                  <Th k="storage" right>Storage</Th>
                  <Th k="mrr" right>MRR</Th>
                  <Th k="createdAt">Joined</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <EmptyRow colSpan={8} message="No restaurants match." />}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link className="clickable" to={`/restaurants/${r.id}`}>{r.name}</Link>
                      <div className="subtitle">/{r.slug}</div>
                    </td>
                    <td>
                      {r.owner?.name}
                      <div className="subtitle">{r.owner?.email}</div>
                    </td>
                    <td><PlanBadge plan={r.plan} /><div className="subtitle">{r.billingCycle}</div></td>
                    <td><StatusBadge status={r.subscriptionStatus} /></td>
                    <td>{date(r.expiresAt)}<div className="subtitle"><Expiry row={r} /></div></td>
                    <td className="sa-right">{bytes(r.storageBytes)}</td>
                    <td className="sa-right">{r.mrr ? inr(r.mrr) : "—"}</td>
                    <td>{date(r.createdAt)}</td>
                  </tr>
                ))}
                <InfiniteScrollLoader sentinelRef={sentinelRef} hasMore={hasMore} colSpan={8} />
              </tbody>
            </table>
            <InfiniteScrollOverlay isLoading={loadingMore || busy} label={busy ? "Updating…" : undefined} />
          </div>
          <ResultCount total={total} shown={rows.length} />
        </>
      )}
    </div>
  );
}

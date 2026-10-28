import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "../api.js";
import PageLoader from "../components/PageLoader.js";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader.js";
import useServerInfinite from "../hooks/useServerInfinite.js";
import { Collapsible, EmptyRow, ErrorNote, PageHeader, ResultCount, useCollapse, PlanBadge, StatusBadge } from "../components.js";
import { bytes, date, inr } from "../format.js";

const LIMIT = 25;

export default function Clients() {
  const [collapsed, toggleCollapsed] = useCollapse();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 250); return () => clearTimeout(t); }, [search]);
  const { rows, total, loaded, busy, loadingMore, hasMore, error, sentinelRef, containerRef } =
    useServerInfinite((page, limit) => api.clients({ search: debounced, page, limit }), debounced, { pageSize: LIMIT });
  const data = loaded ? { total } : null;

  return (
    <div className="inner-page">
      <PageHeader
        collapsed={collapsed} onToggle={toggleCollapsed}
        title="Clients"
        count={data ? `${data.total} client${data.total === 1 ? "" : "s"}` : undefined}
        subtitle="A client is a restaurant owner. One owner can run several restaurants."
      />
      <Collapsible collapsed={collapsed}>
      <div className="filter-bar">
        <div className="filter-groups">
          <input className="search-input" placeholder="Search name, email, phone, restaurant…" aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button type="button" className="ae-clear-filter" onClick={() => setSearch("")}>Clear</button>}
        </div>
      </div>
      </Collapsible>
      <ErrorNote error={error} />
      {!data && !error ? <PageLoader /> : (
        <>
          <div className="table-wrapper" ref={containerRef}>
            <table>
              <thead><tr><th>Owner</th><th>Contact</th><th>Restaurants</th><th className="sa-right">MRR</th><th className="sa-right">Storage</th><th>Joined</th><th>Last sign-in</th></tr></thead>
              <tbody>
                {rows.length === 0 && <EmptyRow colSpan={7} message="No clients match." />}
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td>{o.name}{o.status !== "active" && <span className="subtitle"> ({o.status})</span>}</td>
                    <td>{o.email}<div className="subtitle">{o.phone}</div></td>
                    <td>
                      {o.restaurants.map((r) => (
                        <div key={r.id} className="sa-inline">
                          <Link className="clickable" to={`/restaurants/${r.id}`}>{r.name}</Link> <PlanBadge plan={r.plan} /> <StatusBadge status={r.subscriptionStatus} />
                          <span className="subtitle"> {r.expiresAt ? `· ${date(r.expiresAt)}` : ""}</span>
                        </div>
                      ))}
                    </td>
                    <td className="sa-right">{o.mrr ? inr(o.mrr) : "—"}</td>
                    <td className="sa-right">{bytes(o.storageBytes)}</td>
                    <td>{date(o.createdAt)}</td>
                    <td>{date(o.lastLoginAt)}</td>
                  </tr>
                ))}
                <InfiniteScrollLoader sentinelRef={sentinelRef} hasMore={hasMore} colSpan={7} />
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

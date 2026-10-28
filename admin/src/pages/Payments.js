/**
 * Payments.js  —  Dishky Admin Panel
 * Lists Razorpay-verified UPI QR payments generated for orders (see
 * server/payments.js). Read-only — payment records are created by the
 * order flow and updated by Razorpay's webhook, never edited here.
 * Self-fetching/paginated like Memos.js rather than part of the
 * app-start adminData bulk preload, since payment records grow
 * continuously (one per paid bill) rather than being a small bounded
 * set like Dishes.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";
import socket from "../socket";
import { EmptyRow, formatDisplayDate } from "../App";
import { useToast } from "../useToast";
import CollapseChevron from "../components/CollapseChevron";
import CollapseSection from "../components/CollapseSection";
import CustomDropdown from "../components/CustomDropdown";
import { FilterBar } from "../components/FilterBar";
import PageLoader from "../components/PageLoader";
import Button3D from "../components/Button3D";
import useInfiniteScroll from "../components/useInfiniteScroll";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader";

import "./Payments.css";

const STATUS_OPTIONS = ["PENDING", "PAID", "FAILED"];

const STATUS_BADGE_CLASS = {
  PENDING: "pay-status-pending",
  PAID: "pay-status-paid",
  FAILED: "pay-status-failed",
};

const Payments = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const firstLoadDone = React.useRef(false);

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [preset, setPreset] = useState("");
  const [status, setStatus] = useState("");

  const load = async () => {
    if (!firstLoadDone.current) setIsLoading(true);
    else setIsFiltering(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (status) params.status = status;
      const res = await api.get("/payments", { params });
      setPayments(res.data || []);
    } catch (err) {
      console.error("Failed to load payments:", err);
      toast.error("Failed to load payments");
    } finally {
      setIsLoading(false);
      setIsFiltering(false);
      firstLoadDone.current = true;
    }
  };

  useEffect(() => {
    const t = setTimeout(load, firstLoadDone.current ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, fromDate, toDate, status]);

  // Live updates: the server emits data-change for "payments" whenever the
  // Razorpay webhook marks a payment PAID/FAILED, so the list stays current
  // without a manual reload.
  useEffect(() => {
    const onChange = ({ resource }) => {
      if (resource === "payments") load();
    };
    socket.on("data-change", onChange);
    return () => socket.off("data-change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, fromDate, toDate, status]);

  const clearFilters = () => {
    setSearch(""); setFromDate(""); setToDate(""); setPreset(""); setStatus("");
  };
  const filtersActive = !!(search || fromDate || toDate || status);

  const totalCount = payments.length;
  const pendingCount = payments.filter(p => p.status === "PENDING").length;
  const paidCount = payments.filter(p => p.status === "PAID").length;
  const failedCount = payments.filter(p => p.status === "FAILED").length;
  const paidTotal = payments.filter(p => p.status === "PAID").reduce((sum, p) => sum + (p.amount || 0), 0);

  const { displayLimit, sentinelRef, containerRef, hasMore, isLoadingMore } =
    useInfiniteScroll(payments.length, 30);

  if (isLoading) {
    return (
      <div className="inner-page">
        <PageLoader fill label="Loading payments…" />
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
              <h2 className="title">Payments</h2>
              <span className="result-count">{totalCount} payment(s)</span>
            </div>
            <p className="pay-subtitle">UPI payments verified via Razorpay</p>
          </div>
          <div className="pay-header-actions">
            <Button3D variant="cancel" onClick={load} disabled={isFiltering}>Refresh</Button3D>
          </div>
        </div>
      </div>

      <CollapseSection collapsed={headerCollapsed}>
        {/* KPI strip */}
        <div className="pay-kpi-row">
          <div className="pay-kpi" style={{ borderTopColor: "#111" }}>
            <div className="pay-kpi-val" style={{ color: "#111" }}>{totalCount}</div>
            <div className="pay-kpi-label">Total</div>
          </div>
          <div className="pay-kpi" style={{ borderTopColor: "#ca8a04" }}>
            <div className="pay-kpi-val" style={{ color: "#ca8a04" }}>{pendingCount}</div>
            <div className="pay-kpi-label">Pending</div>
          </div>
          <div className="pay-kpi" style={{ borderTopColor: "#16a34a" }}>
            <div className="pay-kpi-val" style={{ color: "#16a34a" }}>{paidCount}</div>
            <div className="pay-kpi-label">Paid</div>
          </div>
          <div className="pay-kpi" style={{ borderTopColor: "#dc2626" }}>
            <div className="pay-kpi-val" style={{ color: "#dc2626" }}>{failedCount}</div>
            <div className="pay-kpi-label">Failed</div>
          </div>
          <div className="pay-kpi" style={{ borderTopColor: "#16a34a" }}>
            <div className="pay-kpi-val" style={{ color: "#16a34a" }}>₹{paidTotal.toLocaleString("en-IN")}</div>
            <div className="pay-kpi-label">Collected</div>
          </div>
        </div>

        {/* FILTER BAR */}
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder=" Search order ID, payment ID…"
          dateRange={{
            from: fromDate,
            to: toDate,
            onChangeFrom: setFromDate,
            onChangeTo: setToDate,
            preset,
            onChangePreset: setPreset,
          }}
          onClear={clearFilters}
          active={filtersActive}
          rightContent={
            <CustomDropdown
              label="Status"
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))}
              placeholder="All statuses"
            />
          }
        />
      </CollapseSection>

      <div
        className="table-wrapper pay-page-table"
        style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
        ref={containerRef}
      >
        <table>
          <thead>
            <tr>
              <th>Payment ID</th>
              <th>Order ID</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Method</th>
              <th>VPA</th>
              <th>Status</th>
              <th className="icon-width">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <EmptyRow colSpan={8} message="No payments found" />
            ) : (
              payments.slice(0, displayLimit).map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="clickable" onClick={() => navigate(`/payments/${p.id}`, { state: { payment: p } })}>
                      {p.id}
                    </span>
                  </td>
                  <td>{p.orderId}</td>
                  <td>{formatDisplayDate(p.createdAt)}</td>
                  <td>₹{Number(p.amount || 0).toLocaleString("en-IN")}</td>
                  <td>{p.method || "—"}</td>
                  <td>{p.vpa || "—"}</td>
                  <td>
                    <span className={`pay-status-badge ${STATUS_BADGE_CLASS[p.status] || ""}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="icon-width">
                    <Button3D variant="cancel" onClick={() => navigate(`/payments/${p.id}`, { state: { payment: p } })}>
                      View
                    </Button3D>
                  </td>
                </tr>
              ))
            )}
            <InfiniteScrollLoader sentinelRef={sentinelRef} hasMore={hasMore} colSpan={8} />
          </tbody>
        </table>
        <InfiniteScrollOverlay isLoading={isLoadingMore || isFiltering} label={isFiltering ? "Updating…" : undefined} />
      </div>
    </div>
  );
};

export default Payments;

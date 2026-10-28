import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./FoodCategory.css";
import "./MyOrders.css";
import PageHeader from "./shared/PageHeader";
import { fmtDate as fmtDateNumeric, fmtTime as fmtTimeOfDay } from "../utils/dateUtils";

/** Format "YYYY-MM-DD" -> "Mon, 31-07-2026" */
function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const weekday = d.toLocaleDateString("en-IN", { weekday: "short" });
  return `${weekday}, ${fmtDateNumeric(dateStr)}`;
}

/** Format an ISO timestamp -> "Mon, 31-07-2026 · 2:45 PM". Falls back to
 *  fmtDate's output when there's no time-of-day component to show. */
function fmtDateTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const datePart = fmtDate(dateStr);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${datePart} · ${fmtTimeOfDay(`${hh}:${mm}`)}`;
}

export { fmtDate, fmtDateTime };

const STATUS_LABELS = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_ICONS = {
  pending: "⏳",
  preparing: "👨‍🍳",
  ready: "🔔",
  completed: "✅",
  cancelled: "✕",
};

/** Total dish count for an order, respecting each item's quantity. */
function dishCount(order) {
  return (order.items || []).reduce((sum, item) => sum + (item.quantity ?? item.qty ?? 1), 0);
}

export { STATUS_LABELS, STATUS_ICONS, dishCount };

const sortOrders = (list) =>
  [...(list || [])].sort((a, b) => {
    const at = new Date(a.createdAt || a.date || 0).getTime();
    const bt = new Date(b.createdAt || b.date || 0).getTime();
    return bt - at;
  });

// App.js already fetches every logged-in customer's orders once on app
// load (part of fetchMenu's initial Promise.all batch) and keeps them
// live via Socket.IO. This page used to ignore that and re-fetch
// /orders/mine from scratch on every visit — a full network round trip
// (plus Render cold-start latency) just to show a spinner over data the
// app already had. Now it renders instantly from `initialOrders` and
// only hits the network as a silent background refresh, never blocking
// the UI.
const MyOrders = ({ currentUser, initialOrders, handleBack, handleHome }) => {
  const navigate = useNavigate();
  const hasInitial = Array.isArray(initialOrders);
  const [orders, setOrders] = useState(() => sortOrders(initialOrders));
  const [loading, setLoading] = useState(!hasInitial);
  const [error, setError] = useState(false);

  // Keep in sync if the parent's global orders update (e.g. via socket).
  useEffect(() => {
    if (hasInitial) setOrders(sortOrders(initialOrders));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrders]);

  useEffect(() => {
    if (!currentUser || currentUser.id === "guest") {
      setLoading(false);
      return;
    }

    let cancelled = false;
    // Only show the loading state if we had nothing to render yet —
    // otherwise this is a silent background refresh over existing data.
    if (!hasInitial) setLoading(true);
    setError(false);

    api
      .get("/orders/mine")
      .then((res) => {
        if (cancelled) return;
        setOrders(sortOrders(res.data));
      })
      .catch(() => {
        if (!cancelled && !hasInitial) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // BLOCK GUEST ACCESS
  if (!currentUser || currentUser.id === "guest") {
    return null;
  }

  return (
    <div className="no-padding">
      <PageHeader
        title={
          <span className="my-orders-title-row">
            My Orders
            {!loading && !error && orders.length > 0 && (
              <span className="my-orders-count-badge">{orders.length}</span>
            )}
          </span>
        }
        wrapperClassName="food-header"
        titleClassName="food-list-title"
        onBack={handleBack}
        onHome={handleHome}
      />

      <div className="pl-body">
        {loading && (
          <div className="my-orders-state">
            <div className="my-orders-state-icon my-orders-state-icon--loading">🧾</div>
            <h3 className="my-orders-state-title">Loading your orders</h3>
          </div>
        )}

        {!loading && error && (
          <div className="my-orders-state">
            <div className="my-orders-state-icon my-orders-state-icon--error">⚠️</div>
            <h3 className="my-orders-state-title">Couldn't load your orders</h3>
            <p className="my-orders-state-sub">Please try again in a moment.</p>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="my-orders-state">
            <div className="my-orders-state-icon my-orders-state-icon--empty">🧾</div>
            <h3 className="my-orders-state-title">No orders yet</h3>
            <p className="my-orders-state-sub">Orders you place will show up here.</p>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="my-orders-list-scroll">
            <div className="my-orders-list">
              {orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  className={`my-order-card my-order-status--${order.status || "pending"}`}
                  onClick={() => navigate(`/my-orders/${order.id}`)}
                >
                  <span className="my-order-card-accent" />

                  <div className="my-order-card-top">
                    <div className="my-order-meta">
                      <span className="my-order-id">#{order.id}</span>
                      <span className="my-order-date">{fmtDate(order.date || order.createdAt)}</span>
                    </div>
                    <span className={`my-order-status my-order-status--${order.status || "pending"}`}>
                      <span className="my-order-status-icon">{STATUS_ICONS[order.status] || STATUS_ICONS.pending}</span>
                      {STATUS_LABELS[order.status] || order.status || "Pending"}
                    </span>
                  </div>

                  <div className="my-order-items">
                    <span className="my-order-dish-count">
                      🍽️ {dishCount(order)} {dishCount(order) === 1 ? "dish" : "dishes"}
                    </span>
                  </div>

                  <div className="my-order-card-bottom">
                    <span>Total</span>
                    <span className="my-order-total">₹{order.totalAmount ?? 0}</span>
                    <span className="my-order-card-arrow" aria-hidden="true">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default MyOrders;
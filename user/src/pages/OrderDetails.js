import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../api";
import "./FoodCategory.css";
import "./MyOrders.css";
import "./OrderDetails.css";
import PageHeader from "./shared/PageHeader";
import { fmtDate as fmtDateNumeric } from "../utils/dateUtils";

/** Format "YYYY-MM-DD" / ISO → "Mon, 31-07-2026" */
function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const weekday = d.toLocaleDateString("en-IN", { weekday: "short" });
  return `${weekday}, ${fmtDateNumeric(dateStr)}`;
}

function fmtTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

const STATUS_LABELS = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

// Order the timeline steps appear in, for the progress rail. "cancelled"
// is handled separately since it isn't a step on the happy path.
const TIMELINE_STEPS = ["pending", "preparing", "ready", "completed"];

function dishCount(order) {
  return (order?.items || []).reduce((sum, item) => sum + (item.quantity ?? item.qty ?? 1), 0);
}

const pageVariant = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

const listStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const itemRise = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

const OrderDetails = ({ handleBack, handleHome }) => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    api
      .get(`/orders/mine`)
      .then((res) => {
        if (cancelled) return;
        const found = (res.data || []).find((o) => String(o.id) === String(orderId));
        if (!found) {
          setError(true);
        } else {
          setOrder(found);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [orderId]);

  const status = order?.status || "pending";
  const isCancelled = status === "cancelled";
  const activeStepIndex = TIMELINE_STEPS.indexOf(status);

  const items = order?.items || [];
  const subtotal = items.reduce((sum, item) => sum + Number(item.totalPrice ?? item.unitPrice ?? 0), 0);
  const discountPercent = Math.max(0, Math.min(100, Number(order?.discount?.percent) || 0));
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const total = order?.totalAmount ?? subtotal - discountAmount;

  return (
    <div className="no-padding">
      <PageHeader
        title="Order Details"
        wrapperClassName="food-header"
        titleClassName="food-list-title"
        onBack={handleBack}
        onHome={handleHome}
      />

      <div className="pl-body food-list order-details-page">
      <div className="food-category" style={{ padding: "0px" }}>
        {loading && (
          <div className="my-orders-state">
            <div className="my-orders-state-icon my-orders-state-icon--loading">🧾</div>
            <h3 className="my-orders-state-title">Loading order</h3>
          </div>
        )}

        {!loading && error && (
          <div className="my-orders-state">
            <div className="my-orders-state-icon my-orders-state-icon--error">⚠️</div>
            <h3 className="my-orders-state-title">Couldn't find that order</h3>
            <p className="my-orders-state-sub">It may have been removed, or the link is incorrect.</p>
          </div>
        )}

        {!loading && !error && order && (
          <motion.div
            className="od-scroll"
            variants={pageVariant}
            initial="hidden"
            animate="show"
          >
            {/* HERO */}
            <div className={`od-hero od-status--${status}`}>
              <div className="od-hero-glow" />
              <div className="od-hero-top">
                <span className="od-hero-id">#{order.id}</span>
                <span className={`od-status-pill od-status--${status}`}>
                  {STATUS_LABELS[status] || status}
                </span>
              </div>
              <div className="od-hero-datetime">
                {fmtDate(order.date || order.createdAt)}
                {fmtTime(order.createdAt) && <span className="od-hero-dot">•</span>}
                {fmtTime(order.createdAt)}
              </div>
              <div className="od-hero-total">
                <span>Total Paid</span>
                <strong>₹{total}</strong>
              </div>
            </div>

            {/* TIMELINE */}
            {!isCancelled ? (
              <div className="od-timeline">
                {TIMELINE_STEPS.map((step, i) => (
                  <div
                    key={step}
                    className={`od-timeline-step${i <= activeStepIndex ? " od-timeline-step--done" : ""}${i === activeStepIndex ? " od-timeline-step--current" : ""}`}
                  >
                    <span className="od-timeline-dot">{i <= activeStepIndex ? "✓" : ""}</span>
                    <span className="od-timeline-label">{STATUS_LABELS[step]}</span>
                    {i < TIMELINE_STEPS.length - 1 && <span className="od-timeline-line" />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="od-cancelled-banner">This order was cancelled.</div>
            )}

            {order.mode && (
              <div className="od-mode-row">
                <span className="od-mode-icon">{order.mode?.toLowerCase() === "dine in" ? "🍽️" : order.mode?.toLowerCase() === "delivery" ? "🛵" : "🥡"}</span>
                <span>{order.mode.toUpperCase()}</span>
                {(order.tableNo || order.tableNumber) && <span className="od-mode-table">Table {order.tableNo || order.tableNumber}</span>}
              </div>
            )}

            {order.attenderName && (
              <div className="od-mode-row">
                <span className="od-mode-icon">🧑‍🍳</span>
                <span>Attender: {order.attenderName}</span>
              </div>
            )}

            {/* ITEMS */}
            <motion.div className="od-items-card" variants={listStagger} initial="hidden" animate="show">
              <div className="od-items-header">
                <span>Items</span>
                <span className="od-items-count">{dishCount(order)} {dishCount(order) === 1 ? "dish" : "dishes"}</span>
              </div>

              {items.map((item, i) => (
                <motion.div key={i} className="od-item-row" variants={itemRise}>
                  <div className="od-item-qty-badge">{item.quantity ?? item.qty ?? 1}×</div>
                  <div className="od-item-info">
                    <span className="od-item-name">{item.dishName || item.name}</span>
                    {item.notes && <span className="od-item-notes">{item.notes}</span>}
                  </div>
                  <span className="od-item-price">₹{item.totalPrice ?? item.unitPrice ?? 0}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* BILL SUMMARY */}
            <div className="od-bill-card">
              <div className="od-bill-row">
                <span>Subtotal</span>
                <span>₹{subtotal}</span>
              </div>
              {discountPercent > 0 && (
                <div className="od-bill-row od-bill-row--discount">
                  <span>Discount ({discountPercent}%){order.discount?.reason ? ` — ${order.discount.reason}` : ""}</span>
                  <span>−₹{discountAmount}</span>
                </div>
              )}
              <div className="od-bill-row od-bill-row--total">
                <span>Total</span>
                <span>₹{total}</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      </div>
    </div>
  );
};

export default OrderDetails;

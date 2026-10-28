import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import "./FoodCategory.css";
import "./MyOrders.css";
import "./MyOrderDetails.css";
import PageHeader from "./shared/PageHeader";
import Button3D from "./shared/Button3D";
import { fmtDateTime, STATUS_LABELS, STATUS_ICONS, dishCount } from "./MyOrders";

// Ordered progression used to render the status timeline. "cancelled"
// is handled separately since it isn't a step on the happy path.
const STATUS_STEPS = ["pending", "preparing", "ready", "completed"];

const MyOrderDetails = ({ currentUser, handleHome, handleBack }) => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!currentUser || currentUser.id === "guest") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);

    api
      .get("/orders/mine")
      .then((res) => {
        if (cancelled) return;
        const found = (res.data || []).find((o) => String(o.id) === String(orderId));
        if (!found) { setError(true); return; }
        setOrder(found);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [currentUser, orderId]);

  if (!currentUser || currentUser.id === "guest") return null;

  const handleBackToList = () => navigate("/my-orders");

  if (loading) {
    return (
      <div className="no-padding">
        <PageHeader title="Order Details" wrapperClassName="food-header" titleClassName="food-list-title" onBack={handleBackToList} onHome={handleHome} />
        <div className="pl-body food-list my-order-details-page">
        <div className="my-orders-state">
          <div className="my-orders-state-icon my-orders-state-icon--loading">🧾</div>
          <h3 className="my-orders-state-title">Loading order</h3>
        </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="no-padding">
        <PageHeader title="Order Details" wrapperClassName="food-header" titleClassName="food-list-title" onBack={handleBackToList} onHome={handleHome} />
        <div className="pl-body food-list my-order-details-page">
        <div className="my-orders-state">
          <div className="my-orders-state-icon my-orders-state-icon--error">⚠️</div>
          <h3 className="my-orders-state-title">Order not found</h3>
          <p className="my-orders-state-sub">It may have been removed, or the link is out of date.</p>
          <Button3D className="mod-back-to-orders-btn" onClick={handleBackToList}>Back to My Orders</Button3D>
        </div>
        </div>
      </div>
    );
  }

  const items = order.items || [];
  const status = order.status || "pending";
  const isCancelled = status === "cancelled";
  const activeStepIndex = STATUS_STEPS.indexOf(status);
  const subtotal = items.reduce((sum, it) => sum + (it.totalPrice ?? (it.unitPrice ?? 0) * (it.quantity || 1)), 0);
  const extras = (order.totalAmount ?? subtotal) - subtotal; // taxes/fees/discount, if the total differs from item sum

  return (
    <div className="no-padding">
      <PageHeader
        title="Order Details"
        wrapperClassName="food-header"
        titleClassName="food-list-title"
        onBack={handleBackToList}
        onHome={handleHome}
      />

      <div className="pl-body food-list my-order-details-page">
      <div className="food-category mod-scroll" style={{ padding: "0px" }}>
        <div className="mod-hero">
          <div className="mod-hero-top">
            <span className="mod-order-id">Order #{order.id}</span>
            <span className="mod-order-date">{fmtDateTime(order.date || order.createdAt)}</span>
          </div>
          <span className={`mod-status-pill mod-status-pill--${status}`}>
            <span className="mod-status-icon">{STATUS_ICONS[status] || STATUS_ICONS.pending}</span>
            {STATUS_LABELS[status] || status}
          </span>
        </div>

        {!isCancelled ? (
          <div className="mod-timeline">
            {STATUS_STEPS.map((step, i) => (
              <div
                key={step}
                className={`mod-timeline-step${i <= activeStepIndex ? " mod-timeline-step--done" : ""}${i === activeStepIndex ? " mod-timeline-step--current" : ""}`}
              >
                <span className="mod-timeline-dot">{STATUS_ICONS[step]}</span>
                <span className="mod-timeline-label">{STATUS_LABELS[step]}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mod-cancelled-banner">
            This order was cancelled.
          </div>
        )}

        {(order.orderType || order.tableNumber || order.deliveryAddress || order.paymentMethod) && (
          <div className="mod-info-grid">
            {order.orderType && (
              <div className="mod-info-card">
                <span className="mod-info-label">Order Type</span>
                <span className="mod-info-value">{order.orderType}</span>
              </div>
            )}
            {order.tableNumber && (
              <div className="mod-info-card">
                <span className="mod-info-label">Table</span>
                <span className="mod-info-value">{order.tableNumber}</span>
              </div>
            )}
            {order.paymentMethod && (
              <div className="mod-info-card">
                <span className="mod-info-label">Payment</span>
                <span className="mod-info-value">{order.paymentMethod}</span>
              </div>
            )}
            {order.deliveryAddress && (
              <div className="mod-info-card mod-info-card--wide">
                <span className="mod-info-label">Delivery Address</span>
                <span className="mod-info-value">{order.deliveryAddress}</span>
              </div>
            )}
          </div>
        )}

        <div className="mod-section">
          <div className="mod-section-title">
            <span>Items</span>
            <span className="mod-section-sub">{dishCount(order)} {dishCount(order) === 1 ? "dish" : "dishes"}</span>
          </div>
          <div className="mod-items-list">
            {items.map((item, i) => (
              <div key={i} className="mod-item-row">
                <span className="mod-item-qty-badge">{item.quantity || 1}×</span>
                <span className="mod-item-name">{item.dishName || item.name}</span>
                <span className="mod-item-price">₹{item.totalPrice ?? item.unitPrice ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        {order.notes && (
          <div className="mod-section">
            <div className="mod-section-title"><span>Special Instructions</span></div>
            <p className="mod-notes">{order.notes}</p>
          </div>
        )}

        <div className="mod-bill">
          <div className="mod-bill-row">
            <span>Subtotal</span>
            <span>₹{subtotal}</span>
          </div>
          {extras > 0 && (
            <div className="mod-bill-row">
              <span>Taxes & Fees</span>
              <span>₹{extras}</span>
            </div>
          )}
          <div className="mod-bill-row mod-bill-row--total">
            <span>Total</span>
            <span>₹{order.totalAmount ?? subtotal}</span>
          </div>
        </div>

        <Button3D className="mod-back-to-orders-btn" onClick={handleBackToList}>
          Back to My Orders
        </Button3D>
      </div>
      </div>
    </div>
  );
};

export default MyOrderDetails;

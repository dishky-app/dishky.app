import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import api from "../api";
import { bookingCrud } from "./shared/eventBookingCrud";
import "./FoodCategory.css";
import "./MyOrders.css";
import "./MyOrderDetails.css";
import "./MySubscriptions.css";
import PageHeader from "./shared/PageHeader";
import Button3D from "./shared/Button3D";
import ConfirmDialog from "./shared/ConfirmDialog";
import FormBtnRowPortal from "./shared/FormBtnRowPortal";
import { fmtDate as fmtDateNumeric } from "../utils/dateUtils";

function fmtDateTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const weekday = d.toLocaleDateString("en-IN", { weekday: "short" });
  return `${weekday}, ${fmtDateNumeric(dateStr)}`;
}

const SLOT_LABELS = {
  breakfast: "Breakfast",
  brunch: "Brunch",
  lunch: "Lunch",
  "hi-tea": "Hi-Tea",
  dinner: "Dinner",
};
const SLOT_ICONS = {
  breakfast: "🌅",
  brunch: "🥐",
  lunch: "🍛",
  "hi-tea": "☕",
  dinner: "🌙",
};
const SLOT_ORDER = ["breakfast", "brunch", "lunch", "hi-tea", "dinner"];
const WEEKS = ["week1", "week2", "week3", "week4"];
const WEEK_LABELS = { week1: "Week 1", week2: "Week 2", week3: "Week 3", week4: "Week 4" };
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

const STATUS_LABELS = { active: "Active", paused: "Paused", cancelled: "Cancelled" };
const STATUS_ICONS = { active: "✅", paused: "⏸️", cancelled: "✕" };

/** Every (slot, week, day, dish) cell with a dish in it, flattened. */
function flattenSlots(slots, planType) {
  const rows = [];
  if (!slots) return rows;
  SLOT_ORDER.forEach((slot) => {
    const weekMap = slots[slot];
    if (!weekMap) return;
    const weeksToShow = planType === "monthly" ? WEEKS : ["week1"];
    weeksToShow.forEach((week) => {
      DAY_ORDER.forEach((dayKey) => {
        const cell = weekMap?.[week]?.[dayKey];
        const dishIds = Array.isArray(cell) ? cell : (cell ? [cell] : []);
        dishIds.forEach((dishId) => {
          if (dishId) rows.push({ slot, week, dayKey, dishId });
        });
      });
    });
  });
  return rows;
}

const SubscriptionDetailsPage = ({ currentUser, handleBack, handleHome }) => {
  const { subscriptionId } = useParams();
  const navigate = useNavigate();

  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dishById, setDishById] = useState({});
  const [busy, setBusy] = useState(false);
  const [showFullTable, setShowFullTable] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // "pause" | "resume" | "cancel" | null

  const handleBackToList = () => navigate("/my-subscriptions");
  // Falls back to handleBackToList if handleBack isn't passed in (defensive
  // only — App.js always supplies it), so the header chevron never no-ops.
  const goBack = handleBack || handleBackToList;

  // Load the subscription record.
  useEffect(() => {
    if (!currentUser || currentUser.id === "guest") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);

    bookingCrud.getAll("subscriptions")
      .then((records) => {
        if (cancelled) return;
        const found = (records || []).find((s) => String(s.id) === String(subscriptionId));
        if (!found) { setError(true); return; }
        setSub(found);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [currentUser, subscriptionId]);

  // Load the full menu once, so every dish id on the plan resolves to a
  // real name — subscriptions only store dish ids, not names.
  useEffect(() => {
    api.get("/public/categories")
      .then((res) => {
        const rawCats = Array.isArray(res.data) ? res.data : (res.data?.categories || []);
        const map = {};
        const collect = (list) => (list || []).forEach((d) => { map[d.id] = d; });
        rawCats.forEach((topCat) => {
          const subs = topCat.subCategories || [];
          if (subs.length > 0) subs.forEach((s) => collect(s.dishes));
          else collect(topCat.dishes);
        });
        setDishById(map);
      })
      .catch(() => setDishById({}));
  }, []);

  if (!currentUser || currentUser.id === "guest") return null;

  const togglePause = async () => {
    if (!sub) return;
    setBusy(true);
    try {
      const nextStatus = sub.status === "paused" ? "active" : "paused";
      const updated = await bookingCrud.update("subscriptions", sub.id, { status: nextStatus }, sub);
      setSub(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  const cancelSub = async () => {
    if (!sub) return;
    setBusy(true);
    try {
      const updated = await bookingCrud.cancel("subscriptions", sub.id, sub);
      setSub(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  // Config for the confirmation dialog, keyed by which action is pending.
  // "pause" and "resume" are really the same togglePause call — only the
  // copy shown to the user differs based on the sub's current status.
  const CONFIRM_CONFIG = {
    pause: {
      title: "Pause Plan?",
      message: "Your meals won't be prepared or delivered while the plan is paused. You can resume anytime.",
      confirmLabel: "Pause Plan",
      onConfirm: togglePause,
    },
    resume: {
      title: "Resume Plan?",
      message: "Your subscription will go back to active and deliveries will restart on schedule.",
      confirmLabel: "Resume Plan",
      onConfirm: togglePause,
    },
    cancel: {
      title: "Cancel Subscription?",
      message: "This will permanently cancel your plan. This action can't be undone.",
      confirmLabel: "Cancel Plan",
      onConfirm: cancelSub,
    },
  };
  const activeConfirm = confirmAction ? CONFIRM_CONFIG[confirmAction] : null;

  if (loading) {
    return (
      <div className="no-padding">
        <PageHeader title="Subscription" wrapperClassName="food-header" titleClassName="food-list-title" onBack={goBack} onHome={handleHome} />
        <div className="pl-body food-list my-order-details-page">
          <div className="my-orders-state">
            <div className="my-orders-state-icon my-orders-state-icon--loading">🥗</div>
            <h3 className="my-orders-state-title">Loading subscription</h3>
          </div>
        </div>
      </div>
    );
  }

  if (error || !sub) {
    return (
      <div className="no-padding">
        <PageHeader title="Subscription" wrapperClassName="food-header" titleClassName="food-list-title" onBack={goBack} onHome={handleHome} />
        <div className="pl-body food-list my-order-details-page">
          <div className="my-orders-state">
            <div className="my-orders-state-icon my-orders-state-icon--error">⚠️</div>
            <h3 className="my-orders-state-title">Subscription not found</h3>
            <p className="my-orders-state-sub">It may have been removed, or the link is out of date.</p>
            <Button3D className="mod-back-to-orders-btn" onClick={handleBackToList}>Back to My Subscriptions</Button3D>
          </div>
        </div>
      </div>
    );
  }

  const status = sub.status || "active";
  const rows = flattenSlots(sub.slots, sub.planType);
  const dishLabel = (dishId) => dishById[dishId]?.name || dishId;

  // Group rows into one row per (slot [+ week]) with a Dish / Days summary,
  // AND keep the flat per-dish rows for the detailed table below.
  const groups = rows.reduce((acc, row) => {
    const key = sub.planType === "monthly" ? `${row.slot}__${row.week}` : row.slot;
    if (!acc[key]) acc[key] = { slot: row.slot, week: row.week, dishMap: new Map() };
    if (!acc[key].dishMap.has(row.dishId)) acc[key].dishMap.set(row.dishId, []);
    acc[key].dishMap.get(row.dishId).push(row.dayKey);
    return acc;
  }, {});
  const groupList = Object.values(groups);

  return (
    <div className="no-padding">
      <PageHeader
        title="Subscription Details"
        wrapperClassName="food-header"
        titleClassName="food-list-title"
        onBack={goBack}
        onHome={handleHome}
      />

      <div className="pl-body food-list my-order-details-page">
        <div className="food-category mod-scroll" style={{ padding: "0px" }}>

          <div className="mod-hero">
            <div className="mod-hero-top">
              <span className="mod-order-id">Subscription #{sub.id}</span>
              <span className="mod-order-date">Started {fmtDateTime(sub.startDate)}</span>
            </div>
            <div className="sub-hero-bottom">
              <span className={`mod-status-pill mod-status-pill--${status === "cancelled" ? "cancelled" : status === "paused" ? "preparing" : "completed"}`}>
                <span className="mod-status-icon">{STATUS_ICONS[status] || STATUS_ICONS.active}</span>
                {STATUS_LABELS[status] || "Active"}
              </span>
              <span className="sub-hero-price">
                ₹{(sub.totalPrice ?? 0).toLocaleString()}<span className="sub-hero-price-unit">/mo</span>
              </span>
            </div>
          </div>

          <div className="mod-info-grid">
            <div className="mod-info-card">
              <span className="mod-info-label">Customer</span>
              <span className="mod-info-value">{sub.customerName || "—"}</span>
            </div>
            <div className="mod-info-card">
              <span className="mod-info-label">Mobile</span>
              <span className="mod-info-value">{sub.customerPhone || "—"}</span>
            </div>
            <div className="mod-info-card">
              <span className="mod-info-label">Delivery Address</span>
              <span className="mod-info-value">
                {[
                  sub.addrDoorNo, sub.addrStreet, sub.addrArea,
                  sub.addrLandmark, sub.addrCity, sub.addrDistrict,
                  sub.addrState, sub.addrPincode,
                ].filter(Boolean).join(", ") || "—"}
              </span>
            </div>
            <div className="mod-info-card">
              <span className="mod-info-label">Plan Type</span>
              <span className="mod-info-value">{sub.planType === "monthly" ? "Custom / Monthly" : "Weekly Repeat"}</span>
            </div>
            <div className="mod-info-card">
              <span className="mod-info-label">Meals Scheduled</span>
              <span className="mod-info-value">{rows.length}</span>
            </div>
          </div>

          {/* Quick-scan summary: one card per slot(+week), dishes with day pills */}
          <div className="mod-section">
            <div className="mod-section-title">
              <span>Meal Schedule</span>
              <span className="mod-section-sub">{groupList.length} {groupList.length === 1 ? "slot" : "slots"}</span>
            </div>

            {groupList.length === 0 ? (
              <p className="my-orders-state-sub">Nothing was scheduled on this plan.</p>
            ) : (
              <div className="sub-schedule-groups">
                {groupList.map((g, i) => (
                  <div key={i} className={`sub-schedule-group sub-schedule-group--${g.slot}`}>
                    <div className="sub-schedule-group-head">
                      <span className="sub-schedule-group-icon" aria-hidden="true">{SLOT_ICONS[g.slot] || "🍽️"}</span>
                      <span className="sub-schedule-group-name">
                        {SLOT_LABELS[g.slot] || g.slot}
                        {sub.planType === "monthly" && (
                          <span className="sub-schedule-group-week"> — {WEEK_LABELS[g.week]}</span>
                        )}
                      </span>
                      <span className="sub-schedule-group-count">{g.dishMap.size}</span>
                    </div>
                    <div className="sub-schedule-dish-list">
                      {Array.from(g.dishMap.entries()).map(([dishId, days]) => (
                        <div key={dishId} className="sub-schedule-dish-row">
                          <span className="sub-schedule-dish-name">{dishLabel(dishId)}</span>
                          <span className="sub-schedule-day-pills">
                            {DAY_ORDER.filter((d) => days.includes(d)).map((d) => (
                              <span key={d} className="sub-day-pill">{DAY_LABELS[d]}</span>
                            ))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Full detail table: slot / dish name / day (+ week) — collapsed by
              default, since the schedule cards above already give an at-a-glance
              view; this is for anyone who wants the flat, row-by-row list. */}
          {rows.length > 0 && (
            <div className="mod-section">
              <button
                type="button"
                className="sub-full-table-toggle"
                onClick={() => setShowFullTable((v) => !v)}
                aria-expanded={showFullTable}
              >
                <span>Full Schedule ({rows.length} {rows.length === 1 ? "row" : "rows"})</span>
                <span className={`sub-full-table-chevron${showFullTable ? " is-open" : ""}`} aria-hidden="true">▾</span>
              </button>

              <AnimatePresence initial={false}>
                {showFullTable && (
                  <motion.div
                    key="sub-summary-table-wrap"
                    className="sub-summary-table-wrap"
                    initial={{ opacity: 0, height: 0, y: -8 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -8 }}
                    transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                    style={{ overflow: "hidden" }}
                  >
                    <table className="sub-summary-table">
                      <thead>
                        <tr>
                          <th>Slot</th>
                          <th>Dish</th>
                          <th>Day</th>
                          {sub.planType === "monthly" && <th>Week</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={`${row.slot}-${row.week}-${row.dayKey}-${row.dishId}-${i}`}>
                            <td>{SLOT_LABELS[row.slot] || row.slot}</td>
                            <td>{dishLabel(row.dishId)}</td>
                            <td>{DAY_LABELS[row.dayKey]}</td>
                            {sub.planType === "monthly" && <td>{WEEK_LABELS[row.week]}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {status !== "cancelled" && (
            <FormBtnRowPortal>
              <div className="sub-details-actions">
                <Button3D
                  className="btn-3d red"
                  disabled={busy}
                  onClick={() => setConfirmAction(status === "paused" ? "resume" : "pause")}
                >
                  {status === "paused" ? "Resume Plan" : "Pause Plan"}
                </Button3D>
                <Button3D className="btn-3d red" disabled={busy} onClick={() => setConfirmAction("cancel")}>
                  Cancel Plan
                </Button3D>
                <Button3D className="btn-3d green" onClick={handleBackToList}>
                  Back to My Subscriptions
                </Button3D>
              </div>
            </FormBtnRowPortal>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!activeConfirm}
        title={activeConfirm?.title}
        message={activeConfirm?.message}
        confirmLabel={activeConfirm?.confirmLabel}
        cancelLabel="Nevermind"
        onConfirm={activeConfirm?.onConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

export default SubscriptionDetailsPage;
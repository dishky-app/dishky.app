import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { bookingCrud } from "./shared/eventBookingCrud";
import "./FoodCategory.css";
import "./MyOrders.css";
import "./MySubscriptions.css";
import PageHeader from "./shared/PageHeader";
import Button3D from "./shared/Button3D";
import { fmtDate as fmtDateNumeric } from "../utils/dateUtils";

const WEEKS = ["week1", "week2", "week3", "week4"];
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const weekday = d.toLocaleDateString("en-IN", { weekday: "short" });
  return `${weekday}, ${fmtDateNumeric(dateStr)}`;
}

const STATUS_LABELS = {
  active: "Active",
  paused: "Paused",
  cancelled: "Cancelled",
};

const STATUS_ICONS = {
  active: "✅",
  paused: "⏸️",
  cancelled: "✕",
};

const SLOT_ORDER = ["breakfast", "brunch", "lunch", "hi-tea", "dinner"];

/** Every scheduled dish/day cell across a subscription's slots, flattened. */
function flattenSlots(slots, planType) {
  const rows = [];
  if (!slots) return rows;
  Object.entries(slots).forEach(([slot, weekMap]) => {
    const weeksToShow = planType === "monthly" ? WEEKS : ["week1"];
    weeksToShow.forEach(week => {
      DAY_ORDER.forEach(dayKey => {
        const cell = weekMap?.[week]?.[dayKey];
        const dishIds = Array.isArray(cell) ? cell : (cell ? [cell] : []);
        dishIds.forEach(dishId => {
          if (dishId) rows.push({ slot, week, dayKey, dishId });
        });
      });
    });
  });
  return rows;
}

const mealCount = (sub) => flattenSlots(sub.slots, sub.planType).length;

/** Which meal slots (breakfast/lunch/etc.) have at least one dish scheduled. */
const activeSlots = (sub) => {
  const rows = flattenSlots(sub.slots, sub.planType);
  const seen = new Set(rows.map((r) => r.slot));
  return SLOT_ORDER.filter((s) => seen.has(s));
};

const sortSubs = (list) =>
  [...(list || [])].sort((a, b) => {
    const at = new Date(a.startDate || a.createdAt || 0).getTime();
    const bt = new Date(b.startDate || b.createdAt || 0).getTime();
    return bt - at;
  });

const MySubscriptions = ({ currentUser, handleBack, handleHome }) => {
  const navigate = useNavigate();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dishById, setDishById] = useState({});

  useEffect(() => {
    if (!currentUser || currentUser.id === "guest") {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    bookingCrud.getAll("subscriptions")
      .then((records) => { if (!cancelled) setSubs(sortSubs(records)); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Dish names aren't stored on the subscription record — only ids — so
  // pull the menu once to resolve them for the card preview.
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

  const dishPreview = (sub) => {
    const rows = flattenSlots(sub.slots, sub.planType);
    const seen = new Set();
    for (const row of rows) seen.add(dishById[row.dishId]?.name || row.dishId);
    const allNames = Array.from(seen);
    return { shown: allNames.slice(0, 3), extraCount: Math.max(0, allNames.length - 3) };
  };

  // BLOCK GUEST ACCESS
  if (!currentUser || currentUser.id === "guest") {
    return null;
  }

  return (
    <div className="no-padding">
      <PageHeader
        title={
          <span className="my-orders-title-row">
            My Subscriptions
            {!loading && !error && subs.length > 0 && (
              <span className="my-orders-count-badge">{subs.length}</span>
            )}
          </span>
        }
        wrapperClassName="food-header"
        titleClassName="food-list-title"
        onBack={handleBack}
        onHome={handleHome}
        rightExtra={
          !loading && !error && subs.length > 0 && (
            <Button3D className="btn-3d red" onClick={() => navigate("/subscribe")}>
              + Add
            </Button3D>
          )
        }
      />

      <div className="pl-body">
        {loading && (
          <div className="my-orders-state">
            <div className="my-orders-state-icon my-orders-state-icon--loading">🥗</div>
            <h3 className="my-orders-state-title">Loading your subscriptions</h3>
          </div>
        )}

        {!loading && error && (
          <div className="my-orders-state">
            <div className="my-orders-state-icon my-orders-state-icon--error">⚠️</div>
            <h3 className="my-orders-state-title">Couldn't load your subscriptions</h3>
            <p className="my-orders-state-sub">Please try again in a moment.</p>
          </div>
        )}

        {!loading && !error && subs.length === 0 && (
          <div className="my-orders-state">
            <div className="my-orders-state-icon my-orders-state-icon--empty">🥗</div>
            <h3 className="my-orders-state-title">No subscriptions yet</h3>
            <p className="my-orders-state-sub">Set up a recurring meal plan and it'll show up here.</p>
            <Button3D className="btn-3d red sub-new-btn" onClick={() => navigate("/subscribe")}>
              + New Subscription
            </Button3D>
          </div>
        )}

        {!loading && !error && subs.length > 0 && (
          <div className="my-orders-list-scroll">
            <div className="my-orders-list">
              {subs.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  className={`my-order-card sub-card my-order-status--${sub.status === "cancelled" ? "cancelled" : sub.status === "paused" ? "pending" : "completed"}`}
                  onClick={() => navigate(`/my-subscriptions/${sub.id}`)}
                >
                  <span className="my-order-card-accent" />

                  <div className="my-order-card-div">
                    <div className="my-order-card-top">
                      <div className="my-order-meta">
                        <span className="my-order-id">#{sub.id}</span>
                        <span className="my-order-date">Started {fmtDate(sub.startDate)}</span>
                      </div>
                    </div>

                    <div className="sub-card-dish-preview">
                      {dishPreview(sub).shown.map((line, i) => (
                        <span key={i} className="sub-card-dish-line">{line}</span>
                      ))}
                      {dishPreview(sub).extraCount > 0 && (
                        <span className="sub-card-dish-more">+{dishPreview(sub).extraCount} more</span>
                      )}
                      {mealCount(sub) === 0 && (
                        <span className="sub-card-dish-line sub-card-dish-line--empty">Nothing scheduled yet</span>
                      )}
                    </div>

                    <div className="my-order-items">
                      <span className="my-order-dish-count">
                        🍽️ {mealCount(sub)} {mealCount(sub) === 1 ? "meal" : "meals"}/month
                      </span>
                      <span className="sub-plan-type-badge">
                        {sub.planType === "monthly" ? "Custom / Monthly" : "Same Every Week"}
                      </span>
                    </div>

                    <div className="my-order-card-bottom">
                      <span>Per Month</span>
                      <span className="my-order-total">₹{(sub.totalPrice ?? 0).toLocaleString()}</span>
                      <span className="my-order-card-arrow" aria-hidden="true">→</span>
                    </div>
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

export default MySubscriptions;
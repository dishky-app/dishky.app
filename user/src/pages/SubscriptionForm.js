// user panel
import { useState, useEffect, useMemo, useRef } from "react";
import api from "../api";
import { bookingCrud } from "./shared/eventBookingCrud";
import { UserDatePicker, todayStr } from "../components/UserDatePicker";
import "./PreBooking.css";
import "./ReservationForm.css";
import "./PreviewModal.css";
import "./SubscriptionForm.css";
import "./shared/buttons.css";
import Button3D from "./shared/Button3D";
import MatField from "./shared/MatField";
import CloseButton from "./shared/CloseButton";
import PageHeader from "./shared/PageHeader";
import ModalTransition from "./shared/ModalTransition";
import "./shared/ModalTransition.css";
import { createPortal } from "react-dom";
import { useIsBelowWidth } from "./shared/useIsBelowWidth";
import PageLoader from "../components/PageLoader";

// Meal slots — kept in sync with the dish "Slot" field (Dishes.js, admin
// panel) and the admin Subscriptions builder's SLOT_OPTIONS.
import { handleImgFallback } from "../App";
import { toTitleCase } from "../utils/nameCase";
const SLOT_OPTIONS = [
  { value: "breakfast", label: "Breakfast", time: "7 – 10 AM" },
  { value: "brunch", label: "Brunch", time: "10 AM – 12 PM" },
  { value: "lunch", label: "Lunch", time: "12 – 3 PM" },
  { value: "hi-tea", label: "Hi-Tea", time: "3 – 6 PM" },
  { value: "dinner", label: "Dinner", time: "6:30 – 10 PM" },
];

const WEEKS = ["week1", "week2", "week3", "week4"];
const WEEK_LABELS = { week1: "Week 1", week2: "Week 2", week3: "Week 3", week4: "Week 4" };
const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];
const ALL_DAY_KEYS = DAYS.map(d => d.key);
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri"];

const emptyDayMap = () => DAYS.reduce((acc, d) => ({ ...acc, [d.key]: [] }), {});
const emptyWeekMap = () => WEEKS.reduce((acc, w) => ({ ...acc, [w]: emptyDayMap() }), {});
const emptySlotsMap = () => SLOT_OPTIONS.reduce((acc, s) => ({ ...acc, [s.value]: emptyWeekMap() }), {});

// Every (slot, week, day, dish) cell with a dish in it, flattened — the
// single source both the running total and the "what's scheduled" list
// read from, so they can never disagree.
function flattenScheduledCells(slots, planType) {
  const rows = [];
  SLOT_OPTIONS.forEach(({ value: slot, label: slotLabel }) => {
    const weeksToShow = planType === "monthly" ? WEEKS : ["week1"];
    weeksToShow.forEach(week => {
      DAYS.forEach(({ key, label: dayLabel }) => {
        const cell = slots?.[slot]?.[week]?.[key];
        const dishIds = Array.isArray(cell) ? cell : (cell ? [cell] : []);
        dishIds.forEach(dishId => {
          if (dishId) rows.push({ slot, slotLabel, week, dayKey: key, dayLabel, dishId });
        });
      });
    });
  });
  return rows;
}

/* ══════════════════════════════════
   Dish Picker Popup — same shape as PreBooking's AddDishPopup, but
   scoped to dishes tagged for the meal slot currently being built and
   showing only one "Add" action (a subscription cell can hold more
   than one dish, but they're added one at a time from here — the tap
   flow itself is what makes multi-dish easy to follow).
══════════════════════════════════ */
const DishPickerPopup = ({ slotValue, slotLabel, onClose, onPick }) => {
  const [menuData, setMenuData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/public/categories")
      .then(res => { setMenuData(res.data); setLoading(false); })
      .catch(() => { setMenuData([]); setLoading(false); });
  }, []);

  const { categories, dishes } = useMemo(() => {
    if (!menuData) return { categories: [], dishes: [] };
    const rawCats = Array.isArray(menuData) ? menuData : (menuData.categories || []);
    const cats = [];
    const list = [];

    const pushDish = (d, catId, catName) => {
      if (!(d.slots || []).includes(slotValue)) return; // only this meal slot
      list.push({
        ...d,
        price: d.basePrice || d.price || 0,
        categoryId: catId,
        categoryName: catName,
      });
    };

    rawCats.forEach(topCat => {
      const subs = topCat.subCategories || [];
      if (subs.length > 0) {
        subs.forEach(sub => {
          const before = list.length;
          (sub.dishes || []).forEach(d => pushDish(d, sub.id, sub.name));
          if (list.length > before) cats.push({ id: sub.id, name: sub.name });
        });
      } else {
        const before = list.length;
        (topCat.dishes || []).forEach(d => pushDish(d, topCat.id, topCat.name));
        if (list.length > before) cats.push({ id: topCat.id, name: topCat.name });
      }
    });

    return { categories: cats, dishes: list };
  }, [menuData, slotValue]);

  const filteredDishes = useMemo(() => {
    let d = activeCat ? dishes.filter(x => x.categoryId === activeCat) : dishes;
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(x => (x.name || "").toLowerCase().includes(q));
    }
    return d;
  }, [dishes, activeCat, search]);

  return (
    <div className="dish-popup-overlay" onClick={onClose}>
      <div className="dish-popup" onClick={e => e.stopPropagation()}>
        <div className="dish-popup-header">
          <h3 className="dish-popup-title">Pick a {slotLabel} Dish</h3>
          <CloseButton onClick={onClose} />
        </div>

        <div className="dish-popup-body">
          <div className="dish-popup-search-wrap">
            <div className="field-group">
              <MatField
                label="Search dishes"
                value={search}
                onChange={e => setSearch(e.target.value)}
                wrapperClassName=""
              />
            </div>
          </div>

          {!loading && categories.length > 0 && (
            <div className="dish-popup-cats">
              <Button3D className={`sort-btn${!activeCat ? " active" : ""}`} onClick={() => setActiveCat(null)}>
                All
              </Button3D>
              {categories.map(c => (
                <Button3D key={c.id}
                  className={`sort-btn${activeCat === c.id ? " active" : ""}`}
                  onClick={() => setActiveCat(activeCat === c.id ? null : c.id)}>
                  {c.name}
                </Button3D>
              ))}
            </div>
          )}

          <div className="dish-popup-dish-body">
            {loading ? (
              <PageLoader inline label="Loading dishes" />
            ) : filteredDishes.length === 0 ? (
              <div className="dish-popup-empty">
                {dishes.length === 0
                  ? `No dishes are set up for ${slotLabel} yet.`
                  : "No dishes found."}
              </div>
            ) : (
              <div className="dish-grid">
                {filteredDishes.map(dish => (
                  <div key={dish.id} className="dish-card">
                    {dish.image ? (
                      <img src={dish.image} alt={dish.name} className="dish-card-img" onError={handleImgFallback} />
                    ) : (
                      <div className="dish-card-img dish-placeholder">🍽️</div>
                    )}
                    <div className="dish-card-body">
                      <div className="dish-card-name">{dish.name}</div>
                      <div className="dish-card-cat">{dish.categoryName}</div>
                      <div className="dish-card-price">₹{Math.round(dish.price)}</div>
                    </div>
                    <button
                      className="dish-card-btn"
                      onClick={() => onPick(dish)}
                      title="Pick this dish"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════
   Main Component
══════════════════════════════════ */
const SubscriptionForm = ({ handleBack, handleHome }) => {
  const isFixedBtnRow = useIsBelowWidth(600);

  const [contact, setContact] = useState({
    name: "", mobile: "",
    addrDoorNo: "", addrStreet: "", addrArea: "", addrLandmark: "",
    addrCity: "", addrDistrict: "", addrState: "", addrPincode: "",
  });
  const [planType, setPlanType] = useState("weekly"); // "weekly" | "monthly"
  const [startDate, setStartDate] = useState("");
  const [slots, setSlots] = useState(emptySlotsMap());
  const [dishById, setDishById] = useState({});

  const [activeSlot, setActiveSlot] = useState(SLOT_OPTIONS[0].value);
  const [activeWeek, setActiveWeek] = useState("week1");
  const [pickerDishForDays, setPickerDishForDays] = useState(null); // dish currently being assigned to days
  const [showDishPopup, setShowDishPopup] = useState(false);

  const [errors, setErrors] = useState({});
  const [flashField, setFlashField] = useState("");
  const fieldRefs = {
    name: useRef(null), mobile: useRef(null),
    addrDoorNo: useRef(null), addrStreet: useRef(null), addrArea: useRef(null),
    addrCity: useRef(null), addrDistrict: useRef(null), addrState: useRef(null), addrPincode: useRef(null),
    startDate: useRef(null), slots: useRef(null),
  };

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [subscriptionRef, setSubscriptionRef] = useState("");
  const [showBuilderSummary, setShowBuilderSummary] = useState(false);

  // Review-before-submit modal — same pattern as Catering/Celebration/
  // PreBooking/Reservation's own preview/cross-check modal, sharing
  // PreviewModal.css's .rf-modal-* classes.
  const [showPreview, setShowPreview] = useState(false);

  /* Pre-fill from logged-in user — merge into existing state rather
     than replacing it outright, since replacing it wiped out the
     address fields (setting them to undefined) as soon as this
     resolved, which crashed validate()'s .trim() calls on Confirm. */
  useEffect(() => {
    bookingCrud.resolveUser().then(({ name, mobile }) => {
      setContact(p => ({ ...p, name, mobile }));
    }).catch(console.error);
  }, []);

  const setF = (key, val) => {
    setContact(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: "" }));
  };

  // Joins the address fields into one display/storage string — same
  // shape as the catering form's buildAddress, so a subscription's
  // address reads the same way everywhere it's shown later.
  const buildAddress = (c) => [
    c.addrDoorNo, c.addrStreet, c.addrArea, c.addrLandmark,
    c.addrCity, c.addrDistrict, c.addrState, c.addrPincode,
  ].filter(Boolean).join(", ");

  // Toggles a dish in/out of one slot/week/day cell. In "weekly" plans,
  // editing week1 mirrors the change into weeks 2-4 automatically —
  // same rule the admin builder uses, since the point of that mode is
  // one recurring weekly pattern.
  const toggleCellDish = (slot, week, dayKey, dishId) => {
    setSlots(prev => {
      const next = { ...prev };
      const weeksToUpdate = planType === "weekly" ? WEEKS : [week];
      const nextSlotWeeks = { ...next[slot] };
      weeksToUpdate.forEach(w => {
        const existing = nextSlotWeeks[w]?.[dayKey];
        const currentIds = Array.isArray(existing) ? existing : (existing ? [existing] : []);
        const nextIds = currentIds.includes(dishId)
          ? currentIds.filter(id => id !== dishId)
          : [...currentIds, dishId];
        nextSlotWeeks[w] = { ...nextSlotWeeks[w], [dayKey]: nextIds };
      });
      next[slot] = nextSlotWeeks;
      return next;
    });
    setErrors(p => ({ ...p, slots: false }));
  };

  // Clears a dish from ALL 7 days, then (optionally) sets it present on
  // just `dayKeys` — one atomic state update. Backs the "All Days" /
  // "Weekdays" quick-select chips: the two are mutually exclusive (only
  // one can read as active at a time), and unchecking either clears the
  // dish from every day rather than leaving a partial selection behind.
  const setDishExclusivelyOnDays = (slot, week, dayKeys, dishId) => {
    setSlots(prev => {
      const next = { ...prev };
      const weeksToUpdate = planType === "weekly" ? WEEKS : [week];
      const nextSlotWeeks = { ...next[slot] };
      weeksToUpdate.forEach(w => {
        const nextWeek = { ...nextSlotWeeks[w] };
        ALL_DAY_KEYS.forEach(dayKey => {
          const existing = nextWeek[dayKey];
          const currentIds = Array.isArray(existing) ? existing : (existing ? [existing] : []);
          const shouldBePresent = dayKeys.includes(dayKey);
          const alreadyIn = currentIds.includes(dishId);
          if (shouldBePresent && !alreadyIn) {
            nextWeek[dayKey] = [...currentIds, dishId];
          } else if (!shouldBePresent && alreadyIn) {
            nextWeek[dayKey] = currentIds.filter(id => id !== dishId);
          } else {
            nextWeek[dayKey] = currentIds;
          }
        });
        nextSlotWeeks[w] = nextWeek;
      });
      next[slot] = nextSlotWeeks;
      return next;
    });
    setErrors(p => ({ ...p, slots: false }));
  };

  const weekForCell = planType === "monthly" ? activeWeek : "week1";

  const scheduledRows = useMemo(
    () => flattenScheduledCells(slots, planType),
    [slots, planType]
  );

  const totalPrice = useMemo(() => {
    const sum = scheduledRows.reduce((acc, row) => {
      const dish = dishById[row.dishId];
      return acc + (dish ? Number(dish.basePrice || dish.price) || 0 : 0);
    }, 0);
    return Math.round(sum);
  }, [scheduledRows, dishById]);

  const filledCellCount = scheduledRows.length;

  // Everything scheduled for the slot/week currently being edited, one
  // row per dish with the days it's on — same "already scheduled" list
  // the admin builder shows, so a customer always sees what they've
  // set so far without having to scan a grid.
  const scheduledForActiveSlot = useMemo(() => {
    const byDish = new Map();
    DAYS.forEach(({ key, label }) => {
      const cell = slots?.[activeSlot]?.[weekForCell]?.[key];
      const dayIds = Array.isArray(cell) ? cell : (cell ? [cell] : []);
      dayIds.forEach(id => {
        if (!byDish.has(id)) byDish.set(id, []);
        byDish.get(id).push(label);
      });
    });
    return Array.from(byDish.entries());
  }, [slots, activeSlot, weekForCell]);

  const dishLabel = (dishId) => dishById[dishId]?.name || "—";

  const handleDishPicked = (dish) => {
    setDishById(prev => ({ ...prev, [dish.id]: dish }));
    setShowDishPopup(false);
    setPickerDishForDays(dish); // straight into "which days?" for the picked dish
  };

  const removeDishFromSlot = (dishId) => {
    DAYS.forEach(({ key }) => {
      const cell = slots?.[activeSlot]?.[weekForCell]?.[key];
      const dayIds = Array.isArray(cell) ? cell : (cell ? [cell] : []);
      if (dayIds.includes(dishId)) toggleCellDish(activeSlot, weekForCell, key, dishId);
    });
    if (pickerDishForDays?.id === dishId) setPickerDishForDays(null);
  };

  const switchActiveSlot = (slot) => {
    setActiveSlot(slot);
    setPickerDishForDays(null);
  };

  const validate = () => {
    const err = {};
    if (!contact.name.trim() || contact.name.trim().length < 2) err.name = true;
    const mob = contact.mobile.replace(/\D/g, "");
    if (!mob || mob.length !== 10) err.mobile = true;
    /* Address — all mandatory except landmark */
    if (!contact.addrDoorNo.trim()) err.addrDoorNo = true;
    if (!contact.addrStreet.trim()) err.addrStreet = true;
    if (!contact.addrArea.trim()) err.addrArea = true;
    if (!contact.addrCity.trim()) err.addrCity = true;
    if (!contact.addrDistrict.trim()) err.addrDistrict = true;
    if (!contact.addrState.trim()) err.addrState = true;
    if (!contact.addrPincode || contact.addrPincode.length !== 6) err.addrPincode = true;
    if (!startDate) err.startDate = true;
    if (filledCellCount === 0) err.slots = true;
    return err;
  };

  // "Confirm Subscription" now opens the review modal instead of
  // submitting directly — validation still runs first so the modal
  // never opens on an incomplete form. The actual API call moved to
  // handleSubmit below, fired from the modal's own Confirm button.
  const openPreview = () => {
    const ve = validate();
    if (Object.keys(ve).length > 0) {
      setErrors(ve);
      const order = [
        "name", "mobile",
        "addrDoorNo", "addrStreet", "addrArea", "addrCity", "addrDistrict", "addrState", "addrPincode",
        "startDate", "slots",
      ];
      const firstErrorKey = order.find(k => ve[k]);
      if (firstErrorKey) {
        const node = fieldRefs[firstErrorKey]?.current;
        if (node) {
          node.scrollIntoView({ behavior: "smooth", block: "center" });
          setFlashField(firstErrorKey);
          setTimeout(() => setFlashField(""), 1100);
        }
      }
      return;
    }
    setShowPreview(true);
  };

  const closePreview = () => setShowPreview(false);

  /* ── Preview Modal — animation handled entirely by ModalTransition
     (shared/ModalTransition.js). ── */
  const PreviewModal = () => {
    const address = buildAddress(contact);
    const rows = [
      ["Name", contact.name],
      ["Mobile", "+91 " + contact.mobile],
      ["Plan", planType === "weekly" ? "Same Every Week" : "Custom Per Week"],
      ["Start Date", startDate || "—"],
      ["Dishes Scheduled", filledCellCount],
    ];
    return (
      <ModalTransition open={showPreview} onClose={closePreview} overlayClassName="rf-modal-overlay" panelClassName="rf-modal">
        <div className="rf-modal-title">Confirm Your Subscription</div>
        <div className="rf-modal-subtitle">Please review your details before submitting.</div>
        <div className="rf-modal-grid">
          {rows.map(([k, v]) => (
            <div key={k} className="rf-modal-row">
              <span className="rf-modal-key">{k}</span>
              <span className="rf-modal-val">{v}</span>
            </div>
          ))}
          {address && (
            <div className="rf-modal-row-full">
              <span className="rf-modal-key">Address</span>
              <span className="rf-modal-val">{address}</span>
            </div>
          )}
        </div>
        {totalPrice > 0 && (
          <div className="rf-modal-total-row">
            <span className="rf-modal-total-label">Estimated Total</span>
            <span className="rf-modal-total-val">₹{totalPrice.toLocaleString()}</span>
          </div>
        )}
        <div className="rf-modal-actions">
          <Button3D className="btn-3d white" onClick={closePreview}>
            Edit
          </Button3D>
          <Button3D className="btn-3d red" onClick={handleSubmit} disabled={loading}>
            {loading ? <span className="rf-spinner" /> : "Confirm"}
          </Button3D>
        </div>
      </ModalTransition>
    );
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const address = buildAddress(contact);
      const saved = await bookingCrud.create("subscriptions", {
        customerName: contact.name,
        customerPhone: contact.mobile,
        addrDoorNo: contact.addrDoorNo,
        addrStreet: contact.addrStreet,
        addrArea: contact.addrArea,
        addrLandmark: contact.addrLandmark,
        addrCity: contact.addrCity,
        addrDistrict: contact.addrDistrict,
        addrState: contact.addrState,
        addrPincode: contact.addrPincode,
        address,
        planType,
        startDate,
        slots,
        totalPrice,
      });
      setSubscriptionRef(bookingCrud.makeRef(saved.id));
      setSubmitted(true);
    } catch (e) {
      console.error(e);
      setErrors(prev => ({ ...prev, _submit: true }));
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setSubmitted(false);
    setPlanType("weekly");
    setStartDate("");
    setSlots(emptySlotsMap());
    setDishById({});
    setActiveSlot(SLOT_OPTIONS[0].value);
    setActiveWeek("week1");
    setPickerDishForDays(null);
    setErrors({});
    setShowBuilderSummary(false);
    setShowPreview(false);
  };

  /* ── Success Screen ── */
  if (submitted) {
    const scheduledRowsForSuccess = flattenScheduledCells(slots, planType);
    return (
      <div className="no-padding">
        <PageHeader title="Subscription" onBack={handleBack} onHome={handleHome} />
        <div className="pl-body">
          <div className="rf-success-screen">
            <div className="rf-success-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="32" fill="#d1fae5" />
                <path d="M20 32 L28 40 L44 24" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="rf-success-title">Subscription Confirmed!</h2>
            <p className="rf-success-sub">Your meal plan is set. We'll take it from here.</p>
            <div className="rf-booking-id">
              <span className="rf-booking-label">Subscription ID</span>
              <span className="rf-booking-code">#{subscriptionRef}</span>
            </div>
            <div className="rf-success-card">
              {[
                ["Name", contact.name],
                ["Plan", planType === "monthly" ? "Custom / Monthly" : "Weekly Repeat"],
                ["Start Date", startDate],
                ["Meals Scheduled", filledCellCount],
                ["Total (per month)", `₹${totalPrice.toLocaleString()}`],
              ].map(([k, v]) => (
                <div key={k} className="rf-sc-row">
                  <span className="rf-sc-label">{k}</span>
                  <span className="rf-sc-val">{v}</span>
                </div>
              ))}
            </div>

            {scheduledRowsForSuccess.length > 0 && (
              <div className="sub-summary-table-wrap">
                <table className="sub-summary-table">
                  <thead>
                    <tr>
                      <th>Slot</th>
                      <th>Dish</th>
                      <th>Day</th>
                      {planType === "monthly" && <th>Week</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {scheduledRowsForSuccess.map((row, i) => (
                      <tr key={`${row.slot}-${row.week}-${row.dayKey}-${row.dishId}-${i}`}>
                        <td>{row.slotLabel}</td>
                        <td>{dishLabel(row.dishId)}</td>
                        <td>{row.dayLabel}</td>
                        {planType === "monthly" && <td>{WEEK_LABELS[row.week]}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Button3D className="btn-3d red" onClick={resetAll}>
              Start Another Plan
            </Button3D>
            <Button3D className="btn-3d red" onClick={handleHome}>
              Back to Home
            </Button3D>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main Form ── */
  return (
    <div className="no-padding">
      <PreviewModal />

      <PageHeader title="Meal Subscription" onBack={handleBack} onHome={handleHome} />

      <div className="pl-body">
        <div className="pbp-form-shell">
          <div className="pbp-form-grid">

            {/* ════ LEFT COLUMN — contact + plan + schedule ════ */}
            <div className="pbp-col">

              <div className="section-title">Your Details</div>
              <div className="pbp-card">
                <div className={`field-group${flashField === "name" ? " rf-error-flash" : ""}`} ref={fieldRefs.name}>
                  <MatField
                    label={<>Name <span className="pbp-req">*</span></>}
                    value={contact.name}
                    onChange={e => setF("name", toTitleCase(e.target.value))}
                    error={errors.name}
                    wrapperClassName=""
                  />
                </div>
                <div className={`field-group${flashField === "mobile" ? " rf-error-flash" : ""}`} ref={fieldRefs.mobile}>
                  <div className="mat-input-prefix-wrap">
                    <span className={`mat-prefix${errors.mobile ? " error" : ""}`}>+91</span>
                    <MatField
                      label={<>Mobile <span className="pbp-req">*</span></>}
                      type="tel"
                      value={contact.mobile}
                      onChange={e => setF("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
                      error={errors.mobile}
                      wrapperClassName=""
                    />
                  </div>
                </div>
              </div>

              <div className="section-title">Delivery Address <span className="pbp-req">*</span></div>
              <div className="pbp-card">
                <div className="sub-addr-grid">
                  {[
                    { key: "addrDoorNo", label: "Door No. / Building", placeholder: "Door / Flat No." },
                    { key: "addrStreet", label: "Street Name", placeholder: "Street / Road" },
                    { key: "addrArea", label: "Area / Locality", placeholder: "Area / Colony" },
                    { key: "addrLandmark", label: "Landmark", placeholder: "Near / Opposite…", optional: true },
                    { key: "addrCity", label: "City", placeholder: "City" },
                    { key: "addrDistrict", label: "District", placeholder: "District" },
                    { key: "addrState", label: "State", placeholder: "State" },
                    { key: "addrPincode", label: "Pincode", placeholder: "6-digit pincode" },
                  ].map(field => (
                    <div key={field.key} className={`field-group${flashField === field.key ? " rf-error-flash" : ""}`} ref={fieldRefs[field.key]}>
                      <MatField
                        label={<>
                          {field.label}
                          {!field.optional
                            ? <span className="pbp-req"> *</span>
                            : <span className="pbp-opt"> (optional)</span>}
                        </>}
                        value={contact[field.key]}
                        maxLength={field.key === "addrPincode" ? 6 : undefined}
                        onChange={e => {
                          const v = field.key === "addrPincode"
                            ? e.target.value.replace(/\D/g, "").slice(0, 6)
                            : e.target.value;
                          setF(field.key, v);
                        }}
                        error={errors[field.key]}
                        wrapperClassName=""
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="section-title">Plan Type</div>
              <div className="pbp-card">
                <div className="slot-groups sub-plan-groups">
                  <div
                    className={`slot-group${planType === "weekly" ? " active" : ""}`}
                    onClick={() => setPlanType("weekly")}
                  >
                    <span className="slot-group-label">Same Every Week</span>
                    <span className="slot-group-time">Set Week 1 once — it repeats</span>
                  </div>
                  <div
                    className={`slot-group${planType === "monthly" ? " active" : ""}`}
                    onClick={() => setPlanType("monthly")}
                  >
                    <span className="slot-group-label">Custom Per Week</span>
                    <span className="slot-group-time">Different dishes each week</span>
                  </div>
                </div>
              </div>

              <div className="section-title">Start Date</div>
              <div className="pbp-card">
                <div className={`field-group${flashField === "startDate" ? " rf-error-flash" : ""}`} ref={fieldRefs.startDate}>
                  <UserDatePicker
                    value={startDate}
                    min={todayStr()}
                    hasError={!!errors.startDate}
                    onChange={v => { setStartDate(v); setErrors(p => ({ ...p, startDate: false })); }}
                  />
                </div>
              </div>

            </div>{/* end left col */}

            {/* ════ RIGHT COLUMN — meal builder ════ */}
            <div className="pbp-col">

              <div className="section-title">Meal Slot</div>
              <div className="pbp-card">
                <div className="slot-groups">
                  {SLOT_OPTIONS.map(opt => {
                    const count = flattenScheduledCells(slots, planType).filter(r => r.slot === opt.value).length;
                    return (
                      <div
                        key={opt.value}
                        className={`slot-group${activeSlot === opt.value ? " active" : ""}`}
                        onClick={() => switchActiveSlot(opt.value)}
                      >
                        <span className="slot-group-label">
                          {opt.label}
                          {count > 0 && <span className="sub-slot-count">{count}</span>}
                        </span>
                        <span className="slot-group-time">{opt.time}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {planType === "monthly" && (
                <>
                  <div className="section-title">Week</div>
                  <div className="pbp-card">
                    <div className="slot-groups">
                      {WEEKS.map(w => (
                        <div
                          key={w}
                          className={`slot-group${activeWeek === w ? " active" : ""}`}
                          onClick={() => { setActiveWeek(w); setPickerDishForDays(null); }}
                        >
                          <span className="slot-group-label">{WEEK_LABELS[w]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div
                className="section-title"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <span>
                  {SLOT_OPTIONS.find(o => o.value === activeSlot)?.label}
                  {planType === "monthly" ? ` — ${WEEK_LABELS[activeWeek]}` : " — repeats weekly"}
                </span>
                <Button3D type="button" className="chip" onClick={() => setShowDishPopup(true)}>
                  + Add Dish
                </Button3D>
              </div>

              <div
                className={`pbp-card${errors.slots ? " pbp-card-error" : ""}${flashField === "slots" ? " rf-error-flash" : ""}`}
                ref={fieldRefs.slots}
              >
                {/* STEP 2 — checkboxes for whichever dish was just picked */}
                {pickerDishForDays && (
                  <div className="sub-days-picker">
                    <span className="sub-days-picker-label">
                      Serve <strong>{pickerDishForDays.name}</strong> on:
                    </span>
                    <div className="sub-day-quick-row">
                      {[
                        { keys: ALL_DAY_KEYS, label: "All Days" },
                        { keys: WEEKDAY_KEYS, label: "Weekdays" },
                      ].map(({ keys, label }) => {
                        const checkedDayKeys = ALL_DAY_KEYS.filter(key => {
                          const cell = slots?.[activeSlot]?.[weekForCell]?.[key];
                          const dayIds = Array.isArray(cell) ? cell : (cell ? [cell] : []);
                          return dayIds.includes(pickerDishForDays.id);
                        });
                        // Active only when the checked days are EXACTLY this
                        // chip's set — not just a superset of it — so "All
                        // Days" and "Weekdays" can never both read as active
                        // at once (e.g. all 7 days checked satisfies "every
                        // weekday is checked" too, but isn't the Weekdays
                        // chip's own exact selection).
                        const isActive =
                          checkedDayKeys.length === keys.length &&
                          keys.every(key => checkedDayKeys.includes(key));
                        return (
                          <button
                            key={label}
                            type="button"
                            className={`sub-day-quick-chip${isActive ? " is-active" : ""}`}
                            onClick={() =>
                              setDishExclusivelyOnDays(
                                activeSlot,
                                weekForCell,
                                isActive ? [] : keys,
                                pickerDishForDays.id
                              )
                            }
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="sub-day-chip-row">
                      {DAYS.map(({ key, label }) => {
                        const cell = slots?.[activeSlot]?.[weekForCell]?.[key];
                        const dayIds = Array.isArray(cell) ? cell : (cell ? [cell] : []);
                        const checked = dayIds.includes(pickerDishForDays.id);
                        return (
                          <label
                            key={key}
                            className={`sub-day-checkbox${checked ? " is-checked" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCellDish(activeSlot, weekForCell, key, pickerDishForDays.id)}
                            />
                            <span className="sub-day-checkbox-box" aria-hidden="true" />
                            <span className="sub-day-checkbox-label">{label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      className="sub-days-picker-done"
                      onClick={() => setPickerDishForDays(null)}
                    >
                      Done
                    </button>
                  </div>
                )}

                {scheduledForActiveSlot.length === 0 && !pickerDishForDays ? (
                  <div className="pbp-empty">
                    <p>Nothing scheduled yet</p>
                    <span>Tap "Add Dish" to build this slot</span>
                  </div>
                ) : (
                  scheduledForActiveSlot.length > 0 && (
                    <div className="sub-scheduled-list">
                      {scheduledForActiveSlot.map(([dishId, dayLabels]) => (
                        <div className="sub-scheduled-row" key={dishId}>
                          <div className="sub-scheduled-row-main">
                            <span className="sub-scheduled-name">{dishLabel(dishId)}</span>
                            <span className="sub-scheduled-days">{dayLabels.join(", ")}</span>
                          </div>
                          <div className="sub-scheduled-row-actions">
                            <button
                              type="button"
                              className="sub-scheduled-edit"
                              onClick={() => setPickerDishForDays(dishById[dishId] || { id: dishId, name: dishLabel(dishId) })}
                            >
                              Edit days
                            </button>
                            <button
                              type="button"
                              className="pbp-item-delete"
                              onClick={() => removeDishFromSlot(dishId)}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              {filledCellCount > 0 && (
                <div className="pbp-bill">
                  <div className="pbp-bill-row"><span>Total Meals Scheduled</span><span>{filledCellCount}</span></div>
                  <div className="pbp-bill-row pbp-bill-total">
                    <span>Total (per month)</span><strong>₹{totalPrice.toLocaleString()}</strong>
                  </div>
                </div>
              )}

              {/* Running summary of every dish scheduled anywhere in the
                  plan so far — slot / dish / day (+ week) — same shape as
                  the success screen's table, but live while building. */}
              {scheduledRows.length > 0 && (
                <div className="sub-builder-summary">
                  <button
                    type="button"
                    className="sub-full-table-toggle"
                    onClick={() => setShowBuilderSummary(v => !v)}
                    aria-expanded={showBuilderSummary}
                  >
                    <span>Your Plan So Far ({scheduledRows.length} {scheduledRows.length === 1 ? "dish" : "dishes"})</span>
                    <span className={`sub-full-table-chevron${showBuilderSummary ? " is-open" : ""}`} aria-hidden="true">▾</span>
                  </button>

                  {showBuilderSummary && (
                    <div className="sub-summary-table-wrap">
                      <table className="sub-summary-table">
                        <thead>
                          <tr>
                            <th>Slot</th>
                            <th>Dish</th>
                            <th>Day</th>
                            {planType === "monthly" && <th>Week</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {scheduledRows.map((row, i) => (
                            <tr key={`${row.slot}-${row.week}-${row.dayKey}-${row.dishId}-${i}`}>
                              <td>{row.slotLabel}</td>
                              <td>{dishLabel(row.dishId)}</td>
                              <td>{row.dayLabel}</td>
                              {planType === "monthly" && <td>{WEEK_LABELS[row.week]}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {errors._submit && (
                <div className="pbp-submit-error">Something went wrong. Please try again.</div>
              )}

              {(() => {
                const btnRow = (
                  <div className="form-btn-row">
                    <Button3D
                      className="btn-3d white"
                      type="button"
                      disabled={loading}
                      onClick={handleBack}
                    >
                      Cancel
                    </Button3D>

                    <Button3D
                      className={`btn-3d red${loading ? " loading" : ""}`}
                      type="button"
                      onClick={openPreview}
                      disabled={loading}
                    >
                      {loading ? "Processing..." : "Review & Confirm"}
                    </Button3D>
                  </div>
                );
                return isFixedBtnRow ? createPortal(btnRow, document.body) : btnRow;
              })()}

            </div>{/* end right col */}

          </div>{/* end grid */}
        </div>

        {showDishPopup && (
          <DishPickerPopup
            slotValue={activeSlot}
            slotLabel={SLOT_OPTIONS.find(o => o.value === activeSlot)?.label}
            onClose={() => setShowDishPopup(false)}
            onPick={handleDishPicked}
          />
        )}

      </div>
    </div>
  );
};

export default SubscriptionForm;
// user panel
import { useState, useEffect, useMemo, useRef } from "react";
import api from "../api";
import { bookingCrud } from "./shared/eventBookingCrud";
import { UserDatePicker, todayStr } from "../components/UserDatePicker";
import { UserTimePicker } from "../components/UserTimePicker";
import "./PreBooking.css";
import "./ReservationForm.css";
import "./PreviewModal.css";
import Button3D from "./shared/Button3D";
import MatField from "./shared/MatField";
import CloseButton from "./shared/CloseButton";
import PageHeader from "./shared/PageHeader";
import ModalTransition from "./shared/ModalTransition";
import "./shared/ModalTransition.css";
import { createPortal } from "react-dom";
import { useIsBelowWidth } from "./shared/useIsBelowWidth";
import PageLoader from "../components/PageLoader";
import { handleImgFallback } from "../App";
import { toTitleCase } from "../utils/nameCase";

const pad = (n) => String(n).padStart(2, "0");
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; };

const SLOT_GROUPS = [
  { label: "Breakfast", key: "BF", start: "07:00", end: "10:00" },
  { label: "Brunch", key: "BR", start: "10:00", end: "12:00" },
  { label: "Lunch", key: "LU", start: "12:00", end: "15:00" },
  { label: "Hi-Tea", key: "HT", start: "15:00", end: "18:00" },
  { label: "Dinner", key: "DI", start: "18:30", end: "22:00" },
];

/* ══════════════════════════════════
   Add Dish Popup — ALL dishes (no isEventFood filter)
══════════════════════════════════ */
const AddDishPopup = ({ onClose, onAdd, existingIds, guests }) => {
  const [menuData, setMenuData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState(null);
  const [vegFilter, setVegFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/categories")
      .then(res => { setMenuData(res.data); setLoading(false); })
      .catch(() => { setMenuData([]); setLoading(false); });
  }, []);

  /* All dishes — no isEventFood filter for prebooking */
  const { categories, allDishes } = useMemo(() => {
    if (!menuData) return { categories: [], allDishes: [] };
    const rawCats = Array.isArray(menuData) ? menuData : (menuData.categories || []);
    const cats = [];
    const dishes = [];

    rawCats.forEach(topCat => {
      const subs = topCat.subCategories || [];
      if (subs.length > 0) {
        subs.forEach(sub => {
          if ((sub.dishes || []).length > 0) {
            cats.push({ id: sub.id, name: sub.name });
            (sub.dishes || []).forEach(d => dishes.push({
              ...d,
              price: d.basePrice || d.price || 0,
              categoryId: sub.id,
              categoryName: sub.name,
            }));
          }
        });
      } else if ((topCat.dishes || []).length > 0) {
        cats.push({ id: topCat.id, name: topCat.name });
        (topCat.dishes || []).forEach(d => dishes.push({
          ...d,
          price: d.basePrice || d.price || 0,
          categoryId: topCat.id,
          categoryName: topCat.name,
        }));
      }
    });

    return { categories: cats, allDishes: dishes };
  }, [menuData]);

  const guestCount = Math.max(1, parseInt(guests, 10) || 1);

  const filteredDishes = useMemo(() => {
    let d = activeCat ? allDishes.filter(x => x.categoryId === activeCat) : allDishes;
    if (vegFilter === "veg") d = d.filter(x => x.isVeg !== false);
    if (vegFilter === "nonveg") d = d.filter(x => x.isVeg === false);
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(x => (x.name || "").toLowerCase().includes(q));
    }
    return d;
  }, [allDishes, activeCat, vegFilter, search]);

  return (
    <div className="dish-popup-overlay" onClick={onClose}>
      <div className="dish-popup" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="dish-popup-header">
          <h3 className="dish-popup-title">Add Dish</h3>
          <CloseButton onClick={onClose}>

          </CloseButton>
        </div>

        <div className="dish-popup-body">
          {/* Search */}
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

          {/* Category tabs */}
          {!loading && (
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

          {/* Veg filter */}
          <div className="dish-popup-veg-row">
            {["all", "veg", "nonveg"].map(v => (
              <Button3D key={v}
                className={`sort-btn${vegFilter === v ? " active-" + v : ""}`}
                onClick={() => setVegFilter(v)}>
                {v === "all" ? "All" : v === "veg" ? "🟢 Veg" : "🔴 Non-Veg"}
              </Button3D>
            ))}
          </div>

          {/* Dish grid */}
          <div className="dish-popup-dish-body">
            {loading ? (
              <PageLoader inline label="Loading dishes" />
            ) : filteredDishes.length === 0 ? (
              <div className="dish-popup-empty">No dishes found.</div>
            ) : (
              <div className="dish-grid">
                {filteredDishes.map(dish => {
                  const already = existingIds.has(dish.id);
                  const total = dish.price * guestCount;
                  return (
                    <div key={dish.id} className={`dish-card${already ? " added" : ""}`}>
                      {dish.image ? (
                        <img src={dish.image} alt={dish.name} className="dish-card-img" onError={handleImgFallback} />
                      ) : (
                        <div className="dish-card-img dish-placeholder">🍽️</div>
                      )}
                      <div className="dish-card-body">
                        <div className="dish-card-name">{dish.name}</div>
                        <div className="dish-card-cat">{dish.categoryName}</div>
                        <div className="dish-card-price">
                          ₹{dish.price}/person
                          <span className="dish-card-total"> = ₹{total.toLocaleString()}</span>
                        </div>
                      </div>
                      <button
                        className={`dish-card-btn${already ? " remove" : ""}`}
                        onClick={() => onAdd(dish, already)}
                        title={already ? "Remove" : "Add"}>
                        {already ? "✕" : "+"}
                      </button>
                    </div>
                  );
                })}
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
const PreBooking = ({ handleBack, handleHome }) => {
  const isFixedBtnRow = useIsBelowWidth(600);
  const [form, setForm] = useState({
    name: "", mobile: "", email: "", guests: 1,
    date: tomorrowStr(), time: "", slotGroup: "", notes: ""
  });
  const [errors, setErrors] = useState({});
  const [flashField, setFlashField] = useState(""); // briefly highlights the field scrolled to on validation failure
  // Date defaults to tomorrow (never empty) so, unlike the other forms,
  // "has a date" can't gate the slot reveal — track whether the person
  // has actually interacted with the date picker instead.
  const [dateConfirmed, setDateConfirmed] = useState(false);

  /* One ref per field the submit validation can flag, in form order,
     so a failed submit can scroll straight to the first invalid one. */
  const fieldRefs = {
    name: useRef(null), mobile: useRef(null), email: useRef(null), guests: useRef(null),
    date: useRef(null), slotGroup: useRef(null), time: useRef(null), bag: useRef(null),
  };
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [selectedDishes, setSelectedDishes] = useState([]);
  const [showDishPopup, setShowDishPopup] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  /* Pre-fill from logged-in user */
  useEffect(() => {
    bookingCrud.resolveUser().then(({ name, mobile, email }) => {
      setForm(p => ({ ...p, name, mobile, email }));
    }).catch(console.error);
  }, []);

  const guestCount = parseInt(form.guests, 10) || 0;
  const isGroupDiscount = guestCount > 8;

  /* Recalculate when guests changes */
  useEffect(() => {
    setSelectedDishes(prev => prev.map(d => ({
      ...d,
      totalPrice: (d.unitPrice || d.price || 0) * Math.max(1, guestCount),
    })));
  }, [guestCount]);

  const subtotal = selectedDishes.reduce((s, d) => s + (d.totalPrice || 0), 0);
  const discount = isGroupDiscount ? Math.round(subtotal * 0.1) : 0;
  const totalAmount = subtotal - discount;

  const setF = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: "" }));
  };

  const handleDishAdd = (dish, remove) => {
    if (remove) {
      setSelectedDishes(prev => prev.filter(d => d.id !== dish.id));
    } else {
      const unitPrice = dish.price || 0;
      setSelectedDishes(prev => [...prev, {
        ...dish,
        unitPrice,
        totalPrice: unitPrice * Math.max(1, guestCount),
      }]);
    }
  };

  const existingIds = useMemo(() => new Set(selectedDishes.map(d => d.id)), [selectedDishes]);

  const validate = () => {
    const err = {};
    if (!form.name.trim() || form.name.trim().length < 2) err.name = true;
    const mob = form.mobile.replace(/\D/g, "");
    if (!mob || mob.length !== 10) err.mobile = true;
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) err.email = true;
    if (!form.guests || guestCount < 1) err.guests = true;
    if (!form.date) err.date = true;
    if (!form.slotGroup) err.slotGroup = true;
    if (!form.time) err.time = true;
    if (!selectedDishes.length) err.bag = true;
    return err;
  };

  const handleSubmit = async () => {
    const ve = validate();
    if (Object.keys(ve).length > 0) {
      setErrors(ve);
      // Scroll to and briefly flash the first invalid field, in form
      // order, so the person lands right on what needs fixing.
      const order = ["name", "mobile", "email", "guests", "date", "slotGroup", "time", "bag"];
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
    try {
      setLoading(true);
      const saved = await bookingCrud.create("preBookings", {
        name: form.name, mobile: form.mobile, email: form.email || "",
        guests: guestCount, date: form.date, time: form.time,
        slotGroup: form.slotGroup || "", notes: form.notes || "",
        items: selectedDishes, subtotal, discount, totalAmount,
      });
      setBookingId(bookingCrud.makeRef(saved.id));
      setSubmitted(true);
    } catch (e) {
      console.error(e);
      setErrors(prev => ({ ...prev, _submit: true }));
    } finally {
      setLoading(false);
    }
  };

  const activeSlot = SLOT_GROUPS.find(s => s.key === form.slotGroup);
  const fmtTime = (t) => { if (!t) return ""; const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`; };

  const handleReview = () => {
    const ve = validate();
    if (Object.keys(ve).length > 0) {
      setErrors(ve);
      // Same scroll-to-first-error behavior as handleSubmit, so a
      // failed "Review & Confirm" doesn't fail silently — previously
      // this just set the error state with no visible feedback if the
      // person hadn't scrolled to see the highlighted field.
      const order = ["name", "mobile", "email", "guests", "date", "slotGroup", "time", "bag"];
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

  /* ── Preview Modal — animation handled entirely by ModalTransition
     (shared/ModalTransition.js). ── */
  const PreviewModal = () => {
    const slot = SLOT_GROUPS.find(s => s.key === form.slotGroup);
    const rows = [
      ["Name", form.name],
      ["Mobile", "+91 " + form.mobile],
      ["Email", form.email || "—"],
      ["Guests", form.guests],
      ["Date", form.date],
      ["Slot", slot?.label || "—"],
      ["Time", fmtTime(form.time)],
      ["Dishes", selectedDishes.length],
    ];
    if (isGroupDiscount) rows.push(["Group Discount", "10% off"]);
    return (
      <ModalTransition open={showPreview} onClose={() => setShowPreview(false)} overlayClassName="rf-modal-overlay" panelClassName="rf-modal">
        <div className="rf-modal-title">Confirm Pre-Booking</div>
        <div className="rf-modal-subtitle">Review your order before confirming.</div>
        <div className="rf-modal-grid">
          {rows.map(([k, v]) => (
            <div key={k} className="rf-modal-row">
              <span className="rf-modal-key">{k}</span>
              <span className="rf-modal-val">{v}</span>
            </div>
          ))}
        </div>
        {form.notes && (
          <div className="rf-modal-notes">
            <span className="rf-modal-key">Notes</span>
            <span>{form.notes}</span>
          </div>
        )}
        {totalAmount > 0 && (
          <div className="rf-modal-total-row">
            <span className="rf-modal-total-label">Total (Pay in Advance)</span>
            <span className="rf-modal-total-val">₹{totalAmount.toLocaleString()}</span>
          </div>
        )}
        <div className="rf-modal-actions">
          <Button3D className="btn-3d white" onClick={() => setShowPreview(false)}>
            Edit
          </Button3D>
          <Button3D className="btn-3d red" onClick={handleSubmit} disabled={loading}>
            {loading ? <span className="rf-spinner" /> : "Confirm"}
          </Button3D>
        </div>
      </ModalTransition>
    );
  };

  /* ── Success Screen ── */
  if (submitted) {
    const slot = SLOT_GROUPS.find(s => s.key === form.slotGroup);
    return (
      <div className="no-padding">
        <PageHeader title="Pre Booking" onBack={handleBack} onHome={handleHome} />
        <div className="pl-body">
          <div className="rf-success-screen">
            <div className="rf-success-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="32" fill="#d1fae5" />
                <path d="M20 32 L28 40 L44 24" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="rf-success-title">Pre-Booking Confirmed!</h2>
            <p className="rf-success-sub">Your food order is reserved. See you soon!</p>
            <div className="rf-booking-id">
              <span className="rf-booking-label">Booking ID</span>
              <span className="rf-booking-code">#{bookingId}</span>
            </div>
            <div className="rf-success-card">
              {[
                ["Guest", form.name],
                ["Date", form.date],
                ["Time", fmtTime(form.time)],
                ["Slot", slot?.label || "—"],
                ["Guests", guestCount],
                ["Dishes", selectedDishes.length],
                ["Total", `₹${totalAmount.toLocaleString()}`],
              ].map(([k, v]) => (
                <div key={k} className="rf-sc-row">
                  <span className="rf-sc-label">{k}</span>
                  <span className="rf-sc-val">{v}</span>
                </div>
              ))}
            </div>
            <Button3D
              className="btn-3d red"
              onClick={() => {
                setSubmitted(false);
                setShowPreview(false);
                setSelectedDishes([]);
                setForm({
                  name: "",
                  mobile: "",
                  email: "",
                  guests: 1,
                  date: tomorrowStr(),
                  time: "",
                  slotGroup: "",
                  notes: ""
                });
              }}
            >
              Make Another Booking
            </Button3D>
            <Button3D
              className="btn-3d red"
              onClick={handleHome}
            >
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

      <PageHeader title="Pre Booking" onBack={handleBack} onHome={handleHome} />

      <div className="pl-body">
        <div className="pbp-form-shell">
          <div className="pbp-form-grid">

            {/* ════ LEFT COLUMN ════ */}
            <div className="pbp-col">

              {/* GUEST DETAILS */}
              <div className="section-title">Guest Details</div>
              <div className="pbp-card">
                <div className={`field-group${flashField === "name" ? " rf-error-flash" : ""}`} ref={fieldRefs.name}>
                  <MatField
                    label={<>Name <span className="pbp-req">*</span></>}
                    value={form.name}
                    onChange={e => setF("name", toTitleCase(e.target.value))}
                    error={errors.name}
                    wrapperClassName=""
                  />
                </div>
                <div className="mat-row">
                  <div className={`field-group${flashField === "mobile" ? " rf-error-flash" : ""}`} style={{ flex: 1.4 }} ref={fieldRefs.mobile}>
                    <div className="mat-input-prefix-wrap">
                      <span className={`mat-prefix${errors.mobile ? " error" : ""}`}>+91</span>
                      <MatField
                        label={<>Mobile <span className="pbp-req">*</span></>}
                        type="tel"
                        value={form.mobile}
                        onChange={e => setF("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
                        error={errors.mobile}
                        wrapperClassName=""
                      />
                    </div>

                  </div>
                  <div className={`field-group${flashField === "email" ? " rf-error-flash" : ""}`} style={{ flex: 1 }} ref={fieldRefs.email}>
                    <MatField
                      label={<>Email <span className="pbp-opt">(optional)</span></>}
                      type="email"
                      value={form.email}
                      onChange={e => setF("email", e.target.value)}
                      error={errors.email}
                      wrapperClassName=""
                    />
                  </div>
                </div>

                <div className={`field-group${flashField === "guests" ? " rf-error-flash" : ""}`} ref={fieldRefs.guests}>
                  <label>Guests <span className="pbp-req">*</span></label>
                  <div className={`stepper-ctrl${errors.guests ? " error" : ""}`}>
                    <button className="stepper-btn" type="button" onClick={() => setF("guests", Math.max(1, form.guests - 1))}>−</button>
                    <span className="stepper-val">{form.guests}</span>
                    <button className="stepper-btn" type="button" onClick={() => setF("guests", Math.min(500, form.guests + 1))}>+</button>
                  </div>
                  {isGroupDiscount && <span className="pbp-discount-note">🎉 Group &gt;8 — 10% off!</span>}
                </div>
              </div>

              {/* NOTES */}
              <div className="section-title">Note <span className="pbp-opt">(optional)</span></div>

              <textarea
                className="pbp-notes"
                rows={3}
                placeholder="Special requests, dietary restrictions..."
                value={form.notes}
                onChange={e => setF("notes", e.target.value)}
              />

            </div>{/* end left col */}

            {/* ════ RIGHT COLUMN ════ */}
            <div className="pbp-col">

              {/* SCHEDULE — Date first, then Dining Slot once the date
                is confirmed, then Preferred Time once a slot is picked */}
              <div className="section-title">Date &amp; Dining Slot</div>
              <div className="pbp-card">
                <div className={`field-group pbp-schedule-date${flashField === "date" ? " rf-error-flash" : ""}`} ref={fieldRefs.date}>
                  <label>Date <span className="pbp-req">*</span></label>
                  <UserDatePicker
                    value={form.date}
                    min={tomorrowStr()}
                    hasError={!!errors.date}
                    onChange={v => { setF("date", v); setF("slotGroup", ""); setF("time", ""); setDateConfirmed(true); }}
                  />
                </div>
                {dateConfirmed && (
                  <div className={`field-group pbp-schedule-slots rf-field-reveal${flashField === "slotGroup" ? " rf-error-flash" : ""}`} ref={fieldRefs.slotGroup}>
                    <label>Dining Slot <span className="pbp-req">*</span></label>
                    <div className="slot-groups">
                      {SLOT_GROUPS.map(sg => {
                        const nowH = new Date().getHours();
                        const slotEndH = parseInt(sg.end.split(":")[0]);
                        const isPast = form.date === todayStr() && nowH >= slotEndH;
                        return (
                          <div key={sg.key}
                            className={`slot-group${form.slotGroup === sg.key ? " active" : ""}${isPast ? " pbp-slot-disabled" : ""}`}
                            onClick={() => { if (!isPast) { setF("slotGroup", sg.key); setF("time", ""); } }}>
                            <span className="slot-group-label">{sg.label}</span>
                            <span className="slot-group-time">{sg.start} – {sg.end}</span>
                            {isPast && <span className="slot-group-passed-badge">Passed</span>}
                          </div>
                        );
                      })}
                    </div>
                    {errors.slotGroup && <span className="pbp-field-error">Pick a dining slot</span>}
                  </div>
                )}
                {form.slotGroup && (
                  <div className={`field-group pbp-schedule-time rf-field-reveal${flashField === "time" ? " rf-error-flash" : ""}`} ref={fieldRefs.time}>
                    <label>Preferred Time <span className="pbp-req">*</span></label>
                    <UserTimePicker
                      value={form.time}
                      hasError={!!errors.time}
                      onChange={v => setF("time", v)}
                      slotStart={activeSlot?.start}
                      slotEnd={activeSlot?.end}
                      isToday={form.date === todayStr()}
                      disabled={!form.slotGroup}
                    />
                    {activeSlot && <span className="pbp-time-hint">{activeSlot.start} – {activeSlot.end}</span>}
                  </div>
                )}
              </div>

              {/* PRE-ORDER FOODS */}
              <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Pre-Order Foods</span>
                <Button3D type="button" className="chip" onClick={() => setShowDishPopup(true)}>
                  + Add Dish
                </Button3D>
              </div>
              <div className={`pbp-card${errors.bag ? " pbp-card-error" : ""}${flashField === "bag" ? " rf-error-flash" : ""}`} ref={fieldRefs.bag}>
                {selectedDishes.length === 0 ? (
                  <div className="pbp-empty">
                    <p>No dishes selected</p>
                    <span>Click "Add Dish" to pick items</span>
                  </div>
                ) : (
                  <>
                    <div className="pbp-items">
                      {selectedDishes.map((dish, i) => (
                        <div key={i} className="pbp-item">
                          <div>
                            <span className="pbp-item-name">{dish.name}</span>
                            <span className="pbp-item-size"> ₹{dish.unitPrice} × {guestCount}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="pbp-item-price">₹{dish.totalPrice?.toLocaleString()}</div>
                            <button type="button"
                              className="pbp-item-delete"
                              onClick={() => setSelectedDishes(prev => prev.filter(d => d.id !== dish.id))}>
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button3D
                      type="button"
                      className="chip"
                      onClick={() => setShowDishPopup(true)}
                    >
                      + Add More
                    </Button3D>
                    <div className="pbp-bill">
                      <div className="pbp-bill-row"><span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
                      {isGroupDiscount && (
                        <div className="pbp-bill-row pbp-bill-discount">
                          <span>Group Discount (10%)</span><span>− ₹{discount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="pbp-bill-row pbp-bill-total">
                        <span>Total (Pay in Advance)</span><strong>₹{totalAmount.toLocaleString()}</strong>
                      </div>
                    </div>
                  </>
                )}
              </div>

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
                      onClick={() => {
                        setForm({ name: "", mobile: "", email: "", guests: 1, date: tomorrowStr(), time: "", slotGroup: "", notes: "" });
                        setSelectedDishes([]);
                        setErrors({});
                        handleBack();
                      }}
                    >
                      Cancel
                    </Button3D>

                    <Button3D
                      className={`btn-3d red${loading ? " loading" : ""}`}
                      type="button"
                      onClick={handleReview}
                      disabled={loading}
                    >
                      {loading ? "Processing..." : "Review & Confirm"}
                    </Button3D>

                  </div>
                );

                // Below 600px .form-btn-row becomes position: fixed (see
                // ReservationForm.css, imported here). At that width it
                // must not live inside the route's animated
                // .page-transition-wrapper: Framer Motion applies a CSS
                // transform to that wrapper while a page transition
                // plays, and a transformed ancestor becomes the
                // containing block for any fixed-position descendant —
                // so .form-btn-row would suddenly be "fixed" relative
                // to the sliding wrapper instead of the viewport,
                // jumping/glitching on every page enter and exit.
                // Portalling it straight to document.body keeps it
                // anchored to the viewport regardless of what the route
                // transition is doing. Above 600px it's a normal
                // in-flow flex child, so it renders inline as before.
                return isFixedBtnRow ? createPortal(btnRow, document.body) : btnRow;
              })()}

            </div>{/* end right col */}

          </div>{/* end grid */}
        </div>

        {/* ADD DISH POPUP */}
        {showDishPopup && (
          <AddDishPopup
            onClose={() => setShowDishPopup(false)}
            onAdd={handleDishAdd}
            existingIds={existingIds}
            guests={form.guests}
          />
        )}

      </div>
    </div>
  );
};

export default PreBooking;
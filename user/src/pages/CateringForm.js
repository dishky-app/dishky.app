// user panel
import { useState, useEffect, useMemo, useRef } from "react";
import api from "../api";
import { bookingCrud } from "./shared/eventBookingCrud";
import { UserDatePicker } from "../components/UserDatePicker";
import { UserTimePicker } from "../components/UserTimePicker";
import "./CateringForm.css";
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
  { label: "Breakfast", key: "BF", start: "07:00", end: "10:00", icon: "🌅" },
  { label: "Brunch", key: "BR", start: "10:00", end: "12:00", icon: "☀️" },
  { label: "Lunch", key: "LU", start: "12:00", end: "15:00", icon: "🍱" },
  { label: "Hi-Tea", key: "HT", start: "15:00", end: "18:00", icon: "🫖" },
  { label: "Dinner", key: "DI", start: "18:30", end: "22:00", icon: "🌙" },
];

const DECORATION_TIERS = [
  { label: "Normal", value: "normal", price: 1500, desc: "Balloons & basic setup" },
  { label: "Elegant", value: "elegant", price: 3000, desc: "Flowers, drapes & lighting" },
  { label: "Luxury", value: "luxury", price: 5000, desc: "Premium full decor" },
];

const EXTRA_PRICES = {
  cake: 500, specialMention: 0, mic: 500, projector: 800,
  liveMusic: 2000, surpriseGift: 300, candleLight: 800, music: 1500, speaker: 600,
};

const calcExtrasTotal = (form) => {
  let t = 0;
  Object.keys(EXTRA_PRICES).forEach(k => { if (form[k]) t += EXTRA_PRICES[k]; });
  if (form.decoration) {
    const tier = DECORATION_TIERS.find(d => d.value === form.decoration);
    if (tier) t += tier.price;
  }
  return t;
};

/* ══════════════════════════════════
   Add Dish Popup
══════════════════════════════════ */
const AddDishPopup = ({ onClose, onAdd, existingIds, guests }) => {
  const [menuData, setMenuData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState(null);
  const [vegFilter, setVegFilter] = useState("all"); // "all" | "veg" | "nonveg"
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/categories")
      .then(res => { setMenuData(res.data); setLoading(false); })
      .catch(() => { setMenuData([]); setLoading(false); });
  }, []);

  /* Flatten categories & filter isEventFood === true */
  const { categories, allDishes } = useMemo(() => {
    if (!menuData) return { categories: [], allDishes: [] };
    const rawCats = Array.isArray(menuData) ? menuData : (menuData.categories || []);
    const cats = [];
    const dishes = [];

    rawCats.forEach(topCat => {
      const subs = topCat.subCategories || [];
      if (subs.length > 0) {
        subs.forEach(sub => {
          const subDishes = (sub.dishes || []).filter(d => d.isEventFood === true);
          if (subDishes.length > 0) {
            cats.push({ id: sub.id, name: sub.name, parentName: topCat.name });
            subDishes.forEach(d => dishes.push({
              ...d,
              price: d.basePrice || d.price || 0,
              categoryId: sub.id,
              categoryName: sub.name,
            }));
          }
        });
      } else {
        const topDishes = (topCat.dishes || []).filter(d => d.isEventFood === true);
        if (topDishes.length > 0) {
          cats.push({ id: topCat.id, name: topCat.name });
          topDishes.forEach(d => dishes.push({
            ...d,
            price: d.basePrice || d.price || 0,
            categoryId: topCat.id,
            categoryName: topCat.name,
          }));
        }
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
          <CloseButton className="home-btn home-btn-icon" onClick={onClose}>

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
              <Button3D
                className={`sort-btn${!activeCat ? " active" : ""}`}
                onClick={() => setActiveCat(null)}>
                All
              </Button3D>
              {categories.map(c => (
                <Button3D
                  key={c.id}
                  className={`sort-btn${activeCat === c.id ? " active" : ""}`}
                  onClick={() => setActiveCat(activeCat === c.id ? null : c.id)}>
                  {c.name}
                </Button3D>
              ))}
            </div>
          )}

          {/* Veg / Non-Veg filter */}
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
              <div className="dish-popup-empty">
                {allDishes.length === 0
                  ? "No event food dishes found. Mark dishes as Event Food in the menu."
                  : "No dishes match your filter."}
              </div>
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
                          <span className="dish-card-total"> = ₹{total.toLocaleString()} for {guestCount}</span>
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
   CheckCard
══════════════════════════════════ */
const CheckCard = ({ label, price, checked, onChange }) => (
  <label className={`ucat-check-card${checked ? " active" : ""}`}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: "none" }} />
    <div className="ucat-check-card-title">
      <div className="ucat-addon-label">{label}</div>
      {price ? <div className="ucat-addon-price">+₹{price}</div> : null}
    </div>
  </label>
);

/* ══════════════════════════════════
   Main Component — User Catering Form
══════════════════════════════════ */
const CateringForm = ({ handleBack, handleHome }) => {
  const isFixedBtnRow = useIsBelowWidth(600);
  const [form, setForm] = useState({
    name: "", mobile: "", email: "", guests: 20,
    eventDate: "", time: "", slotGroup: "",
    /* Address */
    addrDoorNo: "", addrStreet: "", addrArea: "",
    addrLandmark: "", addrCity: "", addrDistrict: "", addrState: "", addrPincode: "",
    notes: "",
    /* Celebration-style extras */
    decoration: null,
    cake: false, specialMention: false, specialMentionText: "",
    mic: false, projector: false, music: false, speaker: false,
    liveMusic: false, surpriseGift: false, candleLight: false,
  });
  const [errors, setErrors] = useState({});
  const [flashField, setFlashField] = useState(""); // briefly highlights the field scrolled to on validation failure

  /* One ref per field the submit validation can flag, in form order,
     so a failed submit can scroll straight to the first invalid one. */
  const fieldRefs = {
    name: useRef(null), mobile: useRef(null), email: useRef(null), guests: useRef(null),
    eventDate: useRef(null), slotGroup: useRef(null), time: useRef(null),
    addrDoorNo: useRef(null), addrStreet: useRef(null), addrArea: useRef(null),
    addrCity: useRef(null), addrDistrict: useRef(null), addrState: useRef(null), addrPincode: useRef(null),
    dishes: useRef(null),
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
      setForm(prev => ({ ...prev, name, mobile, email }));
    }).catch(console.error);
  }, []);

  const guestCount = Math.max(1, parseInt(form.guests, 10) || 1);

  const buildAddress = (f) => [
    f.addrDoorNo, f.addrStreet, f.addrArea,
    f.addrLandmark, f.addrCity, f.addrDistrict, f.addrState, f.addrPincode,
  ].filter(Boolean).join(", ");

  const setF = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: "" }));
  };

  /* Recalculate dish totals when guests changes */
  useEffect(() => {
    setSelectedDishes(prev => prev.map(d => ({
      ...d,
      totalPrice: (d.unitPrice || d.price || 0) * guestCount,
    })));
  }, [guestCount]);

  const dishTotal = selectedDishes.reduce((s, d) => s + (d.totalPrice || 0), 0);
  const extrasTotal = calcExtrasTotal(form);
  const totalAmount = dishTotal + extrasTotal;

  const handleDishAdd = (dish, remove) => {
    if (remove) {
      setSelectedDishes(prev => prev.filter(d => d.id !== dish.id));
    } else {
      const unitPrice = dish.price || 0;
      setSelectedDishes(prev => [...prev, {
        ...dish,
        unitPrice,
        totalPrice: unitPrice * guestCount,
      }]);
      setErrors(prev => ({ ...prev, dishes: "" }));
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
    if (!form.eventDate) err.eventDate = true;
    if (!form.slotGroup) err.slotGroup = true;
    if (!form.time) err.time = true;
    /* Address — all mandatory */
    if (!form.addrDoorNo.trim()) err.addrDoorNo = true;
    if (!form.addrStreet.trim()) err.addrStreet = true;
    if (!form.addrArea.trim()) err.addrArea = true;
    if (!form.addrCity.trim()) err.addrCity = true;
    if (!form.addrDistrict.trim()) err.addrDistrict = true;
    if (!form.addrState.trim()) err.addrState = true;
    if (!form.addrPincode || form.addrPincode.length !== 6) err.addrPincode = true;
    /* Dishes — at least one required */
    if (selectedDishes.length === 0) err.dishes = true;
    return err;
  };

  const handleSubmit = async () => {
    const ve = validate();
    if (Object.keys(ve).length > 0) {
      setErrors(ve);
      // Scroll to and briefly flash the first invalid field, in form
      // order, so the person lands right on what needs fixing instead
      // of having to scan the whole form for red-outlined fields.
      const order = ["name", "mobile", "email", "guests", "eventDate", "slotGroup", "time",
        "addrDoorNo", "addrStreet", "addrArea", "addrCity", "addrDistrict", "addrState", "addrPincode", "dishes"];
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
      const address = buildAddress(form);
      const saved = await bookingCrud.create("cateringOrders", {
        name: form.name,
        mobile: form.mobile,
        email: form.email || "",
        guests: guestCount,
        date: form.eventDate,
        eventDate: form.eventDate,
        time: form.time,
        slotGroup: form.slotGroup || "",
        location: address,
        addrDoorNo: form.addrDoorNo,
        addrStreet: form.addrStreet,
        addrArea: form.addrArea,
        addrLandmark: form.addrLandmark,
        addrCity: form.addrCity,
        addrDistrict: form.addrDistrict,
        addrState: form.addrState,
        addrPincode: form.addrPincode,
        notes: form.notes || "",
        decoration: form.decoration,
        cake: form.cake, specialMention: form.specialMention,
        specialMentionText: form.specialMentionText,
        mic: form.mic, projector: form.projector,
        music: form.music, speaker: form.speaker,
        liveMusic: form.liveMusic, surpriseGift: form.surpriseGift,
        candleLight: form.candleLight,
        items: selectedDishes,
        dishTotal,
        extrasTotal,
        totalAmount,
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

  const fmtTime = (t) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
  };

  const handleReview = () => {
    const ve = validate();
    if (Object.keys(ve).length > 0) { setErrors(ve); return; }
    setShowPreview(true);
  };

  /* ── Preview Modal — animation handled entirely by ModalTransition
     (shared/ModalTransition.js). ── */
  const PreviewModal = () => {
    const slot = SLOT_GROUPS.find(s => s.key === form.slotGroup);
    const decoTier = DECORATION_TIERS.find(d => d.value === form.decoration);
    const address = buildAddress(form);
    const rows = [
      ["Name", form.name],
      ["Mobile", "+91 " + form.mobile],
      ["Email", form.email || "—"],
      ["Guests", form.guests],
      ["Date", form.eventDate],
      ["Time", fmtTime(form.time)],
      ["Slot", slot?.label || "—"],
      ["Decoration", decoTier ? `${decoTier.label} (₹${decoTier.price.toLocaleString()})` : "None"],
      ["Dishes", selectedDishes.length],
    ];
    return (
      <ModalTransition open={showPreview} onClose={() => setShowPreview(false)} overlayClassName="rf-modal-overlay" panelClassName="rf-modal">
        <div className="rf-modal-title">Confirm Catering Order</div>
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
        {form.notes && (
          <div className="rf-modal-notes">
            <span className="rf-modal-key">Notes</span>
            <span>{form.notes}</span>
          </div>
        )}
        {totalAmount > 0 && (
          <div className="rf-modal-total-row">
            <span className="rf-modal-total-label">Estimated Total</span>
            <span className="rf-modal-total-val">₹{totalAmount.toLocaleString()}</span>
          </div>
        )}
        <div className="rf-modal-actions">
          <Button3D className="btn-3d white" onClick={() => setShowPreview(false)}>
            Edit
          </Button3D>
          <Button3D className="btn-3d red" onClick={handleSubmit} disabled={loading}>
            {loading ? <span className="rf-spinner" /> : "Submit"}
          </Button3D>
        </div>
      </ModalTransition>
    );
  };

  /* ── Success Screen ── */
  /* ── Success Screen ── */
  const resetForm = () => {
    setSubmitted(false);
    setSelectedDishes([]);
    setShowPreview(false);
    setErrors({});
    setForm({
      name: "", mobile: "", email: "", guests: 20,
      eventDate: "", time: "", slotGroup: "",
      addrDoorNo: "", addrStreet: "", addrArea: "",
      addrLandmark: "", addrCity: "", addrDistrict: "", addrState: "", addrPincode: "",
      notes: "",
      decoration: null,
      cake: false, specialMention: false, specialMentionText: "",
      mic: false, projector: false, music: false, speaker: false,
      liveMusic: false, surpriseGift: false, candleLight: false,
    });
  };

  if (submitted) {
    return (
      <div className="no-padding">
        <PageHeader title="Catering" onBack={handleBack} onHome={handleHome} />
        <div className="pl-body">
          <div className="rf-success-screen">
            <div className="rf-success-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="32" fill="#d1fae5" />
                <path d="M20 32 L28 40 L44 24" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="rf-success-title">Catering Submitted!</h2>
            <p className="rf-success-sub">We'll confirm your catering order shortly.</p>
            <div className="rf-booking-id">
              <span className="rf-booking-label">Booking ID</span>
              <span className="rf-booking-code">#{bookingId}</span>
            </div>
            <div className="rf-success-card">
              <div className="rf-sc-row"><span className="rf-sc-label">Name</span><span className="rf-sc-val">{form.name}</span></div>
              <div className="rf-sc-row"><span className="rf-sc-label">Mobile</span><span className="rf-sc-val">{form.mobile}</span></div>
              <div className="rf-sc-row"><span className="rf-sc-label">Date</span><span className="rf-sc-val">{form.eventDate}</span></div>
              {form.slotGroup && <div className="rf-sc-row"><span className="rf-sc-label">Slot</span><span className="rf-sc-val">{SLOT_GROUPS.find(s => s.key === form.slotGroup)?.label}</span></div>}
              <div className="rf-sc-row"><span className="rf-sc-label">Time</span><span className="rf-sc-val">{fmtTime(form.time)}</span></div>
              <div className="rf-sc-row"><span className="rf-sc-label">Guests</span><span className="rf-sc-val">{guestCount}</span></div>
              <div className="rf-sc-row"><span className="rf-sc-label">Dishes Total</span><span className="rf-sc-val">₹{dishTotal.toLocaleString()}</span></div>
              {extrasTotal > 0 && <div className="rf-sc-row"><span className="rf-sc-label">Extras</span><span className="rf-sc-val">₹{extrasTotal.toLocaleString()}</span></div>}
              <div className="rf-sc-row"><span className="rf-sc-label">Grand Total</span><span className="rf-sc-val">₹{totalAmount.toLocaleString()}</span></div>
            </div>
            <Button3D className="btn-3d red" onClick={resetForm}>
              Make Another Booking
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

      <PageHeader title="Catering" onBack={handleBack} onHome={handleHome} />

      <div className="pl-body">
        <div className="ucat-form-shell">
          <div className="ucat-form-grid">

            {/* ════ LEFT COLUMN ════ */}
            <div className="ucat-col">

              {/* GUEST DETAILS */}
              <div className="section-title">Your Details</div>
              <div className="ucat-card">
                <div className={`field-group${flashField === "name" ? " rf-error-flash" : ""}`} style={{ flex: 1.4 }} ref={fieldRefs.name}>
                  <MatField
                    label={<>Name <span className="ucat-req">*</span></>}
                    value={form.name}
                    onChange={e => setF("name", toTitleCase(e.target.value))}
                    error={errors.name}
                    wrapperClassName=""
                  />
                </div>


                <div className="mat-row">
                  <div className={`field-group${flashField === "mobile" ? " rf-error-flash" : ""}`} style={{ flex: 1.4 }} ref={fieldRefs.mobile}>
                    <div className="mat-input-prefix-wrap">
                      <span className="mat-prefix">+91</span>
                      <MatField
                        label={<>Mobile <span className="ucat-req">*</span></>}
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
                      label={<>Email <span className="ucat-opt">(optional)</span></>}
                      type="email"
                      value={form.email}
                      onChange={e => setF("email", e.target.value)}
                      error={errors.email}
                      wrapperClassName=""
                    />
                  </div>
                </div>

                <div className={`field-group${flashField === "guests" ? " rf-error-flash" : ""}`} style={{ flex: 1 }} ref={fieldRefs.guests}>
                  <label>Guests <span className="ucat-req">*</span></label>
                  <div className={`stepper-ctrl${errors.guests ? " error" : ""}`}>
                    <button className="stepper-btn" type="button" onClick={() => setF("guests", Math.max(1, form.guests - 1))}>−</button>
                    <span className="stepper-val" >{form.guests}</span>
                    <button className="stepper-btn" type="button" onClick={() => setF("guests", Math.min(10000, form.guests + 1))}>+</button>
                  </div>
                </div>
              </div>

              {/* EVENT DETAILS — date first, then slot once a date is
                picked, then time once a slot is picked */}
              <div className="section-title">Event Details</div>
              <div className="ucat-card">
                <div className={`field-group${flashField === "eventDate" ? " rf-error-flash" : ""}`} ref={fieldRefs.eventDate}>
                  <label>Event Date <span className="ucat-req">*</span></label>
                  <UserDatePicker
                    value={form.eventDate}
                    min={tomorrowStr()}
                    hasError={!!errors.eventDate}
                    onChange={v => { setF("eventDate", v); setF("slotGroup", ""); setF("time", ""); }}
                  />
                </div>

                {form.eventDate && (
                  <div className={`field-group rf-field-reveal${flashField === "slotGroup" ? " rf-error-flash" : ""}`} ref={fieldRefs.slotGroup}>
                    <label>Dining Slot <span className="ucat-req">*</span></label>
                    <div className="slot-groups">
                      {SLOT_GROUPS.map(sg => (
                        <button
                          key={sg.key}
                          type="button"
                          className={`slot-group${form.slotGroup === sg.key ? " active" : ""}`}
                          onClick={() => {
                            const next = form.slotGroup === sg.key ? "" : sg.key;
                            setF("slotGroup", next);
                            setF("time", "");
                          }}
                        >
                          <span className="slot-group-label">{sg.label}</span>
                          <span className="slot-group-time">{sg.start}–{sg.end}</span>
                        </button>
                      ))}
                    </div>
                    {errors.slotGroup && <span className="ucat-field-error">Please select a dining slot</span>}
                  </div>
                )}

                {form.slotGroup && (
                  <div className={`field-group rf-field-reveal${flashField === "time" ? " rf-error-flash" : ""}`} ref={fieldRefs.time}>
                    <label>
                      Preferred Time <span className="ucat-req">*</span>
                      {(() => {
                        const sg = SLOT_GROUPS.find(s => s.key === form.slotGroup);
                        return sg ? <span className="ucat-slot-hint-inline">{sg.start} – {sg.end}</span> : null;
                      })()}
                    </label>
                    <UserTimePicker
                      value={form.time}
                      hasError={!!errors.time}
                      onChange={v => setF("time", v)}
                      slotStart={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.start}
                      slotEnd={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.end}
                      disabled={!form.slotGroup}
                      isToday={false}
                    />
                  </div>
                )}
              </div>

              {/* ADDRESS */}
              <div className="section-title">Event Address <span className="ucat-req">*</span></div>
              <div className="ucat-card">
                <div className="ucat-addr-grid">
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
                            ? <span className="ucat-req"> *</span>
                            : <span className="ucat-opt"> (optional)</span>}
                        </>}
                        value={form[field.key]}
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

              {/* NOTES */}
              <div className="section-title">Note <span className="ucat-opt">(optional)</span></div>
              <div className="ucat-card">
                <div className="mat-area">
                  <textarea
                    className="ucat-notes"
                    rows={3}
                    placeholder="Special requests, dietary requirements, additional info..."
                    value={form.notes}
                    onChange={e => setF("notes", e.target.value)}
                  />
                  <span className="mat-area-bar" />
                </div>
              </div>

            </div>{/* end left col */}

            {/* ════ RIGHT COLUMN ════ */}
            <div className="ucat-col">

              {/* DECORATION */}
              <div className="section-title">Decoration</div>
              <div className="ucat-card">
                <div className="ucat-deco-grid">
                  <button type="button"
                    className={`ucat-deco-btn${!form.decoration ? " active" : ""}`}
                    onClick={() => setF("decoration", null)}>
                    None
                  </button>
                  {DECORATION_TIERS.map(t => (
                    <button key={t.value} type="button"
                      className={`ucat-deco-btn${form.decoration === t.value ? " active" : ""}`}
                      onClick={() => setF("decoration", t.value)}>
                      <span className="ucat-deco-label">{t.label}</span>
                      <span className="ucat-deco-price">₹{t.price.toLocaleString()}</span>
                      <span className="ucat-deco-desc">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ADD-ONS */}
              <div className="section-title">Add-ons & Services</div>
              <div className="ucat-card">
                <div className="ucat-check-grid">
                  {[
                    { key: "cake", label: "Cake", price: 500 },
                    { key: "specialMention", label: "Special Mention", price: 0 },
                    { key: "liveMusic", label: "Live Music", price: 2000 },
                    { key: "surpriseGift", label: "Surprise Gift", price: 300 },
                    { key: "candleLight", label: "Candle Light", price: 800 },
                    { key: "mic", label: "Microphone", price: 500 },
                    { key: "projector", label: "Projector", price: 800 },
                    { key: "music", label: "Music System", price: 1500 },
                    { key: "speaker", label: "Speaker", price: 600 },
                  ].map(ex => (
                    <CheckCard key={ex.key} label={ex.label} price={ex.price}
                      checked={form[ex.key]} onChange={v => setF(ex.key, v)} />
                  ))}
                </div>
                {form.specialMention && (
                  <div className="mat-area" style={{ marginTop: 8 }}>
                    <textarea
                      className="ucat-notes"
                      rows={2}
                      placeholder="Describe what to announce / mention..."
                      value={form.specialMentionText}
                      onChange={e => setF("specialMentionText", e.target.value)}
                    />
                    <span className="mat-area-bar" />
                  </div>
                )}
              </div>

              {/* DISHES */}
              <div className="section-title">
                Selected Dishes
                <Button3D as="button" type="button" className="chip" onClick={() => setShowDishPopup(true)}>
                  + Add Dish
                </Button3D>
              </div>
              <div className={`pbp-card${errors.dishes ? " pbp-card-error" : ""}${flashField === "dishes" ? " rf-error-flash" : ""}`} ref={fieldRefs.dishes}>
                {selectedDishes.length === 0 ? (
                  <div className="ucat-empty">
                    <p>No dishes selected</p>
                    <span>Click "Add Dish" to pick event food items</span>
                  </div>
                ) : (
                  <>
                    <div className="ucat-items">
                      {selectedDishes.map((dish, i) => (
                        <div key={i} className="ucat-item">
                          <div>
                            <span className="ucat-item-name">{dish.name}</span>
                            <span className="ucat-item-size"> ₹{dish.unitPrice} × {guestCount} guests</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="ucat-item-price">₹{dish.totalPrice?.toLocaleString()}</div>
                            <button type="button"
                              className="ucat-item-delete"
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
                  </>
                )}


                {/* PRICE SUMMARY */}
                {(dishTotal > 0 || extrasTotal > 0) && (
                  <div className="ucat-card ucat-bill">
                    {dishTotal > 0 && (
                      <div className="ucat-bill-row">
                        <span>Dishes ({selectedDishes.length} × {guestCount} guests)</span>
                        <span>₹{dishTotal.toLocaleString()}</span>
                      </div>
                    )}
                    {form.decoration && (
                      <div className="ucat-bill-row">
                        <span>Decoration ({DECORATION_TIERS.find(d => d.value === form.decoration)?.label})</span>
                        <span>₹{DECORATION_TIERS.find(d => d.value === form.decoration)?.price.toLocaleString()}</span>
                      </div>
                    )}
                    {Object.keys(EXTRA_PRICES).filter(k => form[k] && EXTRA_PRICES[k] > 0).map(k => (
                      <div key={k} className="ucat-bill-row">
                        <span style={{ textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</span>
                        <span>₹{EXTRA_PRICES[k]}</span>
                      </div>
                    ))}
                    <div className="ucat-bill-row ucat-bill-total">
                      <span>Grand Total</span>
                      <strong>₹{totalAmount.toLocaleString()}</strong>
                    </div>
                  </div>
                )}

              </div>

              {(() => {
                const btnRow = (
                  <div className="form-btn-row">
                    <Button3D
                      className="btn-3d white"
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setForm({
                          name: "", mobile: "", email: "", guests: 20,
                          eventDate: "", time: "", slotGroup: "",
                          addrDoorNo: "", addrStreet: "", addrArea: "",
                          addrLandmark: "", addrCity: "", addrDistrict: "", addrState: "", addrPincode: "",
                          notes: "",
                          decoration: null,
                          cake: false, specialMention: false, specialMentionText: "",
                          mic: false, projector: false, music: false, speaker: false,
                          liveMusic: false, surpriseGift: false, candleLight: false,
                        });
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
                      Review &amp; Submit
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

export default CateringForm;
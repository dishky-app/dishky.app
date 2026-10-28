/* user panel */
import { useState, useEffect, useRef } from "react";
import { bookingCrud } from "./shared/eventBookingCrud";
import { UserDatePicker, todayStr } from "../components/UserDatePicker";
import { UserTimePicker } from "../components/UserTimePicker";
import { fmtDate, fmtTime } from "../utils/dateUtils";
import "./CelebrationForm.css";
import "./ReservationForm.css";
import "./PreviewModal.css";
import Button3D from "./shared/Button3D";
import MatField from "./shared/MatField";
import { allowTextInput, sanitizePhoneInput } from "./shared/inputLimits";
import PageHeader from "./shared/PageHeader";
import ModalTransition from "./shared/ModalTransition";
import "./shared/ModalTransition.css";
import { createPortal } from "react-dom";
import { useIsBelowWidth } from "./shared/useIsBelowWidth";
import { useToast } from "../components/Usetoast";
import { toTitleCase } from "../utils/nameCase";

const pad = (n) => String(n).padStart(2, "0");

const tomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

const SLOT_GROUPS = [
  { label: "Breakfast", key: "BF", start: "07:00", end: "10:00" },
  { label: "Brunch", key: "BR", start: "10:00", end: "12:00" },
  { label: "Lunch", key: "LU", start: "12:00", end: "15:00" },
  { label: "Hi-Tea", key: "HT", start: "15:00", end: "18:00" },
  { label: "Dinner", key: "DI", start: "19:00", end: "23:00" },
];

/* ── "Get Together" removed, "Meeting" kept ── */
const CELEBRATION_TYPES = [
  { label: "Birthday", value: "birthday" },
  { label: "Anniversary", value: "anniversary" },
  { label: "Meeting", value: "meeting" },
  { label: "Candle Light Dinner", value: "candlelightdinner" },
];

/* Luxury only available for Candle Light Dinner */
const DECORATION_TIERS = [
  { label: "Normal", value: "normal", price: 1500, desc: "Balloons & basic setup" },
  { label: "Elegant", value: "elegant", price: 3000, desc: "Flowers, drapes & lighting" },
  { label: "Luxury", value: "luxury", price: 5000, desc: "Premium full decor", onlyCandleLight: true },
];

const BIRTHDAY_EXTRAS = [
  { key: "cake", label: "Cake", price: 500 },
  { key: "specialMention", label: "Special Mentions", price: 0 },
];
const MEETING_SEATING = [
  { key: "standingBrochures", label: "Standing Brochures", price: 200 },
  { key: "placeHolders", label: "Place Holders", price: 150 },
  { key: "pens", label: "Pens", price: 100 },
];
const MEETING_AV = [
  { key: "mic", label: "Microphone", price: 500 },
  { key: "projector", label: "Projector", price: 800 },
];
const ANNIVERSARY_EXTRAS = [
  { key: "candleLight", label: "Candle Light Setup", price: 800 },
  { key: "liveMusic", label: "Live Music", price: 2000 },
  { key: "surpriseGift", label: "Surprise Gift Revealing", price: 300 },
  { key: "cake", label: "Cake", price: 500 },
  { key: "specialMention", label: "Special Mentions", price: 0 },
];
const CANDLELIGHT_EXTRAS = [
  { key: "liveMusic", label: "Live Music", price: 2000 },
  { key: "cake", label: "Cake", price: 500 },
  { key: "specialMention", label: "Special Mentions", price: 0 },
];

/* ─── extra prices lookup ─── */
const EXTRA_PRICES = {
  cake: 500, specialMention: 0, standingBrochures: 200, placeHolders: 150, pens: 100,
  mic: 500, projector: 800, candleLight: 800, liveMusic: 2000, surpriseGift: 300,
};
const AV_PRICE = 500; /* mic or projector base pack */

/* ─── Checkbox Card ─── */
const CheckCard = ({ label, checked, onChange, price }) => (
  <label className={`clp-check-card${checked ? " active" : ""}`}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: "none" }} />
    <span className="clp-check-label">{label}{price ? <span style={{ fontSize: 10, marginLeft: 4 }}>+₹{price}</span> : null}</span>
  </label>
);

/* ─── Decoration Picker ─── */
const DecorationPicker = ({ value, onChange, allowLuxury }) => (
  <div className="clp-deco-grid">
    <button type="button" className={`clp-deco-none-btn${!value ? " active" : ""}`} onClick={() => onChange(null)}>
      No Decoration
    </button>
    {DECORATION_TIERS.map(t => {
      const disabled = (t.onlyCandleLight && !allowLuxury) || (t.value === "normal" && allowLuxury);
      const lockMsg = t.value === "normal" ? "Not available for Candle Light Dinner" : "Candle Light Dinner only";
      return (
        <button key={t.value} type="button"
          className={`clp-deco-card${value === t.value ? " active" : ""}${disabled ? " clp-deco-disabled" : ""}`}
          onClick={() => !disabled && onChange(t.value)}
          title={disabled ? lockMsg : ""}
        >
          <div className="clp-deco-label">{t.label}</div>
          <div className="clp-deco-price">₹{t.price.toLocaleString()}</div>
          <div className="clp-deco-desc">{t.desc}</div>
          {disabled && <div className="clp-deco-lock-msg">{lockMsg}</div>}
        </button>
      );
    })}
  </div>
);

/* ═══════════════════════════════
   Price Calculator
═══════════════════════════════ */
const calcTotal = (form) => {
  let total = 0;
  /* Decoration */
  if (form.decoration) {
    const tier = DECORATION_TIERS.find(t => t.value === form.decoration);
    if (tier) total += tier.price;
  }
  /* Per-extra prices */
  Object.keys(EXTRA_PRICES).forEach(key => {
    if (form[key]) total += EXTRA_PRICES[key];
  });
  /* AV base if mic/projector and not meeting (meeting handles separately) */
  if (form.type !== "meeting" && (form.mic || form.projector)) {
    total += AV_PRICE;
  }
  return total;
};

/* ═══════════════════════════════
   Main Component
═══════════════════════════════ */
const CelebrationForm = ({ handleBack, handleHome, navigateToCatering }) => {
  const { toast } = useToast();
  const isFixedBtnRow = useIsBelowWidth(600);
  const [form, setForm] = useState({
    type: "birthday",
    name: "", mobile: "", email: "",
    date: "", time: "", slotGroup: "",
    guests: 2,
    birthdayPersonName: "", birthdayPersonAge: "",
    cake: false,
    specialMention: false, specialMentionText: "",
    standingBrochures: false, placeHolders: false, pens: false,
    mic: false, projector: false,
    candleLight: false, liveMusic: false, surpriseGift: false,
    decoration: null,
    audioVideo: false,
    specialNote: "",
  });

  const [errors, setErrors] = useState({});
  const [flashField, setFlashField] = useState(""); // briefly highlights the field scrolled to on validation failure

  /* One ref per field the submit validation can flag, in form order,
     so a failed submit can scroll straight to the first invalid one. */
  const fieldRefs = {
    name: useRef(null), mobile: useRef(null), date: useRef(null),
    slotGroup: useRef(null), time: useRef(null), guests: useRef(null),
    birthdayPersonName: useRef(null),
  };
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    bookingCrud.resolveUser().then(({ name, mobile, email }) => {
      setForm(prev => ({ ...prev, name, mobile, email }));
    }).catch(console.error);
  }, []);

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: "" }));
  };

  /* If type changes away from candlelightdinner, remove luxury decoration */
  const setType = (val) => {
    setForm(prev => ({
      ...prev,
      type: val,

      // reset event-specific add-ons
      cake: false,
      specialMention: false,
      specialMentionText: "",
      standingBrochures: false,
      placeHolders: false,
      pens: false,
      candleLight: false,
      liveMusic: false,
      surpriseGift: false,

      // reset decoration if luxury not allowed, or "normal" for candle light dinner
      decoration:
        (val !== "candlelightdinner" && prev.decoration === "luxury") ||
        (val === "candlelightdinner" && prev.decoration === "normal")
          ? null
          : prev.decoration,
    }));

    setErrors(prev => ({
      ...prev,
      type: "",
      birthdayPersonName: "",
    }));
  };

  const currentSlot = SLOT_GROUPS.find(s => s.key === form.slotGroup);
  const isToday = form.date === todayStr();
  const isCandleLight = form.type === "candlelightdinner";
  const estimatedTotal = calcTotal(form);

  const handleSlotChange = (key) => { set("slotGroup", key); set("time", ""); };
  const handleDateChange = (d) => { set("date", d); set("slotGroup", ""); set("time", ""); };

  /* Guest cap: max 20 for celebrations */
  const setGuests = (n) => {
    set("guests", Math.max(1, Math.min(20, n)));
  };

  const validate = () => {
    const err = {};
    if (!form.name.trim()) err.name = "Name required";
    if (!form.mobile || form.mobile.replace(/\D/g, "").length !== 10) err.mobile = "Valid 10-digit mobile required";
    if (!form.date) err.date = "Date required";
    if (form.date && form.date < tomorrowStr()) err.date = "Please select a future date (today not allowed)";
    if (!form.slotGroup) err.slotGroup = "Please select a dining slot";
    if (!form.time) err.time = "Time required";
    if (!form.guests || Number(form.guests) < 1) err.guests = "At least 1 guest required";
    if (Number(form.guests) > 20) err.guests = "Maximum 20 guests allowed for celebration";
    if (form.type === "birthday" && !form.birthdayPersonName.trim()) err.birthdayPersonName = "Birthday person name required";
    return err;
  };

  const handleSubmit = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Scroll to and briefly flash the first invalid field, in form
      // order, so the person lands right on what needs fixing.
      const order = ["name", "mobile", "date", "slotGroup", "time", "guests", "birthdayPersonName"];
      const firstErrorKey = order.find(k => validationErrors[k]);
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
      const saved = await bookingCrud.create("celebrations", {
        ...form,
        totalAmount: estimatedTotal,
      });
      setBookingId(bookingCrud.makeRef(saved.id));
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      type: "birthday", name: "", mobile: "", email: "", date: "", time: "", slotGroup: "",
      guests: 2, birthdayPersonName: "", birthdayPersonAge: "", cake: false,
      specialMention: false, specialMentionText: "", standingBrochures: false,
      placeHolders: false, pens: false, mic: false, projector: false, candleLight: false,
      liveMusic: false, surpriseGift: false, decoration: null, audioVideo: false, specialNote: "",
    });
    setShowPreview(false);
    setSubmitted(false);
  }

  /* ─── Special Mention expansion helper ─── */
  const renderExtrasWithMention = (extras) => extras.map(ex => (
    <div key={ex.key} className="clp-extra-item-wrap">
      <CheckCard label={ex.label} price={ex.price || 0} checked={form[ex.key]} onChange={v => set(ex.key, v)} />
      {ex.key === "specialMention" && form.specialMention && (
        <div className="clp-mention-box">
          <div className="clp-mat-area">
            <textarea
              className="clp-mention-textarea"
              placeholder="Describe what you'd like announced or mentioned during the event..."
              value={form.specialMentionText}
              onChange={e => set("specialMentionText", allowTextInput(form.specialMentionText, e.target.value, 500, 100000))}
              rows={3}
              maxLength={500}
            />
            <span className="clp-mat-area-bar" />
          </div>
        </div>
      )}
    </div>
  ));

  const handleReview = () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return; }
    setShowPreview(true);
  };

  /* ─── Preview Modal — animation handled entirely by ModalTransition
     (shared/ModalTransition.js). ─── */
  const PreviewModal = () => {
    const typeObj = CELEBRATION_TYPES.find(t => t.value === form.type);
    const slot = SLOT_GROUPS.find(s => s.key === form.slotGroup);
    const decoTier = DECORATION_TIERS.find(t => t.value === form.decoration);
    const fmtT = (t) => { if (!t) return ""; const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`; };
    const rows = [
      ["Name", form.name],
      ["Mobile", "+91 " + form.mobile],
      ["Email", form.email || "—"],
      ["Event Type", typeObj?.label],
      ["Date", fmtDate(form.date)],
      ["Slot", slot?.label || "—"],
      ["Time", fmtT(form.time)],
      ["Guests", form.guests],
      ["Decoration", decoTier ? `${decoTier.label} (₹${decoTier.price.toLocaleString()})` : "None"],
    ];
    if (form.type === "birthday" && form.birthdayPersonName) {
      rows.push(["Birthday Person", form.birthdayPersonName + (form.birthdayPersonAge ? `, Age ${form.birthdayPersonAge}` : "")]);
    }
    return (
      <ModalTransition open={showPreview} onClose={() => setShowPreview(false)} overlayClassName="rf-modal-overlay" panelClassName="rf-modal">
        <div className="rf-modal-title">Confirm Celebration Booking</div>
        <div className="rf-modal-subtitle">Review your details before confirming.</div>
        <div className="rf-modal-grid">
          {rows.map(([k, v]) => (
            <div key={k} className="rf-modal-row">
              <span className="rf-modal-key">{k}</span>
              <span className="rf-modal-val">{v}</span>
            </div>
          ))}
        </div>
        {form.specialNote && (
          <div className="rf-modal-notes">
            <span className="rf-modal-key">Special Notes</span>
            <span>{form.specialNote}</span>
          </div>
        )}
        {estimatedTotal > 0 && (
          <div className="rf-modal-total-row">
            <span className="rf-modal-total-label">Estimated Total</span>
            <span className="rf-modal-total-val">₹{estimatedTotal.toLocaleString()}</span>
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

  /* ─── Success Screen ─── */
  if (submitted) {
    const typeObj = CELEBRATION_TYPES.find(t => t.value === form.type);
    return (
      <div className="no-padding">
        <PageHeader title="Celebration" onBack={handleBack} onHome={handleHome} />
        <div className="pl-body">
          <div className="rf-success-screen">
            <div className="rf-success-icon">
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
                <circle cx="36" cy="36" r="36" fill="#d1fae5" />
                <path d="M22 36 L32 46 L50 28" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="rf-success-title">Celebration Booked!</h2>
            <p className="rf-success-sub">We look forward to making it special for you.</p>
            <div className="rf-booking-id">
              <span className="rf-booking-label">Booking ID</span>
              <span className="rf-booking-code">#{bookingId}</span>
            </div>
            <div className="rf-success-card">
              {[
                ["Guest", form.name],
                ["Type", typeObj?.label],
                ["Date", fmtDate(form.date)],
                ["Time", form.time ? (() => { const [h, m] = form.time.split(":").map(Number); return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`; })() : ""],
                ["Guests", form.guests],
                ["Decoration", form.decoration ? DECORATION_TIERS.find(t => t.value === form.decoration)?.label : "None"],
                ["Estimated Total", `₹${estimatedTotal.toLocaleString()}`],
              ].map(([k, v]) => (
                <div key={k} className="rf-sc-row">
                  <span className="rf-sc-label">{k}</span>
                  <span className="rf-sc-val">{v}</span>
                </div>
              ))}
            </div>
            <Button3D className="btn-3d red" onClick={resetForm}>
              Book Another
            </Button3D>

            <Button3D className="btn-3d red" onClick={handleHome}>
              Back to Home
            </Button3D>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="no-padding">
      <PreviewModal />
      <PageHeader title="Celebration" onBack={handleBack} onHome={handleHome} />

      <div className="pl-body">
        <div className="clp-container">
          {/* ── LEFT COLUMN ── */}
          <div className="clp-section">

            {/* Event Type — Get Together removed */}
            <div className="clp-block">
              <div className="section-title">Event Type</div>
              <div className="clp-type-grid">
                {CELEBRATION_TYPES.map(t => (
                  <button key={t.value} type="button"
                    className={`clp-type-card${form.type === t.value ? " active" : ""}`}
                    onClick={() => setType(t.value)}>
                    <span className="clp-type-label">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Guest Details */}
            <div className="clp-block">
              <div className="section-title">Your Details</div>
              <div className="clp-card">
                {/* Full Name */}
                <div className={`field-group${flashField === "name" ? " rf-error-flash" : ""}`} ref={fieldRefs.name}>
                  <MatField
                    label={<>Full Name <span className="rf-req">*</span></>}
                    value={form.name}
                    onChange={e => set("name", toTitleCase(allowTextInput(form.name, e.target.value, 100, 5)))}
                    autoComplete="name"
                    error={errors.name}
                    wrapperClassName=""
                  />
                </div>

                <div className="mat-row">
                  {/* Mobile */}
                  <div className={`field-group${flashField === "mobile" ? " rf-error-flash" : ""}`} style={{ flex: 1.4 }} ref={fieldRefs.mobile}>
                    <div className="mat-input-prefix-wrap">
                      <span className={`mat-prefix${errors.mobile ? " error" : ""}`}>+91</span>
                      <MatField
                        label={<>Mobile <span className="rf-req">*</span></>}
                        type="tel"
                        value={form.mobile}
                        onChange={e => set("mobile", sanitizePhoneInput(e.target.value))}
                        autoComplete="tel"
                        error={errors.mobile}
                        wrapperClassName=""
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="field-group" style={{ flex: 1 }}>
                    <MatField
                      label={<>Email <span className="rf-optional">(optional)</span></>}
                      type="email"
                      value={form.email}
                      onChange={e => set("email", e.target.value)}
                      autoComplete="email"
                      error={errors.email}
                      wrapperClassName=""
                    />
                  </div>
                </div>

                {/* Date → Slot → Time (each field appears once the
                  previous one is picked) */}
                <div className={`field-group${flashField === "date" ? " rf-error-flash" : ""}`} style={{ flex: "0 0 auto" }} ref={fieldRefs.date}>
                  <label>Date <span className="rf-req">*</span></label>
                  <UserDatePicker
                    value={form.date}
                    min={tomorrowStr()}
                    hasError={!!errors.date}
                    onChange={handleDateChange}
                  />
                  {errors.date && <span className="rf-error">{errors.date}</span>}
                </div>

                {form.date && (
                  <div className={`field-group rf-field-reveal${flashField === "slotGroup" ? " rf-error-flash" : ""}`} ref={fieldRefs.slotGroup}>
                    <label>Dining Slot <span className="rf-req">*</span></label>
                    <div className="slot-groups">
                      {SLOT_GROUPS.map(sg => {
                        const nowH = new Date().getHours();
                        const slotEndH = parseInt(sg.end.split(":")[0]);
                        const isPastSlot = isToday && nowH >= slotEndH;
                        return (
                          <div key={sg.key}
                            className={`slot-group${form.slotGroup === sg.key ? " active" : ""}${isPastSlot ? " slot-group-disabled" : ""}`}
                            onClick={() => !isPastSlot && handleSlotChange(sg.key)}>
                            <span className="slot-group-label">{sg.label}</span>
                            <span className="slot-group-time">{fmtTime(sg.start)} – {fmtTime(sg.end)}</span>
                            {isPastSlot && <span className="slot-group-passed-badge">Passed</span>}
                          </div>
                        );
                      })}
                    </div>
                    {errors.slotGroup && <span className="rf-error">{errors.slotGroup}</span>}
                  </div>
                )}

                {form.slotGroup && (
                  <div className={`field-group rf-field-reveal${flashField === "time" ? " rf-error-flash" : ""}`} style={{ flex: "0 0 auto" }} ref={fieldRefs.time}>
                    <label>Preferred Time <span className="rf-req">*</span></label>
                    <UserTimePicker
                      value={form.time}
                      hasError={!!errors.time}
                      onChange={v => set("time", v)}
                      slotStart={currentSlot?.start}
                      slotEnd={currentSlot?.end}
                      disabled={!form.slotGroup}
                      isToday={isToday}
                    />
                    {currentSlot && <span style={{ fontSize: 11, color: "#888", marginTop: 4, display: "block" }}>{currentSlot.start} – {currentSlot.end}</span>}
                  </div>
                )}

                {/* Guests — max 20 */}
                <div className={`field-group${flashField === "guests" ? " rf-error-flash" : ""}`} ref={fieldRefs.guests}>
                  <label>Number of Guests <span className="rf-req">*</span></label>
                  <div className="stepper-ctrl">
                    <button type="button" className="stepper-btn" onClick={() => setGuests(form.guests - 1)}>−</button>
                    <span className="stepper-val">{form.guests}</span>
                    <button type="button" className="stepper-btn" onClick={() => setGuests(form.guests + 1)}>+</button>
                  </div>
                  {form.guests >= 20 && (
                    <div className="clp-guest-limit-msg">
                      ⚠️ Maximum 20 guests for celebration.{" "}
                      <span>For larger groups,{" "}
                        <button type="button" className="clp-catering-link" onClick={navigateToCatering}>
                          use our Catering service →
                        </button>
                      </span>
                    </div>
                  )}
                  {errors.guests && <span className="rf-error">{errors.guests}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="clp-section">

            {/* Birthday Details */}
            {form.type === "birthday" && (
              <div className="clp-block">
                <div className="section-title">Birthday Details</div>
                <div className="clp-card">
                  <div className="mat-row">
                    <div className={`field-group${flashField === "birthdayPersonName" ? " rf-error-flash" : ""}`} style={{ flex: 1.5 }} ref={fieldRefs.birthdayPersonName}>
                      <MatField
                        label={<>Birthday Person's Name <span className="rf-req">*</span></>}
                        value={form.birthdayPersonName}
                        onChange={e => set("birthdayPersonName", toTitleCase(allowTextInput(form.birthdayPersonName, e.target.value, 100, 5)))}
                        error={errors.birthdayPersonName}
                        wrapperClassName=""
                      />
                    </div>
                    <div className="field-group" style={{ flex: 1 }}>
                      <MatField
                        label={<>Age <span className="rf-optional">(optional)</span></>}
                        type="number"
                        min="1"
                        max="120"
                        value={form.birthdayPersonAge}
                        onChange={e => set("birthdayPersonAge", e.target.value)}
                        wrapperClassName=""
                      />
                    </div>
                  </div>
                  <div className="section-title" style={{ marginBottom: 8 }}>Add-ons</div>
                  <div className="clp-check-grid">{renderExtrasWithMention(BIRTHDAY_EXTRAS)}</div>
                </div>
              </div>
            )}

            {/* Meeting Setup */}
            {form.type === "meeting" && (
              <div className="clp-block">
                <div className="section-title">Meeting Setup</div>
                <div className="clp-card">
                  <div className="clp-sub-title">Table Decoration</div>
                  <div className="clp-check-grid">
                    {MEETING_SEATING.map(ex => <CheckCard key={ex.key} label={ex.label} price={ex.price} checked={form[ex.key]} onChange={v => set(ex.key, v)} />)}
                  </div>
                  <div className="clp-sub-title" style={{ marginTop: 10 }}>Audio / Video</div>
                  <div className="clp-check-grid">
                    {MEETING_AV.map(ex => <CheckCard key={ex.key} label={ex.label} price={ex.price} checked={form[ex.key]} onChange={v => set(ex.key, v)} />)}
                  </div>
                </div>
              </div>
            )}

            {/* Anniversary Extras */}
            {form.type === "anniversary" && (
              <div className="clp-block">
                <div className="section-title ">Anniversary Extras</div>
                <div className="clp-card">
                  <div className="clp-check-grid">{renderExtrasWithMention(ANNIVERSARY_EXTRAS)}</div>
                </div>
              </div>
            )}

            {/* Candle Light Dinner Extras */}
            {form.type === "candlelightdinner" && (
              <div className="clp-block">
                <div className="section-title ">Candle Light Dinner Add-ons</div>
                <div className="clp-card">
                  <div className="clp-check-grid">{renderExtrasWithMention(CANDLELIGHT_EXTRAS)}</div>
                </div>
              </div>
            )}

            {/* Decoration — Luxury only for Candle Light Dinner */}
            <div className="clp-block">
              <div className="section-title">Decoration</div>
              <DecorationPicker value={form.decoration} onChange={v => set("decoration", v)} allowLuxury={isCandleLight} />
            </div>

            {/* Audio & Video (skip if meeting — already there) */}
            {form.type !== "meeting" && (
              <div className="clp-block">
                <div className="section-title ">Audio &amp; Video</div>
                <div className="clp-card">
                  <div className="clp-check-grid">
                    <CheckCard label="Microphone" price={500} checked={form.mic} onChange={v => set("mic", v)} />
                    <CheckCard label="Projector" price={800} checked={form.projector} onChange={v => set("projector", v)} />
                  </div>
                  {(form.mic || form.projector) && (
                    <div className="clp-av-price">Audio & Video Setup — ₹{AV_PRICE.toLocaleString()}</div>
                  )}
                </div>
              </div>
            )}

            {/* Special Note */}
            <div className="clp-block">
              <div className="section-title ">Special Notes</div>
              <div className="clp-card">
                <div className="field-group">
                  <textarea
                    id="clp-note"
                    className="rf-textarea"
                    placeholder=" "
                    value={form.specialNote}
                    onChange={e => set("specialNote", allowTextInput(form.specialNote, e.target.value, 500, 100000))}
                    rows={3}
                    maxLength={500}
                  />
                </div>
              </div>
            </div>

            {/* Price Summary */}
            {estimatedTotal > 0 && (
              <div className="clp-block clp-price-summary">
                <div className="section-title ">Estimated Cost</div>
                <div className="clp-card">
                  {form.decoration && (
                    <div className="clp-price-row">
                      <span>Decoration ({DECORATION_TIERS.find(t => t.value === form.decoration)?.label})</span>
                      <span>₹{DECORATION_TIERS.find(t => t.value === form.decoration)?.price.toLocaleString()}</span>
                    </div>
                  )}
                  {Object.keys(EXTRA_PRICES).filter(k => form[k] && EXTRA_PRICES[k] > 0).map(k => (
                    <div key={k} className="clp-price-row">
                      <span style={{ textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</span>
                      <span>₹{EXTRA_PRICES[k]}</span>
                    </div>
                  ))}
                  {form.type !== "meeting" && (form.mic || form.projector) && (
                    <div className="clp-price-row">
                      <span>A/V Setup</span>
                      <span>₹{AV_PRICE}</span>
                    </div>
                  )}
                  <div className="clp-price-row clp-price-total">
                    <span>Estimated Total</span>
                    <strong>₹{estimatedTotal.toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            )}

            {(() => {
              const btnRow = (
                <div className="form-btn-row">
                  <Button3D
                    className="btn-3d white"
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setForm({
                        type: "birthday",
                        name: "", mobile: "", email: "",
                        date: "", time: "", slotGroup: "",
                        guests: 2,
                        birthdayPersonName: "", birthdayPersonAge: "",
                        cake: false,
                        specialMention: false, specialMentionText: "",
                        standingBrochures: false, placeHolders: false, pens: false,
                        mic: false, projector: false,
                        candleLight: false, liveMusic: false, surpriseGift: false,
                        decoration: null,
                        audioVideo: false,
                        specialNote: "",
                      });
                      setErrors({});
                      handleBack();
                    }}
                  >
                    Cancel
                  </Button3D>

                  <Button3D className={`btn-3d red${loading ? " loading" : ""}`} onClick={handleReview} disabled={loading}>
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

          </div>
        </div>
      </div>
    </div>
  );
};

export default CelebrationForm;
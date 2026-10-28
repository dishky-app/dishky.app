//user panel
import { useState, useEffect, useRef } from "react";
import { bookingCrud } from "./shared/eventBookingCrud";
import { UserDatePicker, todayStr } from "../components/UserDatePicker";
import { UserTimePicker } from "../components/UserTimePicker";
import "./ReservationForm.css";
import "./PreviewModal.css";
import { useToast } from "../components/Usetoast";
import Button3D from "./shared/Button3D";
import MatField from "./shared/MatField";
import PageHeader from "./shared/PageHeader";
import ModalTransition from "./shared/ModalTransition";
import "./shared/ModalTransition.css";
import { createPortal } from "react-dom";
import { useIsBelowWidth } from "./shared/useIsBelowWidth";
import { handleImgFallback } from "../App";
import { toTitleCase } from "../utils/nameCase";

const pad = (n) => String(n).padStart(2, "0");

const SLOT_GROUPS = [
  { label: "Breakfast", key: "BF", start: "07:00", end: "10:00" },
  { label: "Brunch", key: "BR", start: "10:00", end: "12:00" },
  { label: "Lunch", key: "LU", start: "12:00", end: "15:00" },
  { label: "Hi-Tea", key: "HT", start: "15:00", end: "18:00" },
  { label: "Dinner", key: "DI", start: "18:30", end: "22:00" },
];

/* ─── Default SVG visuals keyed by label ─── */
const DEFAULT_PREF_SVGS = {
  Window: (
    <svg viewBox="0 0 60 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="56" height="40" rx="3" fill="#bfdbfe" stroke="#60a5fa" strokeWidth="1.5" />
      <line x1="30" y1="2" x2="30" y2="42" stroke="#60a5fa" strokeWidth="1.5" />
      <line x1="2" y1="22" x2="58" y2="22" stroke="#60a5fa" strokeWidth="1.5" />
      <rect x="10" y="28" width="16" height="10" rx="2" fill="#93c5fd" opacity=".6" />
      <rect x="34" y="28" width="16" height="10" rx="2" fill="#93c5fd" opacity=".6" />
      <path d="M8 6 L14 14 M18 6 L24 14" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  Booth: (
    <svg viewBox="0 0 60 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="52" height="36" rx="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" />
      <rect x="4" y="4" width="12" height="36" rx="4" fill="#fbbf24" />
      <rect x="44" y="4" width="12" height="36" rx="4" fill="#fbbf24" />
      <rect x="16" y="16" width="28" height="12" rx="3" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.2" />
      <circle cx="30" cy="22" r="4" fill="#fcd34d" />
    </svg>
  ),
  Hitter: (
    <svg viewBox="0 0 60 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="6" width="28" height="6" rx="2" fill="#6b7280" stroke="#4b5563" strokeWidth="1.2" />
      <line x1="30" y1="12" x2="30" y2="38" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round" />
      <circle cx="14" cy="18" r="5" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.2" />
      <line x1="14" y1="23" x2="14" y2="38" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
      <circle cx="46" cy="18" r="5" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.2" />
      <line x1="46" y1="23" x2="46" y2="38" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Any: (
    <svg viewBox="0 0 60 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="14" width="40" height="22" rx="4" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1.5" />
      <rect x="18" y="8" width="6" height="10" rx="2" fill="#9ca3af" />
      <rect x="36" y="8" width="6" height="10" rx="2" fill="#9ca3af" />
      <rect x="18" y="32" width="6" height="10" rx="2" fill="#9ca3af" />
      <rect x="36" y="32" width="6" height="10" rx="2" fill="#9ca3af" />
      <circle cx="30" cy="25" r="5" fill="#d1d5db" />
      <text x="30" y="29" textAnchor="middle" fontSize="8" fill="#9ca3af" fontWeight="700">ANY</text>
    </svg>
  ),
};

const FALLBACK_TABLE_PREFS = [
  { label: "Any", desc: "No preference" },
  { label: "Window", desc: "Natural light, street view" },
  { label: "Booth", desc: "Cozy enclosed seating" },
  { label: "Hitter", desc: "High-top bar seating" },
];

/* ─── Main Form Component ─── */
const ReservationForm = ({ handleBack, handleHome, foodData }) => {
  const { toast } = useToast();
  const isFixedBtnRow = useIsBelowWidth(600);
  const [form, setForm] = useState({
    name: "", mobile: "", email: "", guests: 2,
    slotGroup: "", time: "", date: todayStr(),
    tablePref: "Any", notes: "", status: "pending",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [errors, setErrors] = useState({});
  const [showCrossCheck, setShowCrossCheck] = useState(false);
  const [flashField, setFlashField] = useState(""); // briefly highlights the field scrolled to on validation failure

  /* One ref per field the submit validation can flag, so a failed
     submit can scroll straight to the first invalid one instead of
     leaving the person to hunt for the red error text themselves. */
  const fieldRefs = {
    name: useRef(null),
    mobile: useRef(null),
    email: useRef(null),
    guests: useRef(null),
    date: useRef(null),
    slotGroup: useRef(null),
  };

  /* ── Dynamic table preferences from /tablePreferences ── */
  const [tablePrefs, setTablePrefs] = useState(FALLBACK_TABLE_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadPrefs = async () => {
      try {
        const records = await bookingCrud.getAll("tablePreferences");
        if (!cancelled && records.length > 0) {
          const sorted = [...records].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
          setTablePrefs(sorted.map(r => ({
            label: r.label,
            desc: r.desc || "",
            image: r.image || null,
            svg: r.image
              ? <img src={r.image} alt={r.label} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }}  onError={handleImgFallback} />
              : DEFAULT_PREF_SVGS[r.label] || <span style={{ fontSize: 24 }}>🪑</span>,
          })));
        }
      } catch {
        setTablePrefs(FALLBACK_TABLE_PREFS.map(p => ({
          ...p,
          svg: DEFAULT_PREF_SVGS[p.label] || <span style={{ fontSize: 24 }}>🪑</span>,
        })));
      } finally {
        if (!cancelled) setPrefsLoaded(true);
      }
    };
    loadPrefs();
    return () => { cancelled = true; };
  }, []);

  /* Pre-fill user */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { name, mobile, email } = await bookingCrud.resolveUser();
        if (!cancelled) setForm(p => ({ ...p, name, mobile, email }));
      } catch { }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const set = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(e => ({ ...e, [key]: "" }));
  };

  const fmtTime = (t) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
  };

  const currentSlot = SLOT_GROUPS.find(s => s.key === form.slotGroup);
  const isToday = form.date === todayStr();

  const handleSlotChange = (key) => { set("slotGroup", key); set("time", ""); };
  const handleDateChange = (d) => { set("date", d); set("slotGroup", ""); set("time", ""); };

  const validate = () => {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Enter a valid name";
    const cleanMobile = form.mobile.replace(/\D/g, "");
    if (!cleanMobile || cleanMobile.length !== 10) e.mobile = "Enter a valid 10-digit number";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Invalid email";
    if (!form.guests || Number(form.guests) < 1) e.guests = "At least 1 guest required";
    if (!form.date) e.date = "Pick a date";
    else if (form.date < todayStr()) e.date = "Date cannot be in the past";
    if (!form.slotGroup) e.slotGroup = "Pick a dining slot";
    setErrors(e);

    // Scroll to and briefly flash the first invalid field, in form
    // order, so the person lands right on what needs fixing instead
    // of having to scan the whole form for red text.
    const firstErrorKey = ["name", "mobile", "email", "guests", "date", "slotGroup"].find(k => e[k]);
    if (firstErrorKey) {
      const node = fieldRefs[firstErrorKey]?.current;
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        setFlashField(firstErrorKey);
        setTimeout(() => setFlashField(""), 1100);
      }
    }

    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const saved = await bookingCrud.create("reservations", form);
      setBookingId(bookingCrud.makeRef(saved.id));
      setSubmitted(true);
    } catch {
      toast.error("Failed to reserve table. Please try again.");
    } finally {
      setSubmitting(false);
      setShowCrossCheck(false);
    }
  };

  /* ── Success Screen ── */
  if (submitted) {
    const slot = SLOT_GROUPS.find(s => s.key === form.slotGroup);
    return (
      <div className="no-padding">
        <PageHeader
          title={
            <span className="rf-header-title-block">
              <span className="rf-page-title">Table Reservation</span>
              <span className="rf-page-sub">Reserve your perfect dining experience</span>
            </span>
          }
          titleTag="span"
          onBack={handleBack}
          onHome={handleHome}
        />
        <div className="pl-body">
          <div className="rf-success-screen">
            <div className="rf-success-icon">
              <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                <circle cx="30" cy="30" r="30" fill="#d1fae5" />
                <path d="M18 30 L26 38 L42 22" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="rf-success-title">Reservation Confirmed!</h2>
            <p className="rf-success-sub">Your table is reserved. We look forward to hosting you.</p>
            <div className="rf-booking-id">
              <span className="rf-booking-label">Booking ID</span>
              <span className="rf-booking-code">#{bookingId}</span>
            </div>
            <div className="rf-success-card">
              <div className="rf-sc-row"><span className="rf-sc-label">Guest</span><span className="rf-sc-val">{form.name}</span></div>
              <div className="rf-sc-row"><span className="rf-sc-label">Date</span><span className="rf-sc-val">{form.date}</span></div>
              <div className="rf-sc-row"><span className="rf-sc-label">Slot</span><span className="rf-sc-val">{slot?.label}</span></div>
              {form.time && <div className="rf-sc-row"><span className="rf-sc-label">Time</span><span className="rf-sc-val">{fmtTime(form.time)}</span></div>}
              <div className="rf-sc-row"><span className="rf-sc-label">Guests</span><span className="rf-sc-val">{form.guests}</span></div>
              <div className="rf-sc-row"><span className="rf-sc-label">Seating</span><span className="rf-sc-val">{form.tablePref}</span></div>
              {form.notes && <div className="rf-sc-row rf-sc-notes"><span className="rf-sc-label">Notes</span><span className="rf-sc-val">{form.notes}</span></div>}
            </div>
            <p className="rf-success-policy">Please arrive 10 min early. Reservation held for 15 min.</p>
            <Button3D className="btn-3d red" onClick={() => {
              setSubmitted(false);
              setForm({ name: "", mobile: "", email: "", guests: 2, slotGroup: "", time: "", date: todayStr(), tablePref: "Any", notes: "", status: "pending" });
            }}>
              Make Another Reservation
            </Button3D>

            <Button3D className="btn-3d red" onClick={handleHome}>
              Back to Home
            </Button3D>
          </div>
        </div>
      </div>
    );
  }

  /* ── Cross-check Modal — animation handled entirely by
     ModalTransition (shared/ModalTransition.js), so no local
     closing-state/timeout bookkeeping is needed here anymore. ── */
  const CrossCheckModal = () => (
    <ModalTransition open={showCrossCheck} onClose={() => setShowCrossCheck(false)} overlayClassName="rf-modal-overlay" panelClassName="rf-modal">
      <div className="rf-modal-title">Confirm Your Booking</div>
      <div className="rf-modal-grid">
        {[
          ["Name", form.name],
          ["Mobile", "+91 " + form.mobile],
          ["Email", form.email || "—"],
          ["Guests", form.guests],
          ["Date", form.date],
          ["Time", form.time ? fmtTime(form.time) : "Not specified"],
          ["Slot", SLOT_GROUPS.find(s => s.key === form.slotGroup)?.label || "—"],
          ["Seating", form.tablePref],
        ].map(([k, v]) => (
          <div key={k} className="rf-modal-row">
            <span className="rf-modal-key">{k}</span>
            <span className="rf-modal-val">{v}</span>
          </div>
        ))}
      </div>
      {form.notes && <div className="rf-modal-notes"><span className="rf-modal-key">Notes</span><span>{form.notes}</span></div>}
      <div className="rf-modal-actions">
        <Button3D className="btn-3d white" onClick={() => setShowCrossCheck(false)}>
          Edit
        </Button3D>
        <Button3D className="btn-3d red" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <span className="rf-spinner" /> : "Confirm"}
        </Button3D>
      </div>
    </ModalTransition>
  );

  return (
    <div className="no-padding rf-fixed-page">
      <CrossCheckModal />

      <PageHeader
        title={
          <span className="rf-header-title-block">
            <span className="rf-page-title">Table Reservation</span>
            <span className="rf-page-sub">Reserve your perfect dining experience</span>
          </span>
        }
        titleTag="span"
        onBack={handleBack}
        onHome={handleHome}
      />

      <div className="pl-body">
        <div className="rf-single-form">
          <div className="rf-form-grid">

            {/* LEFT COLUMN */}
            <div className="rf-col rf-col-left">

              {/* Guest Details */}
              <div className="rf-section rf-section--guest">
                <div className="section-title">Guest Details</div>

                {/* Full Name */}
                <div className={`field-group${flashField === "name" ? " rf-error-flash" : ""}`} ref={fieldRefs.name}>
                  <MatField
                    label={<>Full Name <span className="rf-req">*</span></>}
                    value={form.name}
                    onChange={e => set("name", toTitleCase(e.target.value))}
                    autoComplete="name"
                    error={errors.name}
                    wrapperClassName=""
                  />
                </div>

                <div className="mat-row">
                  {/* Mobile */}
                  <div className={`field-group${flashField === "mobile" ? " rf-error-flash" : ""}`} style={{ flex: 1.4 }} ref={fieldRefs.mobile}>

                    <div className={"mat-input-prefix-wrap"}>
                      <MatField
                        label={<>Mobile <span className="rf-req">*</span></>}
                        type="tel"
                        value={form.mobile}
                        onChange={e => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
                        autoComplete="tel"
                        error={errors.mobile}
                        wrapperClassName=""
                      />

                    </div>
                  </div>

                  {/* Email */}
                  <div className={`field-group${flashField === "email" ? " rf-error-flash" : ""}`} style={{ flex: 1 }} ref={fieldRefs.email}>
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

                <div className={`field-group${flashField === "guests" ? " rf-error-flash" : ""}`} style={{ flex: "0 0 auto" }} ref={fieldRefs.guests}>
                  <label>Guests <span className="rf-req">*</span></label>
                  <div className="stepper-ctrl">
                    <button type="button" className="stepper-btn" onClick={() => set("guests", Math.max(1, form.guests - 1))}>−</button>
                    <span className="stepper-val">{form.guests}</span>
                    <button type="button" className="stepper-btn" onClick={() => set("guests", Math.min(30, form.guests + 1))}>+</button>
                  </div>
                  {errors.guests && <span className="rf-error">{errors.guests}</span>}
                </div>
              </div>

              {/* Seating Preference */}
              <div className="rf-section rf-section--seating">
                <div className="section-title">Seating Preference</div>
                {!prefsLoaded && (
                  <div style={{ padding: "12px 0", color: "#aaa", fontSize: 13 }}>Loading options</div>
                )}
                <div className="rf-table-pref-grid">
                  {tablePrefs.map(p => (
                    <button type="button" key={p.label}
                      className={`rf-table-pref-card${form.tablePref === p.label ? " active" : ""}`}
                      onClick={() => set("tablePref", p.label)}>
                      <div className="rf-tpref-visual">{p.svg}</div>
                      <div className="rf-tpref-label">{p.label}</div>
                      <div className="rf-tpref-desc">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="rf-col rf-col-right">
              <div className="rf-section rf-section--datetime">
                <div className="section-title">Date &amp; Dining Slot</div>

                {/* Date — first step of the cascade */}
                <div className={`field-group${flashField === "date" ? " rf-error-flash" : ""}`} style={{ flex: "0 0 auto" }} ref={fieldRefs.date}>
                  <label>Date <span className="rf-req">*</span></label>
                  <UserDatePicker
                    value={form.date}
                    min={todayStr()}
                    hasError={!!errors.date}
                    onChange={handleDateChange}
                  />
                  {errors.date && <span className="rf-error">{errors.date}</span>}
                </div>

                {/* Dining Slot — appears once a date is picked */}
                {form.date && (
                  <div className={`field-group rf-field-reveal${flashField === "slotGroup" ? " rf-error-flash" : ""}`} ref={fieldRefs.slotGroup}>
                    <label>Dining Slot <span className="rf-req">*</span></label>
                    <div className="rf-slot-groups">
                      {SLOT_GROUPS.map(sg => {
                        const nowH = new Date().getHours();
                        const slotEndH = parseInt(sg.end.split(":")[0]);
                        const isPastSlot = isToday && nowH >= slotEndH;
                        return (
                          <div key={sg.key}
                            className={`rf-slot-group${form.slotGroup === sg.key ? " active" : ""}${isPastSlot ? " rf-slot-disabled" : ""}`}
                            onClick={() => !isPastSlot && handleSlotChange(sg.key)}>
                            <span className="rf-sg-label">{sg.label}</span>
                            <span className="rf-sg-time">{sg.start} – {sg.end}</span>
                            {isPastSlot && <span className="rf-slot-past-badge">Passed</span>}
                          </div>
                        );
                      })}
                    </div>
                    {errors.slotGroup && <span className="rf-error">{errors.slotGroup}</span>}
                  </div>
                )}

                {/* Preferred Time (optional) — appears once a slot is picked */}
                {form.slotGroup && (
                  <div className="field-group rf-field-reveal" style={{ flex: "0 0 auto" }}>
                    <label>Preferred Time <span className="rf-optional">(optional)</span></label>
                    <UserTimePicker
                      value={form.time}
                      onChange={v => set("time", v)}
                      slotStart={currentSlot?.start}
                      slotEnd={currentSlot?.end}
                      disabled={!form.slotGroup}
                      isToday={isToday}
                      hasError={!!errors.time}
                    />
                    {currentSlot && <span style={{ fontSize: 11, color: "#888", marginTop: 4, display: "block" }}>{currentSlot.start} – {currentSlot.end}</span>}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="rf-section rf-section--notes">
                <div className="section-title">Special Requests</div>
                <div className="field-group">
                  <textarea
                    className="rf-textarea"
                    rows={3}
                    placeholder=" "
                    value={form.notes}
                    onChange={e => set("notes", e.target.value)}
                    maxLength={300}
                  />
                </div>
              </div>

              {(() => {
                const btnRow = (
                  <div className="form-btn-row">
                    <Button3D type="button" className="btn-3d white" onClick={() => {
                      setForm({ name: "", mobile: "", email: "", guests: 2, slotGroup: "", time: "", date: todayStr(), tablePref: "Any", notes: "", status: "pending" });
                      setErrors({});
                      handleBack();
                    }}>
                      Cancel
                    </Button3D>
                    <Button3D type="button" className="btn-3d red" onClick={() => { if (validate()) setShowCrossCheck(true); }}>
                      Review & Confirm
                    </Button3D>

                  </div>
                );

                // Below 600px .form-btn-row becomes position: fixed (see
                // ReservationForm.css). At that width it must not live
                // inside the route's animated .page-transition-wrapper:
                // Framer Motion applies a CSS transform to that wrapper
                // while a page transition plays, and a transformed
                // ancestor becomes the containing block for any
                // fixed-position descendant — so .form-btn-row would
                // suddenly be "fixed" relative to the sliding wrapper
                // instead of the viewport, jumping/glitching on every
                // page enter and exit. Portalling it straight to
                // document.body keeps it anchored to the viewport
                // regardless of what the route transition is doing.
                // Above 600px it's a normal in-flow flex child, so it
                // renders inline as before.
                return isFixedBtnRow ? createPortal(btnRow, document.body) : btnRow;
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationForm;
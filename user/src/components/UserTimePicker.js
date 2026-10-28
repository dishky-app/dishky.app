// UserTimePicker.js — shared user-panel clock time picker
// Import once, reuse across CateringForm, CelebrationForm, PreBooking, ReservationForm
//
// Props:
//   value       – "HH:MM" 24-h string or ""
//   onChange    – (value: string) => void
//   slotStart   – optional "HH:MM" – hours before this are disabled
//   slotEnd     – optional "HH:MM" – hours from this onward are disabled
//   disabled    – boolean
//   isToday     – boolean – disables past hours/minutes vs current wall clock
//   hasError    – boolean – shows red border on trigger
//   placeholder – string shown when no time is selected

import React, { useState, useEffect, useRef } from "react";
import "./UserTimePicker.css";
import Button3D from "../pages/shared/Button3D";
import ModalTransition from "../pages/shared/ModalTransition";
import "../pages/shared/ModalTransition.css";

// ── Helpers ───────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");

const parseTime = (v) => {
  if (!v) return { h: 12, m: 0, ampm: "PM" };
  const [hh, mm] = v.split(":").map(Number);
  return { h: hh % 12 || 12, m: mm, ampm: hh >= 12 ? "PM" : "AM" };
};

const to24 = (h, m, ampm) => {
  const hh = ampm === "PM" ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
  return `${pad(hh)}:${pad(m)}`;
};

// ── Clock geometry ────────────────────────────────────
const CLOCK_R = 100;
const CENTER = 110;
const HOUR_R = 78;
const MIN_R = 78;

const hours12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const minutes5 = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const hourAngle = (h) => ((h % 12) / 12) * 360 - 90;
const minAngle = (m) => (m / 60) * 360 - 90;
const toXY = (angle, r) => ({
  x: CENTER + r * Math.cos((angle * Math.PI) / 180),
  y: CENTER + r * Math.sin((angle * Math.PI) / 180),
});

const CLOCK_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// ── Component ─────────────────────────────────────────
export const UserTimePicker = ({
  value,
  onChange,
  slotStart,
  slotEnd,
  disabled = false,
  isToday = false,
  hasError = false,
  placeholder,
}) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("hour");
  const ref = useRef(null);
  const svgRef = useRef(null);

  const selRef = useRef(parseTime(value));
  const [sel, setSel] = useState(parseTime(value));
  const lastEmitted = useRef(value);
  const isDragging = useRef(false);
  const modeRef = useRef(mode);

  // Sync external value
  useEffect(() => {
    if (value && value !== lastEmitted.current) {
      const p = parseTime(value);
      selRef.current = p;
      setSel(p);
    }
  }, [value]);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  const requestClose = () => {
    setOpen(false);
    setMode("hour");
    modeRef.current = "hour";
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) requestClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Slot / today constraint helpers ──────────────
  const slotH24Start = slotStart ? parseInt(slotStart.split(":")[0], 10) : null;
  const slotH24End = slotEnd ? parseInt(slotEnd.split(":")[0], 10) : null;
  const nowH = new Date().getHours();
  const nowM = new Date().getMinutes();

  const isHourDis = (h, ampm) => {
    const h24 = ampm === "PM" ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
    if (slotH24Start !== null && slotH24End !== null) {
      if (h24 < slotH24Start || h24 >= slotH24End) return true;
    }
    if (isToday && h24 < nowH) return true;
    return false;
  };

  const isMinDis = (m) => {
    if (!isToday) return false;
    const cur = selRef.current;
    const h24 = cur.ampm === "PM" ? (cur.h === 12 ? 12 : cur.h + 12) : (cur.h === 12 ? 0 : cur.h);
    return h24 === nowH && m <= nowM;
  };

  // ── Emit ─────────────────────────────────────────
  const emit = (ns) => {
    const v = to24(ns.h, ns.m, ns.ampm);
    lastEmitted.current = v;
    onChange(v);
  };

  // ── SVG pointer drag ─────────────────────────────
  const valueFromEvent = (e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const src = e.touches?.[0] ?? e.changedTouches?.[0] ?? e;
    const x = src.clientX - rect.left - CENTER;
    const y = src.clientY - rect.top - CENTER;
    const norm = ((Math.atan2(y, x) * 180 / Math.PI + 90) % 360 + 360) % 360;

    if (modeRef.current === "hour") {
      const h = Math.round(norm / 30) % 12 || 12;
      return isHourDis(h, selRef.current.ampm) ? null : { kind: "hour", h };
    } else {
      const snapped = Math.round(Math.round(norm / 6) / 5) * 5 % 60;
      return { kind: "min", m: snapped };
    }
  };

  const applyVal = (v) => {
    if (!v) return;
    if (v.kind === "hour") {
      const ns = { ...selRef.current, h: v.h };
      selRef.current = ns; setSel({ ...ns }); emit(ns);
    } else {
      if (isMinDis(v.m)) return;
      const ns = { ...selRef.current, m: v.m };
      selRef.current = ns; setSel({ ...ns }); emit(ns);
    }
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    isDragging.current = true;
    svgRef.current?.setPointerCapture?.(e.pointerId);
    applyVal(valueFromEvent(e));
  };
  const onPointerMove = (e) => { if (!isDragging.current) return; applyVal(valueFromEvent(e)); };
  const onPointerUp = (e) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    applyVal(valueFromEvent(e));
    if (modeRef.current === "hour") { modeRef.current = "minute"; setMode("minute"); }
    else { requestClose(); }
  };

  // ── Tap handlers ─────────────────────────────────
  const tapHour = (h) => {
    if (isHourDis(h, selRef.current.ampm)) return;
    const ns = { ...selRef.current, h };
    selRef.current = ns; setSel({ ...ns }); emit(ns);
    setMode("minute");
  };
  const tapMinute = (m) => {
    if (isMinDis(m)) return;
    const ns = { ...selRef.current, m };
    selRef.current = ns; setSel({ ...ns }); emit(ns);
    requestClose();
  };
  const tapAmpm = (ap) => {
    const ns = { ...selRef.current, ampm: ap };
    selRef.current = ns; setSel({ ...ns }); emit(ns);
  };

  // ── Display value ─────────────────────────────────
  const defaultPlaceholder = disabled
    ? "Select a slot first"
    : slotStart && slotEnd
      ? `${slotStart} – ${slotEnd}`
      : "Select time";

  const displayVal = value
    ? (() => {
      const [hh, mm] = value.split(":").map(Number);
      return `${hh % 12 || 12}:${pad(mm)} ${hh >= 12 ? "PM" : "AM"}`;
    })()
    : (placeholder ?? defaultPlaceholder);

  const handAngle = mode === "hour" ? hourAngle(sel.h) : minAngle(sel.m);
  const handTip = toXY(handAngle, (mode === "hour" ? HOUR_R : MIN_R) - 14);
  const slotHint = slotStart && slotEnd ? `Slot: ${slotStart} – ${slotEnd}` : null;

  const wrapClass = [
    "utp-wrap",
    open ? "utp-open" : "",
    value ? "utp-has-value" : "",
    hasError ? "utp-error-state" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapClass} ref={ref}>
      {/* Floating label */}
      <span className={`utp-label${(open || value) ? " utp-label-float" : ""}${hasError ? " utp-label-error" : ""}`}>
        {placeholder ?? defaultPlaceholder}
      </span>

      {/* Trigger */}
      <button
        type="button"
        className={`utp-trigger${hasError ? " utp-error" : ""}${disabled ? " utp-disabled" : ""}`}
        onClick={() => { if (!disabled) { if (open) requestClose(); else setOpen(true); } }}
      >
        <span className={`utp-val${!value ? " utp-ph" : ""}`}>{value ? displayVal : ""}</span>
        <span className="utp-arrow">▾</span>
      </button>

      {/* Highlight bar */}
      <span className="utp-bar" />

      {/* Popup */}
      {!disabled && (
        <ModalTransition open={open} onClose={requestClose} overlayClassName="utp-overlay" panelClassName="utp-popup">
            {/* Red header */}
            <div className="utp-header">
              <div className="utp-ampm-col">
                <button type="button" className={`utp-ampm-btn${sel.ampm === "AM" ? " active" : ""}`} onClick={() => tapAmpm("AM")}>AM</button>
                <button type="button" className={`utp-ampm-btn${sel.ampm === "PM" ? " active" : ""}`} onClick={() => tapAmpm("PM")}>PM</button>
              </div>
              <div className="utp-time-display">
                <span className={`utp-hm${mode === "hour" ? " active" : ""}`} onClick={() => setMode("hour")}>{pad(sel.h)}</span>
                <span className="utp-colon">:</span>
                <span className={`utp-hm${mode === "minute" ? " active" : ""}`} onClick={() => setMode("minute")}>{pad(sel.m)}</span>
              </div>
            </div>

            {/* Slot hint */}
            {slotHint && <div className="utp-slot-hint">{slotHint}</div>}

            {/* SVG clock */}
            <svg
              ref={svgRef}
              width={CENTER * 2}
              height={CENTER * 2}
              className="utp-clock"
              style={{ touchAction: "none", display: "block" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {/* Face */}
              <circle cx={CENTER} cy={CENTER} r={CLOCK_R} fill="var(--bg-main)" stroke="var(--color-pale-red)" strokeWidth="1.5" />

              {/* Hand */}
              <line x1={CENTER} y1={CENTER} x2={handTip.x} y2={handTip.y}
                stroke="var(--color-red)" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx={CENTER} cy={CENTER} r="4" fill="var(--color-red)" />
              <circle cx={handTip.x} cy={handTip.y} r="18" fill="var(--color-red)" opacity="0.15" />
              <circle cx={handTip.x} cy={handTip.y} r="5" fill="var(--bg-main)" />

              {/* Hour numbers */}
              {mode === "hour" && hours12.map((h) => {
                const ang = hourAngle(h);
                const pos = toXY(ang, HOUR_R);
                const isSel = sel.h === h;
                const isDis = isHourDis(h, sel.ampm);
                return (
                  <g key={h}
                    style={{ cursor: isDis ? "not-allowed" : "pointer" }}
                    onPointerDown={(e) => { e.stopPropagation(); if (!isDis) tapHour(h); }}
                  >
                    <circle cx={pos.x} cy={pos.y} r="16"
                      fill={isSel ? "var(--color-red, #e74c3c)" : "transparent"} />
                    <text x={pos.x} y={pos.y}
                      textAnchor="middle" dominantBaseline="central"
                      fontSize="13" fontWeight={isSel ? "700" : "400"}
                      fill={isSel ? "#fff" : isDis ? "var(--text-tertiary)" : "var(--text-primary)"}
                    >{h}</text>
                  </g>
                );
              })}

              {/* Minute marks */}
              {mode === "minute" && minutes5.map((m) => {
                const ang = minAngle(m);
                const pos = toXY(ang, MIN_R);
                const isSel = sel.m === m;
                const isDis = isMinDis(m);
                return (
                  <g key={m}
                    style={{ cursor: isDis ? "not-allowed" : "pointer" }}
                    onPointerDown={(e) => { e.stopPropagation(); tapMinute(m); }}
                  >
                    <circle cx={pos.x} cy={pos.y} r="16"
                      fill={isSel ? "var(--color-red, #e74c3c)" : isDis ? "#f3f4f6" : "transparent"} />
                    <text x={pos.x} y={pos.y}
                      textAnchor="middle" dominantBaseline="central"
                      fontSize="12" fontWeight={isSel ? "700" : "400"}
                      fill={isSel ? "#fff" : isDis ? "#d1d5db" : "#333"}
                    >{pad(m)}</text>
                  </g>
                );
              })}
            </svg>

            {/* Footer */}
            <div className="utp-footer">
              <Button3D type="button" className="form-action-btn cancel" frontClassName="sm-padding"
                onClick={requestClose}>
                Cancel
              </Button3D>
              <Button3D type="button" className="form-action-btn submit" frontClassName="sm-padding"
                onClick={() => { emit(selRef.current); requestClose(); }}>
                Ok
              </Button3D>
            </div>
        </ModalTransition>
      )}
    </div>
  );
};

export default UserTimePicker;
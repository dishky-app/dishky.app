/**
 * AttendeeFields.js — Admin Panel
 * Same inputs as the user panel's booking form.
 *   Gender (male / female / third gender) adds up to the total persons.
 *   Kids, elderly and physically challenged are taken from that total — each
 *   person is counted in at most one of them — so together they can never be
 *   more than the total (2 male + 2 female = 4 persons → at most 4 across the three).
 * Used by "Add Booking" and "Add More Persons".
 */
import React from "react";
import { GENDER_FIELDS, GROUP_FIELDS, attendeeTotal, groupsTotal } from "../utils/eventConfig";

const Stepper = ({ label, hint, value, min = 0, max = null, onChange }) => (
  <div className="ae-att-row">
    <div className="ae-att-label">
      <span>{label}</span>
      {hint ? <small>{hint}</small> : null}
    </div>
    <div className="ae-add-guest-row" style={{ margin: 0 }}>
      <button type="button" className="ae-guest-stepper-btn" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span className="ae-guest-stepper-val">{value}</span>
      <button type="button" className="ae-guest-stepper-btn" disabled={max !== null && value >= max}
        onClick={() => onChange(max === null ? value + 1 : Math.min(max, value + 1))}>+</button>
    </div>
  </div>
);

/**
 * @param value     { male, female, third, kids, seniors, physicallyChallenged }
 * @param onChange  (nextValue) => void
 * @param maxTotal  seats still available (null = unlimited)
 */
const AttendeeFields = ({ value, onChange, maxTotal = null, error = "", title = "Persons attending" }) => {
  const total = attendeeTotal(value);
  const groups = groupsTotal(value);
  const free = Math.max(0, total - groups); // persons not yet placed in kids / elderly / physically challenged
  const set = (key, v) => onChange({ ...value, [key]: v });
  // Gender counts may grow while the total stays within the seats left, and may
  // shrink only while the total stays ≥ the kids/elderly/challenged already chosen.
  const genderMax = (key) => (maxTotal === null ? null : Math.max(value[key], value[key] + (maxTotal - total)));
  const genderMin = (key) => Math.max(0, value[key] - free);
  return (
    <div className={`ae-att${error ? " ae-att-error" : ""}`}>
      <div className="ae-att-head">
        <span className="ae-att-title">{title}</span>
        <span className="ae-att-total">{total} person{total !== 1 ? "s" : ""}</span>
      </div>
      <div className="ae-att-section">Gender <small>(adds up to the total)</small></div>
      {GENDER_FIELDS.map((f) => (
        <Stepper key={f.key} label={f.label} value={value[f.key]} min={genderMin(f.key)} max={genderMax(f.key)} onChange={(v) => set(f.key, v)} />
      ))}
      <div className="ae-att-section">
        Out of these {total} <small>(together at most {total} — {free} left to assign)</small>
      </div>
      {GROUP_FIELDS.map((f) => (
        <Stepper key={f.key} label={f.label} hint={f.hint} value={value[f.key]} max={value[f.key] + free} onChange={(v) => set(f.key, v)} />
      ))}
      {error ? <p className="ae-att-msg">{error}</p> : null}
    </div>
  );
};

export default AttendeeFields;

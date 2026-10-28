import React from "react";
import { CustomDatePicker } from "../components/CustomDatePicker.js";
import { CustomTimePicker } from "../components/CustomTimePicker.js";

// Date + time using the Admin Panel's calendar and clock pickers.
// value / onChange use the local "YYYY-MM-DDTHH:mm" form (what toLocalInput() produces).
export default function DateTimeField({ label, value, onChange, required, min }) {
  const [date = "", time = ""] = String(value || "").split("T");
  const emit = (d, t) => onChange(d ? `${d}T${t || "09:00"}` : "");
  return (
    <div className="admin-form-group form-group">
      {label && <span className="tk-label">{label}{required && <span className="rf-req">*</span>}</span>}
      <div className="tk-datetime">
        <CustomDatePicker value={date} min={min} onChange={(d) => emit(d, time)} placeholder="Select date" />
        <CustomTimePicker value={time} onChange={(t) => emit(date, t)} placeholder="Select time" />
      </div>
    </div>
  );
}

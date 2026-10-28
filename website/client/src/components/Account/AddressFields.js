import React from "react";
import { Field } from "./AccountLayout.js";
import { formatTitle, formatDigits } from "../../utils/validate.js";

export const EMPTY_ADDRESS = { doorNo: "", street: "", area: "", district: "", state: "", pincode: "" };

/** Normalises whatever the API returns (or nothing) into the six address fields. */
export const toAddress = (a) => ({ ...EMPTY_ADDRESS, ...(a || {}) });

const FIELDS = [
  { key: "doorNo", label: "Door no.", autoComplete: "address-line1", maxLength: 20 },
  { key: "street", label: "Street", autoComplete: "address-line2", maxLength: 80 },
  { key: "area", label: "Area", autoComplete: "address-level3", maxLength: 80 },
  { key: "district", label: "District", autoComplete: "address-level2", maxLength: 60 },
  { key: "state", label: "State", autoComplete: "address-level1", maxLength: 60 },
  { key: "pincode", label: "Pincode", autoComplete: "postal-code", maxLength: 6, inputMode: "numeric", pattern: "[0-9]{6}", title: "6-digit pincode" },
];

/**
 * Address block with one text box each for door no., street, area, district, state and pincode.
 * `value` is the address object, `onChange` receives the updated object.
 */
export default function AddressFields({ value, onChange, idPrefix = "addr", dark = false, required = false }) {
  const addr = toAddress(value);
  const inputCls = `input${dark ? " input-dark" : ""}`;
  return (
    <fieldset className="space-y-3">
      <legend className={`text-sm font-semibold ${dark ? "text-cream/80" : "text-ink/80"}`}>Address</legend>
      <div className="form-grid">
        {FIELDS.map((f) => (
          <Field key={f.key} id={`${idPrefix}-${f.key}`} label={`${f.label}${required ? " *" : ""}`} dark={dark}>
            <input
              id={`${idPrefix}-${f.key}`}
              type="text"
              required={required}
              autoComplete={f.autoComplete}
              inputMode={f.inputMode}
              pattern={f.pattern}
              title={f.title}
              maxLength={f.maxLength}
              className={inputCls}
              value={addr[f.key]}
              onChange={(e) => onChange({ ...addr, [f.key]: f.key === "pincode" ? formatDigits(e.target.value, 6) : f.key === "doorNo" ? e.target.value : formatTitle(e.target.value) })}
            />
          </Field>
        ))}
      </div>
    </fieldset>
  );
}

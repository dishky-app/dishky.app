import React from "react";
import { Check } from "lucide-react";
import "./ChoiceControls.css";

/** Custom checkbox: rounded box that fills red and draws a white tick. */
export function CheckField({ id, checked, onChange, children, invalid = false }) {
  return (
    <label className="dk-check">
      <input id={id} type="checkbox" className="dk-check__input" checked={checked} onChange={onChange} aria-invalid={invalid || undefined} />
      <span className="dk-check__box" aria-hidden="true">
        <svg viewBox="0 0 20 20" className="dk-check__tick"><path d="M4.5 10.5l3.5 3.5 7.5-8" /></svg>
      </span>
      <span className="dk-check__text">{children}</span>
    </label>
  );
}

/** Segmented two-way switch (e.g. Monthly / Yearly). options: [{ value, label, badge? }] */
export function Segmented({ name, value, onChange, options, label }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div role="radiogroup" aria-label={label} className="dk-seg" style={{ "--n": options.length, "--i": idx }}>
      <span className="dk-seg__thumb" aria-hidden="true" />
      {options.map((o) => (
        <label key={o.value} className={`dk-seg__opt ${o.value === value ? "is-on" : ""}`}>
          <input type="radio" name={name} className="sr-only" checked={o.value === value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
          {o.badge && <em className="dk-seg__badge">{o.badge}</em>}
        </label>
      ))}
    </div>
  );
}

/** Selectable plan tile. */
export function PlanTile({ name, groupName, checked, onChange, title, price, note, badge }) {
  return (
    <label className={`dk-plan ${checked ? "is-on" : ""}`}>
      <input type="radio" name={groupName} className="sr-only" checked={checked} onChange={onChange} />
      {badge && <span className="dk-plan__badge">{badge}</span>}
      <span className="dk-plan__tick" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
      <span className="dk-plan__name">{title}</span>
      <span className="dk-plan__price"><b>{price}</b><small>/mo</small></span>
      {note && <span className="dk-plan__note">{note}</span>}
    </label>
  );
}

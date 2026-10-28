import { useState } from "react";
import { getRestaurant } from "../tenant";

// "Restaurant URL name" input shared by the sign-in and forgot-password pages.
// Prefilled from ?restaurant= or the last restaurant used on this browser.
export function useRestaurantField() {
  const [restaurant, setRestaurant] = useState(getRestaurant());
  return [restaurant, (v) => setRestaurant(String(v).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40))];
}

const RestaurantField = ({ value, onChange, hasError }) => (
  <div className="mat">
    <input
      className={`mat-input${hasError ? " auth-input-error" : ""}`}
      type="text"
      placeholder=" "
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      autoComplete="organization"
    />
    <label className="mat-label">Restaurant URL name<span className="rf-req">*</span></label>
    <span className="mat-bar" />
  </div>
);

export default RestaurantField;

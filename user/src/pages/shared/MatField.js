/**
 * MatField
 * --------
 * Material-Design-style floating label input, used across Welcome,
 * FoodGridList, Reservation/Catering/Celebration/PreBooking forms, etc.
 *
 * Renders the `.mat` wrapper with `.mat-input`, `.mat-label`, `.mat-bar`,
 * and (when `error` is provided) a `.mat-error` message below it. Adds
 * the `error` / `mat-label-error` / `mat-bar-error` classes automatically.
 *
 * Any extra props (value, onChange, type, placeholder override, maxLength,
 * list, ref via `inputRef`, etc.) are forwarded to the underlying <input>.
 *
 * Example:
 *   <MatField
 *     label="Mobile Number"
 *     type="tel"
 *     maxLength={10}
 *     value={mobile}
 *     onChange={(e) => setMobile(e.target.value)}
 *     error={formErrors.mobile}
 *     inputRef={mobileInputRef}
 *   />
 */
const MatField = ({
  label,
  error,
  type = "text",
  className = "",
  inputRef,
  wrapperClassName = "section",
  ...rest
}) => (
  <div className={wrapperClassName}>
    <div className="mat">
      <input
        ref={inputRef}
        className={`mat-input${error ? " error" : ""}${className ? ` ${className}` : ""}`}
        placeholder=" "
        type={type}
        {...rest}
      />
      <label className={`mat-label${error ? " mat-label-error" : ""}`}>{label}</label>
      <span className={`mat-bar${error ? " mat-bar-error" : ""}`}></span>
    </div>
  </div>
);

export default MatField;
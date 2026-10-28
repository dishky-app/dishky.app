import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button3D from "../components/Button3D";
import AuthPasswordField from "./AuthPasswordField";
import AuthShell from "./AuthShell";
import RestaurantField, { useRestaurantField } from "./RestaurantField";
import { MARKETING_URL } from "../tenant";
import { allowTextInput } from "../App";
import { useLegalModal } from "../components/LegalModal";
import { useToast } from "../useToast";
import "./Login.css";

const Login = () => {
  const navigate = useNavigate();
  const legal = useLegalModal();
  const { login, sessionExpired } = useAuth();
  const { toast } = useToast();

  const [restaurant, setRestaurant] = useRestaurantField();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Mirrors AuthContext's sessionExpired, but can be locally dismissed —
  // otherwise, once a session genuinely expires, this message would keep
  // showing (masking the real error) on every subsequent login attempt,
  // including a wrong-password retry, until a login actually succeeds.
  const [showSessionExpired, setShowSessionExpired] = useState(sessionExpired);

  const fail = (msg) => { setError(msg); toast.error(msg); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setShowSessionExpired(false);
    if (!String(restaurant || "").trim()) { fail("Enter your restaurant's web address."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { fail("Enter a valid email address."); return; }
    if (!password) { fail("Enter your password."); return; }
    setIsSubmitting(true);
    try {
      await login(restaurant, email, password);
      navigate("/", { replace: true });
    } catch (err) {
      if (err.response) {
        fail(err.response.data?.error || "Invalid email or password");
      } else if (err.request) {
        // Request went out but no response came back — server unreachable,
        // CORS rejection, or a network drop. This is a fundamentally
        // different failure than wrong credentials, and showing "Invalid
        // email or password" for it would send someone down the wrong
        // path entirely (re-checking a password that was never the issue).
        fail("Can't reach the server. Check your connection and try again.");
      } else {
        fail("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="Welcome back!" subtitle="Sign in to your restaurant's admin panel.">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {showSessionExpired && !error && (
          <p className="auth-error">Your session has expired. Please log in again.</p>
        )}
        <RestaurantField value={restaurant} onChange={(v) => { setRestaurant(v); setError(""); }} hasError={!!error} />

        <div className="mat">
          <input
            className={`mat-input${error ? " auth-input-error" : ""}`}
            type="email"
            placeholder=" "
            value={email}
            onChange={(e) => { setEmail(allowTextInput(email, e.target.value, 100, 5)); setError(""); }}
            required
            autoComplete="username"
          />
          <label className="mat-label">Email<span className="rf-req">*</span></label>
          <span className="mat-bar" />
        </div>

        <AuthPasswordField
          label="Password"
          value={password}
          onChange={(e) => { setPassword(allowTextInput(password, e.target.value, 100, 5)); setError(""); }}
          autoComplete="current-password"
          hasError={!!error}
        />

        <Link className="auth-forgot" to="/forgot-password">Forgot Password?</Link>

        <div className="auth-submit-row">
          <Button3D type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Logging in..." : "Log In"}
          </Button3D>
        </div>
      </form>

      <p className="auth-terms">
        By logging in you agree to our{" "}
        <button type="button" className="auth-terms-link" onClick={() => legal.show("terms")}>Terms &amp; Conditions</button>{" "}
        and <button type="button" className="auth-terms-link" onClick={() => legal.show("privacy")}>Privacy Policy</button>.
      </p>

      <p className="auth-switch-hint">
        Staff accounts are created by your manager or Super Admin. Contact them if you need access.
        {" "}Own a restaurant? <a href={`${MARKETING_URL}/signup`}>Start a free trial</a>.
      </p>
      {legal.modal}
    </AuthShell>
  );
};

export default Login;
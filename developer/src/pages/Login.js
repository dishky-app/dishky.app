import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.js";
import { ErrorNote } from "../components.js";
import { useToast } from "../useToast.js";
import { isValidEmail } from "../formUtils.js";
import Button3D from "../components/Button3D.js";
import AuthPasswordField from "../components/AuthPasswordField.js";
import AuthVisual from "../components/AuthVisual.js";
import "./Login.css";

// Same split-screen auth layout as the Admin Panel (AuthShell + Login).
export default function Login() {
  const { signIn, expired } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!isValidEmail(email)) { toast.error("Enter a valid email address."); return; }
    if (!password) { toast.error("Enter your password."); return; }
    setError("");
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err.message);
      // The password is kept so a typo can be fixed; the show/hide toggle never clears it.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <AuthVisual
          product="developer"
          headline="Triage, fix and"
          accent="ship with confidence."
          text="Your queue of support tickets, deadlines and releases in one workspace."
          points={["Tickets assigned to you, with clear deadlines", "Hand off to QA and releases without friction", "Stay in sync with support in real time"]}
        />
        <div className="auth-form-panel">
          <h1 className="auth-title">Developer sign in</h1>
          <p className="auth-subtitle">Sign in with your Dishky staff account.</p>
          <form className="auth-form" onSubmit={submit} noValidate>
            {expired && !error && <p className="auth-hint">Your session ended. Please sign in again.</p>}
            <div className="mat">
              <input id="li-email" className={`mat-input${error ? " auth-input-error" : ""}`} type="email" placeholder=" " required autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
              <label className="mat-label" htmlFor="li-email">Email<span className="rf-req">*</span></label>
              <span className="mat-bar" />
            </div>
            <AuthPasswordField id="li-pass" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" hasError={!!error} />
            <div style={{ textAlign: "right" }}><Link to="/forgot-password" className="auth-forgot">Forgot password?</Link></div>
            <ErrorNote error={error} />
            <div className="auth-submit-row"><Button3D type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign In"}</Button3D></div>
          </form>
          <p className="auth-switch-hint">Authorised Dishky staff only. Accounts are created by invitation.</p>
        </div>
      </div>
    </div>
  );
}

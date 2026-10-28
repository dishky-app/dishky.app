import React, { useState } from "react";
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
    setBusy(true);
    setError("");
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err.message);
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <AuthVisual
          product="console"
          headline="Every restaurant,"
          accent="one control room."
          text="Manage clients, subscriptions and support for the whole Dishky platform."
          points={["Clients, restaurants and plans at a glance", "Subscriptions, revenue and storage tracking", "Support tickets handled end to end"]}
        />

        <div className="auth-form-panel">
          <h1 className="auth-title">Welcome back!</h1>
          <p className="auth-subtitle">Sign in to the Dishky Super Admin console.</p>
          <form className="auth-form" onSubmit={submit} noValidate>
            {expired && !error && <p className="auth-hint">Your session ended. Please sign in again.</p>}
            <div className="mat">
              <input
                id="li-email"
                className={`mat-input${error ? " auth-input-error" : ""}`}
                type="email"
                placeholder=" "
                required
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label className="mat-label" htmlFor="li-email">Email<span className="rf-req">*</span></label>
              <span className="mat-bar" />
            </div>
            <AuthPasswordField
              id="li-pass"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              hasError={!!error}
            />
            <ErrorNote error={error} />
            <div className="auth-submit-row">
              <Button3D type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign In"}</Button3D>
            </div>
          </form>
          <p className="auth-switch-hint">Authorised Dishky staff only.</p>
        </div>
      </div>
    </div>
  );
}

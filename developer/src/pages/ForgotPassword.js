import React, { useState } from "react";
import { Link } from "react-router-dom";
import * as api from "../api.js";
import { ErrorNote } from "../components.js";
import { useToast } from "../useToast.js";
import Button3D from "../components/Button3D.js";
import AuthVisual from "../components/AuthVisual.js";
import "./Login.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!EMAIL_RE.test(email.trim())) { toast.error("Enter a valid email address."); return; }
    setBusy(true);
    try {
      const d = await api.forgotPassword(email.trim());
      setSent(d.message); // identical wording whether or not the account exists
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <AuthVisual product="developer" headline="Locked out?" accent="We'll get you back in." text="Request a reset link and you'll be back to your tickets in a minute." />
        <div className="auth-form-panel">
          <h1 className="auth-title">Forgot password</h1>
          {sent ? (
            <div className="auth-form">
              <p className="auth-hint" role="status">{sent}</p>
              <p className="auth-switch-hint">The link is valid for 30 minutes and works once.</p>
              <div className="auth-submit-row"><Link to="/"><Button3D>Back to sign in</Button3D></Link></div>
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit} noValidate>
              <p className="auth-switch-hint">Enter your registered email address and we'll send you a reset link.</p>
              <div className="mat">
                <input id="fp-email" className={`mat-input${error ? " auth-input-error" : ""}`} type="email" placeholder=" " autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
                <label className="mat-label" htmlFor="fp-email">Email<span className="rf-req">*</span></label>
                <span className="mat-bar" />
              </div>
              <ErrorNote error={error} />
              <div className="auth-submit-row"><Button3D type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button3D></div>
              <p className="auth-switch-hint"><Link to="/" className="auth-forgot">Back to sign in</Link></p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

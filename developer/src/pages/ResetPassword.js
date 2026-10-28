import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import * as api from "../api.js";
import { ErrorNote } from "../components.js";
import { useToast } from "../useToast.js";
import Button3D from "../components/Button3D.js";
import AuthVisual from "../components/AuthVisual.js";
import AuthPasswordField from "../components/AuthPasswordField.js";
import "./Login.css";

// Used both for "forgot password" links and for first-time invitation links (?invite=1).
export default function ResetPassword() {
  const { toast } = useToast();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [state, setState] = useState("checking"); // checking | ok | invalid | done
  const [purpose, setPurpose] = useState("reset");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    api.validateResetToken(token).then((d) => { setPurpose(d.purpose || "reset"); setState(d.valid ? "ok" : "invalid"); }).catch(() => setState("invalid"));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 12) { toast.error("Password must be at least 12 characters."); return; }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) { toast.error("Password must contain letters and numbers."); return; }
    if (password !== confirm) { toast.error("Passwords do not match."); return; }
    setBusy(true);
    try {
      await api.resetPassword(token, password, confirm);
      setState("done");
      setTimeout(() => navigate("/", { replace: true }), 2500);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const invite = purpose === "invite";
  return (
    <div className="auth-page">
      <div className="auth-shell">
        <AuthVisual product="developer" headline="Choose a new" accent="password." text="Pick something strong and unique. Other devices are signed out afterwards." />
        <div className="auth-form-panel">
          <h1 className="auth-title">{invite ? "Set your password" : "Reset password"}</h1>
          {state === "checking" && <p className="auth-switch-hint">Checking your link…</p>}
          {state === "invalid" && (
            <div className="auth-form">
              <p className="auth-error" role="alert">This link is invalid or has expired.</p>
              <div className="auth-submit-row"><Link to="/forgot-password"><Button3D>Request a new link</Button3D></Link></div>
            </div>
          )}
          {state === "done" && (
            <div className="auth-form">
              <p className="auth-hint" role="status">Your password has been updated. Redirecting to sign in…</p>
              <div className="auth-submit-row"><Link to="/"><Button3D>Sign in now</Button3D></Link></div>
            </div>
          )}
          {state === "ok" && (
            <form className="auth-form" onSubmit={submit} noValidate>
              <AuthPasswordField id="rp-pass" label="New password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" hasError={!!error} />
              <AuthPasswordField id="rp-confirm" label="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" hasError={!!error} />
              <p className="auth-switch-hint">At least 12 characters, with letters and numbers.</p>
              <ErrorNote error={error} />
              <div className="auth-submit-row"><Button3D type="submit" disabled={busy}>{busy ? "Saving…" : invite ? "Set password" : "Reset password"}</Button3D></div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

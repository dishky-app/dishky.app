import "../Welcome.css";
import "./Attender.css";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../../api";
import { resolved } from "../../tenant";
import PageLoader from "../../components/PageLoader";
import { useToast } from "../../components/Usetoast";
import MatField from "../shared/MatField";
import Button3D from "../shared/Button3D";

import logoExtend from "../../assets/logo-shrink.png";
import logoShrink from "../../assets/logo.png";

/**
 * AttenderAuth — sign in / sign up page for attenders (waiters), plus the
 * forgot-password flow.
 *
 *   login   : mobile + password
 *   signup  : name + mobile + password (+ confirm)
 *   forgot  : mobile  -> a 6-digit code is sent to that number's WhatsApp
 *   reset   : code + new password
 *
 * On success `onAuthed(attender)` hands the signed-in attender to App, which
 * moves on to the "add table" page.
 */
const MOBILE_ERR = "Enter a valid 10-digit mobile number.";
const PASSWORD_ERR = "Password must be at least 6 characters.";

// Password input with the show/hide eye at its left-most end.
const EyeIcon = ({ off }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {off ? (
      <>
        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

const PasswordField = (props) => {
  const [show, setShow] = useState(false);
  return (
    <div className="at-pw-field">
      <MatField {...props} type={show ? "text" : "password"} />
      <button
        type="button"
        className="at-pw-eye"
        onClick={() => setShow((v) => !v)}
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
      >
        <EyeIcon off={show} />
      </button>
    </div>
  );
};

const AttenderAuth = ({ attenderCtl, onAuthed, handleNavigate, toCamelCase }) => {
  const { toast } = useToast();
  const [view, setView] = useState("login"); // login | signup | forgot | reset
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Already signed in on this device → straight to the tables page.
  if (attenderCtl.isAttender) return <Navigate to="/attender/tables" replace />;

  const branchName = resolved.venueName
    ? `${resolved.restaurantName} · ${resolved.venueName}`
    : resolved.restaurantName || "";

  const clearError = (field) => setErrors((prev) => ({ ...prev, [field]: "" }));

  const switchView = (next) => {
    setView(next);
    setErrors({});
    setPassword("");
    setConfirm("");
    setCode("");
    if (next === "login" || next === "signup") setName("");
  };

  const onMobile = (e) => {
    setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
    clearError("mobile");
  };

  const onName = (e) => {
    const value = e.target.value;
    if (value.length > 100) return;
    if (value.trim().split(/\s+/).length > 5) return;
    setName(toCamelCase ? toCamelCase(value) : value);
    clearError("name");
  };

  // Maps an API error to a field message where it makes sense, otherwise a toast.
  const handleError = (err, fallback) => {
    const status = err.response?.status;
    const message = err.response?.data?.error;
    if (status === 409) return setErrors({ mobile: message || "This number already has an account." });
    if (status === 401) return setErrors({ password: message || "Incorrect mobile number or password." });
    if (status === 400 && message) return toast.error(message);
    if (status === 429) return toast.error(message || "Too many attempts. Please try again later.");
    console.error(fallback, err);
    toast.error(fallback);
  };

  /* ── actions ───────────────────────────────────────────────────────── */
  const handleLogin = async () => {
    const e = {};
    if (mobile.length !== 10) e.mobile = MOBILE_ERR;
    if (!password) e.password = "Enter your password.";
    if (Object.keys(e).length) return setErrors(e);

    try {
      setLoading(true);
      const res = await api.post("/attender-auth/login", { mobile, password });
      onAuthed(res.data.attender);
    } catch (err) {
      handleError(err, "Couldn't sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    const e = {};
    if (name.trim().length < 2) e.name = "Enter a valid name.";
    if (mobile.length !== 10) e.mobile = MOBILE_ERR;
    if (password.length < 6) e.password = PASSWORD_ERR;
    if (confirm !== password) e.confirm = "Passwords don't match.";
    if (Object.keys(e).length) return setErrors(e);

    try {
      setLoading(true);
      const res = await api.post("/attender-auth/signup", { name: name.trim(), mobile, password });
      onAuthed(res.data.attender);
    } catch (err) {
      handleError(err, "Couldn't create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (mobile.length !== 10) return setErrors({ mobile: MOBILE_ERR });
    try {
      setLoading(true);
      const res = await api.post("/attender-auth/forgot-password", { mobile });
      // The server answers the same way whether or not the number has an account.
      toast.info("If this number has an attender account, a 6-digit code was sent to its WhatsApp.");
      setErrors({});
      setView("reset");
      // Only present outside production, so the flow can be tried without WhatsApp set up.
      if (res.data?.devCode) {
        setCode(res.data.devCode);
        toast.info(`Test mode: your code is ${res.data.devCode}`);
      }
    } catch (err) {
      handleError(err, "Couldn't send the code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    const e = {};
    if (!/^\d{6}$/.test(code)) e.code = "Enter the 6-digit code.";
    if (password.length < 6) e.password = PASSWORD_ERR;
    if (confirm !== password) e.confirm = "Passwords don't match.";
    if (Object.keys(e).length) return setErrors(e);

    try {
      setLoading(true);
      await api.post("/attender-auth/reset-password", { mobile, code, newPassword: password });
      toast.success("Password changed. Please sign in.");
      switchView("login");
    } catch (err) {
      if (err.response?.status === 400) return setErrors({ code: err.response.data?.error || "That code is invalid or has expired." });
      handleError(err, "Couldn't reset your password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitOnEnter = (action) => (e) => {
    if (e.key === "Enter") action();
  };

  const heading = {
    login: "Attender sign in",
    signup: "Create attender account",
    forgot: "Forgot password",
    reset: "Set a new password",
  }[view];

  return (
    <div className="welcome-page at-auth-page">
      {loading && <PageLoader label="Please wait" />}

      <div className="welcome-waves" aria-hidden="true">
        <div className="welcome-wave" />
        <div className="welcome-wave" />
        <div className="welcome-wave" />
      </div>

      <div className="welcome-container at-auth-container at-wide at-split">
        <div className="at-brand">
          <div className="welcome-title">
            <div className="welcome-logos">
              <img src={logoExtend} alt="Cafe" />
              <img src={logoShrink} alt="" />
            </div>
          </div>
          {branchName && <div className="welcome-branch-name">{branchName}</div>}
          <p className="at-brand-tag">Attender portal — take orders for your tables, switch between guests, and see what each table has ordered.</p>
        </div>

        <div className="at-form-col">
        <div className="at-auth-card">
          {(view === "login" || view === "signup") && (
            <div className="at-auth-tabs">
              <button
                type="button"
                className={`at-auth-tab ${view === "login" ? "active" : ""}`}
                onClick={() => switchView("login")}
              >
                Login
              </button>
              <button
                type="button"
                className={`at-auth-tab ${view === "signup" ? "active" : ""}`}
                onClick={() => switchView("signup")}
              >
                Sign Up
              </button>
            </div>
          )}

          <h2 className="at-auth-title">{heading}</h2>
          {view === "forgot" && (
            <p className="at-auth-hint">Enter your mobile number and we'll send a 6-digit code to its WhatsApp.</p>
          )}
          {view === "reset" && (
            <p className="at-auth-hint">Enter the code sent to +91 {mobile} and choose a new password.</p>
          )}

          {view === "signup" && (
            <MatField
              label="Full Name"
              type="text"
              maxLength={100}
              autoComplete="name"
              value={name}
              onChange={onName}
              error={errors.name}
              wrapperClassName=""
            />
          )}

          {view !== "reset" && (
            <MatField
              label="Mobile Number"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              value={mobile}
              onChange={onMobile}
              onKeyDown={view === "forgot" ? submitOnEnter(handleForgot) : undefined}
              error={errors.mobile}
              wrapperClassName=""
            />
          )}

          {view === "reset" && (
            <MatField
              label="6-digit Code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); clearError("code"); }}
              error={errors.code}
              wrapperClassName=""
            />
          )}

          {view !== "forgot" && (
            <PasswordField
              label={view === "reset" ? "New Password" : "Password"}
              autoComplete={view === "login" ? "current-password" : "new-password"}
              maxLength={72}
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
              onKeyDown={view === "login" ? submitOnEnter(handleLogin) : undefined}
              error={errors.password}
              wrapperClassName=""
            />
          )}

          {(view === "signup" || view === "reset") && (
            <PasswordField
              label="Confirm Password"
              autoComplete="new-password"
              maxLength={72}
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); clearError("confirm"); }}
              onKeyDown={submitOnEnter(view === "signup" ? handleSignup : handleReset)}
              error={errors.confirm}
              wrapperClassName=""
            />
          )}

          {view === "login" && (
            <>
              <Button3D className="btn-3d red at-auth-btn" onClick={handleLogin} disabled={loading}>Login</Button3D>
              <button type="button" className="at-link" onClick={() => switchView("forgot")}>Forgot password?</button>
            </>
          )}
          {view === "signup" && (
            <Button3D className="btn-3d red at-auth-btn" onClick={handleSignup} disabled={loading}>Sign Up</Button3D>
          )}
          {view === "forgot" && (
            <>
              <Button3D className="btn-3d red at-auth-btn" onClick={handleForgot} disabled={loading}>Send code</Button3D>
              <button type="button" className="at-link" onClick={() => switchView("login")}>Back to login</button>
            </>
          )}
          {view === "reset" && (
            <>
              <Button3D className="btn-3d red at-auth-btn" onClick={handleReset} disabled={loading}>Change password</Button3D>
              <button type="button" className="at-link" onClick={() => switchView("forgot")}>Send a new code</button>
            </>
          )}
        </div>

        <button type="button" className="at-back-link" onClick={() => handleNavigate("/")}>
          ← Back to guest login
        </button>
        </div>
      </div>
    </div>
  );
};

export default AttenderAuth;

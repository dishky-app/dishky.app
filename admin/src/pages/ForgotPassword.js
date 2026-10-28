import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api";
import Button3D from "../components/Button3D";
import AuthPasswordField from "./AuthPasswordField";
import AuthShell from "./AuthShell";
import RestaurantField, { useRestaurantField } from "./RestaurantField";
import { setRestaurant as storeRestaurant } from "../tenant";
import { useToast } from "../useToast";
import "./Login.css";

const ForgotPassword = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get("token") || "";

  const [step, setStep] = useState(urlToken ? "reset" : "request"); // "request" | "reset" | "done"
  const [restaurant, setRestaurant] = useRestaurantField();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(urlToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(urlToken ? "" : "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fail = (msg) => { setError(msg); toast.error(msg); };

  // If the reset link's token arrives after mount (e.g. slower query
  // param resolution on some routers), still land on the reset step.
  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
      setStep("reset");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlToken]);

  const handleRequest = async (e) => {
    e.preventDefault();
    setError("");
    if (!String(restaurant || "").trim()) { fail("Enter your restaurant's web address."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim())) { fail("Enter a valid email address."); return; }
    setIsSubmitting(true);
    try {
      storeRestaurant(restaurant);
      const res = await api.post("/staff-auth/forgot-password", { email, restaurant });
      // In production the token is emailed rather than returned to the
      // client — the dev-mode response includes it so this flow is
      // testable before an email provider (Phase-4 item 9) is wired up.
      if (res.data.token) {
        setToken(res.data.token);
        setMessage("Dev mode: reset token pre-filled below (would normally be emailed).");
      } else {
        setMessage("If that email is registered, a reset link has been sent.");
      }
      setStep("reset");
    } catch (err) {
      fail(err.response?.data?.error || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    if (!String(token).trim()) { fail("Enter the reset code from your email."); return; }
    if (newPassword.length < 6) { fail("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) {
      fail("Passwords do not match");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("/staff-auth/reset-password", { token, newPassword, restaurant });
      setStep("done");
    } catch (err) {
      fail(err.response?.data?.error || "Reset failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="Forgot Password">
      {step === "request" && (
        <form className="auth-form" onSubmit={handleRequest} noValidate>
          <RestaurantField value={restaurant} onChange={setRestaurant} />
          <div className="mat">
            <input
              className="mat-input"
              type="email"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label className="mat-label">Email<span className="rf-req">*</span></label>
            <span className="mat-bar" />
          </div>


          <div className="auth-submit-row">
            <Button3D type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </Button3D>
          </div>
        </form>
      )}

      {step === "reset" && (
        <form className="auth-form" onSubmit={handleReset} noValidate>
          {message && <p className="auth-hint">{message}</p>}

          {!urlToken && (
            <div className="mat">
              <input
                className="mat-input"
                type="text"
                placeholder=" "
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
              <label className="mat-label">Reset Token<span className="rf-req">*</span></label>
              <span className="mat-bar" />
            </div>
          )}

          <AuthPasswordField
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={6}
          />

          <AuthPasswordField
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            hasError={!!error && newPassword !== confirmPassword && confirmPassword.length > 0}
          />


          <div className="auth-submit-row">
            <Button3D type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Resetting..." : "Reset Password"}
            </Button3D>
          </div>
        </form>
      )}

      {step === "done" && (
        <p className="auth-hint">Password updated. You can now log in with your new password.</p>
      )}

      <p className="auth-switch-hint">
        <Link to="/login">Back to login</Link>
      </p>
    </AuthShell>
  );
};

export default ForgotPassword;

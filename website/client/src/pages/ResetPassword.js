import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Field } from "../components/Account/AccountLayout.js";
import AuthShell from "../components/Account/AuthShell.js";
import PasswordInput from "../components/Account/PasswordInput.js";
import { forgotPassword, resetPassword } from "../services/api.js";
import { toast } from "../components/Toast/Toast.js";
import { formatEmail, vEmail, vPassword } from "../utils/validate.js";

const SIDE = {
  eyebrow: "Account recovery",
  heading: "Locked out? We'll get you back in.",
  points: [
    "We email a single-use reset link to your account address.",
    "Choose a new password of at least 8 characters.",
    "Your restaurant's staff passwords are not affected.",
  ],
};

// /reset-password           -> ask for a reset link
// /reset-password?token=... -> choose a new password (link from the email)
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState("");
  const [done, setDone] = useState("");

  const run = (fn, validate, field) => async (e) => {
    e.preventDefault();
    const msg = validate();
    if (msg) {
      setInvalid(field);
      toast.error(msg);
      document.getElementById(field)?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await fn();
      const text = res.message || "Done.";
      setDone(text);
      toast.success(text);
    } catch (err) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      side={SIDE}
      title={token ? "Choose a new password" : "Reset your password"}
      intro={token ? "Use at least 8 characters." : "Enter your account email and we'll send you a reset link."}
      footer={<p>Remembered it? <Link to="/login" className="font-semibold text-ink underline-offset-4 hover:underline">Back to sign in</Link></p>}
    >
      {done ? (
        <div className="space-y-4">
          <p className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm">{done}</p>
          <Link to="/login" className="btn-primary inline-flex">Go to sign in</Link>
        </div>
      ) : token ? (
        <form onSubmit={run(() => resetPassword(token, password), () => vPassword(password), "rp-password")} noValidate className="space-y-5">
          <Field id="rp-password" label="New password" hint="8+ characters, with a letter and a number">
            <PasswordInput id="rp-password" aria-invalid={invalid === "rp-password" || undefined} autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setInvalid(""); }} />
          </Field>
          <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? "Saving…" : "Update password"}</button>
        </form>
      ) : (
        <form onSubmit={run(() => forgotPassword(email), () => vEmail(email), "rp-email")} noValidate className="space-y-5">
          <Field id="rp-email" label="Email">
            <input id="rp-email" type="email" autoCapitalize="none" aria-invalid={invalid === "rp-email" || undefined} autoComplete="email" placeholder="you@restaurant.com" className="input" value={email} onChange={(e) => { setEmail(formatEmail(e.target.value)); setInvalid(""); }} />
          </Field>
          <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
    </AuthShell>
  );
}

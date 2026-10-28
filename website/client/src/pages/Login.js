import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Field } from "../components/Account/AccountLayout.js";
import AuthShell from "../components/Account/AuthShell.js";
import PasswordInput from "../components/Account/PasswordInput.js";
import { login } from "../services/api.js";
import { useOwner } from "../context/OwnerContext.js";
import { toast } from "../components/Toast/Toast.js";
import { collect, formatEmail, vEmail, vPassword } from "../utils/validate.js";

const SIDE = {
  eyebrow: "Welcome back",
  heading: "Your whole restaurant, one sign-in away.",
  points: [
    "See live orders, tables and kitchen tickets as they happen.",
    "Manage your plan, billing and every restaurant you own.",
    "Staff sign in separately from your restaurant's own dashboard.",
  ],
};

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setOwner } = useOwner();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState([]);

  // Only follow same-site relative paths ("/account/billing"), never "//evil.com".
  const next = params.get("next");
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";

  const submit = async (e) => {
    e.preventDefault();
    const res0 = collect([["email", vEmail(form.email)], ["password", vPassword(form.password, { strong: false })]]);
    if (res0.fields.length) {
      setInvalid(res0.fields);
      toast.error(res0.first);
      document.getElementById(`login-${res0.fields[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await login(form.email, form.password);
      setOwner(res.data.owner);
      toast.success("Signed in successfully.");
      navigate(target, { replace: true });
    } catch (err) {
      toast.error(err.message || "Couldn't sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      side={SIDE}
      title="Sign in to Dishky"
      intro="Enter your owner account details to continue."
      footer={
        <p>
          New to Dishky?{" "}
          <Link to="/signup" className="font-semibold text-ink underline-offset-4 hover:underline">Start your free trial</Link>
        </p>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field id="login-email" label="Email">
          <input id="login-email" type="email" autoCapitalize="none" aria-invalid={invalid.includes("email") || undefined} autoComplete="email" placeholder="you@restaurant.com" className="input"
            value={form.email} onChange={(e) => { setForm({ ...form, email: formatEmail(e.target.value) }); setInvalid([]); }} />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="login-password" className="text-[var(--fs-small)] font-semibold">Password</label>
            <Link to="/reset-password" className="text-sm font-semibold text-amber hover:underline">Forgot password?</Link>
          </div>
          <PasswordInput id="login-password" aria-invalid={invalid.includes("password") || undefined} autoComplete="current-password" placeholder="Your password"
            value={form.password} onChange={(e) => { setForm({ ...form, password: e.target.value }); setInvalid([]); }} />
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
          {busy ? "Signing in…" : "Sign in"} <ArrowRight size={18} />
        </button>
        <p className="text-xs text-ink/50">
          By signing in you agree to our <Link to="/legal/terms" target="_blank" className="underline hover:text-ink">Terms &amp; Conditions</Link>{" "}
          and <Link to="/legal/privacy" target="_blank" className="underline hover:text-ink">Privacy Policy</Link>.
        </p>
      </form>
    </AuthShell>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, X } from "lucide-react";
import AccountLayout, { Field } from "../components/Account/AccountLayout.js";
import { CheckField, Segmented, PlanTile } from "../components/Form/ChoiceControls.js";
import PasswordInput from "../components/Account/PasswordInput.js";
import { toast } from "../components/Toast/Toast.js";
import { collect, formatName, formatTitle, formatEmail, sanitizePhone, vName, vRequired, vEmail, vPhone, vPassword } from "../utils/validate.js";
import { checkSlug, getPlans, signup } from "../services/api.js";
import { useOwner } from "../context/OwnerContext.js";
import { useAppContext } from "../context/AppContext.js";

const SITE = typeof window !== "undefined" ? window.location.host : "dishky.com";

const slugify = (s) =>
  String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");

const FALLBACK_PLANS = [
  { key: "starter", name: "Essential", monthlyPrice: 999, yearlyPrice: 9990, selfServe: true },
  { key: "growth", name: "Professional", monthlyPrice: 2999, yearlyPrice: 29990, selfServe: true },
  { key: "pro", name: "Premium", monthlyPrice: 5999, yearlyPrice: 59990, selfServe: true },
];

export default function Signup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setOwner } = useOwner();
  const { billingCycle } = useAppContext();

  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [planKey, setPlanKey] = useState(params.get("plan") || "growth");
  const [cycle, setCycle] = useState(params.get("cycle") || billingCycle || "monthly");

  const [form, setForm] = useState({ restaurantName: "", slug: "", name: "", email: "", phone: "", password: "" });
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState({ status: "idle" }); // idle | checking | ok | taken
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [invalid, setInvalid] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const seq = useRef(0);

  useEffect(() => {
    getPlans()
      .then((res) => {
        const list = (res?.data || []).filter((p) => p.selfServe !== false && p.monthlyPrice > 0);
        if (list.length) setPlans(list);
      })
      .catch(() => {});
  }, []);

  // The URL name follows the restaurant name until the owner edits it by hand.
  useEffect(() => {
    if (!slugTouched) setForm((f) => ({ ...f, slug: slugify(f.restaurantName) }));
  }, [form.restaurantName, slugTouched]);

  // Debounced availability check for <site>/<slug>.
  useEffect(() => {
    const slug = form.slug;
    if (!slug) {
      setSlugState({ status: "idle" });
      return undefined;
    }
    setSlugState({ status: "checking" });
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await checkSlug(slug);
        if (mine !== seq.current) return;
        const d = res.data;
        setSlugState(d.available ? { status: "ok" } : { status: "taken", reason: d.reason, suggestions: d.suggestions || [] });
      } catch {
        if (mine === seq.current) setSlugState({ status: "idle" }); // the server re-checks on submit
      }
    }, 350);
    return () => clearTimeout(t);
  }, [form.slug]);

  const plan = useMemo(() => plans.find((p) => p.key === planKey) || plans[0], [plans, planKey]);
  const FMT = { restaurantName: formatTitle, name: formatName, email: formatEmail, phone: sanitizePhone };
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: FMT[k] ? FMT[k](e.target.value) : e.target.value }));
    setInvalid((l) => l.filter((n) => n !== k));
  };
  const pickSlug = (s) => {
    setSlugTouched(true);
    setForm((f) => ({ ...f, slug: s }));
    setSuggestions([]);
  };

  const submit = async (e) => {
    e.preventDefault();
    const res = collect([
      ["restaurantName", vRequired(form.restaurantName, "Restaurant name")],
      ["slug", !form.slug ? "Web address is required." : form.slug.length < 3 ? "Web address must be at least 3 characters." : ""],
      ["name", vName(form.name, "Your name")],
      ["phone", vPhone(form.phone)],
      ["email", vEmail(form.email)],
      ["password", vPassword(form.password)],
      ["agree", agreed ? "" : "Please accept the Terms & Conditions and Privacy Policy to continue."],
    ]);
    if (res.fields.length) {
      setInvalid(res.fields);
      toast.error(res.first);
      const ids = { restaurantName: "su-restaurant", slug: "su-slug", name: "su-name", phone: "su-phone", email: "su-email", password: "su-password", agree: "su-agree" };
      document.getElementById(ids[res.fields[0]])?.focus();
      return;
    }
    if (slugState.status === "taken") {
      toast.error(slugState.reason || "That web address isn't available.");
      return;
    }
    setBusy(true);
    setSuggestions([]);
    try {
      const res2 = await signup({ ...form, planKey: plan.key, billingCycle: cycle });
      setOwner(res2.data.owner);
      toast.success("Account created. Welcome to Dishky!");
      navigate(`/account?welcome=${encodeURIComponent(res2.data.restaurant.slug)}`, { replace: true });
    } catch (err) {
      toast.error(err.message || "Couldn't create your account. Please try again.");
      if (err.body?.suggestions) setSuggestions(err.body.suggestions);
    } finally {
      setBusy(false);
    }
  };

  const suggestionList = slugState.status === "taken" && slugState.suggestions?.length ? slugState.suggestions : suggestions;

  return (
    <AccountLayout
      dark
      title="Open your restaurant on Dishky"
      intro="Your free trial starts now. No card needed. Your menu, QR ordering and dashboard are ready in a minute."
    >
      <form onSubmit={submit} noValidate className="space-y-4 rounded-3xl bg-white/5 p-5 sm:p-8">
        <Field id="su-restaurant" label="Restaurant name *" dark>
          <input id="su-restaurant" autoComplete="organization" aria-invalid={invalid.includes("restaurantName") || undefined} className="input input-dark"
            value={form.restaurantName} onChange={set("restaurantName")} maxLength={80} />
        </Field>

        <Field
          id="su-slug"
          label="Your web address *"
          dark
          hint="Customers scan a QR code that opens this address. It can't be changed later."
          error={slugState.status === "taken" ? slugState.reason : ""}
        >
          <div className="flex items-stretch overflow-hidden rounded-[14px] border border-cream/15 bg-white/5 focus-within:border-amber">
            <span className="flex items-center px-3 text-sm text-cream/50">{SITE}/</span>
            <input
              id="su-slug"
              aria-invalid={invalid.includes("slug") || undefined}
              className="af-dark min-w-0 flex-1 bg-transparent py-3 pr-3 text-base outline-none"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
                setInvalid((l) => l.filter((n) => n !== "slug"));
              }}
              maxLength={40}
              autoCapitalize="none"
              spellCheck={false}
            />
            <span className="flex items-center px-3" aria-live="polite">
              {slugState.status === "ok" && <Check size={18} className="text-red-400" aria-label="Available" />}
              {slugState.status === "taken" && <X size={18} className="text-red-400" aria-label="Not available" />}
            </span>
          </div>
        </Field>
        {suggestionList.length > 0 && (
          <p className="text-sm text-cream/60">
            Try:{" "}
            {suggestionList.map((s) => (
              <button type="button" key={s} className="mr-2 underline hover:text-cream" onClick={() => pickSlug(s)}>
                {s}
              </button>
            ))}
          </p>
        )}

        <div className="form-grid">
          <Field id="su-name" label="Your name *" dark>
            <input id="su-name" maxLength={60} autoComplete="name" aria-invalid={invalid.includes("name") || undefined} className="input input-dark" value={form.name} onChange={set("name")} />
          </Field>
          <Field id="su-phone" label="Mobile number" hint="10 digits" dark>
            <input id="su-phone" type="tel" inputMode="numeric" autoComplete="tel-national" aria-invalid={invalid.includes("phone") || undefined} className="input input-dark" value={form.phone} onChange={set("phone")} />
          </Field>
          <Field id="su-email" label="Email *" dark>
            <input id="su-email" type="email" maxLength={100} autoCapitalize="none" autoComplete="email" aria-invalid={invalid.includes("email") || undefined} className="input input-dark" value={form.email} onChange={set("email")} />
          </Field>
          <Field id="su-password" label="Password *" hint="8+ characters, with a letter and a number" dark>
            <PasswordInput id="su-password" dark autoComplete="new-password" aria-invalid={invalid.includes("password") || undefined}
              value={form.password} onChange={set("password")} />
          </Field>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-cream/80">Choose your plan</legend>
          <p className="text-xs text-cream/50">Free trial first. You won't be charged during the trial.</p>
          <div className="grid grid-cols-1 gap-3 pt-2 min-[460px]:grid-cols-3">
            {plans.map((p) => {
              const price = cycle === "yearly" ? Math.round(p.yearlyPrice / 12) : p.monthlyPrice;
              return (
                <PlanTile
                  key={p.key}
                  groupName="plan"
                  checked={p.key === plan?.key}
                  onChange={() => setPlanKey(p.key)}
                  title={p.name}
                  price={`₹${price.toLocaleString("en-IN")}`}
                  note={cycle === "yearly" ? `₹${p.yearlyPrice.toLocaleString("en-IN")} billed yearly` : "Billed monthly"}
                  badge={p.key === "growth" ? "Popular" : undefined}
                />
              );
            })}
          </div>
          <Segmented
            name="cycle"
            label="Billing cycle"
            value={cycle}
            onChange={setCycle}
            options={[{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly", badge: "Save 17%" }]}
          />
        </fieldset>

        <CheckField id="su-agree" checked={agreed} invalid={invalid.includes("agree")} onChange={(e) => { setAgreed(e.target.checked); setInvalid((l) => l.filter((n) => n !== "agree")); }}>
          I agree to the <Link to="/legal/terms" target="_blank">Terms &amp; Conditions</Link> and <Link to="/legal/privacy" target="_blank">Privacy Policy</Link>.
        </CheckField>

        <button type="submit" disabled={busy || !agreed} title={agreed ? undefined : "Accept the Terms & Privacy Policy to continue"} className="btn-primary w-full disabled:cursor-not-allowed">
          {busy ? "Creating your restaurant…" : "Start free trial"} <ArrowRight size={18} />
        </button>
        <p className="text-center text-sm text-cream/60">
          Already have an account? <Link to="/login" className="underline hover:text-cream">Sign in</Link>
        </p>
      </form>
    </AccountLayout>
  );
}

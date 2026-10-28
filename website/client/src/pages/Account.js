import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ExternalLink, Copy, CreditCard, Plus } from "lucide-react";
import AccountLayout, { Field } from "../components/Account/AccountLayout.js";
import PasswordInput from "../components/Account/PasswordInput.js";
import { toast } from "../components/Toast/Toast.js";
import { collect, formatName, formatTitle, sanitizePhone, vName, vRequired, vPhone, vPassword } from "../utils/validate.js";
import { useOwner } from "../context/OwnerContext.js";
import {
  changePassword, checkSlug, createRestaurant, getDashboardLink, listRestaurants, updateMe,
} from "../services/api.js";

export const PLAN_NAMES = { starter: "Essential", growth: "Professional", pro: "Premium", enterprise: "Custom" };

const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function statusLine(sub) {
  if (!sub) return "";
  if (sub.comped) return "Complimentary plan";
  switch (sub.status) {
    case "trialing": {
      const days = Math.max(0, Math.ceil((new Date(sub.trialEndsAt) - Date.now()) / 86400000));
      return `Free trial · ${days} day${days === 1 ? "" : "s"} left`;
    }
    case "active":
      return sub.cancelAtPeriodEnd ? `Ends ${fmtDate(sub.currentPeriodEnd)}` : `Renews ${fmtDate(sub.currentPeriodEnd)}`;
    case "past_due": return "Payment failed · update payment to avoid interruption";
    case "cancelled": return "Cancelled";
    case "expired": return "Expired · choose a plan to continue";
    case "suspended": return "Suspended";
    case "incomplete": return "Payment not completed";
    default: return sub.status || "";
  }
}

function RestaurantCard({ r }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const sub = r.subscription;
  const blocked = sub?.access?.level === "blocked";
  const publicUrl = r.urls?.site || `${window.location.origin}/${r.slug}`;

  const openDashboard = async () => {
    setBusy(true);
    try {
      const res = await getDashboardLink(r.id);
      window.location.assign(res.data.url);
    } catch (err) {
      toast.error(err.message || "Couldn't open the dashboard.");
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success("Restaurant link copied.");
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error("Couldn't copy the link. Copy it manually."); }
  };

  return (
    <article className="rounded-3xl border border-ink/10 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-bold">{r.name}</h3>
          <button type="button" onClick={copy} className="mt-1 inline-flex items-center gap-1 break-all text-left text-sm text-ink/60 hover:text-ink">
            {publicUrl.replace(/^https?:\/\//, "")} <Copy size={14} /> {copied && <span className="text-amber">Copied</span>}
          </button>
        </div>
        <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold">
          {PLAN_NAMES[sub?.planKey] || sub?.planKey || "No plan"}
        </span>
      </div>
      <p className={`mt-3 text-sm ${blocked || sub?.status === "past_due" ? "text-amber" : "text-ink/60"}`}>{statusLine(sub)}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={openDashboard} disabled={busy || blocked} className="btn-primary !min-h-[44px] disabled:opacity-60">
          {busy ? "Opening…" : "Open dashboard"} <ExternalLink size={16} />
        </button>
        <Link to={`/account/billing?restaurant=${r.id}`} className="btn-secondary !min-h-[44px]">
          <CreditCard size={16} /> Plan &amp; billing
        </Link>
      </div>
    </article>
  );
}

function NewRestaurant({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState([]);

  const submit = async (e) => {
    e.preventDefault();
    const res = collect([
      ["nr-name", vRequired(name, "Restaurant name")],
      ["nr-slug", slug && !/^[a-z0-9-]{3,40}$/.test(slug) ? "Web address: 3-40 letters, numbers or hyphens." : ""],
    ]);
    if (res.fields.length) {
      setInvalid(res.fields);
      toast.error(res.first);
      document.getElementById(res.fields[0])?.focus();
      return;
    }
    setBusy(true);
    try {
      const chk = await checkSlug(slug || name);
      if (!chk.data.available) {
        throw new Error(chk.data.reason + (chk.data.suggestions?.length ? ` Try: ${chk.data.suggestions.join(", ")}` : ""));
      }
      await createRestaurant({ restaurantName: name, slug: chk.data.slug, planKey: "growth" });
      setOpen(false);
      setName("");
      setSlug("");
      toast.success("Restaurant created.");
      onCreated();
    } catch (err) {
      toast.error(err.message || "Couldn't create the restaurant.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary !min-h-[44px]">
        <Plus size={16} /> Add another restaurant
      </button>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-3xl border border-ink/10 bg-white p-5">
      <Field id="nr-name" label="Restaurant name">
        <input id="nr-name" aria-invalid={invalid.includes("nr-name") || undefined} className="input" value={name} onChange={(e) => { setName(formatTitle(e.target.value)); setInvalid([]); }} maxLength={80} />
      </Field>
      <Field id="nr-slug" label="Web address (optional)" hint="Leave empty to use the restaurant name. Can't be changed later.">
        <input id="nr-slug" autoCapitalize="none" aria-invalid={invalid.includes("nr-slug") || undefined} className="input" value={slug} onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setInvalid([]); }} maxLength={40} />
      </Field>
      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="btn-primary !min-h-[44px] disabled:opacity-60">{busy ? "Creating…" : "Create"}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary !min-h-[44px]">Cancel</button>
      </div>
    </form>
  );
}

function Profile() {
  const { owner, setOwner } = useOwner();
  const [name, setName] = useState(owner?.name || "");
  const [phone, setPhone] = useState(owner?.phone || "");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [invalid, setInvalid] = useState([]);

  const run = async (fn, okText) => {
    try {
      const res = await fn();
      toast.success(res?.message || okText);
      return res;
    } catch (err) {
      toast.error(err.message || "Something went wrong. Please try again.");
      return null;
    }
  };
  const fail = (res) => {
    setInvalid(res.fields);
    toast.error(res.first);
    document.getElementById(res.fields[0])?.focus();
  };

  return (
    <section className="dk-auto-h space-y-6 rounded-3xl border border-ink/10 bg-white p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">Your account</h2>
      <form
        noValidate
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = collect([["pf-name", vName(name, "Name")], ["pf-phone", vPhone(phone)]]);
          if (res.fields.length) return fail(res);
          const ok = await run(() => updateMe({ name, phone }), "Saved.");
          if (ok) setOwner((o) => (o ? { ...o, name, phone } : o));
        }}
      >
        <Field id="pf-name" label="Name"><input id="pf-name" maxLength={60} aria-invalid={invalid.includes("pf-name") || undefined} className="input" value={name} onChange={(e) => { setName(formatName(e.target.value)); setInvalid([]); }} /></Field>
        <Field id="pf-phone" label="Mobile number" hint="10 digits"><input id="pf-phone" type="tel" inputMode="numeric" autoComplete="tel-national" aria-invalid={invalid.includes("pf-phone") || undefined} className="input" value={phone} onChange={(e) => { setPhone(sanitizePhone(e.target.value)); setInvalid([]); }} /></Field>
        <p className="col-span-full text-sm text-ink/60">Signed in as {owner?.email}</p>
        <button type="submit" className="btn-secondary col-span-full !min-h-[44px] sm:w-fit">Save</button>
      </form>
      <form
        noValidate
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          const res0 = collect([
            ["pf-cur", cur ? "" : "Current password is required."],
            ["pf-new", vPassword(next)],
            ["pf-new", !vPassword(next) && next === cur ? "New password must be different from the current one." : ""],
          ]);
          if (res0.fields.length) return fail(res0);
          const res = await run(() => changePassword(cur, next), "Password updated.");
          if (res) { setCur(""); setNext(""); }
        }}
      >
        <Field id="pf-cur" label="Current password"><PasswordInput id="pf-cur" autoComplete="current-password" aria-invalid={invalid.includes("pf-cur") || undefined} value={cur} onChange={(e) => { setCur(e.target.value); setInvalid([]); }} /></Field>
        <Field id="pf-new" label="New password" hint="8+ characters, with a letter and a number"><PasswordInput id="pf-new" autoComplete="new-password" aria-invalid={invalid.includes("pf-new") || undefined} value={next} onChange={(e) => { setNext(e.target.value); setInvalid([]); }} /></Field>
        <button type="submit" className="btn-secondary col-span-full !min-h-[44px] sm:w-fit">Change password</button>
      </form>
      <p className="text-xs text-ink/50">Your restaurant dashboard keeps its own staff passwords. Changing this one only affects your Dishky account.</p>
    </section>
  );
}

export default function Account() {
  const { owner, loading, signOut } = useOwner();
  const [params] = useSearchParams();
  const [list, setList] = useState(null);
  const load = useCallback(() => {
    listRestaurants().then((res) => setList(res.data)).catch((err) => toast.error(err.message || "Couldn't load your restaurants."));
  }, []);
  useEffect(() => { if (owner) load(); }, [owner, load]);
  const welcomeSlug = params.get("welcome");
  useEffect(() => {
    if (welcomeSlug) toast.success(`Your restaurant is ready at ${window.location.host}/${welcomeSlug}. Open the dashboard to add your menu and print your table QR codes.`, "medium");
  }, [welcomeSlug]);

  if (loading) return <AccountLayout title="Your account" wide />;
  if (!owner) return <Navigate to="/login?next=/account" replace />;

  return (
    <AccountLayout wide title="Your restaurants">
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          {(list || []).map((r) => <RestaurantCard key={r.id} r={r} />)}
        </div>
        <NewRestaurant onCreated={load} />
        <Profile />
        <button type="button" onClick={signOut} className="text-sm text-ink/60 underline hover:text-ink">Sign out</button>
      </div>
    </AccountLayout>
  );
}

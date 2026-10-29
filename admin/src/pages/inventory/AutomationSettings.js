/** AutomationSettings.js — alert windows, forecast defaults and the WhatsApp template used for purchase lists. */
import React, { useEffect, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../useToast";
import { Badge, Btn, Field, PageHead, errText } from "./InvUi";

export default function AutomationSettings() {
  const { hasModulePermission } = useAuth();
  const canWrite = hasModulePermission("purchaseSettings", "write");
  const { toast } = useToast();
  const [f, setF] = useState(null);
  const [loaded, setLoaded] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/automation/settings").then(({ data }) => { setF(data); setLoaded(data); }).catch((e) => setError(errText(e))); }, []);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const save = async (ev) => {
    ev.preventDefault(); setBusy(true);
    try {
      const body = {
        expiryAlertDays: Number(f.expiryAlertDays), dueSoonDays: Number(f.dueSoonDays), forecastLookbackDays: Number(f.forecastLookbackDays),
        forecastHorizonDays: Number(f.forecastHorizonDays), whatsappHourlyLimit: Number(f.whatsappHourlyLimit), whatsappPurchaseTemplate: f.whatsappPurchaseTemplate,
        largeVarianceThreshold: f.largeVarianceThreshold,
      };
      const { data } = await api.put("/automation/settings", body);
      setF(data); setLoaded(data); toast.success("Settings saved");
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="inner-page inv-page">
      <PageHead title="Automation settings" />
      {error && <div className="inv-banner" role="alert">{error}</div>}
      {f && (
        <form className="details-container inv-form" onSubmit={save} noValidate>
          <div className="inv-grid">
            <Field label="Expiry alert window (days)" hint="Batches expiring within this many days are flagged"><input className="inv-input" inputMode="numeric" value={f.expiryAlertDays} onChange={set("expiryAlertDays")} disabled={!canWrite} /></Field>
            <Field label="Invoice due-soon window (days)"><input className="inv-input" inputMode="numeric" value={f.dueSoonDays} onChange={set("dueSoonDays")} disabled={!canWrite} /></Field>
            <Field label="Forecast look-back (days)" hint="7 to 120. Weekday patterns need 28 or more."><input className="inv-input" inputMode="numeric" value={f.forecastLookbackDays} onChange={set("forecastLookbackDays")} disabled={!canWrite} /></Field>
            <Field label="Forecast horizon (days)"><input className="inv-input" inputMode="numeric" value={f.forecastHorizonDays} onChange={set("forecastHorizonDays")} disabled={!canWrite} /></Field>
            <Field label="Large audit variance (₹)" hint="Shown for reviewers; approval is always required"><input className="inv-input" inputMode="decimal" value={f.largeVarianceThreshold} onChange={set("largeVarianceThreshold")} disabled={!canWrite} /></Field>
            <Field label="WhatsApp sends per user per hour"><input className="inv-input" inputMode="numeric" value={f.whatsappHourlyLimit} onChange={set("whatsappHourlyLimit")} disabled={!canWrite} /></Field>
            <Field label="WhatsApp purchase-list template" full hint="The exact AiSensy campaign name of a WhatsApp-approved template with 4 variables: {{1}} supplier, {{2}} branch, {{3}} item list, {{4}} date.">
              <input className="inv-input" value={f.whatsappPurchaseTemplate} onChange={set("whatsappPurchaseTemplate")} maxLength={100} disabled={!canWrite} />
            </Field>
          </div>
          <div className="inv-formstatus">WhatsApp sending: {f.whatsappConfigured ? <Badge tone="green">ready</Badge> : <Badge tone="amber">not ready — needs the server API key and a template name</Badge>}</div>
          {canWrite && <div className="inv-formfoot"><Btn type="submit" kind="primary" disabled={busy || JSON.stringify(f) === JSON.stringify(loaded)}>{busy ? "Saving…" : "Save"}</Btn></div>}
        </form>
      )}
    </div>
  );
}

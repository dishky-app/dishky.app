/**
 * DailyClosing.js — the end-of-day closing checklist.
 * Gas cylinders (several), food wastage (several dishes), electricity meters (several EB connections), cash in hand,
 * the day's tally and a tick list. A new day is pre-filled from the previous closing (cylinders, meters with their last
 * reading). Derived figures are shown live here and recomputed by the server on save.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Badge, Btn, DataTable, DateInput, ExportBtn, Field, Modal, PageHead, Select, dateShort, errText, money } from "../pi-shared/InvUi";
import "./DailyClosing.css";
import ConfirmDialog from "../../components/ConfirmDialog";

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const n = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? 0 : Number(v));
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const WASTE_UNITS = ["kg", "g", "l", "ml", "portion", "pcs"];
const CYL_TYPES = ["LPG 19 kg", "LPG 14.2 kg", "LPG 5 kg", "Other"];
const emptyCyl = () => ({ label: "", type: "LPG 19 kg", remainingKg: "", inUse: false, notes: "" });
const emptyWaste = () => ({ dish: "", quantity: "", unit: "kg", reason: "" });
const emptyMeter = () => ({ label: "", serviceNo: "", reading: "", previousReading: null, meterReset: false });
const blankTally = { systemSales: "", cash: "", upi: "", card: "", other: "" };
const blankCash = { openingFloat: "", cashExpenses: "", cashInHand: "" };

export default function DailyClosing() {
  const { isSuperAdmin, admin: authAdmin } = useAuth();
  const { venueId, venueParam } = useVenue();
  const { toast } = useToast();
  // One unconditional useAuth() call: calling the hook inside the `||` was skipped for super admins (hook-order violation).
  const canManage = isSuperAdmin || ["Manager"].includes(authAdmin?.roleGroup);
  const [rows, setRows] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(null);

  const load = useCallback(async () => {
    setState({ loading: true, error: "" });
    try { setRows((await api.get("/closing", { params: { ...venueParam(), from: from || undefined, to: to || undefined } })).data); setState({ loading: false, error: "" }); }
    catch (e) { setState({ loading: false, error: errText(e, "Could not load closing checklists") }); }
  }, [venueParam, from, to]);
  useEffect(() => { load(); }, [load, venueId]);

  const startNew = async () => {
    const date = todayStr();
    try {
      const p = (await api.get("/closing/prefill", { params: { ...venueParam(), date } })).data;
      setForm({ id: "", status: "draft", date, cylinders: p.cylinders.length ? p.cylinders : [emptyCyl()], foodWastage: [], electricity: p.electricity.length ? p.electricity : [emptyMeter()], tally: { ...blankTally }, cash: { ...blankCash }, checks: p.checks, notes: "" });
    } catch (e) { toast.error(errText(e, "Choose a branch first")); }
  };
  const open = async (row) => {
    try {
      const d = (await api.get(`/closing/${row.id}`)).data;
      setForm({ ...d, tally: { systemSales: d.tally.systemSales, cash: d.tally.cash, upi: d.tally.upi, card: d.tally.card, other: d.tally.other }, cash: { openingFloat: d.cash.openingFloat, cashExpenses: d.cash.cashExpenses, cashInHand: d.cash.countedAny ? d.cash.cashInHand : "" } });
    } catch (e) { toast.error(errText(e)); }
  };

  const payload = (f) => ({ date: f.date, ...(venueId ? { venueId } : {}), cylinders: f.cylinders.filter((c) => c.label || c.remainingKg !== ""), foodWastage: f.foodWastage.filter((w) => w.dish || w.quantity !== ""), electricity: f.electricity.filter((m) => m.label || m.reading !== ""), tally: f.tally, cash: f.cash, checks: f.checks, notes: f.notes });
  const persist = async (f) => {
    const r = f.id ? await api.put(`/closing/${f.id}`, payload(f)) : await api.post("/closing", payload(f), { params: venueParam() });
    return r.data;
  };
  const save = async (andSubmit) => {
    setBusy(true);
    try {
      let saved = await persist(form);
      if (andSubmit) saved = (await api.post(`/closing/${saved.id}/submit`, {})).data;
      toast.success(andSubmit ? "Closing checklist submitted" : "Draft saved");
      setForm(null); load();
    } catch (e) { toast.error(errText(e)); }
    finally { setBusy(false); }
  };
  const reopen = async () => { try { await api.post(`/closing/${ask.id}/reopen`, {}); toast.success("Reopened"); setAsk(null); setForm(null); load(); } catch (e) { toast.error(errText(e)); } };
  const remove = async () => { try { await api.delete(`/closing/${ask.id}`); toast.success("Deleted"); setAsk(null); setForm(null); load(); } catch (e) { toast.error(errText(e)); } };

  const sum = (arr, k) => r2((arr || []).reduce((t, x) => t + n(x[k]), 0));
  const columns = [
    { key: "date", label: "Date", render: (r) => <Btn type="button" kind="plain" sm onClick={() => open(r)}>{dateShort(r.date)}</Btn>, exp: (r) => r.date },
    { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "submitted" ? "green" : "amber"}>{r.status === "submitted" ? "Submitted" : "Draft"}</Badge>, exp: (r) => r.status },
    { key: "gas", label: "Gas left (kg)", num: true, sortValue: (r) => sum(r.cylinders, "remainingKg"), render: (r) => `${sum(r.cylinders, "remainingKg")} (${(r.cylinders || []).length} cyl.)`, exp: (r) => sum(r.cylinders, "remainingKg") },
    { key: "waste", label: "Food wastage", sort: false, render: (r) => (r.foodWastage || []).length ? (r.foodWastage || []).map((w) => `${w.dish} ${w.quantity} ${w.unit}`).join(", ") : "—", exp: (r) => (r.foodWastage || []).map((w) => `${w.dish} ${w.quantity} ${w.unit}`).join("; ") },
    { key: "eb", label: "EB used (units)", num: true, sortValue: (r) => sum(r.electricity, "consumption"), render: (r) => sum(r.electricity, "consumption"), exp: (r) => sum(r.electricity, "consumption") },
    { key: "cashInHand", label: "Cash in hand", num: true, sortValue: (r) => r.cash?.cashInHand || 0, render: (r) => money(r.cash?.cashInHand || 0), exp: (r) => r.cash?.cashInHand || 0 },
    { key: "variance", label: "Cash variance", num: true, sortValue: (r) => r.cash?.variance || 0, render: (r) => <span style={{ color: r.cash?.variance ? "#c0392b" : undefined }}>{money(r.cash?.variance || 0)}</span>, exp: (r) => r.cash?.variance || 0 },
    { key: "tally", label: "Tally diff.", num: true, sortValue: (r) => r.tally?.difference || 0, render: (r) => <span style={{ color: r.tally?.difference ? "#c0392b" : undefined }}>{money(r.tally?.difference || 0)}</span>, exp: (r) => r.tally?.difference || 0 },
    { key: "by", label: "By", render: (r) => r.submittedByName || r.createdByName || "—", exp: (r) => r.submittedByName || r.createdByName || "" },
  ];

  return (
    <div className="inner-page inv-page">
      <PageHead title="Daily closing" count={`${rows.length} checklist(s)`}>
        <ExportBtn rows={rows} columns={columns} name="daily_closing" sheet="Daily closing" />
        <Btn type="button" kind="primary" onClick={startNew}>+ Today's closing</Btn>
      </PageHead>
      <div className="inv-toolbar dc-filters">
        {/* same rules as the Orders page: From can't pass To, picking a later From pulls To along, To can't be in the future */}
        <DateInput label="From" value={from} max={to || todayStr()} onChange={(e) => { const v = e.target.value; setFrom(v); if (v && to && v > to) setTo(v); }} />
        <DateInput label="To" value={to} min={from || undefined} max={todayStr()} onChange={(e) => setTo(e.target.value)} />
        {(from || to) && <Btn type="button" kind="plain" sm onClick={() => { setFrom(""); setTo(""); }}>Clear dates</Btn>}
      </div>
      <DataTable columns={columns} rows={rows} loading={state.loading} error={state.error} onRetry={load} empty="No closing checklists yet." rowKey={(r) => r.id} />

      {form && <ClosingForm form={form} setForm={setForm} busy={busy} canManage={canManage} onSave={save} onAsk={setAsk} />}
      {ask && <ConfirmDialog open title={ask.kind === "reopen" ? "Reopen this checklist?" : "Delete this draft?"} message={ask.kind === "reopen" ? "It becomes a draft again so it can be corrected, then submitted once more." : "This cannot be undone."} confirmLabel={ask.kind === "reopen" ? "Reopen" : "Delete"} danger={ask.kind !== "reopen"} onConfirm={ask.kind === "reopen" ? reopen : remove} onCancel={() => setAsk(null)} />}
    </div>
  );
}

// Module-level (not defined inside ClosingForm) so inputs keep focus while typing.
const Sec = ({ title, hint, onAdd, addLabel, locked, children }) => (
  <section className="dc-sec">
    <div className="dc-sec-head">
      <div><h4 className="dc-sec-title">{title}</h4>{hint && <p className="dc-sec-hint">{hint}</p>}</div>
      {!locked && onAdd && <Btn type="button" kind="plain" sm onClick={onAdd}>{addLabel}</Btn>}
    </div>
    <div className="dc-sec-body">{children}</div>
  </section>
);
const Chip = ({ on, onClick, locked, children }) => (
  <button type="button" disabled={locked} className={`filter-pill dc-chip${on ? " active" : ""}`} aria-pressed={!!on} onClick={onClick}>{children}</button>
);
const Summary = ({ children }) => <div className="dc-summary">{children}</div>;

function ClosingForm({ form, setForm, busy, canManage, onSave, onAsk }) {
  const locked = form.status === "submitted";
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setRow = (key, i, patch) => set({ [key]: form[key].map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const addRow = (key, row) => set({ [key]: [...form[key], row] });
  const delRow = (key, i) => set({ [key]: form[key].filter((_, j) => j !== i) });
  const t = form.tally, c = form.cash;
  const calc = useMemo(() => {
    const collected = r2(n(t.cash) + n(t.upi) + n(t.card) + n(t.other));
    const expected = r2(n(c.openingFloat) + n(t.cash) - n(c.cashExpenses));
    return { collected, difference: r2(collected - n(t.systemSales)), expected, variance: r2(n(c.cashInHand) - expected) };
  }, [t, c]);
  const tone = (v) => (v === 0 ? "#2e7d32" : "#c0392b");
  const num = (v, fn) => <input className="inv-input" inputMode="decimal" disabled={locked} value={v} onChange={(e) => fn(e.target.value.replace(/[^\d.]/g, ""))} />;
  const txt = (v, fn, ph) => <input className="inv-input" disabled={locked} placeholder={ph} value={v} onChange={(e) => fn(e.target.value)} />;
  return (
    <Modal wide title={`Closing — ${dateShort(form.date)}${locked ? " (submitted)" : ""}`} onClose={() => setForm(null)}
      footer={<>
        {form.id && canManage && locked && <Btn type="button" kind="plain" onClick={() => onAsk({ kind: "reopen", id: form.id })}>Reopen</Btn>}
        {form.id && canManage && !locked && <Btn type="button" kind="plain" onClick={() => onAsk({ kind: "delete", id: form.id })}>Delete draft</Btn>}
        <Btn type="button" kind="plain" onClick={() => setForm(null)}>{locked ? "Close" : "Cancel"}</Btn>
        {!locked && <Btn type="button" kind="plain" disabled={busy} onClick={() => onSave(false)}>Save draft</Btn>}
        {!locked && <Btn type="button" kind="primary" disabled={busy} onClick={() => onSave(true)}>Submit closing</Btn>}
      </>}>
      {!form.id && <div className="dc-date"><Field label="Closing date"><DateInput value={form.date} max={todayStr()} onChange={(e) => set({ date: e.target.value })} /></Field></div>}

      <Sec locked={locked} title="Gas cylinders" hint="Balance left in each cylinder at closing." onAdd={() => addRow("cylinders", emptyCyl())} addLabel="+ Add cylinder">
        {form.cylinders.map((x, i) => (
          <div key={i} className="dc-row dc-row-cyl">
            <Field label="Cylinder">{txt(x.label, (v) => setRow("cylinders", i, { label: v }), `Cylinder ${i + 1}`)}</Field>
            <Field label="Type"><Select value={x.type} disabled={locked} onChange={(e) => setRow("cylinders", i, { type: e.target.value })}>{CYL_TYPES.map((o) => <option key={o}>{o}</option>)}</Select></Field>
            <Field label="Balance left (kg)">{num(x.remainingKg, (v) => setRow("cylinders", i, { remainingKg: v }))}</Field>
            <div className="dc-row-tools">
              <Chip locked={locked} on={x.inUse} onClick={() => setRow("cylinders", i, { inUse: !x.inUse })}>In use</Chip>
              {!locked && <Btn type="button" kind="plain" sm onClick={() => delRow("cylinders", i)}>Remove</Btn>}
            </div>
          </div>
        ))}
        {!form.cylinders.length && <div className="dc-empty">No cylinders added.</div>}
      </Sec>

      <Sec locked={locked} title="Food wastage" hint="Dishes or items thrown away today." onAdd={() => addRow("foodWastage", emptyWaste())} addLabel="+ Add dish">
        {form.foodWastage.map((x, i) => (
          <div key={i} className="dc-row dc-row-waste">
            <Field label="Dish / item">{txt(x.dish, (v) => setRow("foodWastage", i, { dish: v }))}</Field>
            <Field label="Quantity">{num(x.quantity, (v) => setRow("foodWastage", i, { quantity: v }))}</Field>
            <Field label="Unit"><Select value={x.unit} disabled={locked} onChange={(e) => setRow("foodWastage", i, { unit: e.target.value })}>{WASTE_UNITS.map((o) => <option key={o}>{o}</option>)}</Select></Field>
            <Field label="Reason">{txt(x.reason, (v) => setRow("foodWastage", i, { reason: v }), "Unsold, spoiled…")}</Field>
            <div className="dc-row-tools">{!locked && <Btn type="button" kind="plain" sm onClick={() => delRow("foodWastage", i)}>Remove</Btn>}</div>
          </div>
        ))}
        {!form.foodWastage.length && <div className="dc-empty">No wastage recorded.</div>}
      </Sec>

      <Sec locked={locked} title="Electricity (EB) readings" hint="Closing meter reading for each connection." onAdd={() => addRow("electricity", emptyMeter())} addLabel="+ Add EB connection">
        {form.electricity.map((x, i) => {
          const used = x.previousReading != null && x.reading !== "" && !x.meterReset ? r2(n(x.reading) - n(x.previousReading)) : null;
          return (
            <div key={i} className="dc-row dc-row-eb">
              <Field label="Connection">{txt(x.label, (v) => setRow("electricity", i, { label: v }), `EB connection ${i + 1}`)}</Field>
              <Field label="Service no.">{txt(x.serviceNo || "", (v) => setRow("electricity", i, { serviceNo: v }))}</Field>
              <Field label="Closing reading">{num(x.reading, (v) => setRow("electricity", i, { reading: v }))}</Field>
              <div className="dc-eb-last">{x.previousReading != null ? <><span>Last: {x.previousReading}</span>{used != null && <b style={{ color: used < 0 ? "#c0392b" : undefined }}>Used: {used}</b>}</> : <span>First reading</span>}</div>
              <div className="dc-row-tools">
                <Chip locked={locked} on={x.meterReset} onClick={() => setRow("electricity", i, { meterReset: !x.meterReset })}>Meter replaced</Chip>
                {!locked && <Btn type="button" kind="plain" sm onClick={() => delRow("electricity", i)}>Remove</Btn>}
              </div>
            </div>
          );
        })}
        {!form.electricity.length && <div className="dc-empty">No EB connections added.</div>}
      </Sec>

      <Sec locked={locked} title="Tally" hint="What the POS says against what was actually collected.">
        <div className="dc-grid dc-grid-1">
          <Field label="Sales per POS (₹)">{num(t.systemSales, (v) => set({ tally: { ...t, systemSales: v } }))}</Field>
        </div>
        <div className="dc-grid dc-grid-4">
          <Field label="Cash collected (₹)">{num(t.cash, (v) => set({ tally: { ...t, cash: v } }))}</Field>
          <Field label="UPI collected (₹)">{num(t.upi, (v) => set({ tally: { ...t, upi: v } }))}</Field>
          <Field label="Card collected (₹)">{num(t.card, (v) => set({ tally: { ...t, card: v } }))}</Field>
          <Field label="Other (₹)">{num(t.other, (v) => set({ tally: { ...t, other: v } }))}</Field>
        </div>
        <Summary>Collected <b>{money(calc.collected)}</b><i /> Difference <b style={{ color: tone(calc.difference) }}>{money(calc.difference)}</b> <span>{calc.difference === 0 ? "— tallies" : calc.difference < 0 ? "— collected is less than POS sales" : "— collected is more than POS sales"}</span></Summary>
      </Sec>

      <Sec locked={locked} title="Cash in hand" hint="Count the drawer and enter what is there now.">
        <div className="dc-grid dc-grid-3">
          <Field label="Opening float (₹)">{num(c.openingFloat, (v) => set({ cash: { ...c, openingFloat: v } }))}</Field>
          <Field label="Cash paid out (₹)">{num(c.cashExpenses, (v) => set({ cash: { ...c, cashExpenses: v } }))}</Field>
          <Field label="Cash in hand now (₹)" required>{num(c.cashInHand, (v) => set({ cash: { ...c, cashInHand: v } }))}</Field>
        </div>
        <Summary>Expected <b>{money(calc.expected)}</b> <span>(float + cash collected − paid out)</span><i /> Variance <b style={{ color: tone(calc.variance) }}>{money(calc.variance)}</b></Summary>
      </Sec>

      <Sec locked={locked} title="Closing checks" hint="Tick each item once it is done.">
        <div className="dc-checks">
          {form.checks.map((x, i) => (
            <Chip key={i} locked={locked} on={x.done} onClick={() => setRow("checks", i, { done: !x.done })}>{x.done ? "✓ " : ""}{x.label}</Chip>
          ))}
        </div>
      </Sec>

      <Sec locked={locked} title="Notes">
        <textarea className="mat-input mat-textarea dc-notes" maxLength={2000} disabled={locked} placeholder="Anything the next shift or the owner should know" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Sec>
      {locked && <div className="dc-summary">Submitted by <b>{form.submittedByName}</b> on {dateShort(form.submittedAt)}.</div>}
    </Modal>
  );
}

/** Suppliers.js — supplier master (list, create/edit, block/deactivate). */
import React, { useEffect, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../useToast";
import { Badge, DataTable, Field, Modal, PageHead, Pager, errText, money, useDebounced, usePagedList } from "./InvUi";

const TONE = { active: "green", inactive: "grey", blocked: "red" };
const TYPES = ["manufacturer", "wholesaler", "distributor", "retailer", "farmer", "service", "other"];
const EMPTY = {
  name: "", code: "", type: "wholesaler", contactPerson: "", phone: "", whatsapp: "", email: "", gstin: "", pan: "",
  billingAddress: "", deliveryAddress: "", city: "", state: "", pincode: "", paymentTerms: "", creditLimit: "",
  leadTimeDays: "", minOrderValue: "", notes: "", bank: { accountName: "", bankName: "", branch: "", ifsc: "", accountType: "", upi: "", accountNumber: "" },
};

function SupplierForm({ supplier, onClose, onSaved }) {
  const { toast } = useToast();
  const editing = !!supplier;
  const [f, setF] = useState(() => supplier
    ? { ...EMPTY, ...supplier, creditLimit: supplier.creditLimit || "", minOrderValue: supplier.minOrderValue || "", leadTimeDays: supplier.leadTimeDays || "", bank: { ...EMPTY.bank, ...supplier.bank, accountNumber: "" } }
    : EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [showNo, setShowNo] = useState(false);
  // The full account number is encrypted on the server; fetch it only when editing a supplier that has one.
  useEffect(() => {
    if (!editing || !supplier.bank?.hasAccountNumber) return;
    let live = true;
    api.get(`/inventory/suppliers/${supplier.id}/bank`)
      .then(({ data }) => { if (live) setF((p) => ({ ...p, bank: { ...p.bank, accountNumber: data.accountNumber } })); })
      .catch(() => {});
    return () => { live = false; };
  }, [editing, supplier]);
  const set = (k) => (e) => { setF((p) => ({ ...p, [k]: e.target.value })); setErrors((p) => ({ ...p, [k]: "" })); };
  const setBank = (k) => (e) => setF((p) => ({ ...p, bank: { ...p.bank, [k]: e.target.value } }));

  const validate = () => {
    const e = {};
    if (!f.name.trim()) e.name = "Name is required";
    if (f.gstin && !/^\d{2}[A-Za-z]{5}\d{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]$/.test(f.gstin)) e.gstin = "Not a valid GSTIN";
    if (f.pan && !/^[A-Za-z]{5}\d{4}[A-Za-z]$/.test(f.pan)) e.pan = "Not a valid PAN";
    const acct = f.bank.accountNumber.replace(/[\s-]/g, "");
    if (acct && !/^\d{9,18}$/.test(acct)) e.accountNumber = "Account number must be 9 to 18 digits";
    if (f.bank.ifsc && !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(f.bank.ifsc)) e.ifsc = "IFSC looks like SBIN0001234";
    if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) e.email = "Not a valid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const body = { ...f };
      if (!editing && !body.code) delete body.code;
      delete body.id; delete body.status; delete body.createdAt; delete body.updatedAt; delete body.statusReason;
      body.bank = { ...body.bank };
      delete body.bank.accountLast4; delete body.bank.hasAccountNumber;
      if (!body.bank.accountNumber) delete body.bank.accountNumber;
      const { data } = editing ? await api.patch(`/inventory/suppliers/${supplier.id}`, body) : await api.post("/inventory/suppliers", body);
      toast.success(editing ? "Supplier updated" : `Supplier ${data.code} created`);
      onSaved();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  return (
    <Modal title={editing ? `Edit ${supplier.name}` : "New supplier"} onClose={onClose} wide
      footer={<>
        <button type="button" className="inv-btn" onClick={onClose}>Cancel</button>
        <button type="submit" form="inv-supplier-form" className="inv-btn inv-btn-primary" disabled={busy}>{busy ? "Saving…" : "Save supplier"}</button>
      </>}>
      <form id="inv-supplier-form" onSubmit={submit} noValidate>
        <div className="inv-grid">
          <Field label="Supplier name" required error={errors.name} full><input className={`inv-input${errors.name ? " inv-invalid" : ""}`} value={f.name} onChange={set("name")} maxLength={200} /></Field>
          <Field label="Supplier code" hint={editing ? "Cannot be changed" : "Leave blank to auto-generate"}><input className="inv-input" value={f.code} onChange={set("code")} disabled={editing} maxLength={20} /></Field>
          <Field label="Type"><select className="inv-select" value={f.type} onChange={set("type")}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
          <Field label="Contact person"><input className="inv-input" value={f.contactPerson} onChange={set("contactPerson")} /></Field>
          <Field label="Phone"><input className="inv-input" inputMode="tel" value={f.phone} onChange={set("phone")} /></Field>
          <Field label="WhatsApp number"><input className="inv-input" inputMode="tel" value={f.whatsapp} onChange={set("whatsapp")} /></Field>
          <Field label="Email" error={errors.email}><input className={`inv-input${errors.email ? " inv-invalid" : ""}`} type="email" value={f.email} onChange={set("email")} /></Field>
          <Field label="GSTIN" error={errors.gstin}><input className={`inv-input${errors.gstin ? " inv-invalid" : ""}`} value={f.gstin} onChange={set("gstin")} maxLength={15} /></Field>
          <Field label="PAN" error={errors.pan}><input className={`inv-input${errors.pan ? " inv-invalid" : ""}`} value={f.pan} onChange={set("pan")} maxLength={10} /></Field>
          <Field label="Billing address" full><textarea className="inv-textarea" value={f.billingAddress} onChange={set("billingAddress")} /></Field>
          <Field label="Delivery address" full><textarea className="inv-textarea" value={f.deliveryAddress} onChange={set("deliveryAddress")} /></Field>
          <Field label="City"><input className="inv-input" value={f.city} onChange={set("city")} /></Field>
          <Field label="State"><input className="inv-input" value={f.state} onChange={set("state")} /></Field>
          <Field label="PIN code"><input className="inv-input" inputMode="numeric" value={f.pincode} onChange={set("pincode")} maxLength={12} /></Field>
          <Field label="Payment terms"><input className="inv-input" placeholder="e.g. Net 15" value={f.paymentTerms} onChange={set("paymentTerms")} /></Field>
          <Field label="Credit limit (₹)"><input className="inv-input" inputMode="decimal" value={f.creditLimit} onChange={set("creditLimit")} /></Field>
          <Field label="Lead time (days)"><input className="inv-input" inputMode="numeric" value={f.leadTimeDays} onChange={set("leadTimeDays")} /></Field>
          <Field label="Minimum order value (₹)"><input className="inv-input" inputMode="decimal" value={f.minOrderValue} onChange={set("minOrderValue")} /></Field>
          <div className="inv-section inv-full">Bank details</div>
          <Field label="Account holder name"><input className="inv-input" value={f.bank.accountName} onChange={setBank("accountName")} /></Field>
          <Field label="Account number" error={errors.accountNumber} hint="Stored encrypted. Shown only to people who can edit suppliers.">
            <div className="inv-row">
              <input className={`inv-input${errors.accountNumber ? " inv-invalid" : ""}`} type={showNo ? "text" : "password"} inputMode="numeric" autoComplete="off" value={f.bank.accountNumber} onChange={setBank("accountNumber")} maxLength={24} />
              <button type="button" className="inv-btn inv-btn-sm" onClick={() => setShowNo((v) => !v)}>{showNo ? "Hide" : "Show"}</button>
            </div>
          </Field>
          <Field label="Bank name"><input className="inv-input" value={f.bank.bankName} onChange={setBank("bankName")} /></Field>
          <Field label="Branch"><input className="inv-input" value={f.bank.branch} onChange={setBank("branch")} /></Field>
          <Field label="IFSC code" error={errors.ifsc}><input className={`inv-input${errors.ifsc ? " inv-invalid" : ""}`} value={f.bank.ifsc} onChange={setBank("ifsc")} maxLength={11} /></Field>
          <Field label="Account type"><select className="inv-select" value={f.bank.accountType} onChange={setBank("accountType")}><option value="">—</option><option value="savings">Savings</option><option value="current">Current</option><option value="cc">Cash credit</option><option value="other">Other</option></select></Field>
          <Field label="UPI ID" full><input className="inv-input" value={f.bank.upi} onChange={setBank("upi")} placeholder="name@bank" /></Field>
          <Field label="Internal notes" full><textarea className="inv-textarea" value={f.notes} onChange={set("notes")} /></Field>
        </div>
      </form>
    </Modal>
  );
}

export default function Suppliers() {
  const { hasModulePermission } = useAuth();
  const { toast } = useToast();
  const canWrite = hasModulePermission("suppliers", "write");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const q = useDebounced(search);
  const list = usePagedList("/inventory/suppliers", { search: q, status });
  const [editing, setEditing] = useState(null); // null | {} (new) | supplier

  const setSupplierStatus = async (s, next) => {
    let reason = "";
    if (next === "blocked") {
      reason = window.prompt(`Why is ${s.name} being blocked? (required)`) || "";
      if (!reason.trim()) return;
    }
    try {
      await api.post(`/inventory/suppliers/${s.id}/status`, { status: next, reason });
      toast.success(`${s.name} is now ${next}`);
      list.reload();
    } catch (e) { toast.error(errText(e)); }
  };

  const columns = [
    { key: "code", label: "Code", render: (s) => <span className="inv-strong">{s.code}</span> },
    { key: "name", label: "Supplier", render: (s) => <div><div className="inv-strong">{s.name}</div><div className="inv-muted">{s.contactPerson || s.type}</div></div> },
    { key: "phone", label: "Phone", render: (s) => s.phone || "—" },
    { key: "gstin", label: "GSTIN", render: (s) => s.gstin || "—" },
    { key: "terms", label: "Terms", render: (s) => s.paymentTerms || "—" },
    { key: "credit", label: "Credit limit", num: true, render: (s) => (s.creditLimit ? money(s.creditLimit) : "—") },
    { key: "status", label: "Status", render: (s) => <Badge tone={TONE[s.status]}>{s.status}</Badge> },
    ...(canWrite ? [{ key: "act", label: "", render: (s) => (
      <span style={{ display: "flex", gap: 6 }}>
        <button type="button" className="inv-btn inv-btn-sm" onClick={() => setEditing(s)}>Edit</button>
        {s.status !== "active" && <button type="button" className="inv-btn inv-btn-sm" onClick={() => setSupplierStatus(s, "active")}>Activate</button>}
        {s.status === "active" && <button type="button" className="inv-btn inv-btn-sm" onClick={() => setSupplierStatus(s, "inactive")}>Deactivate</button>}
        {s.status !== "blocked" && <button type="button" className="inv-btn inv-btn-sm inv-btn-danger" onClick={() => setSupplierStatus(s, "blocked")}>Block</button>}
      </span>) }] : []),
  ];

  return (
    <div className="inv-page">
      <PageHead title="Suppliers" crumb="Masters">
        {canWrite && <button type="button" className="inv-btn inv-btn-primary" onClick={() => setEditing({})}>+ New supplier</button>}
      </PageHead>
      <div className="inv-card">
        <div className="inv-toolbar">
          <input className="inv-input inv-search" placeholder="Search name, code, phone, GSTIN" aria-label="Search suppliers" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="inv-select" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="blocked">Blocked</option>
          </select>
        </div>
        <DataTable columns={columns} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} empty="No suppliers yet. Add your first supplier to start purchasing." />
        <Pager page={list.page} setPage={list.setPage} total={list.total} pageSize={list.pageSize} />
      </div>
      {editing && <SupplierForm supplier={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
    </div>
  );
}

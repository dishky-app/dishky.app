/**
 * Attenders.js — attender (waiter) login accounts.
 * Attenders cannot sign themselves up on the user panel: the restaurant creates each account here with the attender's
 * name, mobile number, a password and their Aadhaar card. The attender signs in with the mobile number + password and
 * can change the password later from the user panel. An admin can also reset the password, replace the Aadhaar or remove
 * the account here. The mobile number is the login (and part of the account id), so it cannot be edited.
 */
import React, { useCallback, useEffect, useState } from "react";
import api from "../../api";
import { useToast } from "../../useToast";
import { Btn, DataTable, Field, Modal, PageHead, dateShort, errText } from "../pi-shared/InvUi";
import ConfirmDialog from "../../components/ConfirmDialog";
import "./StaffModules.css";

const MAX_FILE = 1.5 * 1024 * 1024;
const blank = { id: "", name: "", mobile: "", password: "", aadhaarNumber: "", aadhaarImage: "" };

export default function Attenders() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  const [form, setForm] = useState(null);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(null);

  const load = useCallback(async () => {
    setState({ loading: true, error: "" });
    try { setRows((await api.get("/attenders")).data); setState({ loading: false, error: "" }); }
    catch (e) { setState({ loading: false, error: errText(e, "Could not load attenders") }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const edit = async (row) => {
    try { const d = (await api.get(`/attenders/${row.id}`)).data; setErrs({}); setForm({ ...blank, ...d, password: "" }); }
    catch (e) { toast.error(errText(e)); }
  };

  const pickFile = (file) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { toast.error("Upload a PNG, JPG or WEBP photo of the Aadhaar card"); return; }
    if (file.size > MAX_FILE) { toast.error("The file must be under 1.5 MB"); return; }
    const r = new FileReader();
    r.onload = () => setForm((f) => ({ ...f, aadhaarImage: r.result }));
    r.readAsDataURL(file);
  };

  const save = async (ev) => {
    ev.preventDefault();
    const creating = !form.id;
    const e = {};
    if (form.name.trim().length < 2) e.name = "Enter the attender's name";
    if (creating && !/^\d{10}$/.test(form.mobile)) e.mobile = "Enter a 10-digit mobile number";
    if ((creating || form.password) && (form.password.length < 6 || form.password.length > 72)) e.password = "Password must be 6 to 72 characters";
    if (!/^\d{12}$/.test(form.aadhaarNumber.replace(/\s|-/g, ""))) e.aadhaarNumber = "Enter the 12-digit Aadhaar number";
    setErrs(e);
    if (Object.keys(e).length) return;
    const body = { name: form.name.trim(), aadhaarNumber: form.aadhaarNumber.replace(/\s|-/g, ""), aadhaarImage: form.aadhaarImage, ...(form.password ? { password: form.password } : {}) };
    setBusy(true);
    try {
      if (creating) await api.post("/attenders", { ...body, mobile: form.mobile });
      else await api.patch(`/attenders/${form.id}`, body);
      toast.success(creating ? "Attender account created" : "Attender updated");
      setForm(null); load();
    } catch (er) { toast.error(errText(er)); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    try { await api.delete(`/attenders/${del.id}`); toast.success("Attender removed"); setDel(null); load(); }
    catch (e) { toast.error(errText(e)); }
  };

  const columns = [
    { key: "name", label: "Name" },
    { key: "mobile", label: "Mobile (login)" },
    { key: "aadhaarMasked", label: "Aadhaar", render: (r) => <>{r.aadhaarMasked || "—"}{r.hasAadhaarImage ? " · card on file" : ""}</> },
    { key: "createdAt", label: "Created", render: (r) => dateShort(r.createdAt) },
    { key: "act", label: "", sort: false, render: (r) => <div className="inv-btnrow"><Btn type="button" kind="plain" sm onClick={() => edit(r)}>Edit</Btn><Btn type="button" kind="plain" sm onClick={() => setDel(r)}>Remove</Btn></div> },
  ];
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="inner-page inv-page">
      <PageHead title="Attenders" count={`${rows.length} account(s)`}>
        <Btn type="button" kind="primary" onClick={() => { setErrs({}); setForm({ ...blank }); }}>+ New attender</Btn>
      </PageHead>
      <div className="inv-hint">Attenders sign in on the user panel with their mobile number and the password set here. They can change their password themselves but cannot create an account.</div>
      <DataTable columns={columns} rows={rows} loading={state.loading} error={state.error} onRetry={load} empty="No attender accounts yet." />

      {form && (
        <Modal title={form.id ? `Edit ${form.name}` : "New attender"} onClose={() => setForm(null)}
          footer={<><Btn type="button" kind="plain" onClick={() => setForm(null)}>Cancel</Btn><Btn type="submit" form="att-form" kind="primary" disabled={busy}>{form.id ? "Save" : "Create account"}</Btn></>}>
          <form id="att-form" onSubmit={save} autoComplete="off">
            <div className="inv-grid">
              <Field label="Name" required error={errs.name}><input className="inv-input" maxLength={100} value={form.name} onChange={set("name")} /></Field>
              <Field label="Mobile number" required error={errs.mobile} hint={form.id ? "The login number cannot be changed." : "10 digits, used to sign in."}><input className="inv-input" inputMode="numeric" maxLength={10} disabled={!!form.id} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "") })} /></Field>
              <Field label={form.id ? "New password" : "Password"} required={!form.id} error={errs.password} hint={form.id ? "Leave blank to keep the current password. Setting one signs the attender out everywhere." : "At least 6 characters. Share it with the attender."}><input className="inv-input" type="text" autoComplete="new-password" maxLength={72} value={form.password} onChange={set("password")} /></Field>
              <Field label="Aadhaar number" required error={errs.aadhaarNumber}><input className="inv-input" inputMode="numeric" maxLength={14} value={form.aadhaarNumber} onChange={(e) => setForm({ ...form, aadhaarNumber: e.target.value.replace(/[^\d ]/g, "") })} /></Field>
            </div>
            <div className="admin-form-group">
              <div className="file-wrap">
                <input type="file" accept="image/*" className="file-input" onChange={(e) => pickFile(e.target.files[0])} />
                <div className="file-label">{form.aadhaarImage ? "✔ Aadhaar card selected" : "Choose Aadhaar Card Photo (optional)"}</div>
              </div>
              {form.aadhaarImage && (
                <>
                  <img src={form.aadhaarImage} alt="Aadhaar card" className="staff-image-preview" />
                  <Btn type="button" kind="plain" sm onClick={() => setForm({ ...form, aadhaarImage: "" })}>Remove photo</Btn>
                </>
              )}
            </div>
          </form>
        </Modal>
      )}
      {del && <ConfirmDialog open title="Remove attender?" message={`${del.name} will no longer be able to sign in. Orders they already took keep their name.`} confirmLabel="Remove" danger onConfirm={remove} onCancel={() => setDel(null)} />}
    </div>
  );
}

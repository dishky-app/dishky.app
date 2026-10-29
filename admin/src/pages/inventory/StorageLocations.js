/** StorageLocations.js — storage locations for the selected branch. */
import React, { useEffect, useState, useCallback } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Badge, Btn, DataTable, Field, Modal, PageHead, Select, errText } from "./InvUi";

const TYPES = ["dry_store", "cold_room", "freezer", "kitchen", "bar", "receiving", "quarantine", "other"];
const label = (t) => t.replace("_", " ");

export default function StorageLocations() {
  const { hasModulePermission } = useAuth();
  const { venueParam, venueId } = useVenue();
  const { toast } = useToast();
  const canWrite = hasModulePermission("inventoryItems", "write");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setRows((await api.get("/inventory/locations", { params: venueParam() })).data); }
    catch (e) { setError(errText(e, "Could not load locations")); }
    finally { setLoading(false); }
  }, [venueParam]);
  useEffect(() => { load(); }, [load, venueId]);

  const save = async (ev) => {
    ev.preventDefault();
    if (!form.name.trim() || (!form.id && !form.code.trim())) { toast.error("Code and name are required"); return; }
    setBusy(true);
    try {
      if (form.id) await api.patch(`/inventory/locations/${form.id}`, { name: form.name, type: form.type });
      else await api.post("/inventory/locations", { code: form.code, name: form.name, type: form.type });
      toast.success("Location saved"); setForm(null); load();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  const toggle = async (l) => {
    try { await api.patch(`/inventory/locations/${l.id}`, { status: l.status === "active" ? "inactive" : "active" }); load(); }
    catch (e) { toast.error(errText(e)); }
  };

  const columns = [
    { key: "code", label: "Code", render: (l) => <span className="inv-strong">{l.code}</span> },
    { key: "name", label: "Name" },
    { key: "type", label: "Type", render: (l) => label(l.type) },
    { key: "status", label: "Status", render: (l) => <Badge tone={l.status === "active" ? "green" : "grey"}>{l.status}</Badge> },
    ...(canWrite ? [{ key: "act", label: "", render: (l) => (
      <span style={{ display: "flex", gap: 6 }}>
        <Btn type="button" kind="plain" sm onClick={() => setForm(l)}>Edit</Btn>
        <Btn type="button" kind="plain" sm onClick={() => toggle(l)}>{l.status === "active" ? "Deactivate" : "Activate"}</Btn>
      </span>) }] : []),
  ];

  return (
    <div className="inner-page inv-page">
      <PageHead title="Storage locations">
        {canWrite && <Btn type="button" kind="primary" onClick={() => setForm({ code: "", name: "", type: "dry_store" })}>+ New location</Btn>}
      </PageHead>
      <div className="inv-stack">
        <DataTable columns={columns} rows={rows} loading={loading} error={error} onRetry={load} empty="No storage locations yet. Create one (e.g. Dry store, Cold room) before adding stock." />
      </div>
      {form && (
        <Modal title={form.id ? "Edit location" : "New location"} onClose={() => setForm(null)}
          footer={<><Btn type="button" kind="plain" onClick={() => setForm(null)}>Cancel</Btn><Btn type="submit" form="inv-loc-form" kind="primary" disabled={busy}>Save</Btn></>}>
          <form id="inv-loc-form" onSubmit={save}>
            <div className="inv-grid">
              <Field label="Code" required hint={form.id ? "Cannot be changed" : "Short, unique within the branch"}><input className="inv-input" value={form.code} disabled={!!form.id} maxLength={20} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
              <Field label="Type"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select></Field>
              <Field label="Name" required full><input className="inv-input" value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

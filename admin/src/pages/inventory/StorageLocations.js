/** StorageLocations.js — storage locations for the selected branch. */
import React, { useEffect, useState, useCallback } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Badge, DataTable, Field, Modal, PageHead, errText } from "./InvUi";

const TYPES = ["dry_store", "cold_room", "freezer", "kitchen", "bar", "receiving", "quarantine", "other"];
const label = (t) => t.replace("_", " ");

export default function StorageLocations() {
  const { hasModulePermission } = useAuth();
  const { venueParam, venueId, currentVenue } = useVenue();
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
        <button type="button" className="inv-btn inv-btn-sm" onClick={() => setForm(l)}>Edit</button>
        <button type="button" className="inv-btn inv-btn-sm" onClick={() => toggle(l)}>{l.status === "active" ? "Deactivate" : "Activate"}</button>
      </span>) }] : []),
  ];

  return (
    <div className="inv-page">
      <PageHead title="Storage locations" crumb="Masters">
        {canWrite && <button type="button" className="inv-btn inv-btn-primary" onClick={() => setForm({ code: "", name: "", type: "dry_store" })}>+ New location</button>}
      </PageHead>
      {currentVenue && <div className="inv-muted">Branch: {currentVenue.name}</div>}
      <div className="inv-card">
        <DataTable columns={columns} rows={rows} loading={loading} error={error} onRetry={load} empty="No storage locations yet. Create one (e.g. Dry store, Cold room) before adding stock." />
      </div>
      {form && (
        <Modal title={form.id ? "Edit location" : "New location"} onClose={() => setForm(null)}
          footer={<><button type="button" className="inv-btn" onClick={() => setForm(null)}>Cancel</button><button type="submit" form="inv-loc-form" className="inv-btn inv-btn-primary" disabled={busy}>Save</button></>}>
          <form id="inv-loc-form" onSubmit={save}>
            <div className="inv-grid">
              <Field label="Code" required hint={form.id ? "Cannot be changed" : "Short, unique within the branch"}><input className="inv-input" value={form.code} disabled={!!form.id} maxLength={20} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
              <Field label="Type"><select className="inv-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></Field>
              <Field label="Name" required full><input className="inv-input" value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

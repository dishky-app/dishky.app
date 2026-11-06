/**
 * SupplierMemos.js — memos raised against one supplier, shown on the supplier details page.
 * Each memo is a normal Memo Management record (type "Supplier Issue", linked by supplierId), so it has the full
 * memo workflow and timeline; here the timeline is shown inline and the title opens the memo itself.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Btn, Field, Modal, Select, dateTime, errText } from "../pi-shared/InvUi";
import { PRIORITIES, memoStatusClass, memoPriorityClass } from "../MemoShared";
import "../Memos.css";

function Timeline({ entries }) {
  return (
    <div className="memo-timeline">
      {(entries || []).map((ev) => (
        <div key={ev.id} className="memo-timeline-item">
          <div className="memo-timeline-dot" />
          <div><span className="memo-timeline-action">{ev.action}</span><span className="memo-timeline-time">{dateTime(ev.createdAt)}</span></div>
          {ev.userName && <div className="memo-timeline-by">By {ev.userName}{ev.userRoleTitle ? ` (${ev.userRoleTitle})` : ""}</div>}
          {(ev.notes || ev.story) && <div className="memo-timeline-notes">{ev.notes || ev.story}</div>}
        </div>
      ))}
    </div>
  );
}

export default function SupplierMemos({ supplier }) {
  const { venueParam, venueId } = useVenue();
  const { toast } = useToast();
  const [memos, setMemos] = useState(null); // null = loading, false = not available to this user
  const [open, setOpen] = useState({});
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setMemos((await api.get("/memos", { params: { ...venueParam(), supplierId: supplier.id } })).data); }
    catch { setMemos(false); } // no access to memos (or the plan has none)
  }, [supplier.id, venueParam]);
  useEffect(() => { load(); }, [load, venueId]);

  const save = async (ev) => {
    ev.preventDefault();
    if (!form.title.trim()) { setForm({ ...form, err: "A title is required" }); return; }
    setBusy(true);
    try {
      await api.post("/memos", {
        memoType: "Supplier Issue", department: "Purchase", title: form.title.trim(), description: form.description.trim(), priority: form.priority,
        supplierId: supplier.id, incidentDate: new Date().toISOString().slice(0, 10),
      }, { params: { ...venueParam() } });
      toast.success("Memo added to the supplier's timeline");
      setForm(null); load();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  if (memos === false) return null;
  return (
    <div className="horizontal-form-group">
      <div className="section">
        <div className="section-title"><span>Memos</span></div>
        <div style={{ padding: "0 0 10px" }}><Btn type="button" kind="primary" sm onClick={() => setForm({ title: "", description: "", priority: "Normal", err: "" })}>+ Add memo</Btn></div>
        {memos === null ? <div className="inv-muted">Loading…</div> : memos.length === 0 ? <div className="inv-empty">No memos about this supplier yet.</div> : memos.map((m) => (
          <div key={m.id} className="inv-card" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Link to={`/memos/${m.id}`} className="clickable">{m.id}</Link>
              <b>{m.title}</b>
              <span className={memoStatusClass(m.status)}>{m.status}</span>
              <span className={memoPriorityClass(m.priority)}>{m.priority}</span>
              <span className="inv-muted">{dateTime(m.createdAt)} · {m.createdByName}</span>
              <Btn type="button" kind="plain" sm onClick={() => setOpen({ ...open, [m.id]: !open[m.id] })}>{open[m.id] ? "Hide timeline" : "Timeline"}</Btn>
            </div>
            {m.description && <div className="inv-muted" style={{ marginTop: 6 }}>{m.description}</div>}
            {open[m.id] && <Timeline entries={m.timeline} />}
          </div>
        ))}
      </div>
      {form && (
        <Modal title={`New memo — ${supplier.name}`} onClose={() => setForm(null)}
          footer={<><Btn type="button" kind="plain" onClick={() => setForm(null)}>Cancel</Btn><Btn type="submit" form="sup-memo-form" kind="primary" disabled={busy}>Save memo</Btn></>}>
          <form id="sup-memo-form" onSubmit={save}>
            <Field label="Title" required error={form.err}><input className="inv-input" maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, err: "" })} /></Field>
            <Field label="What happened?" full><textarea className="inv-textarea" maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Priority"><Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field>
            <div className="inv-hint">The memo opens in Memo Management with its full timeline; later updates appear here too.</div>
          </form>
        </Modal>
      )}
    </div>
  );
}

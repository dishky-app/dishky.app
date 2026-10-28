import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "../api.js";
import Button3D from "../components/Button3D.js";
import CustomDropdown from "../components/CustomDropdown.js";
import MediaPicker from "../components/MediaPicker.js";
import PageLoader from "../components/PageLoader.js";
import { Badge, DetailsPage, EmptyRow, Section, Value } from "../components.js";
import { toTitleCase, digitsOnly10, isValidMobile, isValidEmail, MOBILE_ERROR } from "../formUtils.js";
import { fileToAvatar } from "../imageUtils.js";
import Modal, { Field } from "../tickets/Modal.js";
import { StatusTag, PriorityTag, dateTime, dateOnly } from "../tickets/ui.js";
import { useToast } from "../useToast.js";
import { STATUS_TONE, csv } from "./Staff.js";

function TicketTable({ rows, empty }) {
  return (
    <table className="data-table">
      <thead><tr><th>Ticket</th><th>Title</th><th>Restaurant</th><th>As</th><th>Priority</th><th>Status</th><th>Deadline</th></tr></thead>
      <tbody>
        {rows.length === 0 && <EmptyRow colSpan={7} message={empty} />}
        {rows.map((t) => (
          <tr key={t.ticketId}>
            <td><Link className="clickable" to={`/tickets/${t.ticketId}`}>{t.ticketId}</Link></td><td>{t.title}</td><td>{t.restaurantName}</td><td>{t.as}</td>
            <td><PriorityTag priority={t.priority} /></td><td><StatusTag status={t.status} label={t.status.replace(/_/g, " ")} /></td><td>{dateOnly(t.deadline)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const toForm = (s) => ({
  name: s.name || "", email: s.email || "", phone: s.phone || "", role: s.role || "",
  department: s.department || "", designation: s.designation || "",
  skills: (s.skills || []).join(", "), supportedModules: (s.supportedModules || []).join(", "),
  profileImage: s.profileImage || "",
});

// Same page layout and inline edit mode as the Admin Panel's DishDetails:
// header (back · name · Edit) → body of sections → footer (Cancel / Save while editing).
export default function StaffDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [d, setD] = useState(null);
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deact, setDeact] = useState(null); // { reassignTo, error, busy, candidates }
  const [note, setNote] = useState(null);   // invite link result
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { try { setD(await api.staffDetail(id)); setError(""); } catch (e) { setError(e.message); toast.error(e.message); } }, [id, toast]);
  useEffect(() => { load(); api.staffRoles().then((r) => setRoles(r.roles)).catch(() => {}); }, [load]);

  const back = () => navigate("/staff");
  const set = (k) => (x) => setForm((p) => ({ ...p, [k]: x && x.target ? x.target.value : x }));

  const startEditing = () => { setForm(toForm(d.staff)); setIsEditing(true); };
  const cancelEditing = () => { setIsEditing(false); setForm(null); };
  const save = async () => {
    if (String(form.name || "").trim().length < 2) return toast.error("Enter the staff member's full name.");
    if (!isValidEmail(form.email)) return toast.error("Enter a valid work email address.");
    if (!form.role) return toast.error("Choose a role.");
    if (form.phone && !isValidMobile(form.phone)) return toast.error(MOBILE_ERROR);
    setSaving(true);
    try {
      await api.staffUpdate(id, { ...form, skills: csv(form.skills), supportedModules: csv(form.supportedModules) });
      await load();
      setIsEditing(false); setForm(null);
      toast.success("Staff member updated");
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const resend = async () => { setBusy(true); try { setNote(await api.staffResendInvite(id)); } catch (e) { toast.error(e.message); } finally { setBusy(false); } };
  const reactivate = async () => { setBusy(true); try { const r = await api.staffReactivate(id); if (r.inviteLink || r.emailSent !== undefined) setNote(r); await load(); toast.success("Staff member reactivated"); } catch (e) { toast.error(e.message); } finally { setBusy(false); } };

  const openDeactivate = async () => {
    let candidates = [];
    try { candidates = (await api.ticketApi.assignable("developer")).filter((x) => x.id !== id); } catch { /* empty */ }
    setDeact({ reassignTo: "", error: "", busy: false, candidates });
  };
  const doDeactivate = async () => {
    setDeact((p) => ({ ...p, busy: true, error: "" }));
    try { await api.staffDeactivate(id, deact.reassignTo ? { reassignTo: deact.reassignTo } : {}); setDeact(null); await load(); toast.success("Staff member deactivated"); }
    catch (e) { setDeact((p) => ({ ...p, busy: false, error: e.message })); }
  };

  if (error && !d) return <DetailsPage title="Staff" onBack={back} footer={<Button3D variant="cancel" onClick={back}>Back</Button3D>}><div className="details-notice is-error" role="alert">{error}</div></DetailsPage>;
  if (!d) return <PageLoader fill label="Loading staff member…" />;
  const s = d.staff;
  const view = isEditing ? form : null;
  const devTickets = d.activeTickets.filter((t) => t.as === "developer");

  const headerActions = !isEditing && (
    <>
      <Button3D variant="cancel" onClick={startEditing}>Edit</Button3D>
      {s.status !== "deactivated" && <Button3D variant="cancel" disabled={busy} onClick={resend}>{s.status === "invited" ? "Resend invitation" : "Send password reset"}</Button3D>}
      {s.status === "deactivated" ? <Button3D disabled={busy} onClick={reactivate}>Reactivate</Button3D> : <Button3D variant="danger" onClick={openDeactivate}>Deactivate</Button3D>}
    </>
  );

  const textInput = (key, max, extra = {}) => <input value={view[key]} onChange={set(key)} maxLength={max} {...extra} />;

  return (
    <DetailsPage
      title={s.name}
      onBack={() => { cancelEditing(); back(); }}
      meta={<><Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge><span className="subtitle">{s.staffNo} · {s.role}</span></>}
      actions={headerActions}
      footer={isEditing && (
        <>
          <Button3D variant="cancel" disabled={saving} onClick={cancelEditing}>Cancel</Button3D>
          <Button3D disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</Button3D>
        </>
      )}
    >
      {error && <div className="details-notice is-error" role="alert">{error}</div>}

      <div className="horizontal-form-group">
        {/* PICTURE */}
        <div>
          <div className="details-avatar">
            {(isEditing ? form.profileImage : s.profileImage)
              ? <img src={isEditing ? form.profileImage : s.profileImage} alt={s.name} />
              : <div className="details-avatar-fallback">{(s.name || "?").charAt(0).toUpperCase()}</div>}
          </div>
          {isEditing && (
            <div style={{ width: "150px", marginTop: 6 }}>
              <MediaPicker
                label="Change Image" accept="image/png,image/jpeg,image/webp"
                onPick={async ([f]) => { try { set("profileImage")(await fileToAvatar(f)); } catch (e) { toast.error(e.message); } }}
              />
              {form.profileImage && <button type="button" className="details-link clickable" onClick={() => set("profileImage")("")}>Remove picture</button>}
            </div>
          )}
        </div>

        <Section title="Name">{isEditing ? <Field label="Full name" required>{textInput("name", 120, { onChange: (e) => set("name")(toTitleCase(e.target.value)) })}</Field> : <Value>{s.name}</Value>}</Section>
        <Section title="Email">{isEditing ? <Field label="Work email" required hint="Changing the e-mail changes the login.">{textInput("email", 200, { type: "email" })}</Field> : <Value>{s.email}</Value>}</Section>
        <Section title="Phone">{isEditing ? <Field label="Phone">{textInput("phone", 10, { type: "tel", inputMode: "numeric", placeholder: "10-digit mobile number", onChange: (e) => set("phone")(digitsOnly10(e.target.value)) })}</Field> : <Value>{s.phone}</Value>}</Section>
      </div>

      <div className="horizontal-form-group">
        <Section title="Role">
          {isEditing
            ? <CustomDropdown label="Role" required value={form.role} onChange={set("role")} options={roles} placeholder="Choose role" />
            : <Value>{s.role}</Value>}
        </Section>
        <Section title="Designation">{isEditing ? <Field label="Designation">{textInput("designation", 80, { onChange: (e) => set("designation")(toTitleCase(e.target.value)) })}</Field> : <Value>{s.designation}</Value>}</Section>
        <Section title="Department">{isEditing ? <Field label="Department">{textInput("department", 80, { onChange: (e) => set("department")(toTitleCase(e.target.value)) })}</Field> : <Value>{s.department}</Value>}</Section>
      </div>

      <div className="horizontal-form-group">
        <Section title="Skills">{isEditing ? <Field label="Skills" hint="Comma-separated">{textInput("skills", 400)}</Field> : <Value>{(s.skills || []).join(", ")}</Value>}</Section>
        <Section title="Supported modules">{isEditing ? <Field label="Supported modules" hint="Comma-separated, e.g. Orders, Payments">{textInput("supportedModules", 400)}</Field> : <Value>{(s.supportedModules || []).join(", ")}</Value>}</Section>
      </div>

      {!isEditing && (
        <>
          <div className="horizontal-form-group">
            <Section title="Joined"><Value>{dateOnly(s.joinedAt)}</Value></Section>
            <Section title="Last login"><Value>{s.lastLoginAt ? dateTime(s.lastLoginAt) : ""}</Value></Section>
            <Section title="Last activity"><Value>{s.lastActivityAt ? dateTime(s.lastActivityAt) : ""}</Value></Section>
            <Section title="Workload"><p>{s.assignments} open as developer</p></Section>
          </div>
          {s.status === "deactivated" && <Section title="Deactivated"><Value>{`${dateTime(s.deactivatedAt)} by ${s.deactivatedBy}`}</Value></Section>}

          <Section title={`Active assignments (${d.activeTickets.length})`} wide><TicketTable rows={d.activeTickets} empty="No open tickets" /></Section>
          <Section title={`Ticket history (${d.historicalTickets.length})`} wide><TicketTable rows={d.historicalTickets} empty="No completed tickets yet" /></Section>

          <Section title={`Permissions (${s.role})`} wide hint="Granted by the role.">
            {d.permissions.length === 0 ? <Value>No permissions</Value> : (
              <table className="data-table">
                <thead><tr><th>Permission</th></tr></thead>
                <tbody>{d.permissions.map((p) => <tr key={p}><td><code>{p}</code></td></tr>)}</tbody>
              </table>
            )}
            <p>Edit them in <Link to="/roles">Roles &amp; Permissions</Link>.</p>
          </Section>
        </>
      )}

      {note && (
        <Modal title="Link sent" onClose={() => setNote(null)} hideSubmit wide>
          {note.emailSent ? <p style={{ margin: 0 }}>An e-mail with a single-use link was sent to {s.email}.</p> : (
            <>
              <p className="tk-warn">E-mail isn't configured on the server. Share this single-use link yourself:</p>
              <div className="tk-link-box">{note.inviteLink}</div>
            </>
          )}
        </Modal>
      )}
      {deact && (
        <Modal title={`Deactivate ${s.name}?`} danger onClose={() => setDeact(null)} onSubmit={doDeactivate} busy={deact.busy} submitLabel="Deactivate" wide>
          <p style={{ margin: 0 }}>They will be signed out everywhere, will not be able to log in, and cannot receive new assignments. Ticket and audit history is kept.</p>
          {devTickets.length > 0 && (
            <>
              <p className="tk-warn">{devTickets.length} open ticket(s) are assigned to {s.name} as developer. Choose who takes them over.</p>
              <CustomDropdown label="Reassign developer work to" required value={deact.reassignTo} onChange={(v) => setDeact((p) => ({ ...p, reassignTo: v }))} options={deact.candidates.map((c) => ({ value: c.id, label: `${c.name} — ${c.role} (${c.activeWorkload} active)` }))} placeholder="Choose developer" />
            </>
          )}
          {deact.error && <p className="auth-error" role="alert">{deact.error}</p>}
        </Modal>
      )}
    </DetailsPage>
  );
}

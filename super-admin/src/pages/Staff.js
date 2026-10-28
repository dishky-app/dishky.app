import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as api from "../api.js";
import Button3D from "../components/Button3D.js";
import CustomDropdown from "../components/CustomDropdown.js";
import PageLoader from "../components/PageLoader.js";
import MediaPicker from "../components/MediaPicker.js";
import { fileToAvatar } from "../imageUtils.js";
import { Badge, Collapsible, EmptyRow, ErrorNote, PageHeader, ResultCount, useCollapse } from "../components.js";
import Modal, { Field } from "../tickets/Modal.js";
import { useToast } from "../useToast.js";
import { toTitleCase, digitsOnly10, isValidMobile, isValidEmail, MOBILE_ERROR } from "../formUtils.js";
import { dateTime, dateOnly } from "../tickets/ui.js";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader.js";
import useServerInfinite, { makeSorter } from "../hooks/useServerInfinite.js";

const LIMIT = 20;
export const STATUS_TONE = { active: "ok", invited: "warn", deactivated: "muted" };
export const csv = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);

/** Create / edit form shared by the directory and the detail page. */
export function StaffForm({ roles, initial, restaurants = [], onClose, onSaved }) {
  const editing = !!initial;
  const { toast } = useToast();
  const [v, setV] = useState({
    name: initial?.name || "", email: initial?.email || "", phone: initial?.phone || "", role: initial?.role || "",
    department: initial?.department || "Engineering", designation: initial?.designation || "",
    skills: (initial?.skills || []).join(", "), supportedModules: (initial?.supportedModules || []).join(", "),
    profileImage: initial?.profileImage || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const set = (k) => (x) => setV((p) => ({ ...p, [k]: x && x.target ? x.target.value : x }));

  const submit = async () => {
    if (v.name.trim().length < 2) return toast.error("Enter the staff member's full name.");
    if (!isValidEmail(v.email)) return toast.error("Enter a valid work email address.");
    if (!v.role) return toast.error("Choose a role.");
    if (v.phone && !isValidMobile(v.phone)) return toast.error(MOBILE_ERROR);
    setBusy(true); setError("");
    const body = { ...v, skills: csv(v.skills), supportedModules: csv(v.supportedModules) };
    try {
      if (editing) { onSaved(await api.staffUpdate(initial.id, body)); toast.success("Staff member updated"); onClose(); }
      else { const r = await api.staffCreate(body); setResult(r); toast.success("Staff member created"); }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (result) {
    return (
      <Modal title="Staff member created" onClose={() => { onSaved(result.staff); onClose(); }} hideSubmit wide>
        <p style={{ margin: 0 }}><strong>{result.staff.name}</strong> ({result.staff.staffNo}) was added as <strong>{result.staff.role}</strong>.</p>
        {result.emailSent
          ? <p className="subtitle" style={{ margin: 0 }}>An invitation e-mail was sent to {result.staff.email}. The link is valid for 72 hours and works once.</p>
          : (
            <>
              <p className="tk-warn">E-mail isn't configured on the server, so no message was sent. Share this single-use invitation link with {result.staff.name} yourself (valid 72 hours):</p>
              <div className="tk-link-box">{result.inviteLink}</div>
            </>
          )}
      </Modal>
    );
  }
  return (
    <Modal title={editing ? "Edit staff member" : "Add Dishky staff member"} onClose={onClose} onSubmit={submit} busy={busy} submitLabel={editing ? "Save changes" : "Create & invite"} wide>
      <Field label="Full name" required><input value={v.name} onChange={(e) => set("name")(toTitleCase(e.target.value))} maxLength={120} autoComplete="off" /></Field>
      <Field label="Work email" required hint={editing ? "Changing the e-mail changes the login." : "The login account is created through an e-mailed invitation — no password is typed here."}><input type="email" value={v.email} onChange={set("email")} /></Field>
      <CustomDropdown label="Role" required value={v.role} onChange={set("role")} options={roles} placeholder="Choose role" />
      <Field label="Designation"><input value={v.designation} onChange={(e) => set("designation")(toTitleCase(e.target.value))} maxLength={80} placeholder="e.g. Backend Engineer" /></Field>
      <Field label="Department"><input value={v.department} onChange={(e) => set("department")(toTitleCase(e.target.value))} maxLength={80} /></Field>
      <Field label="Phone"><input type="tel" inputMode="numeric" value={v.phone} onChange={(e) => set("phone")(digitsOnly10(e.target.value))} maxLength={10} placeholder="10-digit mobile number" /></Field>
      <Field label="Skills" hint="Comma-separated"><input value={v.skills} onChange={set("skills")} placeholder="React, Node.js, MongoDB" /></Field>
      <Field label="Supported modules" hint="Comma-separated, e.g. Orders, Payments"><input value={v.supportedModules} onChange={set("supportedModules")} /></Field>
      <div className="admin-form-group form-group">
        <span className="tk-label">Profile picture (optional)</span>
        <MediaPicker
          label={v.profileImage ? "✔ Picture selected — change" : "Choose picture"} accept="image/png,image/jpeg,image/webp" preview={v.profileImage}
          onPick={async ([f]) => { try { set("profileImage")(await fileToAvatar(f)); setError(""); } catch (e) { setError(e.message); } }}
        />
        {v.profileImage && <button type="button" className="details-link clickable" onClick={() => set("profileImage")("")}>Remove picture</button>}
      </div>
      <ErrorNote error={error} />
    </Modal>
  );
}

export default function Staff() {
  const [collapsed, toggleCollapsed] = useCollapse();
  const [params, setParams] = useSearchParams();
  const q = { search: params.get("search") || "", role: params.get("role") || "", status: params.get("status") || "", sort: params.get("sort") || "name", dir: params.get("dir") || "asc", page: Number(params.get("page")) || 1 };
  const [searchText, setSearchText] = useState(q.search);
  const [roles, setRoles] = useState([]);
  const [creating, setCreating] = useState(false);

  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === "" || v === null ? next.delete(k) : next.set(k, v)));
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };
  useEffect(() => { api.staffRoles().then((r) => setRoles(r.roles)).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => { if (searchText !== q.search) set({ search: searchText }); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);
  // Filters/search only: the sort is passed separately so changing it never shows the loader.
  const filterKey = (() => { const p = new URLSearchParams(params); p.delete("sort"); p.delete("dir"); return p.toString(); })();
  const { page: _ignoredPage, ...filters } = q;
  const { rows, total, loaded, busy, loadingMore, hasMore, error, sentinelRef, containerRef, refresh } =
    useServerInfinite((page, limit) => api.staffList({ ...filters, page, limit }), filterKey, {
      pageSize: LIMIT,
      sort: { id: `${q.sort}:${q.dir}`, compare: makeSorter((r) => r[q.sort], q.dir) },
    });
  const data = loaded ? { total } : null;
  const load = refresh;

  const Th = ({ k, children }) => (
    <th onClick={() => set({ sort: k, dir: q.sort === k && q.dir === "asc" ? "desc" : "asc" })} style={{ cursor: "pointer" }}>
      <span className="th-content sort-th">{children}{q.sort === k && <span className="sort-arrow">{q.dir === "desc" ? "▼" : "▲"}</span>}</span>
    </th>
  );

  return (
    <div className="inner-page">
      <PageHeader collapsed={collapsed} onToggle={toggleCollapsed} title="Dishky Staff" count={data?.total} subtitle="Developers, testers, QA, support and release staff"><Button3D onClick={() => setCreating(true)}>Add staff</Button3D></PageHeader>
      <Collapsible collapsed={collapsed}>
      <div className="filter-bar">
        <input className="search-input" placeholder="Search name, e-mail, ID, skill…" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        <div className="filter-groups">
          <CustomDropdown label="Role" value={q.role} onChange={(v) => set({ role: v })} options={roles} placeholder="All roles" />
          <CustomDropdown label="Status" value={q.status} onChange={(v) => set({ status: v })} options={[{ value: "active", label: "Active" }, { value: "invited", label: "Invited" }, { value: "deactivated", label: "Deactivated" }]} placeholder="All statuses" />
        </div>
      </div>
      </Collapsible>
      <ErrorNote error={error} />
      {!data && !error ? <PageLoader /> : (
        <>
          <div className="table-wrapper" ref={containerRef}>
            <table>
              <thead><tr><Th k="staffNo">ID</Th><Th k="name">Name</Th><th>Email</th><th>Department</th><th>Designation</th><Th k="role">Role</Th><th>Skills</th><th>Modules</th><Th k="status">Status</Th><Th k="joinedAt">Joined</Th><th>Assignments</th><Th k="lastActivityAt">Last activity</Th></tr></thead>
              <tbody>
                {loaded && rows.length === 0 && <EmptyRow colSpan={12} message="No staff found" />}
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>{s.staffNo}</td>
                    <td><Link to={`/staff/${s.id}`} className="clickable">{s.profileImage && <img src={s.profileImage} alt="" width="22" height="22" style={{ borderRadius: 99, verticalAlign: "middle", marginRight: 6 }} />}{s.name}</Link></td>
                    <td>{s.email}</td><td>{s.department}</td><td>{s.designation || "—"}</td><td>{s.role}</td>
                    <td>{(s.skills || []).slice(0, 3).join(", ") || "—"}</td><td>{(s.supportedModules || []).slice(0, 3).join(", ") || "—"}</td>
                    <td><Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge></td>
                    <td>{dateOnly(s.joinedAt)}</td><td>{s.assignments}</td><td>{s.lastActivityAt ? dateTime(s.lastActivityAt) : "—"}</td>
                  </tr>
                ))}
                <InfiniteScrollLoader sentinelRef={sentinelRef} hasMore={hasMore} colSpan={12} />
              </tbody>
            </table>
            <InfiniteScrollOverlay isLoading={loadingMore || busy} label={busy ? "Updating…" : undefined} />
          </div>
          {loaded && <ResultCount total={total} shown={rows.length} />}
        </>
      )}
      {creating && <StaffForm roles={roles} onClose={() => setCreating(false)} onSaved={() => load()} />}
    </div>
  );
}

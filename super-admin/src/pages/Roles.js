import React, { useEffect, useState } from "react";
import * as api from "../api.js";
import Button3D from "../components/Button3D.js";
import PageLoader from "../components/PageLoader.js";
import { Collapsible, ErrorNote, PageHeader, useCollapse } from "../components.js";
import { Field } from "../tickets/Modal.js";
import { useToast } from "../useToast.js";

const PRIORITIES = ["critical", "high", "medium", "low"];

// Roles & Permissions for Dishky's internal team. The permission group "Developer Support & Ticket
// Management" is enforced by the API on every request (server/support), not just hidden in the UI.
// Restaurant users' access to tickets is set in each restaurant's own Roles and Responsibilities page.
export default function Roles() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [collapsed, toggleCollapsed] = useCollapse();
  const [perms, setPerms] = useState({});
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const apply = (r) => { setData(r); setPerms(JSON.parse(JSON.stringify(r.rolePermissions))); setCfg(JSON.parse(JSON.stringify(r.config))); };
  useEffect(() => { api.staffRoles().then(apply).catch((e) => setError(e.message)); }, []);

  if (!data) return <div className="inner-page"><PageHeader title="Roles & Permissions" /><ErrorNote error={error} />{!error && <PageLoader />}</div>;

  const toggle = (role, key) => {
    setSaved(false);
    setPerms((p) => ({ ...p, [role]: p[role].includes(key) ? p[role].filter((x) => x !== key) : [...p[role], key] }));
  };
  const save = async () => {
    setBusy(true); setError(""); setSaved(false);
    try {
      const r = await api.staffRolesSave({ rolePermissions: perms, slaHours: cfg.slaHours, reopenWindowDays: cfg.reopenWindowDays, autoCloseDays: cfg.autoCloseDays, deadlineWarningHours: cfg.deadlineWarningHours });
      setData((d) => ({ ...d, rolePermissions: r.rolePermissions, config: r.config }));
      setPerms(JSON.parse(JSON.stringify(r.rolePermissions))); setCfg(JSON.parse(JSON.stringify(r.config))); setSaved(true);
      toast.success("Saved. Changes apply to staff on their next request.");
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const doReset = async () => {
    setBusy(true);
    try { const r = await api.staffRolesReset(); setPerms(JSON.parse(JSON.stringify(r.rolePermissions))); setSaved(true); toast.success("Roles reset to the defaults"); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const reset = () => toast.confirm("Reset every role to the default permissions?", doReset, undefined, { title: "Reset roles", confirmLabel: "Reset" });
  const groups = [...new Set(data.permissions.map((p) => p.group))];
  const dirty = JSON.stringify(perms) !== JSON.stringify(data.rolePermissions) || JSON.stringify(cfg) !== JSON.stringify(data.config);
  const num = (k) => (e) => { setSaved(false); setCfg((c) => ({ ...c, [k]: e.target.value })); };

  return (
    <div className="inner-page rp-page">
      <PageHeader title="Roles & Permissions" subtitle={`Permission group: ${data.group}`} collapsed={collapsed} onToggle={toggleCollapsed} collapseLabel="details">
        <Button3D variant="cancel" disabled={busy} onClick={reset}>Reset to defaults</Button3D>
        <Button3D disabled={busy || !dirty} onClick={save}>{busy ? "Saving…" : "Save changes"}</Button3D>
      </PageHeader>
      <ErrorNote error={error} />
      <Collapsible collapsed={collapsed} className="rp-body">
      <p className="subtitle">Super Admin always has every permission and is not listed. Staff management permissions are only usable from this console.</p>
      <div className="table-wrapper tk-perm-table">
        <table>
          <thead><tr><th>Permission</th>{data.roles.map((r) => <th key={r} style={{ fontSize: 12 }}>{r}</th>)}</tr></thead>
          <tbody>
            {groups.map((g) => (
              <React.Fragment key={g}>
                <tr className="tk-perm-group"><td colSpan={data.roles.length + 1}>{g}</td></tr>
                {data.permissions.filter((p) => p.group === g).map((p) => (
                  <tr key={p.key}>
                    <td>{p.label}<br /><code>{p.key}</code></td>
                    {data.roles.map((r) => (
                      <td key={r}>
                        <span className="perm-toggle-wrapper">
                          <input type="checkbox" className={`perm-toggle${perms[r].includes(p.key) ? " on" : ""}`} checked={perms[r].includes(p.key)} readOnly role="switch" aria-checked={perms[r].includes(p.key)} aria-label={`${r}: ${p.label}`} onClick={(e) => { e.preventDefault(); toggle(r, p.key); }} />
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="tk-card tk-form" style={{ marginTop: 14 }}>
        <h4>Deadlines &amp; closure rules</h4>
        <p className="subtitle" style={{ margin: 0 }}>Default resolution deadline (hours) offered when a ticket is assigned, by priority:</p>
        <div className="tk-fields-row">
          {PRIORITIES.map((p) => (
            <Field key={p} label={`${p[0].toUpperCase()}${p.slice(1)} (hours)`}>
              <input type="number" min="1" value={cfg.slaHours[p]} onChange={(e) => { setSaved(false); setCfg((c) => ({ ...c, slaHours: { ...c.slaHours, [p]: e.target.value } })); }} />
            </Field>
          ))}
        </div>
        <div className="tk-fields-row">
          <Field label="Warn developers before deadline (hours)"><input type="number" min="1" value={cfg.deadlineWarningHours} onChange={num("deadlineWarningHours")} /></Field>
          <Field label="Auto-close resolved after (days, 0 = never)"><input type="number" min="0" value={cfg.autoCloseDays} onChange={num("autoCloseDays")} /></Field>
          <Field label="Reporter may reopen within (days)"><input type="number" min="1" value={cfg.reopenWindowDays} onChange={num("reopenWindowDays")} /></Field>
        </div>
        <span className="subtitle">A passed deadline only flags a ticket as overdue and notifies people — it never completes it.</span>
      </div>
      </Collapsible>
    </div>
  );
}

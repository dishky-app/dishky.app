import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "../api.js";
import Button3D from "../components/Button3D.js";
import PageLoader from "../components/PageLoader.js";
import { Badge, Collapsible, EmptyRow, ErrorNote, Expiry, Meter, PageHeader, PlanBadge, Stat, StatusBadge, useCollapse } from "../components.js";
import { useToast } from "../useToast.js";
import { bytes, dateTime, inr, PLAN_LABEL, STATUS_LABEL } from "../format.js";

function Bars({ data, labels }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <p className="subtitle">No data yet.</p>;
  return (
    <ul className="sa-bars">
      {entries.map(([k, v]) => (
        <li key={k}>
          <span className="sa-bars-label">{labels[k] || k}</span>
          <span className="sa-bars-track"><span style={{ width: `${(v / max) * 100}%` }} /></span>
          <span className="sa-bars-n">{v}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Overview() {
  const { toast } = useToast();
  const [d, setD] = useState(null);
  const [collapsed, toggleCollapsed] = useCollapse();
  const [soon, setSoon] = useState([]);
  const [tk, setTk] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, s] = await Promise.all([
        api.overview(),
        api.restaurants({ expiringInDays: 14, sort: "expiresAt", dir: "asc", limit: 8 }),
      ]);
      setD(o);
      setSoon(s.rows.filter((r) => r.daysLeft !== null && r.daysLeft >= 0));
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); api.supportDashboard().then(setTk).catch(() => {}); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try { await api.refreshStorage(); await load(); toast.success("Storage usage refreshed"); } catch (e) { setError(e.message); } finally { setRefreshing(false); }
  };

  if (error && !d) return <div className="inner-page"><PageHeader title="Overview" /><ErrorNote error={error} /></div>;
  if (!d) return <PageLoader />;
  const t = d.totals;
  const s = d.storage;

  return (
    <div className="inner-page">
      <PageHeader title="Overview" collapsed={collapsed} onToggle={toggleCollapsed} collapseLabel="summary" />
      <ErrorNote error={error} />

      <div className="details-body">
        <Collapsible collapsed={collapsed}>
        <div className="dashboard-kpis">
          <Stat label="Clients (owners)" value={t.clients} hint={`+${t.newClients30d} in the last 30 days`} />
          <Stat label="Restaurants" value={t.restaurants} hint={`${t.payingRestaurants} paying · +${t.newRestaurants30d} new (30d)`} />
          <Stat label="Monthly recurring revenue" value={inr(t.mrr)} hint={`${inr(t.arr)} annualised`} />
          <Stat label="Expiring in 7 days" value={t.expiring7d} hint={`${t.trialsEnding7d} are trials · ${t.expiring30d} within 30 days`} tone={t.expiring7d ? "warning" : undefined} />
        </div>
        </Collapsible>

        <div className="sa-cols-2">
          <div className="chart-card">
            <div className="chart-header"><h4>Clients by plan</h4></div>
            <Bars data={d.byPlan} labels={{ ...PLAN_LABEL, undefined: "No plan", null: "No plan", "": "No plan" }} />
          </div>
          <div className="chart-card">
            <div className="chart-header"><h4>Subscription status</h4></div>
            <Bars data={d.byStatus} labels={STATUS_LABEL} />
            {(t.expiredOrBlocked > 0 || t.suspendedRestaurants > 0) && (
              <p className="subtitle">{t.expiredOrBlocked} expired or suspended subscriptions · {t.suspendedRestaurants} suspended restaurants</p>
            )}
          </div>
        </div>

        {tk && (
          <div className="chart-card">
            <div className="chart-header"><h4>Support tickets</h4><Link className="clickable" to="/tickets">Open Ticket Management →</Link></div>
            <div className="dashboard-kpis">
              <Link className="tk-kpi-link" to="/tickets?status=new"><Stat label="New" value={tk.counts.new} tone={tk.counts.new ? "warning" : undefined} /></Link>
              <Link className="tk-kpi-link" to="/tickets?view=unassigned"><Stat label="Unassigned" value={tk.counts.unassigned} tone={tk.counts.unassigned ? "warning" : undefined} /></Link>
              <Link className="tk-kpi-link" to="/tickets?view=critical"><Stat label="Critical & high" value={tk.counts.criticalHigh} tone={tk.counts.criticalHigh ? "bad" : undefined} /></Link>
              <Link className="tk-kpi-link" to="/tickets?view=overdue"><Stat label="Overdue" value={tk.counts.overdue} tone={tk.counts.overdue ? "bad" : undefined} /></Link>
            </div>
          </div>
        )}

        <div className="chart-card">
          <div className="chart-header">
            <h4>Database storage</h4>
            <Button3D variant="cancel" onClick={refresh} disabled={refreshing}>{refreshing ? "Measuring…" : "Re-measure"}</Button3D>
          </div>
          <div className="dashboard-kpis">
            <Stat label="Data" value={bytes(s.dataBytes)} />
            <Stat label="On disk" value={bytes(s.storageBytes)} />
            <Stat label="Indexes" value={bytes(s.indexBytes)} />
            <Stat label="Restaurants' data" value={bytes(s.tenantDataBytes)} hint={`${bytes(s.platformAndOtherBytes)} platform & other`} />
          </div>
          {s.capacityBytes ? (
            <div>
              <Meter value={s.storageBytes} max={s.capacityBytes} label="Database capacity used" />
              <p className="subtitle">{bytes(s.storageBytes)} of {bytes(s.capacityBytes)} used</p>
            </div>
          ) : (
            <p className="subtitle">Set <code>DB_STORAGE_LIMIT_MB</code> on the API to see how much of your database plan is used.</p>
          )}
          <p className="subtitle">
            Measured {dateTime(s.computedAt)}{s.approximate ? " · estimated (this database can't measure exact document sizes)" : ""}. Figures are cached for 10 minutes.
          </p>
        </div>

        <div className="chart-card">
          <div className="chart-header"><h4>Expiring within 14 days</h4></div>
          <div className="table-wrapper sa-inset">
            <table>
              <thead><tr><th>Restaurant</th><th>Owner</th><th>Plan</th><th>Status</th><th>Time left</th></tr></thead>
              <tbody>
                {soon.length === 0 && <EmptyRow colSpan={5} message="Nothing expiring soon." />}
                {soon.map((r) => (
                  <tr key={r.id}>
                    <td><Link className="clickable" to={`/restaurants/${r.id}`}>{r.name}</Link></td>
                    <td>{r.owner?.email}</td>
                    <td><PlanBadge plan={r.plan} /></td>
                    <td><StatusBadge status={r.subscriptionStatus} /></td>
                    <td><Expiry row={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {d.storage.approximate && <div><Badge tone="warn">Storage figures are estimates</Badge></div>}
      </div>
    </div>
  );
}

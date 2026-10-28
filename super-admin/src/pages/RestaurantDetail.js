import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "../api.js";
import Button3D from "../components/Button3D.js";
import PageLoader from "../components/PageLoader.js";
import { Badge, DetailsPage, EmptyRow, Expiry, PlanBadge, Section, StatusBadge, Value } from "../components.js";
import { bytes, date, dateTime, inr } from "../format.js";

// Plan limit row: "Branches 2 / 5" with a usage bar.
const Limit = ({ label, used, limit }) => {
  const pct = limit ? Math.min(100, ((used || 0) / limit) * 100) : 0;
  return (
    <Section title={label}>
      <p>{used ?? "?"} / {limit ?? "unlimited"}</p>
      {limit ? <div className={`details-meter${pct > 85 ? " is-hot" : ""}`} role="img" aria-label={`${label} used`}><span style={{ width: `${pct}%` }} /></div> : null}
    </Section>
  );
};

// Same page layout as the Admin Panel's DishDetails: header (back · name · plan/status) → body of sections → footer.
export default function RestaurantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [r, setR] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setR(null);
    setError("");
    api.restaurant(id).then(setR).catch((e) => setError(e.message));
  }, [id]);

  const back = () => navigate("/restaurants");
  const backButton = <Button3D variant="cancel" style={{ marginRight: "auto" }} onClick={back}>Back</Button3D>;

  if (error) return <DetailsPage title="Restaurant" onBack={back} footer={backButton}><div className="details-notice is-error" role="alert">{error}</div></DetailsPage>;
  if (!r) return <PageLoader fill label="Loading restaurant…" />;

  const sub = r.subscription;
  const maxCollection = Math.max(1, ...r.storage.collections.map((c) => c.bytes));

  return (
    <DetailsPage
      title={r.name}
      onBack={back}
      meta={
        <>
          <PlanBadge plan={r.plan} />
          <StatusBadge status={r.subscriptionStatus} />
          {r.restaurantStatus !== "active" && <Badge tone="bad">{r.restaurantStatus}</Badge>}
          {r.internal && <Badge tone="info">internal</Badge>}
        </>
      }
      subtitle={`/${r.slug} · joined ${date(r.createdAt)}`}
      footer={
        <>
          {backButton}
          <Button3D onClick={() => navigate(`/tickets?restaurantId=${r.id}`)}>View tickets</Button3D>
        </>
      }
    >
      {/* SUMMARY */}
      <div className="horizontal-form-group">
        <Section title="Expires"><p>{date(r.expiresAt)}</p><span className="section-hint"><Expiry row={r} /></span></Section>
        <Section title="Monthly revenue"><Value>{r.mrr ? inr(r.mrr) : ""}</Value>{r.billingCycle && <span className="section-hint">billed {r.billingCycle}</span>}</Section>
        <Section title="Storage used"><p>{bytes(r.storage.bytes)}</p><span className="section-hint">{r.storage.docs.toLocaleString("en-IN")} records</span></Section>
        <Section title="Owner last seen"><p>{date(r.owner?.lastLoginAt)}</p></Section>
      </div>

      {/* OWNER */}
      <Section title="Owner" wide>
        <div className="horizontal-form-group">
          <Section title="Name"><Value>{r.owner?.name}</Value></Section>
          <Section title="Email">{r.owner?.email ? <p><a href={`mailto:${r.owner.email}`}>{r.owner.email}</a></p> : <Value />}</Section>
          <Section title="Phone"><Value>{r.owner?.phone}</Value></Section>
        </div>
        <div className="horizontal-form-group">
          <Section title="Account"><Value>{r.owner?.status}</Value></Section>
          <Section title="City"><Value>{r.city}</Value></Section>
          <Section title="Other restaurants">
            {r.otherRestaurantsOfOwner.length
              ? <p>{r.otherRestaurantsOfOwner.map((o, i) => <React.Fragment key={o.id}>{i > 0 && ", "}<Link to={`/restaurants/${o.id}`}>{o.name}</Link></React.Fragment>)}</p>
              : <Value />}
          </Section>
        </div>
      </Section>

      {/* SUBSCRIPTION */}
      <Section title="Subscription" wide>
        <div className="horizontal-form-group">
          <Section title="Plan"><p>{r.planName || "—"}{r.pendingPlan && <span className="section-hint"> → {r.pendingPlan} at period end</span>}</p></Section>
          <Section title="Status"><Value>{sub && (sub.comped ? "Complimentary" : sub.status)}</Value></Section>
          <Section title="Billing provider"><Value>{sub?.provider}</Value></Section>
        </div>
        <div className="horizontal-form-group">
          <Section title="Trial ends"><Value>{sub?.trialEndsAt && dateTime(sub.trialEndsAt)}</Value></Section>
          <Section title="Current period"><Value>{sub?.currentPeriodStart && `${date(sub.currentPeriodStart)} – ${date(sub.currentPeriodEnd)}`}</Value></Section>
          <Section title="Grace ends"><Value>{sub?.graceEndsAt && dateTime(sub.graceEndsAt)}</Value></Section>
          <Section title="Cancels at period end"><p>{r.cancelAtPeriodEnd ? "Yes" : "No"}</p></Section>
        </div>
      </Section>

      {/* PLAN USAGE */}
      <Section title="Plan usage" wide>
        {r.usage ? (
          <div className="horizontal-form-group">
            <Limit label="Branches" used={r.usage.venues} limit={r.limits?.maxVenues} />
            <Limit label="Tables" used={r.usage.tables} limit={r.limits?.maxTables} />
            <Limit label="Staff logins" used={r.usage.staffAccounts} limit={r.limits?.maxStaffAccounts} />
          </div>
        ) : <Value>Not available.</Value>}
      </Section>

      {/* STORAGE */}
      <Section title="Storage by collection" wide hint={`Measured ${dateTime(r.storage.computedAt)}${r.storage.approximate ? " · estimated" : ""}`}>
        {r.storage.collections.length === 0 ? <Value>No data stored.</Value> : (
          <table className="data-table">
            <thead><tr><th>Collection</th><th>Share of largest</th><th style={{ textAlign: "right" }}>Size</th></tr></thead>
            <tbody>
              {r.storage.collections.slice(0, 10).map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td style={{ width: "50%" }}><div className="details-meter" style={{ marginTop: 0 }}><span style={{ width: `${(c.bytes / maxCollection) * 100}%` }} /></div></td>
                  <td style={{ textAlign: "right" }}>{bytes(c.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* PAYMENTS */}
      <Section title="Payments" wide>
        <table className="data-table">
          <thead><tr><th>Paid</th><th>Plan</th><th>Period</th><th style={{ textAlign: "right" }}>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {r.invoices.length === 0 && <EmptyRow colSpan={5} message="No payments yet." />}
            {r.invoices.map((i) => (
              <tr key={i.id}>
                <td>{date(i.paidAt)}</td>
                <td>{i.planKey} · {i.billingCycle}</td>
                <td>{date(i.periodStart)} – {date(i.periodEnd)}</td>
                <td style={{ textAlign: "right" }}>{inr(i.amount)}</td>
                <td>{i.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </DetailsPage>
  );
}

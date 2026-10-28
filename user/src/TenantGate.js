import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import api from "./api";
import tenant, { resolved, MARKETING_URL } from "./tenant";
import { joinRoom } from "./socket";
import "./TenantGate.css";

// Decides what to show for dishky.com/<restaurant>/<venue>/<table>:
//   no restaurant            -> send them to the product site
//   restaurant only          -> venue picker (or straight to the only venue)
//   restaurant + venue       -> the ordering app (router basename = the prefix)
// All of it is driven by the URL, so a printed table QR is just a link.

function Shell({ title, children }) {
  return (
    <div className="tg-shell">
      <div className="tg-card">
        <div className="tg-brand">dishky</div>
        {title && <h1 className="tg-title">{title}</h1>}
        {children}
      </div>
    </div>
  );
}

function NoRestaurant() {
  useEffect(() => {
    const t = setTimeout(() => { window.location.replace(MARKETING_URL); }, 1500);
    return () => clearTimeout(t);
  }, []);
  return (
    <Shell title="Looking for a restaurant?">
      <p className="tg-text">Scan the QR code on your table, or open the link your restaurant shared.</p>
      <a className="tg-btn" href={MARKETING_URL}>Go to dishky.com</a>
    </Shell>
  );
}

function VenuePicker() {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    api.get("/public/restaurant")
      .then((res) => {
        const venues = res.data.venues || [];
        if (venues.length === 1) {
          window.location.replace(`/${tenant.restaurant}/${venues[0].slug}`);
          return;
        }
        setState({ loading: false, data: res.data });
      })
      .catch((err) => setState({ loading: false, error: err.response?.status === 404 ? "notfound" : "failed" }));
  }, []);

  if (state.loading) return <Shell title="Loading…" />;
  if (state.error === "notfound") {
    return (
      <Shell title="Restaurant not found">
        <p className="tg-text">We couldn't find “{tenant.restaurant}”. Check the link or QR code and try again.</p>
        <a className="tg-btn" href={MARKETING_URL}>Go to dishky.com</a>
      </Shell>
    );
  }
  if (state.error) {
    return (
      <Shell title="Can't connect">
        <p className="tg-text">Something went wrong. Please try again in a moment.</p>
        <button className="tg-btn" onClick={() => window.location.reload()}>Retry</button>
      </Shell>
    );
  }
  const { restaurant, venues, acceptingOrders } = state.data;
  return (
    <Shell title={restaurant.name}>
      {!acceptingOrders && <p className="tg-text tg-warn">This restaurant isn't taking online orders right now.</p>}
      {venues.length === 0 ? (
        <p className="tg-text">No locations are open yet.</p>
      ) : (
        <>
          <p className="tg-text">Choose a location</p>
          <ul className="tg-list">
            {venues.map((v) => (
              <li key={v.id}>
                <a className="tg-venue" href={`/${restaurant.slug}/${v.slug}`}>
                  <span>{v.name}</span>
                  {v.area && <small>{v.area}</small>}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </Shell>
  );
}

function VenueApp({ children }) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    const q = new URLSearchParams({ venue: tenant.venue });
    if (tenant.table) q.set("table", tenant.table);
    api.get(`/public/resolve?${q}`)
      .then((res) => {
        const d = res.data;
        resolved.venueId = d.venue.id;
        resolved.venueName = d.venue.name;
        resolved.restaurantName = d.restaurant.name;
        resolved.branding = d.restaurant.branding;
        resolved.acceptingOrders = d.acceptingOrders !== false;
        resolved.tableValid = d.table ? d.table.valid : null;
        // The rest of the app reads these two keys; they now come from the URL
        // instead of a ?table= query string, so a stale value can't leak
        // between restaurants or tables.
        if (tenant.table && d.table && d.table.valid) localStorage.setItem("tableNo", tenant.table);
        else localStorage.removeItem("tableNo");
        localStorage.setItem("branchId", d.venue.id);
        document.title = `${d.restaurant.name} · ${d.venue.name}`;
        joinRoom();
        setState({ loading: false, data: d });
      })
      .catch((err) => {
        const code = err.response?.data?.code;
        setState({ loading: false, error: code || "FAILED" });
      });
  }, []);

  if (state.loading) return <Shell title="Loading…" />;
  if (state.error === "RESTAURANT_NOT_FOUND") {
    return (
      <Shell title="Restaurant not found">
        <p className="tg-text">We couldn't find “{tenant.restaurant}”. Check the link or QR code.</p>
        <a className="tg-btn" href={MARKETING_URL}>Go to dishky.com</a>
      </Shell>
    );
  }
  if (state.error === "VENUE_NOT_FOUND") {
    return (
      <Shell title="Location not found">
        <p className="tg-text">That location doesn't exist at this restaurant.</p>
        <a className="tg-btn" href={`/${tenant.restaurant}`}>See all locations</a>
      </Shell>
    );
  }
  if (state.error) {
    return (
      <Shell title="Can't connect">
        <p className="tg-text">Something went wrong. Please try again.</p>
        <button className="tg-btn" onClick={() => window.location.reload()}>Retry</button>
      </Shell>
    );
  }
  return (
    <BrowserRouter basename={tenant.basename}>
      {tenant.table && state.data.table && state.data.table.valid === false && (
        <div className="tg-banner">Table “{tenant.table}” isn't set up at this location. You can browse, but ordering is for takeaway.</div>
      )}
      {!state.data.acceptingOrders && (
        <div className="tg-banner">This restaurant isn't taking orders right now.</div>
      )}
      {children}
    </BrowserRouter>
  );
}

export default function TenantGate({ children }) {
  if (!tenant.restaurant) return <NoRestaurant />;
  if (!tenant.venue) return <VenuePicker />;
  return <VenueApp>{children}</VenueApp>;
}

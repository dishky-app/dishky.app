import { useState } from "react";
import api from "../api";
import { customerUrl, getRestaurant } from "../tenant";
import "./VenueConnect.css";

// Inside the venue edit modal: the venue's public web address, and the token
// its print bridge uses to connect (Super Admin only; shown on request).
const VenueConnect = ({ venueId, slug, onSlugChange, toast }) => {
  const [bridge, setBridge] = useState(null);
  const [busy, setBusy] = useState(false);

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Couldn't copy. Select and copy it manually.");
    }
  };

  const reveal = async (rotate) => {
    setBusy(true);
    try {
      const res = rotate
        ? await api.post(`/venues/${venueId}/printer-token/rotate`)
        : await api.get(`/venues/${venueId}/printer-token`);
      setBridge(res.data);
      if (rotate) toast.success("New token created. Update your print bridge.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't load the print bridge token");
    } finally {
      setBusy(false);
    }
  };

  const url = customerUrl(slug || "your-venue");

  return (
    <div className="vn-box">
      <div className="mat">
        <input
          className="mat-input"
          placeholder=" "
          value={slug || ""}
          onChange={(e) => onSlugChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40))}
        />
        <label className="mat-label">Web address (URL name)</label>
        <span className="mat-bar" />
      </div>
      <div className="vn-url-row">
        <code className="vn-url">{url}</code>
        <button type="button" className="vn-btn" onClick={() => copy(url, "Link")}>Copy</button>
      </div>
      <div className="vn-url-row">
        <code className="vn-url">{`${url}/display`}</code>
        <button type="button" className="vn-btn" onClick={() => copy(`${url}/display`, "Display link")}>Copy</button>
      </div>
      <p className="vn-hint">
        Open the second link on a TV or tablet near the counter: it shows live order status (preparing / ready for pickup) for this venue.
      </p>
      <p className="vn-hint">
        Table QR codes use <code>{url}/&lt;table&gt;</code>. Changing the URL name breaks QR codes already printed.
      </p>

      {venueId && (
        <div className="vn-bridge">
          <div className="vn-bridge-head">
            <strong>Print bridge</strong>
            <span>
              {!bridge && (
                <button type="button" className="vn-btn" disabled={busy} onClick={() => reveal(false)}>Show connection details</button>
              )}
            </span>
          </div>
          {bridge && (
            <>
              <dl className="vn-dl">
                <dt>Restaurant</dt><dd>{bridge.restaurant || getRestaurant()}</dd>
                <dt>Venue ID</dt><dd>{bridge.venueId}</dd>
                <dt>Token</dt>
                <dd>
                  <code className="vn-token">{bridge.token}</code>
                  <button type="button" className="vn-btn" onClick={() => copy(bridge.token, "Token")}>Copy</button>
                </dd>
              </dl>
              <button type="button" className="vn-btn vn-danger" disabled={busy} onClick={() => reveal(true)}>
                Generate new token
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default VenueConnect;

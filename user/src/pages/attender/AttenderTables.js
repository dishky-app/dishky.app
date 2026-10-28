import "../Welcome.css";
import "./Attender.css";
import { useState } from "react";
import { resolved } from "../../tenant";
import MatField from "../shared/MatField";
import Button3D from "../shared/Button3D";
import ConfirmDialog from "../shared/ConfirmDialog";
import AttenderBills from "./AttenderBills";
import { toTitleCase } from "../../utils/nameCase";

/**
 * AttenderTables — shown right after an attender signs in (and any time they
 * tap "+ Add table"). They enter the table number they are serving (and
 * optionally a guest name when a table has more than one party), which opens an
 * order tab and takes them to the menu. Tabs already open are listed so they
 * can jump back into any of them.
 */
const TABLE_RE = /^[A-Za-z0-9-]{1,12}$/;

const AttenderTables = ({ attenderCtl, foodData, handleNavigate }) => {
  const { attender, tabs, activeTabId, itemCounts, addTab, switchTab, closeTab, logout } = attenderCtl;
  const [tableNo, setTableNo] = useState("");
  const [guest, setGuest] = useState("");
  const [error, setError] = useState("");
  const [tabToClose, setTabToClose] = useState(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Table numbers this venue has set up (empty list = nothing to validate against).
  const venueTables = Array.isArray(foodData?.tables) ? foodData.tables.map(String) : [];
  const totalWaiting = tabs.reduce((n, t) => n + (itemCounts[t.id] || 0), 0);

  const venueLabel = resolved.venueName
    ? `${resolved.restaurantName} · ${resolved.venueName}`
    : resolved.restaurantName || "";

  const startOrder = () => {
    const value = tableNo.trim();
    if (!value) return setError("Enter the table number.");
    if (!TABLE_RE.test(value)) return setError("Use letters, numbers or hyphens only (max 12).");
    if (venueTables.length && !venueTables.some((t) => t.toLowerCase() === value.toLowerCase())) {
      return setError(`Table ${value} isn't set up at this location.`);
    }
    // Use the venue's own spelling of the table (e.g. "a3" → "A3") when it has one.
    const canonical = venueTables.find((t) => t.toLowerCase() === value.toLowerCase()) || value;
    addTab({ tableNo: canonical, guest });
    setTableNo("");
    setGuest("");
    setError("");
    handleNavigate("/categories");
  };

  // "+ Add more dishes" on an already-ordered bill: open (or re-open) that table's tab and go to the menu.
  const addMore = ({ tableNo: table, guest: who }) => {
    addTab({ tableNo: table, guest: who });
    handleNavigate("/categories");
  };

  const openTab = (id) => {
    switchTab(id);
    handleNavigate("/categories");
  };

  const requestClose = (tab) => {
    if ((itemCounts[tab.id] || 0) > 0) setTabToClose(tab);
    else closeTab(tab.id);
  };

  const requestLogout = () => {
    if (totalWaiting > 0) setConfirmLogout(true);
    else doLogout();
  };

  const doLogout = async () => {
    setConfirmLogout(false);
    await logout();
    handleNavigate("/");
  };

  const labelOf = (tab) => (
    <>
      Table {tab.tableNo}
      {tab.guest ? <span className="at-tab-guest"> · {tab.guest}</span> : null}
    </>
  );

  return (
    <div className="welcome-page at-auth-page at-tables-page">
      <div className="welcome-waves" aria-hidden="true">
        <div className="welcome-wave" />
        <div className="welcome-wave" />
        <div className="welcome-wave" />
      </div>

      <div className="welcome-container at-auth-container at-wide">
        <div className="at-hello">
          <div>
            <div className="at-hello-small">Signed in as</div>
            <div className="at-hello-name">{attender?.name}</div>
            {venueLabel && <div className="at-hello-venue">{venueLabel}</div>}
          </div>
          <button type="button" className="at-hello-logout" onClick={requestLogout}>Logout</button>
        </div>

        <div className="at-tables-grid">
        <div className="at-col">
        <div className="at-auth-card">
          <h2 className="at-auth-title">Take an order</h2>
          <p className="at-auth-hint">Enter the table you are serving. You can open several tables and switch between them any time.</p>

          <MatField
            label="Table Number"
            type="text"
            autoComplete="off"
            maxLength={12}
            value={tableNo}
            onChange={(e) => { setTableNo(e.target.value.replace(/[^A-Za-z0-9-]/g, "")); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") startOrder(); }}
            error={error}
            wrapperClassName=""
          />

          {venueTables.length > 0 && (
            <div className="at-table-chips" role="list" aria-label="Tables at this location">
              {venueTables.map((t) => (
                <button
                  type="button"
                  role="listitem"
                  key={t}
                  className={`at-chip ${tableNo.toLowerCase() === t.toLowerCase() ? "selected" : ""}`}
                  onClick={() => { setTableNo(t); setError(""); }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          <MatField
            label="Guest name (optional)"
            type="text"
            autoComplete="off"
            maxLength={40}
            value={guest}
            onChange={(e) => setGuest(toTitleCase(e.target.value))}
            onKeyDown={(e) => { if (e.key === "Enter") startOrder(); }}
            wrapperClassName=""
          />

          <Button3D className="btn-3d red at-auth-btn" onClick={startOrder}>Start Order</Button3D>
        </div>

        {tabs.length > 0 && (
          <div className="at-auth-card at-open-card">
            <h3 className="at-open-title">Open tables</h3>
            <ul className="at-open-list">
              {tabs.map((tab) => {
                const count = itemCounts[tab.id] || 0;
                return (
                  <li key={tab.id} className={`at-open-row ${tab.id === activeTabId ? "active" : ""}`}>
                    <button type="button" className="at-open-main" onClick={() => openTab(tab.id)}>
                      <span className="at-open-name">{labelOf(tab)}</span>
                      <span className="at-open-meta">
                        {count > 0 ? `${count} item${count === 1 ? "" : "s"} in bag` : "No items yet"}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="at-open-close"
                      aria-label={`Close table ${tab.tableNo}`}
                      onClick={() => requestClose(tab)}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        </div>

        <div className="at-col">
          <AttenderBills tabs={tabs} onAddMore={addMore} />
        </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!tabToClose}
        title="Close this table?"
        message={<>Table <strong>{tabToClose?.tableNo}</strong> still has items that haven't been ordered. They will be discarded.</>}
        confirmLabel="Close table"
        onConfirm={() => { closeTab(tabToClose.id); setTabToClose(null); }}
        onCancel={() => setTabToClose(null)}
      />
      <ConfirmDialog
        open={confirmLogout}
        title="Logout?"
        message="Some tables still have items that haven't been ordered. Logging out will discard them."
        confirmLabel="Logout"
        onConfirm={doLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
};

export default AttenderTables;

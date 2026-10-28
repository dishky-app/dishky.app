import { useState } from "react";
import Button3D from "../shared/Button3D";

// Same rule the server uses for table ids (server/src/modules/platform/slugs.js).
const TABLE_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,11}$/;

/**
 * TablePanel — the attender's table list: switch between tables, add a table
 * (+ optional guest name), remove an empty table, log out.
 * Used both on the full "/attender/tables" page and inside the floating
 * switcher sheet, so the two always behave identically.
 *
 * Props:
 *  - attender:        { id, name, mobile }
 *  - tables:          [{ tableNo, guestName }]
 *  - activeTable:     the table currently being served (string | null)
 *  - bagCounts:       { [tableNo]: number of unplaced items }
 *  - knownTables:     the venue's configured table numbers (quick-pick + validation); may be empty
 *  - onSelect(tableNo), onAdd(tableNo, guestName), onRemove(tableNo), onRequestLogout()
 */
const TablePanel = ({
  attender,
  tables = [],
  activeTable,
  bagCounts = {},
  knownTables = [],
  onSelect,
  onAdd,
  onRemove,
  onRequestLogout,
}) => {
  const [tableInput, setTableInput] = useState("");
  const [guestInput, setGuestInput] = useState("");
  const [error, setError] = useState("");

  const known = (Array.isArray(knownTables) ? knownTables : []).map(String);
  const openSet = new Set(tables.map((t) => t.tableNo));
  const quickPicks = known.filter((k) => !openSet.has(k));

  const addTable = (raw) => {
    const t = String(raw ?? "").trim();
    if (!t) { setError("Enter a table number."); return; }
    if (!TABLE_RE.test(t)) { setError("Use letters, numbers or hyphens only (max 12)."); return; }

    let tableNo = t;
    if (known.length) {
      const match = known.find((k) => k.toLowerCase() === t.toLowerCase());
      if (!match) { setError(`Table ${t} isn't set up at this location.`); return; }
      tableNo = match;
    }

    onAdd(tableNo, guestInput.trim().slice(0, 40));
    setTableInput("");
    setGuestInput("");
    setError("");
  };

  return (
    <div className="att-panel">
      <div className="att-panel-head">
        <div>
          <div className="att-panel-hello">Attender</div>
          <div className="att-panel-name">{attender?.name}</div>
        </div>
        <button type="button" className="att-logout" onClick={onRequestLogout}>Log out</button>
      </div>

      <div className="att-panel-section-title">
        {tables.length ? "Your tables" : "Add a table to start taking orders"}
      </div>

      {tables.length > 0 && (
        <ul className="att-table-list">
          {tables.map((t) => {
            const count = Number(bagCounts[t.tableNo] || 0);
            const isActive = t.tableNo === activeTable;
            return (
              <li key={t.tableNo} className={`att-table-row${isActive ? " is-active" : ""}`}>
                <button type="button" className="att-table-main" onClick={() => onSelect(t.tableNo)}>
                  <span className="att-table-badge">{t.tableNo}</span>
                  <span className="att-table-info">
                    <span className="att-table-title">Table {t.tableNo}{isActive ? " · taking order" : ""}</span>
                    <span className="att-table-sub">
                      {t.guestName ? `${t.guestName} · ` : ""}
                      {count > 0 ? `${count} item${count === 1 ? "" : "s"} in bag` : "Bag empty"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="att-table-remove"
                  onClick={() => onRemove(t.tableNo)}
                  disabled={count > 0}
                  title={count > 0 ? "Place or clear this table's items first" : "Remove table"}
                  aria-label={`Remove table ${t.tableNo}`}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="att-add">
        <div className="att-panel-section-title">Add table</div>

        {quickPicks.length > 0 && (
          <div className="att-chips" role="group" aria-label="Tables at this location">
            {quickPicks.map((k) => (
              <button key={k} type="button" className="att-chip" onClick={() => addTable(k)}>{k}</button>
            ))}
          </div>
        )}

        <div className="att-add-row">
          <input
            className="att-input"
            type="text"
            inputMode="text"
            maxLength={12}
            placeholder="Table number"
            value={tableInput}
            onChange={(e) => { setTableInput(e.target.value.replace(/[^A-Za-z0-9-]/g, "")); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTable(tableInput); } }}
          />
          <input
            className="att-input"
            type="text"
            maxLength={40}
            placeholder="Guest name (optional)"
            value={guestInput}
            onChange={(e) => setGuestInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTable(tableInput); } }}
          />
        </div>

        {error && <div className="att-add-error" role="alert">{error}</div>}

        <Button3D className="btn-3d red att-add-btn" onClick={() => addTable(tableInput)}>
          Add &amp; take order
        </Button3D>
      </div>
    </div>
  );
};

export default TablePanel;

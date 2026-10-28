import "./Attender.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../api";
import socket from "../../socket";
import { resolved } from "../../tenant";

/**
 * AttenderBills — "Ordered so far", table-wise.
 *
 * Lists only the dishes THIS attender ordered, on bills that are not yet paid,
 * grouped by table. Each table has ONE running bill: re-orders and extra dishes
 * are added to it until its payment is completed, then it disappears from here.
 * Refreshes every 15s and whenever an order changes.
 */
const STATUS_LABEL = {
  placed: "Placed",
  preparing: "Preparing",
  "service pickup": "Ready",
  completed: "Served",
};

const naturalSort = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });

const AttenderBills = ({ tabs, onAddMore }) => {
  const [bills, setBills] = useState(null); // null = first load
  const [error, setError] = useState("");
  const tablesParam = useMemo(() => [...new Set(tabs.map((t) => String(t.tableNo)))].join(","), [tabs]);
  const paramRef = useRef(tablesParam);
  paramRef.current = tablesParam;

  const load = useCallback(async () => {
    if (!resolved.venueId) return;
    try {
      const res = await api.get("/attender-auth/table-orders", {
        params: { venueId: resolved.venueId, tables: paramRef.current },
      });
      setBills(Array.isArray(res.data) ? res.data : []);
      setError("");
    } catch (err) {
      if (err.response?.status === 401) setError("Your session expired. Sign in again to see ordered dishes.");
      else setError("Couldn't load ordered dishes.");
    }
  }, []);

  useEffect(() => { load(); }, [load, tablesParam]);

  useEffect(() => {
    const timer = setInterval(load, 15000);
    const onChange = ({ resource }) => { if (resource === "orders") load(); };
    socket.on("data-change", onChange);
    return () => {
      clearInterval(timer);
      socket.off("data-change", onChange);
    };
  }, [load]);

  // table -> bills
  const byTable = useMemo(() => {
    const map = new Map();
    for (const b of bills || []) {
      const key = String(b.tableNo);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(b);
    }
    return [...map.entries()].sort((a, b) => naturalSort(a[0], b[0]));
  }, [bills]);

  return (
    <div className="at-auth-card at-bills-card">
      <div className="at-bills-head">
        <h3 className="at-open-title">Ordered so far</h3>
        <button type="button" className="at-bills-refresh" onClick={load}>Refresh</button>
      </div>

      {error && <p className="at-bills-empty">{error}</p>}
      {!error && bills === null && <p className="at-bills-empty">Loading…</p>}
      {!error && bills !== null && byTable.length === 0 && (
        <p className="at-bills-empty">No dishes ordered yet. Once you place an order it shows here, table by table, until the bill is paid.</p>
      )}

      {byTable.map(([table, tableBills]) => (
        <section key={table} className="at-bill-table">
          <div className="at-bill-table-title">Table {table}</div>
          {tableBills.map((bill) => {
            const named = bill.attenderName && bill.userName && bill.userName !== "Guest";
            return (
              <div key={bill.id} className="at-bill">
                <div className="at-bill-top">
                  <span className="at-bill-id">
                    #{bill.id}{named ? ` · ${bill.userName}` : ""}
                  </span>
                  {bill.attenderName && <span className="at-bill-by">by {bill.attenderName}</span>}
                </div>
                <ul className="at-bill-items">
                  {bill.items.map((it, i) => (
                    <li key={i} className="at-bill-item">
                      <span className="at-bill-qty">{it.quantity}×</span>
                      <span className="at-bill-name">
                        {it.dishName}
                        {it.selectedSize ? <small> ({it.selectedSize})</small> : null}
                        {it.notes ? <small className="at-bill-note">{it.notes}</small> : null}
                      </span>
                      <span className={`at-bill-status at-bill-status--${String(it.status).replace(/\s+/g, "-")}`}>
                        {STATUS_LABEL[String(it.status).toLowerCase()] || it.status}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="at-bill-foot">
                  <span>Your dishes (before GST)</span>
                  <strong>₹{bill.subtotal ?? 0}</strong>
                </div>
                <button
                  type="button"
                  className="at-bill-add"
                  onClick={() => onAddMore({ tableNo: table, guest: named ? bill.userName : "" })}
                >
                  + Add more dishes
                </button>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
};

export default AttenderBills;

import "./attenderUi.css";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TablePanel from "./TablePanel";
import ModalTransition from "../shared/ModalTransition";
import ConfirmDialog from "../shared/ConfirmDialog";
import Button3D from "../shared/Button3D";

/**
 * AttenderBar — what an attender sees on every ordering page:
 *   • a floating "Table N" pill (bottom-left, where customers get the bell)
 *   • tapping it opens the table switcher sheet: jump between tables, add a
 *     table, remove an empty one, log out
 *   • if an attender session is still active and the browser lands on the
 *     customer Welcome page, a notice asks them to continue or log out, so a
 *     customer never accidentally orders under an attender's name.
 */
const AttenderBar = ({
  attender,
  tables,
  activeTable,
  bagCounts,
  knownTables,
  isOpen,
  setIsOpen,
  onSelectTable,
  onAddTable,
  onRemoveTable,
  onLogout,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!attender) return null;

  const path = location.pathname;
  const onWelcome = path === "/";
  const onAttenderPage = path.startsWith("/attender");
  const pendingItems = Object.values(bagCounts || {}).reduce((sum, n) => sum + Number(n || 0), 0);

  const requestLogout = () => (pendingItems > 0 ? setConfirmOpen(true) : onLogout());

  const logoutDialog = (
    <ConfirmDialog
      open={confirmOpen}
      title="Log out?"
      message={`You have ${pendingItems} item${pendingItems === 1 ? "" : "s"} that haven't been ordered yet. They'll be discarded if you log out.`}
      confirmLabel="Log out"
      onConfirm={() => { setConfirmOpen(false); setIsOpen(false); onLogout(); }}
      onCancel={() => setConfirmOpen(false)}
    />
  );

  // Customer Welcome page while an attender session is active.
  if (onWelcome) {
    return (
      <>
        <div className="att-notice-overlay">
          <div className="att-notice">
            <h3>Attender mode is on</h3>
            <p>You're logged in as <strong>{attender.name}</strong>. Orders placed on this device are recorded under your name.</p>
            <div className="att-notice-actions">
              <Button3D className="btn-3d green" onClick={() => navigate(activeTable ? "/categories" : "/attender/tables")}>
                Continue taking orders
              </Button3D>
              <Button3D className="btn-3d white" onClick={requestLogout}>Log out</Button3D>
            </div>
          </div>
        </div>
        {logoutDialog}
      </>
    );
  }

  // The tables page has its own full panel; no pill there.
  if (onAttenderPage) return null;

  return (
    <>
      <button
        type="button"
        className="att-pill"
        onClick={() => setIsOpen(true)}
        aria-label="Switch table"
      >
        <span className="att-pill-label">{activeTable ? `Table ${activeTable}` : "Select table"}</span>
        {tables.length > 1 && <span className="att-pill-count">{tables.length}</span>}
        <span className="att-pill-caret" aria-hidden="true">▾</span>
      </button>

      <ModalTransition
        open={isOpen}
        onClose={() => setIsOpen(false)}
        overlayClassName="att-sheet-overlay"
        panelClassName="att-sheet"
        panelProps={{ onClick: (e) => e.stopPropagation() }}
      >
        <button type="button" className="att-sheet-close" onClick={() => setIsOpen(false)} aria-label="Close">✕</button>
        <TablePanel
          attender={attender}
          tables={tables}
          activeTable={activeTable}
          bagCounts={bagCounts}
          knownTables={knownTables}
          onSelect={(t) => { onSelectTable(t); setIsOpen(false); if (path === "/thank-you") navigate("/categories"); }}
          onAdd={(t, guest) => { onAddTable(t, guest); setIsOpen(false); if (path === "/thank-you") navigate("/categories"); }}
          onRemove={onRemoveTable}
          onRequestLogout={requestLogout}
        />
      </ModalTransition>

      {logoutDialog}
    </>
  );
};

export default AttenderBar;

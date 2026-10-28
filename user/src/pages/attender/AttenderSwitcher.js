import "./Attender.css";
import { useState } from "react";

/**
 * AttenderSwitcher — floating chip (bottom-left, where the guest "call
 * attender" bell sits for guests) shown on every ordering page while an
 * attender is signed in. It names the table the bag belongs to and opens a
 * small sheet to switch to another open table/guest or add a new one.
 *
 * Switching returns to the menu home so a half-open dish page can never end up
 * editing the wrong table's bag.
 */
const AttenderSwitcher = ({ attenderCtl, handleNavigate }) => {
  const { attender, tabs, activeTab, activeTabId, itemCounts, switchTab } = attenderCtl;
  const [open, setOpen] = useState(false);

  // Other tables that have items waiting — shown as a dot so nothing is forgotten.
  const othersWaiting = tabs.filter((t) => t.id !== activeTabId && (itemCounts[t.id] || 0) > 0).length;

  const choose = (id) => {
    setOpen(false);
    if (id !== activeTabId) {
      switchTab(id);
      handleNavigate("/categories");
    }
  };

  const addTable = () => {
    setOpen(false);
    handleNavigate("/attender/tables");
  };

  return (
    <>
      <button
        type="button"
        className="at-switch-chip"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="at-switch-chip-label">
          {activeTab ? `Table ${activeTab.tableNo}` : "Choose table"}
          {activeTab?.guest ? <small> · {activeTab.guest}</small> : null}
        </span>
        <span className="at-switch-chip-caret" aria-hidden="true">▴</span>
        {othersWaiting > 0 && <span className="at-switch-chip-dot" title={`${othersWaiting} other table(s) with items`}>{othersWaiting}</span>}
      </button>

      {open && (
        <>
          <div className="at-switch-backdrop" onClick={() => setOpen(false)} />
          <div className="at-switch-sheet" role="dialog" aria-label="Switch table">
            <div className="at-switch-head">
              <div>
                <div className="at-switch-title">Switch table</div>
                <div className="at-switch-sub">{attender?.name}</div>
              </div>
              <button type="button" className="at-switch-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>

            <ul className="at-switch-list">
              {tabs.map((tab) => {
                const count = itemCounts[tab.id] || 0;
                return (
                  <li key={tab.id}>
                    <button
                      type="button"
                      className={`at-switch-row ${tab.id === activeTabId ? "active" : ""}`}
                      onClick={() => choose(tab.id)}
                    >
                      <span className="at-switch-row-name">
                        Table {tab.tableNo}
                        {tab.guest ? <small> · {tab.guest}</small> : null}
                      </span>
                      <span className={`at-switch-row-count ${count > 0 ? "has-items" : ""}`}>
                        {count > 0 ? `${count} in bag` : "empty"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <button type="button" className="at-switch-add" onClick={addTable}>+ Add table / guest</button>
            <button type="button" className="at-switch-orders" onClick={addTable}>See ordered dishes by table</button>
          </div>
        </>
      )}
    </>
  );
};

export default AttenderSwitcher;

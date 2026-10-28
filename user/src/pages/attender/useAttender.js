/**
 * useAttender — the "attender layer" of the user panel.
 *
 * An attender (waiter) signs in, opens one order tab per table/guest, and can
 * switch between those tabs at any time. Each tab keeps its OWN bag, so taking
 * an order for table 4 never mixes with table 7.
 *
 * This hook owns the bag for BOTH modes so the rest of the app can keep using
 * a single `bag` / `setBag` pair exactly as before:
 *   - customer mode  (no attender signed in): `bag` is the one normal bag.
 *   - attender mode  : `bag` is the ACTIVE tab's bag, and `setBag` writes to it.
 * `setBag` is stable (reads the live mode from a ref), so listeners registered
 * once (e.g. the fly-to-bag image reveal in App.js) keep working after the
 * attender signs in/out or switches tab.
 *
 * Tabs, bags and the signed-in attender are mirrored to localStorage (per
 * restaurant + venue) so a page refresh doesn't drop half-taken orders. The
 * real session is the server's httpOnly cookie; localStorage only remembers
 * who is on this device and what they were doing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../api";
import tenant, { resolved } from "../../tenant";

const STORAGE_KEY = `dishky:attender:${tenant.restaurant || ""}:${tenant.venue || ""}`;
const EMPTY_BAG = [];

const EMPTY_STATE = { attender: null, ownerId: null, tabs: [], activeTabId: null, bags: {} };

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const s = JSON.parse(raw);
    return {
      attender: s.attender && s.attender.id ? s.attender : null,
      ownerId: s.ownerId || null,
      tabs: Array.isArray(s.tabs) ? s.tabs : [],
      activeTabId: s.activeTabId || null,
      bags: s.bags && typeof s.bags === "object" ? s.bags : {},
    };
  } catch {
    return EMPTY_STATE;
  }
}

function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full / blocked: tabs just won't survive a refresh.
  }
}

// In customer mode the table comes from the QR-code URL (TenantGate sets it).
// Put that back when the attender signs out so normal ordering is unaffected.
function restoreUrlTable() {
  try {
    if (tenant.table && resolved.tableValid) localStorage.setItem("tableNo", tenant.table);
    else localStorage.removeItem("tableNo");
  } catch { /* ignore */ }
}

const newTabId = () => `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const sameText = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

export default function useAttender() {
  const [state, setState] = useState(readState);
  const [plainBag, setPlainBag] = useState([]);
  const { attender, tabs, activeTabId, bags } = state;

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId) || null, [tabs, activeTabId]);

  // Live values for the stable callbacks below (they must not close over stale state).
  const stateRef = useRef(state);
  stateRef.current = state;
  const modeRef = useRef({ isAttender: !!attender, activeTabId });
  modeRef.current = { isAttender: !!attender, activeTabId };

  /* ── persistence ───────────────────────────────────────────────────── */
  useEffect(() => { writeState(state); }, [state]);

  /* ── validate the stored attender against the server session once ─── */
  useEffect(() => {
    if (!state.attender) return;
    let cancelled = false;
    api.get("/attender-auth/me")
      .then((res) => {
        const fresh = res.data && res.data.attender;
        if (!cancelled && fresh && (fresh.name !== state.attender.name || fresh.id !== state.attender.id)) {
          setState((s) => ({ ...s, attender: fresh }));
        }
      })
      .catch((err) => {
        // Only a definite "not logged in" signs them out; a network blip must not.
        if (!cancelled && err.response && err.response.status === 401) {
          setState((s) => ({ ...s, attender: null }));
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── keep the shared "tableNo" key pointing at the active tab ─────── */
  useEffect(() => {
    if (!attender) return;
    try {
      if (activeTab) localStorage.setItem("tableNo", String(activeTab.tableNo));
      else localStorage.removeItem("tableNo");
    } catch { /* ignore */ }
  }, [attender, activeTab]);

  /* ── bag (stable setter) ──────────────────────────────────────────── */
  const setBag = useCallback((value) => {
    const { isAttender, activeTabId: id } = modeRef.current;
    if (!isAttender) {
      setPlainBag(value);
      return;
    }
    if (!id) return; // signed in but no table open yet: nothing to put items in
    setState((s) => {
      const current = s.bags[id] || EMPTY_BAG;
      const next = typeof value === "function" ? value(current) : value;
      return { ...s, bags: { ...s.bags, [id]: next } };
    });
  }, []);

  const bag = attender ? (bags[activeTabId] || EMPTY_BAG) : plainBag;

  /* ── auth ─────────────────────────────────────────────────────────── */
  // Call after a successful signup/login. A different attender on the same
  // device must never inherit the previous one's open tables.
  const login = useCallback((who) => {
    const s = stateRef.current;
    let next;
    if (s.ownerId && s.ownerId === who.id) {
      // Same person coming back (e.g. after the session expired): keep their tables.
      const keep = s.tabs.some((t) => t.id === s.activeTabId) ? s.activeTabId : null;
      next = { ...s, attender: who, activeTabId: keep };
    } else {
      next = { attender: who, ownerId: who.id, tabs: [], activeTabId: null, bags: {} };
    }
    modeRef.current = { isAttender: true, activeTabId: next.activeTabId };
    stateRef.current = next;
    setState(next);
  }, []);

  const logout = useCallback(async () => {
    modeRef.current = { isAttender: false, activeTabId: null };
    setState(EMPTY_STATE);
    restoreUrlTable();
    try {
      await api.post("/attender-auth/logout");
    } catch { /* cookie may already be gone */ }
  }, []);

  // The server says the session ended while orders were still open: drop back
  // to signed-out but keep the tabs, so signing in again restores them.
  const expireSession = useCallback(() => {
    modeRef.current = { isAttender: false, activeTabId: null };
    setState((s) => ({ ...s, attender: null }));
    restoreUrlTable();
  }, []);

  /* ── tabs ─────────────────────────────────────────────────────────── */
  // Opens (or re-opens) a tab for a table/guest and makes it active.
  const addTab = useCallback(({ tableNo, guest = "" }) => {
    const table = String(tableNo).trim();
    const who = String(guest || "").trim().slice(0, 40);
    const existing = stateRef.current.tabs.find((t) => sameText(t.tableNo, table) && sameText(t.guest, who));
    const id = existing ? existing.id : newTabId();
    modeRef.current = { ...modeRef.current, activeTabId: id };
    setState((s) =>
      s.tabs.some((t) => t.id === id)
        ? { ...s, activeTabId: id }
        : { ...s, tabs: [...s.tabs, { id, tableNo: table, guest: who }], activeTabId: id }
    );
    return id;
  }, []);

  const switchTab = useCallback((id) => {
    if (!stateRef.current.tabs.some((t) => t.id === id)) return;
    modeRef.current = { ...modeRef.current, activeTabId: id };
    setState((s) => ({ ...s, activeTabId: id }));
  }, []);

  const closeTab = useCallback((id) => {
    if (stateRef.current.activeTabId === id) {
      modeRef.current = { ...modeRef.current, activeTabId: null };
    }
    setState((cur) => {
      const { [id]: _removed, ...bagsLeft } = cur.bags;
      return {
        ...cur,
        tabs: cur.tabs.filter((t) => t.id !== id),
        bags: bagsLeft,
        activeTabId: cur.activeTabId === id ? null : cur.activeTabId,
      };
    });
  }, []);

  // Items waiting in each tab's bag, keyed by tab id (for badges).
  const itemCounts = useMemo(() => {
    const out = {};
    for (const t of tabs) {
      out[t.id] = (bags[t.id] || EMPTY_BAG).reduce((n, it) => n + (Number(it.quantity) || 1), 0);
    }
    return out;
  }, [tabs, bags]);

  return {
    attender,
    isAttender: !!attender,
    tabs,
    activeTab,
    activeTabId,
    itemCounts,
    bag,
    setBag,
    login,
    logout,
    expireSession,
    addTab,
    switchTab,
    closeTab,
  };
}

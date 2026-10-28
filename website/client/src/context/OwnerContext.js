import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getMe, logout as apiLogout } from "../services/api.js";

// The signed-in restaurant owner (the person who pays), as opposed to the
// staff accounts that use a restaurant's dashboard.
const OwnerContext = createContext(null);

export function OwnerProvider({ children }) {
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await getMe();
      setOwner(res.data.owner);
      return res.data.owner;
    } catch {
      setOwner(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signOut = useCallback(async () => {
    try { await apiLogout(); } finally { setOwner(null); }
  }, []);

  return (
    <OwnerContext.Provider value={{ owner, setOwner, loading, refresh, signOut }}>
      {children}
    </OwnerContext.Provider>
  );
}

export function useOwner() {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error("useOwner must be used within OwnerProvider");
  return ctx;
}

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as api from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    // Any 401 after sign-in means the session ended (or the account was deactivated).
    api.setUnauthorizedHandler(() => {
      setStaff((current) => {
        if (current) setExpired(true);
        return null;
      });
    });
    api.me().then((d) => setStaff(d.staff)).catch(() => setStaff(null)).finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email, password) => {
    const d = await api.login(email, password);
    setExpired(false);
    setStaff(d.staff);
  }, []);

  const updateProfile = useCallback(async (body) => {
    const d = await api.updateProfile(body);
    setStaff(d.staff);
    return d.staff;
  }, []);

  const signOut = useCallback(async () => {
    try { await api.logout(); } finally { setStaff(null); setExpired(false); }
  }, []);

  const can = useCallback((perm) => !!staff && staff.permissions.includes(perm), [staff]);

  return <AuthContext.Provider value={{ staff, loading, expired, signIn, signOut, updateProfile, can }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

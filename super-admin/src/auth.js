import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as api from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    // Any 401 after sign-in means the session ended: drop back to the login screen.
    api.setUnauthorizedHandler(() => {
      setAdmin((current) => {
        if (current) setExpired(true);
        return null;
      });
    });
    api.me().then((d) => setAdmin(d.admin)).catch(() => setAdmin(null)).finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email, password) => {
    const d = await api.login(email, password);
    setExpired(false);
    setAdmin(d.admin);
  }, []);

  const updateProfile = useCallback(async (body) => {
    const d = await api.updateProfile(body);
    setAdmin(d.admin);
    return d.admin;
  }, []);

  const signOut = useCallback(async () => {
    try { await api.logout(); } finally { setAdmin(null); setExpired(false); }
  }, []);

  return (
    <AuthContext.Provider value={{ admin, loading, expired, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

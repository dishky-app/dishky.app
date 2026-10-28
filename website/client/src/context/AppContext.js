import React, { createContext, useContext, useState } from "react";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [billingCycle, setBillingCycle] = useState("monthly"); // "monthly" | "yearly"
  const [isDemoModalOpen, setDemoModalOpen] = useState(false);

  const value = {
    billingCycle,
    setBillingCycle,
    isDemoModalOpen,
    openDemoModal: () => setDemoModalOpen(true),
    closeDemoModal: () => setDemoModalOpen(false),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}

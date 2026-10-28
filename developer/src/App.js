import React, { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth.js";
import { ticketApi } from "./api.js";
import Sidebar from "./components/layout/Sidebar.js";
import Topbar from "./components/layout/Topbar.js";
import PageLoader from "./components/PageLoader.js";
import { TicketApiProvider } from "./tickets/ui.js";
import Login from "./pages/Login.js";
import ForgotPassword from "./pages/ForgotPassword.js";
import ResetPassword from "./pages/ResetPassword.js";
import Dashboard from "./pages/Dashboard.js";
import Tickets from "./pages/Tickets.js";
import TicketPage from "./pages/TicketPage.js";
import Account from "./pages/Account.js";

// Same shell as the Admin Panel: .app > .sidebar + .app-main > .topbar + .page
function Shell() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  return (
    <TicketApiProvider value={ticketApi}>
      <div className="app">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      {isSidebarOpen && <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />}
        <div className={`app-main ${isSidebarOpen ? "expanded" : "collapsed"}`}>
          <Topbar onMenu={() => setIsSidebarOpen((o) => !o)} />
          <div className="page">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="/tickets/:id" element={<TicketPage />} />
              <Route path="/account" element={<Account />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    </TicketApiProvider>
  );
}

export default function App() {
  const { staff, loading } = useAuth();
  // Public pages (reachable while signed out): password reset links from e-mail.
  if (loading) return <div className="auth-page"><PageLoader /></div>;
  return (
    <Routes>
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={staff ? <Shell /> : <Login />} />
    </Routes>
  );
}

import React, { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth.js";
import Sidebar from "./components/layout/Sidebar.js";
import Topbar from "./components/layout/Topbar.js";
import PageLoader from "./components/PageLoader.js";
import Login from "./pages/Login.js";
import Overview from "./pages/Overview.js";
import Restaurants from "./pages/Restaurants.js";
import RestaurantDetail from "./pages/RestaurantDetail.js";
import Clients from "./pages/Clients.js";
import Settings from "./pages/Settings.js";
import Tickets from "./pages/Tickets.js";
import TicketPage from "./pages/TicketPage.js";
import Staff from "./pages/Staff.js";
import StaffDetail from "./pages/StaffDetail.js";
import Roles from "./pages/Roles.js";
import { ticketApi } from "./api.js";
import { TicketApiProvider } from "./tickets/ui.js";

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
            <Route path="/" element={<Overview />} />
            <Route path="/restaurants" element={<Restaurants />} />
            <Route path="/restaurants/:id" element={<RestaurantDetail />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/tickets/:id" element={<TicketPage />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/staff/:id" element={<StaffDetail />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
    </TicketApiProvider>
  );
}

export default function App() {
  const { admin, loading } = useAuth();
  if (loading) return <div className="auth-page"><PageLoader /></div>;
  return admin ? <Shell /> : <Login />;
}

import React, { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth.js";
import brandIcon from "../../icon/brand-icon.png";
import brandWordmark from "../../icon/brand-wordmark.png";
import "./Sidebar.css";

// Inline icons drawn in the same stroke style as the Admin Panel's chevrons.
const Icon = ({ children }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const MENU = [
  { label: "Overview", path: "/", end: true, icon: <Icon><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Icon> },
  { label: "Restaurants", path: "/restaurants", icon: <Icon><path d="M4 9l1.5-5h13L20 9" /><path d="M4 9v11h16V9" /><path d="M4 9a2.67 2.67 0 0 0 5.33 0 2.67 2.67 0 0 0 5.34 0A2.67 2.67 0 0 0 20 9" /></Icon> },
  { label: "Clients", path: "/clients", icon: <Icon><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></Icon> },
  { label: "Support Tickets", path: "/tickets", icon: <Icon><path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 0 0-6V6H3z" /><path d="M13 6v12" strokeDasharray="2 2" /></Icon> },
  { label: "Dishky Staff", path: "/staff", icon: <Icon><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /><path d="M9 14l3 3 3-3" /></Icon> },
  { label: "Roles & Permissions", path: "/roles", icon: <Icon><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></Icon> },
  { label: "My Profile", path: "/settings", icon: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon> },
];

export default function Sidebar({ isOpen, setIsOpen }) {
  const { admin } = useAuth();

  // Auto-collapse on narrow screens (<578px), same as the Admin Panel.
  useEffect(() => {
    const onResize = () => { if (window.innerWidth <= 992) setIsOpen(false); };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setIsOpen]);

  return (
    <aside className={`sidebar ${isOpen ? "is-open" : "is-closed"}`} style={{ width: isOpen ? 248 : 72 }}>
      <div className="sidebar-brand" onClick={() => setIsOpen((p) => !p)} title={isOpen ? "Collapse sidebar" : "Expand sidebar"}>
        <div className="brand-icon-wrap"><img src={brandIcon} alt="Dishky" className="brand-icon-img" /></div>
        {isOpen && (
          <div className="brand-logo-wrap"><img src={brandWordmark} alt="Dishky" className="brand-logo-img" /><span className="brand-tag">console</span></div>
        )}
        <div className="sidebar-toggle-icon" style={{ transform: `rotate(${isOpen ? 0 : 180}deg)` }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main">
        <div className="sidebar-menu">
          {MENU.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              title={!isOpen ? item.label : undefined}
              onClick={() => { if (window.innerWidth <= 992) setIsOpen(false); }}
              className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
            >
              <span className="sidebar-icon-wrap">{item.icon}</span>
              {isOpen && <span className="sidebar-label">{item.label}</span>}
            </NavLink>
          ))}
        </div>
      </nav>

      {isOpen && (
        <div className="sidebar-footer">
          <div className="sidebar-footer-inner">
            <div className="sidebar-footer-info">
              <span className="sidebar-footer-name" title={admin?.email}>{admin?.name || "Dishky"}</span>
              <span className="sidebar-footer-role">Super Admin</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

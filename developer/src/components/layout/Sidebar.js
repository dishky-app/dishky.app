import React, { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth.js";
import brandIcon from "../../icon/brand-icon.png";
import brandWordmark from "../../icon/brand-wordmark.png";
import "./Sidebar.css";

const Icon = ({ children }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const MENU = [
  { label: "Dashboard", path: "/", end: true, icon: <Icon><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Icon> },
  { label: "My Tickets", path: "/tickets", icon: <Icon><path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 0 0-6V6H3z" /><path d="M13 6v12" strokeDasharray="2 3" /></Icon> },
  { label: "My Profile", path: "/account", icon: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon> },
];

export default function Sidebar({ isOpen, setIsOpen }) {
  const { staff } = useAuth();

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
        {isOpen && <div className="brand-logo-wrap"><img src={brandWordmark} alt="Dishky" className="brand-logo-img" /><span className="brand-tag">developer</span></div>}
        <div className="sidebar-toggle-icon" style={{ transform: `rotate(${isOpen ? 0 : 180}deg)` }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main">
        <div className="sidebar-menu">
          {MENU.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.end} title={!isOpen ? item.label : undefined}
              onClick={() => { if (window.innerWidth <= 992) setIsOpen(false); }}
              className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`}>
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
              <span className="sidebar-footer-name" title={staff?.email}>{staff?.name}</span>
              <span className="sidebar-footer-role">{staff?.role}</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

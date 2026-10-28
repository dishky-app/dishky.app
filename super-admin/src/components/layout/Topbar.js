import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth.js";
import usePopupAnimation from "../../hooks/usePopupAnimation.js";
import Button3D from "../Button3D.js";
import Notifications from "../../tickets/Notifications.js";
import "./Topbar.css";

const titleFor = (path) => {
  if (path.startsWith("/restaurants/")) return "Restaurant Details";
  if (path.startsWith("/restaurants")) return "Restaurants";
  if (path.startsWith("/tickets/")) return "Ticket Details";
  if (path.startsWith("/tickets")) return "Ticket Management";
  if (path.startsWith("/staff/")) return "Staff Details";
  if (path.startsWith("/staff")) return "Dishky Staff";
  if (path.startsWith("/roles")) return "Roles & Permissions";
  if (path.startsWith("/clients")) return "Clients";
  if (path.startsWith("/settings")) return "My Profile";
  return "Overview";
};

export default function Topbar({ onMenu }) {
  const { admin, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const profilePopup = usePopupAnimation();
  const profileRef = useRef(null);
  const initial = admin?.name?.charAt(0)?.toUpperCase() || "S";

  useEffect(() => {
    const onDown = (e) => { if (profileRef.current && !profileRef.current.contains(e.target)) profilePopup.close(); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [profilePopup]);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="topbar-menu-btn" aria-label="Open menu" onClick={onMenu}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <h3 className="topbar-title">Super Admin - {titleFor(pathname)}</h3>
      </div>

      <div className="topbar-right">
        <Notifications ticketBase="/tickets" />
        <div className="topbar-icon-wrapper" ref={profileRef}>
          <button type="button" className="profile-btn" onClick={(e) => { e.stopPropagation(); profilePopup.toggle(); }}>
            <div className="profile-avatar" style={{ background: "#2563eb" }}>
              {admin?.photo ? <img src={admin.photo} alt="" /> : <span className="profile-avatar-initial">{initial}</span>}
            </div>
            <span className="profile-name">{admin?.name || "Super Admin"}</span>
          </button>

          {profilePopup.shouldRender && (
            <div className={`dropdown profile-dropdown ${profilePopup.animClass}`} onClick={(e) => e.stopPropagation()}>
              <div className="profile-info">
                <div className="profile-avatar large" style={{ background: "#2563eb" }}>
                  {admin?.photo ? <img src={admin.photo} alt="" /> : <span className="profile-avatar-initial">{initial}</span>}
                </div>
                <div>
                  <p className="profile-fullname">{admin?.name || "Super Admin"}</p>
                  <p className="profile-role">{admin?.email}</p>
                </div>
              </div>
              <div className="dropdown-divider" />
              <Button3D variant="cancel" style={{ width: "100%", marginBottom: "8px" }} onClick={() => { profilePopup.close(); navigate("/settings"); }}>My Profile</Button3D>
              <Button3D variant="danger" style={{ width: "100%" }} onClick={() => { profilePopup.close(); signOut(); }}>Logout</Button3D>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

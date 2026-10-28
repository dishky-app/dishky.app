import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import usePopupAnimation from "../hooks/usePopupAnimation.js";
import Button3D from "../components/Button3D.js";
import notificationIcon from "../icon/notification.png";
import { dateTime, usePolling, useTicketApi } from "./ui.js";

// Notification bell — same markup/classes as the Admin Panel's top bar (.notification-icon-btn,
// .notification-badge, fixed-position .dropdown.notification-dropdown). The popup is position:fixed, so the
// scrolling top-bar container can't clip it. Polls every 20 s and when the tab regains focus.
export default function Notifications({ ticketBase = "/tickets" }) {
  const api = useTicketApi();
  const navigate = useNavigate();
  const popup = usePopupAnimation();
  const [data, setData] = useState({ unread: 0, rows: [] });
  const [failed, setFailed] = useState(false);
  const ref = useRef(null);

  const load = () => api.notifications().then((d) => { setData(d || { unread: 0, rows: [] }); setFailed(false); }).catch(() => setFailed(true));
  usePolling(load, 20000, [api]);

  useEffect(() => {
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) popup.close(); };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [popup]);

  const go = async (n) => {
    popup.close();
    if (!n.read) {
      api.markRead([n.id]).catch(() => {});
      setData((d) => ({ unread: Math.max(0, d.unread - 1), rows: d.rows.map((r) => (r.id === n.id ? { ...r, read: true } : r)) }));
    }
    if (n.ticketId) navigate(`${ticketBase}/${n.ticketId}`);
  };
  const readAll = async () => { await api.markRead().catch(() => {}); setData((d) => ({ unread: 0, rows: d.rows.map((r) => ({ ...r, read: true })) })); };
  const count = data.unread > 99 ? "99+" : data.unread;

  return (
    <div className="topbar-icon-wrapper" ref={ref}>
      <button type="button" className="notification-icon-btn" aria-label="Notifications" onClick={(e) => { e.stopPropagation(); if (!popup.shouldRender) load(); popup.toggle(); }}>
        <img src={notificationIcon} alt="" width="22" height="22" />
        {data.unread > 0 && <span className="notification-badge">{count}</span>}
      </button>
      {popup.shouldRender && (
        <div className={`dropdown notification-dropdown tk-notes ${popup.animClass}`} onClick={(e) => e.stopPropagation()}>
          <h4 className="dropdown-title">Notifications</h4>
          <ul className="notification-list">
            {failed && <li><span>Couldn't load notifications. Retrying…</span></li>}
            {!failed && data.rows.length === 0 && <li><span>No notifications yet</span></li>}
            {data.rows.map((n) => (
              <li key={n.id} className={n.read ? "" : "tk-unread"} onClick={() => go(n)}>
                <strong>{n.read ? "" : "● "}{n.message}</strong>
                <span>{dateTime(n.createdAt)}</span>
              </li>
            ))}
          </ul>
          {data.unread > 0 && <Button3D variant="cancel" style={{ width: "100%", marginTop: 10 }} onClick={readAll}>Mark all as read</Button3D>}
        </div>
      )}
    </div>
  );
}

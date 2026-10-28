import { resolved } from "../tenant";
import { useNavigate } from "react-router-dom";
import "./EventHome.css";
import HomeButton from "./shared/HomeButton";
import { useScrollHeader } from "./shared/useScrollHeader";

const EventHome = ({ handleBack, handleHome }) => {
  const navigate = useNavigate();
  const { headerRef, scrolled } = useScrollHeader();

  const options = [
    {
      name: "Book an Event",
      path: "/events/hosted",
      emoji: "🎉",
      description: "Join our hosted restaurant events",
      accent: "linear-gradient(135deg, #f59e0b, #ef4444)",
      accentLight: "rgba(239, 68, 68, 0.1)",
    },
    {
      name: "Table Reservation",
      path: "/events/reservation",
      emoji: "🪑",
      description: "Reserve your perfect table in advance",
      accent: "linear-gradient(135deg, #2563eb, #0891b2)",
      accentLight: "rgba(37, 99, 235, 0.1)",
    },
    {
      name: "Birthday & Candlelight",
      path: "/events/celebration",
      emoji: "🕯️",
      description: "Make special moments unforgettable",
      accent: "linear-gradient(135deg, #ec4899, #8b5cf6)",
      accentLight: "rgba(236, 72, 153, 0.1)",
    },
    {
      name: "Pre Booking",
      path: "/events/prebooking",
      emoji: "📅",
      description: "Schedule your visit ahead of time",
      accent: "linear-gradient(135deg, #16a34a, #0d9488)",
      accentLight: "rgba(22, 163, 74, 0.1)",
    },
    {
      name: "Catering Order",
      path: "/events/catering",
      emoji: "🍱",
      description: "Bulk food orders for your events",
      accent: "linear-gradient(135deg, #7c3aed, #2563eb)",
      accentLight: "rgba(124, 58, 237, 0.1)",
    },
  ];

  return (
    <div className="no-padding">
      {/* Header */}
      <div ref={headerRef} className={`pl-header${scrolled ? " header-scrolled" : ""}`}>
        <button className="back-button" onClick={handleBack} aria-label="Back" />
        <h1 className="ehome-page-title">Events & Bookings</h1>
        <HomeButton onClick={handleHome} />
      </div>

      <div className="pl-body">
        {/* Hero */}
        <div className="ehome-hero">
          <div className="ehome-hero-bg">
            <div className="ehome-hero-orb ehome-orb-1" />
            <div className="ehome-hero-orb ehome-orb-2" />
          </div>
          <div className="ehome-hero-content">
            <span className="ehome-hero-tag">✦ {resolved.restaurantName || "Welcome"}</span>
            <h2 className="ehome-hero-title">Plan Your<br />Perfect Experience</h2>
            <p className="ehome-hero-sub">From intimate dinners to grand celebrations — we've got you covered.</p>
          </div>
        </div>

        {/* Options */}
        <div className="ehome-section">
          <p className="ehome-section-label">Choose a Service</p>
          <div className="ehome-options-list">
            {options.map((opt, index) => (
              <div
                key={opt.name}
                className="ehome-option-card"
                onClick={() => navigate(opt.path)}
                style={{ "--accent": opt.accent, "--accentLight": opt.accentLight, animationDelay: `${index * 0.06}s` }}
              >
                <div className="ehome-option-text">
                  <h3 className="ehome-option-name">{opt.name}</h3>
                  <p className="ehome-option-desc">{opt.description}</p>
                </div>
                <div className="ehome-option-arrow">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventHome;
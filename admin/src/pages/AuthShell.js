/**
 * AuthShell.js — shared split-screen layout for every auth page
 * (Login, Signup, ForgotPassword, ForcePasswordReset).
 *
 * Left: a vivid brand panel (logo, headline, key points) on a themed
 * gradient. It collapses to a slim brand banner on small screens.
 * Right: the form card. The Dishky icon (icon/logo-shrink.png) and red logo (icon/logo.png) sit on a white
 * plate so it stays readable on the coloured panel.
 */

import dishkyLogo from '../icon/logo.png'
import dishkyIcon from '../icon/logo-shrink.png'

const POINTS = [
  "Live orders, kitchen and table service in sync",
  "Menu, stock, offers and staff in one place",
  "Payments and reports that are always up to date",
];

const AuthShell = ({ title, subtitle, children }) => {
  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-visual">
          <div className="auth-visual-glow" />

          <div className="auth-brand">
            <span className="auth-brand-mark">
              <img alt="" aria-hidden="true" className="auth-brand-icon" src={dishkyIcon} />
              <img alt="Dishky" className="login-logo" src={dishkyLogo} />
            </span>
          </div>

          <div className="auth-hero">
            <h2>Run your restaurant <em>effortlessly.</em></h2>
            <p>Everything your team needs to take orders, serve guests and grow, in a single admin panel.</p>
            <ul className="auth-points">
              {POINTS.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>

          <div className="auth-visual-foot">&copy; Dishky &middot; Restaurant management</div>
        </div>

        <div className="auth-form-panel">
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthShell;

import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PageLoader from "../components/PageLoader";
import AuthShell from "./AuthShell";
import { MARKETING_URL } from "../tenant";
import "./Login.css";

// Landing page for "Open dashboard" on dishky.com:
//   /sso?restaurant=<slug>&token=<one-time token>
// Exchanges the one-time token for a staff session, then opens the dashboard.
const SsoLanding = () => {
  const { ssoLogin } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // tokens are single-use; never submit twice
    started.current = true;
    const restaurant = params.get("restaurant");
    const token = params.get("token");
    if (!restaurant || !token) {
      setError("This sign-in link is incomplete.");
      return;
    }
    ssoLogin(restaurant, token)
      .then(() => navigate("/", { replace: true }))
      .catch((err) => setError(err.response?.data?.error || "Couldn't sign you in. Please try again."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!error) return <PageLoader label="Opening your dashboard…" />;
  return (
    <AuthShell title="Couldn't sign you in">
      <p className="auth-error">{error}</p>
      <p className="auth-switch-hint">
        <a href={`${MARKETING_URL}/account`}>Open the dashboard again from your Dishky account</a>
        {" · "}
        <Link to="/">Sign in with your restaurant login</Link>
      </p>
    </AuthShell>
  );
};

export default SsoLanding;

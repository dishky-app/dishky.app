import "./Welcome.css";
import "./attender/Attender.css";
import PageLoader from "../components/PageLoader";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";

import api from "../api";
import { resolved } from "../tenant";

import logoExtend from "../assets/logo-shrink.png";
import logoShrink from "../assets/logo.png";
import powerLogo from "../assets/marqwon-logo.png";

import { useTheme } from "../components/ThemeContext";
import MatField from "./shared/MatField";
import Button3D from "./shared/Button3D";
import { useToast } from "../components/Usetoast";
import { endCustomerSession } from "./customerSession";

const Welcome = ({ toCamelCase, setCurrentUser, fetchMenu }) => {
  const navigate = useNavigate();
  const mobileInputRef = useRef(null);
  const [enableAutocomplete, setEnableAutocomplete] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [activeCard, setActiveCard] = useState(null);
  const [branchName, setBranchName] = useState("");

  const { theme } = useTheme();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("Login")
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [animateCards, setAnimateCards] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimateCards(true);
    }, 100); // slight delay ensures visible animation
    return () => clearTimeout(timer);
  }, []);

  /**
   * NOTE: this used to fetch every registered customer's mobile number
   * (GET /users, admin-only) to power a browser <datalist> autocomplete
   * on the login field. Beyond now correctly 401ing for a customer
   * session, showing another customer's phone number as a login
   * suggestion was a real privacy leak in its own right — there's no
   * safe way to "autocomplete" someone else's number. Removed rather
   * than replaced 1:1; enableAutocomplete is left wired through to the
   * <MatField> below (currently forced false) in case a *self-only*
   * version — e.g. remembering just this device's last-used number via
   * localStorage — is wanted later.
   */

  // Venue name comes from the URL (/<restaurant>/<venue>), already resolved
  // by TenantGate before the app mounted.
  useEffect(() => {
    setBranchName(resolved.venueName ? `${resolved.restaurantName} · ${resolved.venueName}` : resolved.restaurantName || "");
  }, []);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 576);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 576);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const containerVariants = {
    hidden: {},
    visible: {}
  };

  const cardVariants = {
    hidden: (index) => ({
      opacity: 1,
      x: 0,
      position: isMobile ? "relative" : "absolute",
      left: 0,
      zIndex: 10 - index
    }),
    visible: (index) => ({
      x: isMobile ? 0 : index * 240,
      position: isMobile ? "relative" : "absolute",
      left: 0,
      transition: {
        delay: isMobile ? 0 : index * 0.4,
        type: "spring",
        stiffness: 120,
        damping: 18
      }
    })
  };

  const handleGuest = () => {
    endCustomerSession(); // clears both localStorage and any server-side session cookie

    setCurrentUser({
      id: "guest",
      role: "guest"
    });

    navigate("/categories");
  };

  const handleMobileChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
    setMobile(value);
    setFormErrors(prev => ({ ...prev, mobile: "" }));

    if (value.length === 10) {
      setEnableAutocomplete(false);
      setTimeout(() => mobileInputRef.current?.blur(), 0);
    } else {
      setEnableAutocomplete(true);
    }
  };

  const handleSignupMobileChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, "");
    if (digitsOnly.length <= 10) {
      setMobile(digitsOnly);
      setFormErrors(prev => ({ ...prev, mobile: "" }));
    }
  };

  const handleNameChange = (e) => {
    let value = e.target.value;
    if (value.length > 100) return;
    const words = value.trim().split(/\s+/);
    if (words.length > 5) return;
    setName(toCamelCase(value));
    setFormErrors(prev => ({ ...prev, name: "" }));
  };

  const handleLogin = async () => {
    const e = {};
    if (mobile.length !== 10) e.mobile = "Enter a valid 10-digit mobile number.";
    if (Object.keys(e).length > 0) { setFormErrors(e); return; }

    try {
      setLoading(true);
      const res = await api.post("/auth/session-login", { mobile });
      const user = res.data.user;

      localStorage.setItem("userId", user.id);

      // SYNC USER INTO STATE
      setCurrentUser(user);

      // REFRESH MENU + FAVOURITES
      fetchMenu();
      setActiveCard(null);
      setMobile("");
      navigate("/categories");
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) {
        setFormErrors({ mobile: "No account exists with this mobile number." });
      } else if (status === 409) {
        setFormErrors({ mobile: "Multiple accounts found. Contact support." });
      } else {
        console.error("Login failed", err);
        toast.error("Couldn't log in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    const e = {};
    if (!name.trim() || name.trim().length < 2) e.name = "Enter a valid name.";
    if (mobile.length !== 10) e.mobile = "Enter a valid 10-digit mobile number.";
    if (Object.keys(e).length > 0) { setFormErrors(e); return; }

    try {
      setLoading(true);

      const res = await api.post("/auth/session-signup", { name: name.trim(), mobile });
      const newUser = res.data.user;

      localStorage.setItem("userId", newUser.id);

      setActiveCard(null);
      setName("");
      setMobile("");
      setCurrentUser(newUser);
      // REFRESH MENU
      fetchMenu();
      navigate("/categories");

    } catch (err) {
      if (err.response?.status === 409) {
        setFormErrors({ mobile: "An account already exists with this mobile number." });
      } else {
        console.error("Signup failed", err);
        toast.error("Couldn't create your account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  var loginTab = 'Login';
  var tabs = document.getElementsByClassName('openTab');

  function openTab(loginTab) {
    // var i;
    var x = document.getElementsById;
    //console.log(loginTab);
    if (loginTab == 'Login') {
      console.log(loginTab);
      document.getElementById('Login').style.display = "block";
      document.getElementById('Create').style.display = "none";
      // document.elementFromPoint('Login').className = "welcome-btn welcome-btn-active";
      //document.getElementsByClassName('welcome-btn').className = "welcome-btn welcome-btn-active";

    }
    if (loginTab == 'Create') {
      console.log(loginTab);
      document.getElementById('Login').style.display = "none";
      document.getElementById('Create').style.display = "block";

    }
    //alert(x);
    //document.getElementById('Login').style.display = "block";
    //alert(document.getElementById('Login'));
  }


  // tabs.addEventListener.Object.openTab('Login');

  return (
    <div className="welcome-page">
      {loading && <PageLoader label="Please wait" />}
      {/* Wave background */}
      <div className="welcome-waves" aria-hidden="true">
        <div className="welcome-wave" />
        <div className="welcome-wave" />
        <div className="welcome-wave" />
      </div>

      <div className="welcome-container">
        <div className="welcome-title">
          {/* two logos side by side: flex, gap 10px */}
          <div className="welcome-logos">
            <img src={logoExtend} alt="Cafe" />
            <img src={logoShrink} alt="" /> {/* ← swap for the second logo you want here */}
          </div>
        </div>

        <div className="welcome-slogan">
          Where every bite feels right
        </div>

        {branchName && (
          <div className="welcome-branch-name">{branchName}</div>
        )}

        <div className="welcome-card-wrapper">
          <div className="welcome-btn-container">
            <button
              className={`welcome-btn ${activeTab === "Login" ? "active" : ""}`}
              onClick={() => {
                openTab('Login')
                setActiveTab("Login")
                setMobile("")
                setFormErrors(prev => ({ ...prev, name: "", mobile: "" }));
              }}
            >
              Login
            </button>
            <button
              className={`welcome-btn ${activeTab === "Create" ? "active" : ""}`}
              onClick={() => {
                openTab('Create')
                setActiveTab("Create")
                setName("")
                setMobile("")
                setFormErrors(prev => ({ ...prev, mobile: "" }));
              }}>Create Account</button>
          </div>

          <div
            className="profile-card openTab" id="Login"
          >
            <div
              className="section"
              onClick={(e) => e.stopPropagation()}
            >
              <MatField
                label="Mobile Number"
                type="tel"
                style={{ paddingLeft: "4px" }}
                inputRef={mobileInputRef}
                list={enableAutocomplete ? "user-mobiles" : undefined}
                maxLength={10}
                value={mobile}
                onChange={handleMobileChange}
                error={formErrors.mobile}
                wrapperClassName=""
              />
            </div>


            <Button3D
              className="btn-3d red"
              onClick={(e) => {
                e.stopPropagation();
                handleLogin();
              }}
            >
              Login
            </Button3D>
          </div>

          <div
            className="profile-card openTab"
            style={{ display: "none" }}
            id="Create"
          >
            <div
              className="section"
              onClick={(e) => e.stopPropagation()}
            >
              <MatField
                label="Full Name"
                type="text"
                maxLength={100}
                value={name}
                onChange={handleNameChange}
                error={formErrors.name}
                wrapperClassName=""
              />
            </div>

            <div
              className="section"
              onClick={(e) => e.stopPropagation()}
            >
              <MatField
                label="Mobile Number"
                type="tel"
                maxLength={10}
                value={mobile}
                onChange={handleSignupMobileChange}
                error={formErrors.mobile}
                wrapperClassName=""
              />
            </div>


            <Button3D
              className="btn-3d red"
              onClick={(e) => {
                e.stopPropagation();
                handleSignup();
              }}
              disabled={loading}
            >
              Sign Up
            </Button3D>
          </div>

          <Button3D
            className="btn-3d green"
            onClick={handleGuest}
            frontStyle={{ padding: "0 10px" }}
          >
            Enter as Guest
          </Button3D>
          <span className="subtext">(No login needed)</span>
        </div>
        <button type="button" className="at-welcome-link" onClick={() => navigate("/attender")}>
          Attender login
        </button>
        {/* parent logo (image) + company name (text), wrapped in a flex container */}
        <a className="power-brand" href="https://www.marqwon.com/" target="_blank" rel="noopener noreferrer" aria-label="Visit MarqWon Dynamics Pvt. Ltd.">
          <span className="power-prefix">Powered by</span>
          <img alt="" className="power-logo" src={powerLogo} />
          <span className="power-name">MarqWon Dynamics Pvt. Ltd.</span> {/* ← company name */}
        </a>
      </div>


    </div >

  );
};

export default Welcome;
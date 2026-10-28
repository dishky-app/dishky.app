import { createContext, useContext, useEffect, useState } from "react";
import socket from "../socket";
import api from "../api";

// ─── Context ──────────────────────────────────────────────────────────────────
const ThemeContext = createContext();

// ─── Derive edge-gradient stops from --color-red ─────────────────────────────
// Keeps the 3-D button edge colour in sync with the admin's accent choice.
// Mirrors the same helper in ThemeSettings.js so the user panel is fully
// self-contained — it works even when the saved DB record pre-dates the
// --edge-color-dark / --edge-color-light feature.
const deriveEdgeColors = (accentHex = "") => {
  try {
    const hex = accentHex.startsWith("#") ? accentHex : `#${accentHex}`;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0;
    if (max !== min) {
      const d = max - min;
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (max === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
    }
    const hue = Math.round(h);
    return {
      "--edge-color-dark": `hsl(${hue}deg 100% 16%)`,
      "--edge-color-light": `hsl(${hue}deg 100% 32%)`,
    };
  } catch {
    return {
      "--edge-color-dark": "hsl(6deg 100% 16%)",
      "--edge-color-light": "hsl(6deg 100% 32%)",
    };
  }
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export const ThemeProvider = ({ children }) => {
  // "light" | "dark" — derived from the browser/OS color-scheme
  // preference (prefers-color-scheme), not a manual user toggle.
  const getSystemTheme = () =>
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

  const [theme, setTheme] = useState(getSystemTheme());

  // Full token maps pushed from admin panel
  const [lightTokens, setLightTokens] = useState({});
  const [darkTokens, setDarkTokens] = useState({});

  // ── Apply a token map to :root CSS variables ──────────────────────────────
  // Always derives --edge-color-dark/light from --color-red so edge gradients
  // stay in sync even when the token map was saved before the edge-color feature.
  const applyTokens = (tokenMap) => {
    if (!tokenMap || typeof tokenMap !== "object") return;
    const root = document.documentElement;
    Object.entries(tokenMap).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });
    const accentHex = tokenMap["--color-red"];
    if (accentHex) {
      const edgeColors = deriveEdgeColors(accentHex);
      Object.entries(edgeColors).forEach(([key, val]) => {
        root.style.setProperty(key, val);
      });
    }
    const greenHex = tokenMap["--color-green"];
    if (greenHex) {
      const { "--edge-color-dark": gDark, "--edge-color-light": gLight } = deriveEdgeColors(greenHex);
      root.style.setProperty("--edge-color-green-dark", gDark);
      root.style.setProperty("--edge-color-green-light", gLight);
    }
  };

  // ── Load saved theme from server on mount ─────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/public/theme");
        const saved = Array.isArray(res.data) ? res.data[0] : res.data;
        if (!saved) return;

        if (saved.light) setLightTokens(saved.light);
        if (saved.dark) setDarkTokens(saved.dark);

        // Apply immediately for the current system-derived theme mode
        applyTokens(theme === "dark" ? saved.dark : saved.light);
      } catch {
        // No theme saved yet — CSS defaults apply
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-apply tokens whenever theme mode switches ──────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    applyTokens(theme === "dark" ? darkTokens : lightTokens);
  }, [theme, lightTokens, darkTokens]);

  // ── Follow the browser/OS theme live — if the person switches their
  // system between light and dark, the app follows without a reload. ──
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => setTheme(e.matches ? "dark" : "light");
    // Safari <14 only supports addListener/removeListener
    if (mql.addEventListener) mql.addEventListener("change", handleChange);
    else mql.addListener(handleChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handleChange);
      else mql.removeListener(handleChange);
    };
  }, []);

  // ── Listen for admin panel theme broadcasts ───────────────────────────────
  useEffect(() => {
    const handleThemeUpdate = (payload) => {
      if (!payload) return;

      setLightTokens(payload.light || {});
      setDarkTokens(payload.dark || {});

      applyTokens(theme === "dark" ? payload.dark || {} : payload.light || {});
    };

    socket.on("theme-update", handleThemeUpdate);

    return () => socket.off("theme-update", handleThemeUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
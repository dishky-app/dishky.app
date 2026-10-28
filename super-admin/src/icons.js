import React from "react";

// Stroke icons for the sidebar. Same size and weight everywhere (18px, 1.8
// stroke, round caps) so they read as one set next to the Admin Panel's.
const Svg = ({ children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const IconOverview = () => (
  <Svg><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Svg>
);

export const IconRestaurants = () => (
  <Svg><path d="M4 10h16l-1.2-5H5.2L4 10z" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></Svg>
);

export const IconClients = () => (
  <Svg><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18 14.8c2 .7 3.3 2.4 3.5 5.2" /></Svg>
);

export const IconAccount = () => (
  <Svg><circle cx="12" cy="8" r="4" /><path d="M4 21c.7-4 3.9-6.5 8-6.5s7.3 2.5 8 6.5" /></Svg>
);

export const IconSignOut = () => (
  <Svg><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" /><path d="M16 8l4 4-4 4" /><path d="M20 12H9" /></Svg>
);

export const IconMenu = () => (
  <Svg><path d="M4 7h16M4 12h16M4 17h16" /></Svg>
);

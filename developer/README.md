# Dishky Developer Panel
Internal panel for Dishky's technical team (developers, testers, QA, release managers, support engineers).
Staff accounts are created by a Super Admin (Super Admin console -> Dishky Staff) and activated through
an e-mailed, single-use invitation link. There is no public sign-up.

    npm install
    npm run dev        # http://localhost:5175, proxies /api -> http://localhost:4000
    npm run build      # set VITE_API_ORIGIN=https://api.dishky.com first (or keep the /api rewrite in vercel.json)

Server settings (server/env.example): DEV_PANEL_URL=https://dev.dishky.com is used to build reset / invitation links.
Styling: same Admin Panel stylesheet stack as the Super Admin console; ticket-only extras are in src/tickets/tickets.css (prefix `tk-`).

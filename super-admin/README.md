# Dishky super admin console
Read-only console for the Dishky team: clients, plans, expiry dates, storage, MRR.

    npm install
    npm run dev        # http://localhost:5174, proxies /api -> http://localhost:4000
    npm run build      # set VITE_API_ORIGIN=https://api.dishky.com first

Create the first admin on the server (there is no sign-up):

    node scripts/create-platform-admin.js --email you@dishky.com --name "Your Name"
    # forgot password / locked: add --reset ; remove access: --disable

## Styling
The look is the Admin Panel's. `src/admin-shared/` holds verbatim copies of the admin's
`Common.css`, `Sidebar.css` and `Login.css`; re-copy them to pick up admin style changes.
`src/styles.css` holds only the few extras the admin has no class for.

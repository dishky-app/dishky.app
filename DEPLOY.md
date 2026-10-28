# Dishky — deployment guide

Four projects, three public hostnames:

| Project (zip) | What it is | Where it runs |
|---|---|---|
| `dishky-api` | Express + MongoDB + Socket.IO. Everything: restaurants, plans, billing, orders | `api.dishky.com` (Render, Railway, a VPS…) |
| `dishky-website` | Marketing site + sign-up, login, account, plans, billing | Vercel project **A** (its own `*.vercel.app` URL) |
| `dishky-customer-app` | The diner's ordering app (QR target) | Vercel project **B**, which owns `www.dishky.com` |
| `dishky-dashboard` | The restaurant staff/owner dashboard | Vercel project **C** at `app.dishky.com` |

```
www.dishky.com                    -> website (A)           via rewrites in B
www.dishky.com/pricing, /login…   -> website (A)
www.dishky.com/<restaurant>/<venue>/<table>  -> customer app (B)
app.dishky.com                    -> dashboard (C)
api.dishky.com                    -> API
```

## 1. Rotate the credentials in the old uploads first

The zips you sent contained `.env` files and an `env.example` with a real-looking MongoDB Atlas
connection string, a JWT secret, and Razorpay and Cashfree keys. Treat all of them as exposed:
change the Atlas database password, issue new Razorpay/Cashfree keys, and generate new secrets.
None of those values are in the converted projects.

## 2. API (`dishky-api`)

1. `npm install`, copy `env.example` to `.env`, fill it in (every variable is explained there).
   Required: `MONGO_URI`, `ALLOWED_ORIGINS`, `PUBLIC_SITE_URL`, `ADMIN_APP_URL`, `PUBLIC_API_URL`,
   `SETTINGS_ENCRYPTION_KEY`, `RAZORPAY_BILLING_*`, SMTP settings.
2. `npm start`. On boot it creates the plans (Starter, Growth, Enterprise), indexes and the subscription sweeper.
3. Razorpay (Dishky's own account, for charging owners): add a webhook to
   `https://api.dishky.com/platform/webhooks/razorpay` with the events listed in `env.example`.
4. **Test the billing in Razorpay test mode end to end before taking real money.** The Razorpay billing
   adapter was written against Razorpay's documentation and has not been run against a live Razorpay
   account. The automated tests use the built-in mock provider.
5. Tests: `npm run test:db` (starts a local test database), then `npm test`.

### Moving your existing single-restaurant data in

```
MONGO_URI=<existing db> node scripts/migrate-to-multitenant.js             # dry run, changes nothing
MONGO_URI=<existing db> node scripts/migrate-to-multitenant.js --apply --slug my-restaurant --name "My Restaurant"
```

It turns the current database into the first restaurant (`dishky.com/my-restaurant`) on a complimentary
Enterprise plan, keeps all data, gives venues URL names, and replaces the old unique indexes.
It is safe to re-run. Take a backup first. Everyone gets signed out once. Session cookies are now named `dishkyid` (staff), `dishkyid_cust_<restaurantId>` (customers), `dishkyid_owner` (owners) and `dishkyid_admin` (Dishky team), so all existing sessions end at deployment.

## 3. Website (`dishky-website/client`)

* Env: `VITE_API_ORIGIN=https://api.dishky.com` (the API and website must share a parent domain so the owner
  login cookie is first-party).
* Deploy as Vercel project **A** (root = `client`). Note its URL, e.g. `https://dishky-site.vercel.app`.
* Local dev: `npm run dev` (proxies `/api` to `localhost:4000`).
* The old `server/` folder (contact/demo/newsletter/plans) is no longer needed: all of it now lives in the
  API under `/platform`. It is not included in the zip.

## 4. Customer app (`dishky-customer-app`) and the shared domain

* Deploy as Vercel project **B** and attach the domain `www.dishky.com` to *this* project.
* Env: `BACKEND_ORIGIN=https://api.dishky.com` (used by its `/api` proxy), `REACT_APP_SERVER_URL=https://api.dishky.com`
  (live updates), `REACT_APP_MARKETING_URL=https://www.dishky.com`.
* Its `vercel.json` is generated. It sends every reserved name (`/pricing`, `/login`, `/account`…) to the website
  and everything else to the ordering app. To regenerate with your real website URL:

  ```
  cd dishky-website
  node scripts/generate-vercel-config.js --marketing https://<your-website>.vercel.app \
       --base scripts/customer-base.vercel.json --out ../dishky-customer-app/vercel.json
  ```
  The file currently contains the placeholder `https://dishky-site.vercel.app`. Replace it.
* A restaurant can never take a reserved name, so the two apps can never collide.

## 5. Dashboard (`dishky-dashboard`)

* Vercel project **C**, domain `app.dishky.com`.
* Env: `BACKEND_ORIGIN=https://api.dishky.com`, `REACT_APP_SERVER_URL=https://api.dishky.com`,
  `REACT_APP_MARKETING_URL=https://www.dishky.com`, `REACT_APP_CUSTOMER_URL=https://www.dishky.com`.
* Staff sign in with *restaurant URL name + email + password*. Owners can also jump straight in with
  **Open dashboard** on `www.dishky.com/account` (one-time link, valid 60 s).

## 6. Print bridge (per venue)

The dashboard's Venues page → edit venue → **Print bridge** shows the restaurant name, venue id and a token.
At the venue, run `print-bridge/bridge.js` (in the dashboard project) next to the local print server:

```
DISHKY_API_URL=https://api.dishky.com DISHKY_RESTAURANT=my-restaurant DISHKY_VENUE_ID=… DISHKY_PRINTER_TOKEN=… node bridge.js
```
Your old bridge program was not part of the upload, so this is a new reference client. It was not tested against a physical printer.

## Things to know

* **`public/` folders and images.** The uploads had no `public/` folder and no image/GIF assets in the two React
  apps. I added a bare `public/index.html` to each; keep your own `public/` files (icons, `/assets/...` images)
  and your existing `src/assets`. Don't overwrite your `src/assets`.
* **Plans.** Starter: 1 branch, 15 tables, 3 staff logins, core modules (menu, QR ordering, orders, payments,
  tables, users). Growth: 1 branch, 80 tables, 25 staff logins, everything. Enterprise: unlimited, set by you
  (not self-serve). Edit `platform/plans.js` and restart. Prices ₹999 / ₹2,999 per month, ~2 months free yearly.
* **Lifecycle.** 14-day trial (no card). After the trial: unpaid → read-only → blocked. Failed renewals get a
  7-day grace. Upgrades charge immediately; downgrades apply at period end and are refused if current usage
  is over the new plan's limits. Cancel keeps access until period end.
* **Two passwords.** The owner's Dishky account (billing) and the restaurant dashboard logins are separate by design.
  The first dashboard Super Admin is created with the owner's password at sign-up.
* **Restaurant URL names are permanent** (printed QR codes depend on them). Venue URL names can be edited.
* **Security fix found on the way:** the old CSRF check would have rejected Razorpay's webhooks. Webhook paths
  are now exempt (they are signature-verified instead).
* **Not tested:** live Razorpay billing, Socket.IO real-time paths and the print bridge. The 32 backend tests cover
  tenant isolation, plans/limits, the billing lifecycle (mock provider) and the migration, and ran against FerretDB
  (a MongoDB-compatible database), not a real MongoDB server. The three front ends compile; I did not click
  through them in a browser.

## 7. Super admin console (for the Dishky team)

Shows every client (restaurant owner), their restaurants, plan, status, expiry date, MRR, total clients and
database storage used per restaurant. It is read-only and has its own accounts, separate from owners and staff.

1. **Create the first admin** (no sign-up exists, by design) on the API server:
   `node scripts/create-platform-admin.js --email you@dishky.com --name "Your Name"` (password ≥ 12 chars, prompted).
   Lost password or locked out: rerun with `--reset`. Remove someone: `--disable`.
2. **Deploy `dishky-superadmin`** as a fourth Vercel project on a sibling subdomain, e.g. `ops.dishky.com`
   (build `npm run build`, env `VITE_API_ORIGIN=https://api.dishky.com`).
3. **API env:** add `https://ops.dishky.com` to `ALLOWED_ORIGINS`. Optional: `PLATFORM_ADMIN_ALLOWED_IPS`
   (office/VPN IPs only), `DB_STORAGE_LIMIT_MB`, `SUPERADMIN_LOGIN_RATE_LIMIT_MAX`.

Security: bcrypt passwords, 5 wrong tries locks the account 15 min, same error for every login failure,
12-hour httpOnly SameSite=Strict session, login rate limit, sign-in log kept 180 days, no-store caching.
**Not included:** two-factor login. I recommend adding it, or at least using the IP allow-list.
Storage: exact per-restaurant sizes need real MongoDB 4.4+; on other engines it is estimated (labelled "estimated").
Measurements are cached 10 minutes; "Re-measure" forces a refresh. Tested with 8 automated tests and checked in a
browser against FerretDB only, not a real MongoDB server.

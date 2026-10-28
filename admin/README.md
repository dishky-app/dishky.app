# Dishky Restaurant Admin (Vite + React)

Migrated from Create React App to Vite.

- `npm install`
- `npm run dev` — dev server on http://localhost:3000 (`npm start` is an alias)
- `npm run build` — production build into `dist/` (CRA used `build/`)
- `npm run preview` — serve the production build locally

## Environment variables (prefix changed `REACT_APP_` → `VITE_`)

| Old (CRA) | New (Vite) |
|---|---|
| `REACT_APP_SERVER_URL` | `VITE_SERVER_URL` (dev API origin, default http://localhost:4000) |
| `REACT_APP_MARKETING_URL` | `VITE_MARKETING_URL` |
| `REACT_APP_CUSTOMER_URL` | `VITE_CUSTOMER_URL` |

Put them in `.env` / `.env.local`. In production the app calls `/api/*`, rewritten by `vercel.json`.

JSX lives in `.js` files; `vite.config.js` tells esbuild to treat them as JSX.
`src/assets/sounds/bell.mp3` is a placeholder chime — replace it with your own sound.

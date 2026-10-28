# Dishky customer ordering app (Vite + React)

`npm install` · `npm run dev` (http://localhost:3000) · `npm run build` (→ `dist/`) · `npm run preview`.

Env vars (prefix changed from `REACT_APP_`): `VITE_SERVER_URL` (dev API origin / Socket.IO), `VITE_MARKETING_URL`.
JSX is kept in `.js` files; `vite.config.js` configures esbuild for that. Static files in `public/` are served from `/` as before.

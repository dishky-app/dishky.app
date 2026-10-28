#!/usr/bin/env node
/**
 * Generates the vercel.json for the project that serves www.dishky.com.
 *
 * One domain, two apps:
 *   www.dishky.com/pricing, /login, /account ...   -> this marketing site
 *   www.dishky.com/<restaurant>/<venue>/<table>     -> the customer ordering app
 *
 * The CUSTOMER app's Vercel project owns the domain (it has the /api proxy
 * function that keeps customer cookies first-party). Every reserved name
 * (reserved-slugs.json, mirrored from the backend's platform/slugs.js) is
 * rewritten to the marketing deployment; everything else falls through to the
 * customer app's index.html.
 *
 *   node scripts/generate-vercel-config.js \
 *        --marketing https://dishky-site.vercel.app \
 *        --base scripts/customer-base.vercel.json \
 *        --out  ../user-panel/vercel.json
 *
 * Re-run whenever the reserved list changes (a restaurant can never claim a
 * reserved name, so a name that is reserved here is always safe to route away).
 */
const fs = require("fs");
const path = require("path");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const marketing = (arg("marketing", process.env.MARKETING_ORIGIN) || "").replace(/\/$/, "");
if (!marketing) {
  console.error("Pass --marketing https://<marketing-deployment> (or set MARKETING_ORIGIN).");
  process.exit(1);
}

const { reserved } = JSON.parse(fs.readFileSync(path.join(__dirname, "reserved-slugs.json"), "utf8"));

// Paths the CUSTOMER app itself serves, even though the names are reserved.
const CUSTOMER_OWNED = new Set(["api", "static", "socket.io", "manifest.json", "favicon.ico", "health"]);
// Paths the marketing build serves that are not page routes.
const MARKETING_FILES = ["assets", "brand"];
const MARKETING_ROOT_FILES = ["robots.txt", "sitemap.xml"];

const slugs = reserved.filter((s) => !CUSTOMER_OWNED.has(s) && !s.includes(".") && /^[a-z0-9-]+$/.test(s));

const rewrites = [
  { source: "/api/:path*", destination: "/api/index" },
  { source: "/", destination: `${marketing}/` },
  ...slugs.flatMap((s) => [
    { source: `/${s}`, destination: `${marketing}/${s}` },
    { source: `/${s}/:path*`, destination: `${marketing}/${s}/:path*` },
  ]),
  ...MARKETING_FILES.map((s) => ({ source: `/${s}/:path*`, destination: `${marketing}/${s}/:path*` })),
  ...MARKETING_ROOT_FILES.map((f) => ({ source: `/${f}`, destination: `${marketing}/${f}` })),
  // Everything else is a restaurant: /<restaurant>[/<venue>[/<table>]]
  { source: "/((?!api/|static/).*)", destination: "/index.html" },
];

const baseFile = arg("base");
const base = baseFile && fs.existsSync(baseFile) ? JSON.parse(fs.readFileSync(baseFile, "utf8")) : {};

// Keep the base file's security headers, but apply its (strict) CSP only to
// customer-app paths: the marketing pages load fonts/checkout scripts it would block.
const marketingPrefix = [...slugs, "assets", "brand"].join("|");
const customerSource = `/((?!(?:${marketingPrefix})(?:/|$)).+)`;
const baseHeaders = (base.headers || []).flatMap((h) =>
  h.source === "/(.*)"
    ? [
        {
          source: "/(.*)",
          headers: h.headers.filter((x) => x.key !== "Content-Security-Policy"),
        },
        {
          source: customerSource,
          headers: h.headers.filter((x) => x.key === "Content-Security-Policy"),
        },
      ]
    : [h]
);

const out = { ...base, rewrites, headers: baseHeaders };
const target = arg("out", path.join(__dirname, "..", "generated", "vercel.customer.json"));
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${target} (${rewrites.length} rewrites, ${slugs.length} reserved names routed to ${marketing})`);

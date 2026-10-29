// Vercel serverless catch-all proxy for /api/*.
//
// A plain vercel.json "rewrites" entry proxies the request body/response
// fine, but Vercel's static-rewrite layer silently drops any Set-Cookie
// header coming back from the destination — so the customer session
// cookie (dishkyid) issued by the Render backend never actually
// reaches the browser, even though every other part of the response
// looks correct. This function replaces that rewrite: it's a real
// request handler, so it has full control over headers and can forward
// Set-Cookie (and everything else) through untouched, while still being
// same-origin from the browser's point of view — which is the whole
// reason this proxy exists in the first place (avoids Chrome/Safari
// third-party cookie blocking on the cross-site Render domain).
//
// Requires BACKEND_ORIGIN to be set in Vercel's Environment Variables
// (Settings → Environment Variables), e.g.:
//   BACKEND_ORIGIN=https://api.dishky.com
// This is a plain (non REACT_APP_) var since it's only read server-side
// by this function, never bundled into the browser JS.

const BACKEND_ORIGIN = (process.env.BACKEND_ORIGIN || "").replace(/\/$/, "");

// Hop-by-hop headers must never be forwarded (per RFC 7230 §6.1) — Vercel's
// own runtime sets host/connection-level headers for us either way.
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length", // recalculated by the runtime for the outgoing response
  // fetch() transparently gunzips/inflates the response body for us before
  // we ever see it (arrayBuffer() always returns decoded bytes) — but the
  // origin's own content-encoding header describes the *original* wire
  // format, not what we're actually sending. Forwarding it verbatim tells
  // the browser "this body is still gzipped" when it's plain JSON, so the
  // browser's own decompression then fails on already-decoded bytes
  // (net::ERR_CONTENT_DECODING_FAILED). Since we always forward decoded
  // bytes, this header must never be forwarded on the response side.
  "content-encoding",
]);

// Also stripped specifically from the OUTGOING request to the backend
// (not response headers, hence separate from HOP_BY_HOP): forwarding the
// browser's original accept-encoding (e.g. "gzip, deflate, br") lets the
// backend choose to compress its response, which fetch() then decodes
// for us — an unnecessary round trip, and if fetch's auto-decoding ever
// doesn't kick in for some response shape, it reintroduces the exact
// content-encoding mismatch this proxy exists to avoid. Omitting the
// header lets fetch() negotiate (or skip) encoding on its own terms,
// which we already correctly account for on the way back out.
const REQUEST_ONLY_STRIP = new Set(["accept-encoding"]);

export default async (req, res) => {
  // Temporary debug escape hatch: hit /api/__debug or /api/__debug/nested
  // directly in the browser to see exactly what Vercel's runtime provides
  // as req.url for this function at different path depths, without
  // guessing. Remove once the /api-stripping behavior is confirmed correct.
  if (req.url.startsWith("/api/__debug") || req.url.startsWith("/__debug")) {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ rawUrl: req.url, method: req.method, segments: req.url.split("?")[0].split("/").filter(Boolean) }, null, 2));
    return;
  }

  if (!BACKEND_ORIGIN) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "BACKEND_ORIGIN is not configured on the server" }));
    return;
  }

  // req.url is the full incoming path as Vercel's Node runtime received it,
  // e.g. "/api/orders?venueId=..." — it does NOT get the "/api" prefix
  // stripped automatically. Strip it explicitly here so the backend
  // receives the bare resource path it actually expects (e.g. "/orders"),
  // matching what a plain vercel.json rewrite would have produced.
  const strippedUrl = req.url.replace(/^\/api(?=\/|$|\?)/, "") || "/";
  const targetUrl = `${BACKEND_ORIGIN}${strippedUrl}`;

  const outgoingHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower) || REQUEST_ONLY_STRIP.has(lower)) continue;
    outgoingHeaders[key] = value;
  }

  let body;
  if (!["GET", "HEAD"].includes(req.method)) {
    // Vercel's Node runtime doesn't pre-parse the body for a raw function
    // handler, so collect the stream ourselves and forward it as-is —
    // this keeps JSON, form-data, and any other content-type intact
    // without needing to know or re-serialize the shape of the payload.
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }

  let backendRes;
  try {
    backendRes = await fetch(targetUrl, {
      method: req.method,
      headers: outgoingHeaders,
      body,
      redirect: "manual", // let the browser handle backend redirects itself
    });
  } catch (err) {
    res.statusCode = 502;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Upstream backend unreachable", detail: err.message }));
    return;
  }

  res.statusCode = backendRes.status;

  // getSetCookie() preserves each cookie as its own header — critical,
  // since multiple Set-Cookie values collapsed into one string (which a
  // naive res.setHeader(name, value) loop would do) breaks browser cookie
  // parsing when the backend sets more than one cookie in a response.
  for (const [key, value] of backendRes.headers.entries()) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    if (key.toLowerCase() === "set-cookie") continue; // handled separately below
    res.setHeader(key, value);
  }
  const setCookieValues =
    typeof backendRes.headers.getSetCookie === "function"
      ? backendRes.headers.getSetCookie()
      : backendRes.headers.get("set-cookie")
        ? [backendRes.headers.get("set-cookie")]
        : [];
  if (setCookieValues.length) res.setHeader("set-cookie", setCookieValues);

  const responseBody = Buffer.from(await backendRes.arrayBuffer());
  res.end(responseBody);
};

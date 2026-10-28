// Boots the real Express app against the local test database and gives tests a tiny cookie-aware HTTP client.
process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017";
process.env.BILLING_PROVIDER = "mock";
process.env.SIGNUP_RATE_LIMIT_MAX = "1000";
process.env.OWNER_AUTH_RATE_LIMIT_MAX = "1000";
process.env.ALLOWED_ORIGINS = "http://localhost:3000";
process.env.SETTINGS_ENCRYPTION_KEY = "test-key-test-key-test-key-test-key";
process.env.PUBLIC_SITE_URL = "http://site.test";
process.env.ADMIN_APP_URL = "http://admin.test";
const mongoose = require("mongoose");
const http = require("http");

async function boot() {
  const dbName = `dishky_e2e_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const mod = require("../server");
  await mongoose.connect(process.env.MONGO_URI, { dbName });
  await require("../src/modules/platform").ensureDefaultPlans();
  await new Promise((r) => mod.httpServer.listen(0, "127.0.0.1", r));
  const port = mod.httpServer.address().port;
  return {
    mod, port, dbName,
    async close() {
      await new Promise((r) => mod.httpServer.close(r));
      mod.io.close();
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    },
  };
}

function client(port, defaults = {}) {
  const jar = {};
  async function call(method, path, body, headers = {}) {
    const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...(cookie ? { Cookie: cookie } : {}),
        ...defaults,
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    for (const sc of res.headers.getSetCookie ? res.headers.getSetCookie() : []) {
      const [pair] = sc.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i), v = pair.slice(i + 1);
      if (/expires=Thu, 01 Jan 1970/i.test(sc) || v === "") delete jar[k]; else jar[k] = v;
    }
    let data = null;
    const text = await res.text();
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  }
  return {
    get: (p, h) => call("GET", p, undefined, h),
    post: (p, b, h) => call("POST", p, b ?? {}, h),
    put: (p, b, h) => call("PUT", p, b ?? {}, h),
    patch: (p, b, h) => call("PATCH", p, b ?? {}, h),
    del: (p, h) => call("DELETE", p, undefined, h),
    jar,
  };
}

module.exports = { boot, client };

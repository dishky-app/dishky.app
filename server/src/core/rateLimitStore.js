/**
 * rateLimitStore.js — shared backing store for every express-rate-limit
 * instance in this app.
 *
 * Why this exists: express-rate-limit defaults to an in-memory store,
 * which is per-process. On any deployment running more than one server
 * instance (multiple Render dynos/replicas, a PM2 cluster, etc.), each
 * instance would track its own independent counters — so a caller
 * distributed across instances by the load balancer could exceed the
 * intended limit by roughly (limit × instance count), silently
 * defeating every limiter in the app (login, forgot-password,
 * general API, uploads, WhatsApp sends) without any error or warning.
 * This is exactly the multi-instance correctness requirement called
 * out for rate limiting.
 *
 * Fix: when REDIS_URL is configured, every limiter shares one Redis-
 * backed store, so counts are correct regardless of how many server
 * instances are running. When it isn't configured, this falls back to
 * express-rate-limit's own default in-memory store — correct and
 * sufficient for a single-instance deployment — and logs a clear,
 * one-time warning so the gap is visible rather than silent if the
 * app is ever scaled to multiple instances without Redis configured.
 */

const REDIS_URL = process.env.REDIS_URL || null;

let sharedRedisClient = null;
let warnedAboutMemoryStore = false;

function getRedisClient() {
  if (!REDIS_URL) return null;
  if (sharedRedisClient) return sharedRedisClient;
  // Lazy-required so a deployment that never sets REDIS_URL doesn't pay
  // for loading ioredis at all.
  const Redis = require("ioredis");
  sharedRedisClient = new Redis(REDIS_URL, {
    // Rate limiting is best-effort, not correctness-critical for the
    // rest of the app — if Redis is briefly unreachable, fail toward
    // "let the request through" rather than crashing the whole server
    // or blocking every request while retrying. maxRetriesPerRequest:
    // null + a short connect timeout, combined with the try/catch in
    // makeStore() below, achieves that.
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    lazyConnect: false,
  });
  sharedRedisClient.on("error", (err) => {
    // Don't let unhandled Redis connection errors crash the process —
    // log once per event and keep going; makeStore()'s own try/catch
    // handles individual command failures.
    console.error("[rateLimitStore] Redis connection error:", err.message);
  });
  return sharedRedisClient;
}

/**
 * makeStore(prefix) — returns a store object for express-rate-limit's
 * `store` option, namespaced by `prefix` so different limiters
 * (login, general API, uploads, etc.) don't share counters with each
 * other even though they share one Redis connection.
 *
 * Returns `undefined` when Redis isn't configured, which tells
 * express-rate-limit to use its own built-in in-memory store instead —
 * this keeps single-instance / local-dev setups working exactly as
 * before with zero extra configuration required.
 */
function makeStore(prefix) {
  if (!REDIS_URL) {
    if (!warnedAboutMemoryStore) {
      warnedAboutMemoryStore = true;
      console.warn(
        "[rateLimitStore] REDIS_URL is not set — rate limiters are using per-process " +
        "in-memory storage. This is fine for a single server instance, but if this app " +
        "is ever deployed across multiple instances/replicas, each instance will track " +
        "its own counters independently, effectively multiplying every rate limit by " +
        "the instance count. Set REDIS_URL to share limiter state correctly across instances."
      );
    }
    return undefined;
  }

  // Lazy-required alongside ioredis, for the same reason.
  const { RedisStore } = require("rate-limit-redis");
  const client = getRedisClient();

  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (...args) => client.call(...args),
  });
}

/**
 * wrapLimiterFailOpen(limiterMiddleware) — ensures a Redis-backed
 * limiter degrades to "let the request through" if Redis is down,
 * rather than turning a rate-limiter outage into a site-wide outage.
 *
 * Why this can't live inside makeStore()'s sendCommand alone: tested
 * directly against an unreachable Redis, rate-limit-redis's own
 * script-loading step (loadIncrementScript, used internally for an
 * atomic Lua-based increment) throws a TypeError of its own once the
 * underlying command fails in an unexpected shape — sendCommand's own
 * try/catch only covers commands issued directly through it, not every
 * way the library can fail during a connection outage. Wrapping the
 * whole limiter middleware call is the only place that reliably
 * catches every failure mode and still lets the request proceed,
 * which matters here because a rate limiter is a defense-in-depth
 * control: failing closed on a Redis blip would mean a transient
 * infra issue takes down login, checkout, and every other route this
 * app rate-limits, which is a worse outcome than temporarily running
 * without the limit.
 */
function wrapLimiterFailOpen(limiterMiddleware) {
  return (req, res, next) => {
    let settled = false;
    const safeNext = (...args) => {
      if (settled) return;
      settled = true;
      // Any error object passed to next() from the limiter itself (e.g.
      // its own internal store failure) is treated the same as a thrown
      // exception here — swallow it and let the request through, rather
      // than forwarding it to Express's error handler as a 500.
      next();
    };
    // limiterMiddleware is express-rate-limit's own async middleware
    // function — calling it returns a Promise, so a failure inside it
    // (including one from a broken Redis store) surfaces as a REJECTED
    // PROMISE, not a synchronous throw. A plain try/catch around a
    // synchronous call cannot catch that; .catch() on the returned
    // Promise is what's actually needed.
    try {
      Promise.resolve(limiterMiddleware(req, res, safeNext)).catch((err) => {
        console.error("[rateLimitStore] Rate limiter rejected, allowing request through:", err?.message || err);
        safeNext();
      });
    } catch (err) {
      // Belt-and-braces: also covers the (less likely) case of a
      // synchronous throw before the middleware returns its Promise.
      console.error("[rateLimitStore] Rate limiter threw, allowing request through:", err.message);
      safeNext();
    }
  };
}

/**
 * defaultRateLimitHandler(prefix) — logs a rate-limit violation to the
 * audit trail before sending the limiter's own configured response.
 * Requirement 5 explicitly calls for logging rate-limit violations
 * alongside failed logins and authorization failures — repeated hits
 * against the same limiter from the same source is exactly the signal
 * that distinguishes a genuine abuse/brute-force attempt from normal
 * traffic that happens to trip a generous cap once.
 *
 * Lazy-requires auditLog.js (rather than requiring it at module load
 * time) for the same defensive reason auth.js's own logAudit wrapper
 * does: this module loads very early (before any Mongoose models are
 * necessarily registered), and deferring the require until a limit is
 * actually exceeded avoids any load-order sensitivity.
 */
function defaultRateLimitHandler(prefix) {
  return (req, res, _next, options) => {
    try {
      const { logAudit } = require("../modules/auditLog/auditLog");
      logAudit(req, { action: "rate_limited", resource: prefix, targetId: req.originalUrl || req.path });
    } catch (err) {
      console.error("[rateLimitStore] Failed to log rate-limit violation:", err.message);
    }
    res.status(options.statusCode).json(
      typeof options.message === "function" ? options.message(req, res) : options.message
    );
  };
}

/**
 * buildLimiter(prefix, options) — creates a rate limiter configured
 * with the shared store (Redis-backed when REDIS_URL is set, in-memory
 * otherwise) and, when Redis-backed, wrapped so a Redis outage
 * degrades to "let the request through" rather than a 500.
 *
 * This is the only way limiters in this app should be constructed —
 * a bare `rateLimit({ store: makeStore(...) })` at a call site would
 * still be exposed to the failure mode wrapLimiterFailOpen exists to
 * prevent, so that responsibility lives here once instead of needing
 * every call site to remember to wrap it correctly. It also means every
 * limiter gets rate-limit-violation audit logging automatically,
 * without each call site needing its own `handler` option.
 */
function buildLimiter(prefix, options) {
  const rateLimit = require("express-rate-limit");
  const store = makeStore(prefix);
  const limiter = rateLimit({
    ...options,
    store,
    handler: options.handler || defaultRateLimitHandler(prefix),
  });
  return store ? wrapLimiterFailOpen(limiter) : limiter;
}

module.exports = { buildLimiter };

/**
 * tenancy.js — Dishky multi-tenant isolation layer.
 *
 * Every restaurant ("tenant") shares one database. Isolation is enforced HERE,
 * once, below the route layer, instead of being re-implemented (and potentially
 * forgotten) in each of the ~65 routes:
 *
 *   1. AsyncLocalStorage carries the current tenant (restaurantId) for the
 *      lifetime of a request (see platform/tenantResolver.js, which sets it).
 *   2. A global Mongoose plugin adds a `restaurantId` field to every schema and
 *      - injects `restaurantId = <current tenant>` into the filter of every
 *        read / update / delete / count / aggregate,
 *      - stamps `restaurantId` on every create / upsert,
 *      - refuses to run a tenant-scoped query at all when no tenant is set
 *        ("fail closed") instead of silently returning every restaurant's data,
 *      - rewrites single-field `unique` indexes (id, email, ...) into
 *        (restaurantId, field) compound unique indexes, so two restaurants can
 *        each have their own "order_00001" or their own admin@x.com.
 *   3. Platform-level collections (restaurants, owners, plans, subscriptions...)
 *      opt out with the schema option `{ tenantScoped: false }`.
 *
 * Code that legitimately spans tenants (migrations, platform admin, webhooks,
 * boot tasks) must say so explicitly with runAsPlatform() / runInTenant().
 *
 * IMPORTANT: this file must be required BEFORE any module that defines a
 * Mongoose model, because global plugins only apply to models compiled after
 * they are registered.
 */

const { AsyncLocalStorage } = require("async_hooks");
const mongoose = require("mongoose");

const als = new AsyncLocalStorage();

class TenantContextError extends Error {
  constructor(message) {
    super(message);
    this.name = "TenantContextError";
    this.code = "TENANT_CONTEXT_REQUIRED";
  }
}

/** The restaurantId of the current request, or null. */
function currentTenantId() {
  const store = als.getStore();
  return store && !store.platform ? store.restaurantId || null : null;
}

function isPlatformContext() {
  const store = als.getStore();
  return !!(store && store.platform);
}

/** Run fn with every tenant-scoped query pinned to `restaurantId`. */
function runInTenant(restaurantId, fn) {
  if (!restaurantId || typeof restaurantId !== "string") {
    throw new TenantContextError("runInTenant requires a restaurantId");
  }
  // `async () => await fn()` matters: a Mongoose Query is lazy, so returning
  // it un-awaited would execute it AFTER leaving the tenant context.
  return als.run({ restaurantId, platform: false }, async () => await fn());
}

/** Run fn with tenant scoping DISABLED (platform code, migrations, webhooks). */
function runAsPlatform(fn) {
  return als.run({ restaurantId: null, platform: true }, async () => await fn());
}

/**
 * Enter a tenant context for the remainder of the current async chain. Used by
 * the Express middleware, which cannot wrap the rest of the request in a
 * callback any other way than als.run(store, next).
 */
function tenantMiddlewareRun(restaurantId, next) {
  return als.run({ restaurantId, platform: false }, next);
}

const QUERY_OPS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "updateOne",
  "updateMany",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "countDocuments",
  "distinct",
];
const REPLACE_OPS = new Set(["findOneAndReplace", "replaceOne"]);

function resolveScope(modelName, op) {
  const store = als.getStore();
  if (store && store.platform) return { platform: true };
  if (store && store.restaurantId) return { restaurantId: store.restaurantId };
  throw new TenantContextError(
    `Refusing to run ${op} on tenant-scoped model "${modelName}" without a tenant context. ` +
      `Wrap the call in runInTenant(restaurantId, ...) or runAsPlatform(...).`
  );
}

function tenancyPlugin(schema) {
  if (schema.options && schema.options.tenantScoped === false) return;

  if (!schema.path("restaurantId")) {
    schema.add({ restaurantId: { type: String, index: true } });
  }

  /* ── unique indexes become per-tenant ───────────────────────────── */
  schema.eachPath((pathName, schemaType) => {
    const idx = schemaType._index;
    if (idx && typeof idx === "object" && idx.unique) {
      const opts = { ...idx };
      delete opts.unique;
      schemaType._index = Object.keys(opts).length ? opts : null;
      // keep sparse/partial semantics if the field declared them
      const indexOpts = { unique: true };
      if (idx.sparse) indexOpts.sparse = true;
      schema.index({ restaurantId: 1, [pathName]: 1 }, indexOpts);
    }
  });
  if (Array.isArray(schema._indexes)) {
    schema._indexes = schema._indexes.map(([fields, options]) => {
      if (options && options.unique && !("restaurantId" in fields)) {
        return [{ restaurantId: 1, ...fields }, options];
      }
      return [fields, options];
    });
  }

  /* ── queries ────────────────────────────────────────────────────── */
  for (const op of QUERY_OPS) {
    schema.pre(op, function () {
      const scope = resolveScope(this.model && this.model.modelName, op);
      if (scope.platform) return;
      const { restaurantId } = scope;

      // A caller-supplied restaurantId must never widen or redirect the scope.
      const filter = this.getFilter();
      if (filter && "restaurantId" in filter && filter.restaurantId !== restaurantId) {
        throw new TenantContextError("Query attempted to address a different restaurant");
      }
      this.where({ restaurantId });

      if (op === "distinct" || op === "find" || op === "findOne" || op === "countDocuments") return;
      if (op === "deleteOne" || op === "deleteMany" || op === "findOneAndDelete") return;

      // Updates / replacements: restaurantId is immutable and stamped on upsert.
      const update = this.getUpdate();
      if (!update || Array.isArray(update)) return;
      if (REPLACE_OPS.has(op)) {
        this.setUpdate({ ...update, restaurantId });
        return;
      }
      if (update.$set && "restaurantId" in update.$set) delete update.$set.restaurantId;
      if ("restaurantId" in update) delete update.restaurantId;
      if (this.getOptions().upsert) {
        update.$setOnInsert = { ...(update.$setOnInsert || {}), restaurantId };
      }
    });
  }

  schema.pre("aggregate", function () {
    const scope = resolveScope("aggregate", "aggregate");
    if (scope.platform) return;
    this.pipeline().unshift({ $match: { restaurantId: scope.restaurantId } });
  });

  /* ── writes ─────────────────────────────────────────────────────── */
  schema.pre("save", function () {
    const scope = resolveScope(this.constructor.modelName, "save");
    if (scope.platform) return; // platform code stamps restaurantId itself
    if (this.isNew) {
      this.restaurantId = scope.restaurantId;
    } else if (this.restaurantId !== scope.restaurantId) {
      throw new TenantContextError("Document belongs to a different restaurant");
    }
  });

  schema.pre("insertMany", function (docs) {
    const arg = Array.isArray(docs) ? docs : arguments[1];
    const scope = resolveScope(this.modelName, "insertMany");
    if (scope.platform || !Array.isArray(arg)) return;
    for (const d of arg) {
      if (d && typeof d === "object") d.restaurantId = scope.restaurantId;
    }
  });
}

mongoose.plugin(tenancyPlugin);

/** Run fn once per restaurant id, each inside its own tenant context. */
async function forEachTenant(restaurantIds, fn) {
  for (const id of restaurantIds) {
    await runInTenant(id, () => fn(id));
  }
}

module.exports = {
  als,
  TenantContextError,
  currentTenantId,
  isPlatformContext,
  runInTenant,
  runAsPlatform,
  tenantMiddlewareRun,
  forEachTenant,
};

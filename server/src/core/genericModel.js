/**
 * genericModel.js — schemaless Mongoose models for the many simple
 * "collection of JSON documents" resources (categories, orders, staff...).
 * Extracted from server.js so provisioning/migration code can use the same
 * model instances (Mongoose forbids compiling a model name twice).
 *
 * Tenant isolation is NOT done here — it comes from the global plugin in
 * tenancy.js, which is applied to every schema compiled below.
 */
const mongoose = require("mongoose");

const anySchema = new mongoose.Schema(
  {},
  { strict: false, timestamps: false, versionKey: false, id: false }
);

const modelCache = {};
function getModel(collectionName) {
  if (modelCache[collectionName]) return modelCache[collectionName];
  const model = mongoose.models[collectionName] || mongoose.model(collectionName, anySchema, collectionName);
  modelCache[collectionName] = model;
  // Every query is scoped by restaurantId (tenancy.js) and almost all by
  // venueId, and single-doc lookups use the app-level `id` field.
  model.collection.createIndex({ restaurantId: 1, venueId: 1 }).catch(() => { });
  model.collection.createIndex({ restaurantId: 1, id: 1 }).catch(() => { });
  if (collectionName === "orders") {
    model.collection.createIndex({ restaurantId: 1, venueId: 1, createdAt: -1 }).catch(() => { });
  }
  return model;
}

module.exports = { getModel };

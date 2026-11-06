#!/usr/bin/env node
/**
 * ensure-encryption-key.js — adds SETTINGS_ENCRYPTION_KEY to server/.env when it is missing or empty.
 *
 *   cd server && node scripts/ensure-encryption-key.js
 *
 * The key encrypts supplier bank account numbers and each restaurant's payment-gateway secrets.
 * Keep it stable: changing it later makes values saved with the old key unreadable.
 * Restart the server afterwards (nodemon restarts by itself when .env changes only if configured to).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const file = path.join(__dirname, "..", ".env");
let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
const m = text.match(/^\s*SETTINGS_ENCRYPTION_KEY\s*=\s*(.*)$/m);
if (m && m[1].trim().replace(/^["']|["']$/g, "")) {
  console.log("SETTINGS_ENCRYPTION_KEY is already set in server/.env — nothing to do.");
  process.exit(0);
}
const key = crypto.randomBytes(36).toString("base64");
if (m) text = text.replace(/^\s*SETTINGS_ENCRYPTION_KEY\s*=.*$/m, `SETTINGS_ENCRYPTION_KEY=${key}`);
else text += `${text && !text.endsWith("\n") ? "\n" : ""}SETTINGS_ENCRYPTION_KEY=${key}\n`;
fs.writeFileSync(file, text);
console.log("Added SETTINGS_ENCRYPTION_KEY to server/.env.");
console.log("Restart the API (stop it and run `npm run dev` again) so it picks the key up.");
console.log("Back this key up somewhere safe; if it changes, saved bank account numbers can no longer be read.");

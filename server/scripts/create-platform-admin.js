#!/usr/bin/env node
/**
 * Creates (or resets the password of) a Dishky super-admin account.
 * This is the ONLY way to get an account: the console has no sign-up page.
 *
 *   node scripts/create-platform-admin.js --email you@dishky.com --name "Your Name"
 *
 * The password is asked for on the terminal (hidden). For automation you may set
 * PLATFORM_ADMIN_PASSWORD instead. Minimum 12 characters.
 *
 *   --reset     change the password of an existing account (also unlocks it and
 *               signs it out everywhere)
 *   --disable   disable an account (cannot sign in; sessions are removed)
 *
 * Uses MONGO_URI from the environment / .env.
 */
require("dotenv").config();
require("../src/core/tenancy");
const readline = require("readline");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { PlatformAdmin, PlatformAdminSession } = require("../src/modules/platform/models");
const { MIN_PASSWORD } = require("../src/modules/platform/superadmin");

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = (n) => args.includes(`--${n}`);

function askHidden(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(prompt)) rl.output.write(s); else rl.output.write("*".repeat(Math.min(s.length, 1))); };
    rl.question(prompt, (a) => { rl.close(); process.stdout.write("\n"); resolve(a); });
  });
}

async function main() {
  const email = String(opt("email") || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Pass --email you@yourdomain.com");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set");
  await mongoose.connect(process.env.MONGO_URI);
  const existing = await PlatformAdmin.findOne({ email });

  if (flag("disable")) {
    if (!existing) throw new Error("No such account");
    existing.status = "disabled";
    await existing.save();
    await PlatformAdminSession.deleteMany({ adminId: existing.id });
    console.log(`Disabled ${email} and ended all its sessions.`);
    return;
  }

  if (existing && !flag("reset")) throw new Error(`${email} already exists. Use --reset to change its password.`);
  if (!existing && flag("reset")) throw new Error("No such account to reset.");

  let password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!password) {
    password = await askHidden("Password (min 12 characters): ");
    const again = await askHidden("Repeat password: ");
    if (password !== again) throw new Error("Passwords do not match");
  }
  if (password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);
  const hash = await bcrypt.hash(password, 12);

  if (existing) {
    existing.password = hash;
    existing.status = "active";
    existing.failedAttempts = 0;
    existing.lockUntil = null;
    await existing.save();
    await PlatformAdminSession.deleteMany({ adminId: existing.id });
    console.log(`Password reset for ${email}. All its sessions were ended.`);
  } else {
    const name = String(opt("name") || email.split("@")[0]).trim();
    await PlatformAdmin.create({ name, email, password: hash });
    console.log(`Created super admin ${email}.`);
  }
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());

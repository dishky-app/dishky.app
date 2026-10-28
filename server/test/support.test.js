// End-to-end: restaurant → Super Admin → Developer → QA → release → resolution, over real HTTP + database.
const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, client } = require("./helpers");

let ctx, sa, ownerA, ownerB, dev, qa, rel, ticketId;
const PW = "correct horse battery";
const STRONG = "Sturdy-Passw0rd-42";
const png = "data:image/png;base64," + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]).toString("base64");

async function inviteAndLogin(role, name, email) {
  const r = await sa.post("/superadmin/support/staff", { name, email, role });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const link = r.data.data.inviteLink; // SMTP not configured in tests → link is returned to the Super Admin
  assert.ok(link, "invite link returned when email is not configured");
  const token = new URL(link).searchParams.get("token");
  const c = client(ctx.port);
  const set = await c.post("/dev/auth/reset-password", { token, password: STRONG, confirmPassword: STRONG });
  assert.equal(set.status, 200, JSON.stringify(set.data));
  const login = await c.post("/dev/auth/login", { email, password: STRONG });
  assert.equal(login.status, 200, JSON.stringify(login.data));
  // the sign-in response itself must carry the full profile (the panel shows it straight after login)
  assert.equal(login.data.data.staff.name, name);
  assert.equal(login.data.data.staff.role, role);
  assert.match(login.data.data.staff.staffNo, /^DSK-\d{4}$/);
  assert.ok(Array.isArray(login.data.data.staff.permissions));
  return { c, id: r.data.data.staff.id, token };
}

test.before(async () => {
  ctx = await boot();
  const bcrypt = require("bcrypt");
  const { PlatformAdmin } = require("../src/modules/platform/models");
  await PlatformAdmin.create({ name: "Ops", email: "ops@dishky.test", password: await bcrypt.hash(PW, 4) });
  sa = client(ctx.port);
  assert.equal((await sa.post("/superadmin/auth/login", { email: "ops@dishky.test", password: PW })).status, 200);
  for (const [i, n] of [[1, "Alpha Cafe"], [2, "Beta Bistro"]]) {
    const c = client(ctx.port);
    const r = await c.post("/platform/auth/signup", { name: `Owner ${i}`, email: `owner${i}@example.com`, password: "supersecret1", restaurantName: n, planKey: "growth" });
    assert.equal(r.status, 201, JSON.stringify(r.data));
  }
  ownerA = client(ctx.port); ownerB = client(ctx.port);
  assert.equal((await ownerA.post("/staff-auth/login", { restaurant: "alpha-cafe", email: "owner1@example.com", password: "supersecret1" })).status, 200);
  assert.equal((await ownerB.post("/staff-auth/login", { restaurant: "beta-bistro", email: "owner2@example.com", password: "supersecret1" })).status, 200);
});
test.after(async () => { await ctx.close(); });

test("Dishky staff are created by invitation only and can log in after setting a password", async () => {
  const anon = client(ctx.port);
  assert.equal((await anon.post("/superadmin/support/staff", { name: "X", email: "x@x.io", role: "Developer" })).status, 401, "no public registration");
  dev = await inviteAndLogin("Developer", "Dev One", "dev1@dishky.test");
  qa = await inviteAndLogin("Tester / QA Engineer", "Tess Tester", "qa1@dishky.test");
  rel = await inviteAndLogin("DevOps / Release Manager", "Rex Release", "rel1@dishky.test");
  const dup = await sa.post("/superadmin/support/staff", { name: "Dup", email: "dev1@dishky.test", role: "Developer" });
  assert.equal(dup.status, 409);
  const me = await dev.c.get("/dev/auth/me");
  assert.equal(me.data.data.staff.role, "Developer");
  assert.ok(me.data.data.staff.permissions.includes("tickets.submitForQA"));
  assert.equal(JSON.stringify(me.data).includes("passwordHash"), false);
});

test("invite / reset tokens are single use; forgot-password is generic; login errors do not reveal accounts", async () => {
  const again = await client(ctx.port).post("/dev/auth/reset-password", { token: dev.token, password: STRONG + "x", confirmPassword: STRONG + "x" });
  assert.equal(again.status, 400);
  const a = await client(ctx.port).post("/dev/auth/forgot-password", { email: "dev1@dishky.test" });
  const b = await client(ctx.port).post("/dev/auth/forgot-password", { email: "nobody@dishky.test" });
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.equal(a.data.data.message, b.data.data.message);
  const w1 = await client(ctx.port).post("/dev/auth/login", { email: "dev1@dishky.test", password: "wrong-wrong-1234" });
  const w2 = await client(ctx.port).post("/dev/auth/login", { email: "ghost@dishky.test", password: "wrong-wrong-1234" });
  assert.equal(w1.status, 401); assert.equal(w1.data.message, w2.data.message);
  // reset flow end to end using the stored (hashed) token created by forgot-password
  const { DevReset, DishkyStaff } = require("../src/modules/support/models");
  const crypto = require("crypto");
  const staff = await DishkyStaff.findOne({ email: "dev1@dishky.test" }).lean();
  const row = await DevReset.findOne({ staffId: staff.id, usedAt: null }).lean();
  assert.ok(row && row.tokenHash.length === 64, "only a hash is stored");
  const raw = crypto.randomBytes(32).toString("hex");
  await DevReset.updateOne({ tokenHash: row.tokenHash }, { $set: { tokenHash: crypto.createHash("sha256").update(raw).digest("hex") } });
  const weak = await client(ctx.port).post("/dev/auth/reset-password", { token: raw, password: "short1", confirmPassword: "short1" });
  assert.equal(weak.status, 400);
  const mismatch = await client(ctx.port).post("/dev/auth/reset-password", { token: raw, password: STRONG + "y", confirmPassword: STRONG + "z" });
  assert.equal(mismatch.status, 400);
  const NEW = "Another-Passw0rd-77";
  const good = await client(ctx.port).post("/dev/auth/reset-password", { token: raw, password: NEW, confirmPassword: NEW });
  assert.equal(good.status, 200);
  assert.equal((await dev.c.get("/dev/auth/me")).status, 401, "old sessions are revoked after a reset");
  assert.equal((await dev.c.post("/dev/auth/login", { email: "dev1@dishky.test", password: NEW })).status, 200);
  assert.equal((await client(ctx.port).post("/dev/auth/reset-password", { token: raw, password: NEW + "!", confirmPassword: NEW + "!" })).status, 400, "token cannot be reused");
});

test("restaurant creates a ticket; another restaurant cannot see it; reporter view hides internals", async () => {
  const meta = await ownerA.get("/support/meta");
  assert.equal(meta.status, 200, JSON.stringify(meta.data));
  assert.ok(meta.data.modules.includes("Orders"));
  const bad = await ownerA.post("/support/tickets", { title: "x", description: "short" });
  assert.equal(bad.status, 400);
  const secretFile = { name: "log.txt", dataUrl: "data:text/plain;base64," + Buffer.from("password=hunter22222 token").toString("base64") };
  assert.equal((await ownerA.post("/support/tickets", { title: "Orders crash", description: "App crashes on order", category: "bug", module: "Orders", attachments: [secretFile] })).status, 400, "credentials in diagnostics are rejected");
  assert.equal((await ownerA.post("/support/tickets", { title: "Orders crash", description: "App crashes on order", category: "bug", module: "Orders", attachments: [{ name: "x.png", dataUrl: "data:image/png;base64," + Buffer.from("not a png at all").toString("base64") }] })).status, 400, "signature mismatch rejected");
  const r = await ownerA.post("/support/tickets", {
    title: "Orders crash on save", description: "App crashes when saving an order", category: "bug", module: "Orders",
    steps: "1. open 2. save", suggestedPriority: "high", restaurantId: "someone-else", status: "resolved",
    attachments: [{ name: "shot.png", dataUrl: png }],
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  ticketId = r.data.ticketId;
  assert.match(ticketId, /^TKT-\d{6}$/);
  const stored = await require("../src/modules/support/models").Ticket.findOne({ ticketId }).lean();
  assert.equal(stored.status, "new", "client-supplied status ignored");
  assert.notEqual(stored.restaurantId, "someone-else", "client-supplied tenant ignored");
  assert.equal(stored.attachments.length, 1);
  assert.equal((await ownerA.get("/support/tickets")).data.total, 1);
  assert.equal((await ownerB.get("/support/tickets")).data.total, 0);
  assert.equal((await ownerB.get(`/support/tickets/${ticketId}`)).status, 404);
  assert.equal((await ownerB.post(`/support/tickets/${ticketId}/comments`, { body: "hi" })).status, 404);
  assert.equal((await ownerB.get(`/support/tickets/${ticketId}/attachments/${stored.attachments[0].id}`)).status, 404);
  const detail = await ownerA.get(`/support/tickets/${ticketId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.data.ticket.statusLabel, "Received");
  assert.equal(JSON.stringify(detail.data).includes("developer"), false);
  assert.equal((await ownerA.get(`/support/tickets/${ticketId}/attachments/${stored.attachments[0].id}`)).status, 200);
  // a reporter cannot drive staff transitions
  assert.equal((await ownerA.post(`/support/tickets/${ticketId}/action`, { action: "triage", priority: "low", severity: "minor" })).status, 400);
  assert.equal((await ownerA.post(`/support/tickets/${ticketId}/action`, { action: "reporter_confirm" })).status, 409);
});

test("Super Admin sees the ticket, triages and assigns with a deadline; developer sees only assigned work", async () => {
  const dash = await sa.get("/superadmin/support/dashboard");
  assert.equal(dash.data.data.counts.new, 1);
  assert.equal(dash.data.data.counts.unassigned, 1);
  assert.equal((await dev.c.get("/dev/tickets")).data.data.total, 0, "developer has no access before assignment");
  assert.equal((await dev.c.get(`/dev/tickets/${ticketId}`)).status, 404);
  const act = (c, base, action, body = {}) => c.post(`${base}/tickets/${ticketId}/action`, { action, ...body });
  assert.equal((await act(sa, "/superadmin/support", "assign", { developerId: dev.id, deadline: new Date(Date.now() + 86400000).toISOString() })).status, 409, "cannot assign before triage");
  assert.equal((await act(sa, "/superadmin/support", "triage", { priority: "high", severity: "major" })).status, 200);
  const past = await act(sa, "/superadmin/support", "assign", { developerId: dev.id, deadline: "2020-01-01" });
  assert.equal(past.status, 400);
  const wrongRole = await act(sa, "/superadmin/support", "assign", { developerId: qa.id, deadline: new Date(Date.now() + 86400000).toISOString() });
  assert.equal(wrongRole.status, 400, "a tester cannot be assigned as developer");
  const asg = await act(sa, "/superadmin/support", "assign", { developerId: dev.id, testerId: qa.id, deadline: new Date(Date.now() + 86400000).toISOString() });
  assert.equal(asg.status, 200, JSON.stringify(asg.data));
  assert.equal(asg.data.data.ticket.status, "assigned");
  const list = await sa.get("/superadmin/support/staff/assignable?kind=developer");
  assert.equal(list.data.data.find((s) => s.id === dev.id).activeWorkload, 1);
  assert.equal((await dev.c.get("/dev/tickets")).data.data.total, 1);
  const n = await dev.c.get("/dev/notifications");
  assert.ok(n.data.data.rows.some((x) => x.kind === "assigned"));
  const dd = await dev.c.get("/dev/dashboard");
  assert.equal(dd.data.data.counts.newAssignments, 1);
});

test("developer works the ticket but cannot bypass QA, review, release or resolution", async () => {
  const D = (a, b = {}) => dev.c.post(`/dev/tickets/${ticketId}/action`, { action: a, ...b });
  assert.equal((await D("acknowledge")).status, 200);
  assert.equal((await D("start")).status, 200);
  assert.equal((await D("progress", { progressPct: 50, investigationNotes: "Looks like a null deref" })).status, 200);
  assert.equal((await D("submit_for_qa", { rootCause: "x" })).status, 400, "evidence required");
  for (const a of ["qa_start", "qa_pass", "fix_approve", "release_approve", "record_push", "resolve", "close", "triage", "assign"]) {
    const r = await D(a, { summary: "fine fine", reason: "fine fine" });
    assert.ok([403, 409].includes(r.status), `${a} -> ${r.status}`);
  }
  assert.equal((await D("submit_for_qa", { rootCause: "null deref in save()", fixSummary: "added guard", testEvidence: "unit test + manual run" })).status, 200);
  assert.equal((await dev.c.post(`/dev/tickets/${ticketId}/comments`, { visibility: "internal", body: "secret technical note" })).status, 201);
  assert.equal((await dev.c.post(`/dev/tickets/${ticketId}/comments`, { visibility: "public", body: "We are testing a fix" })).status, 201);
});

test("QA rejection returns to developer; second submission passes QA", async () => {
  const Q = (a, b = {}) => qa.c.post(`/dev/tickets/${ticketId}/action`, { action: a, ...b });
  assert.equal((await Q("qa_start")).status, 200);
  assert.equal((await Q("qa_fail", { summary: "still crashes" })).status, 400, "evidence required");
  const f = await Q("qa_fail", { summary: "still crashes with 2 items", evidence: "video-123" });
  assert.equal(f.status, 200);
  assert.equal(f.data.data.ticket.status, "qa_failed");
  const D = (a, b = {}) => dev.c.post(`/dev/tickets/${ticketId}/action`, { action: a, ...b });
  assert.ok((await dev.c.get("/dev/notifications")).data.data.rows.some((x) => /QA failed/.test(x.message)));
  assert.equal((await D("start")).status, 200);
  assert.equal((await D("submit_for_qa", { fixSummary: "handle multiple items too" })).status, 200);
  assert.equal((await Q("qa_start")).status, 200);
  assert.equal((await Q("qa_pass", { summary: "verified with 1 and 2 items" })).status, 200);
  const t = await sa.get(`/superadmin/support/tickets/${ticketId}`);
  assert.equal(t.data.data.ticket.status, "awaiting_release_approval");
  assert.equal(t.data.data.qaReports.length, 2);
});

test("review → release approval → push → deployment are distinct; failed deployment is not a release", async () => {
  const R = (a, b = {}) => rel.c.post(`/dev/tickets/${ticketId}/action`, { action: a, ...b });
  // Release Manager role in this test has fix.review + release.approve + deploy.record, but order is enforced.
  assert.equal((await R("release_approve")).status, 409, "needs code review first");
  assert.equal((await R("fix_approve", { note: "LGTM" })).status, 200);
  assert.equal((await R("release_approve")).status, 403, "reviewer cannot also approve the release");
  const SA = (a, b = {}) => sa.post(`/superadmin/support/tickets/${ticketId}/action`, { action: a, ...b });
  assert.equal((await SA("release_approve", { note: "ok to ship" })).status, 200);
  assert.equal((await R("record_deployment", { releaseId: "v1.2.3", environment: "production", result: "success" })).status, 409, "push first");
  assert.equal((await R("record_push", { branch: "fix/orders-crash" })).status, 400, "commit required");
  assert.equal((await R("record_push", { branch: "fix/orders-crash", commitRef: "9f3c2ab" })).status, 200);
  const failed = await R("record_deployment", { releaseId: "v1.2.3", environment: "production", result: "failed", notes: "migration error" });
  assert.equal(failed.status, 200);
  assert.equal(failed.data.data.ticket.status, "approved_for_release");
  const ok = await R("record_deployment", { releaseId: "v1.2.4", environment: "production", result: "success" });
  assert.equal(ok.data.data.ticket.status, "released");
  assert.equal(ok.data.data.releases.length, 2);
});

test("verification, reporter confirmation, closure, reopening and the reporter's view", async () => {
  const SA = (a, b = {}) => sa.post(`/superadmin/support/tickets/${ticketId}/action`, { action: a, ...b });
  assert.equal((await SA("resolve", {})).status, 400);
  assert.equal((await SA("request_confirmation", { verificationNote: "Verified on production", resolutionSummary: "Fixed a crash when saving orders." })).status, 200);
  const pre = await ownerA.get(`/support/tickets/${ticketId}`);
  assert.equal(pre.data.ticket.awaitingYou, true);
  assert.ok(pre.data.actions.includes("reporter_confirm"));
  assert.equal(pre.data.comments.some((c) => /secret technical/.test(c.body)), false, "internal notes hidden");
  assert.equal(JSON.stringify(pre.data).includes("v1.2.4"), false, "release internals hidden");
  assert.equal((await SA("close")).status, 409, "not resolved yet");
  assert.equal((await ownerA.post(`/support/tickets/${ticketId}/action`, { action: "reporter_confirm", message: "Works now" })).status, 200);
  assert.equal((await SA("close")).data.data.ticket.status, "closed");
  assert.equal((await ownerA.post(`/support/tickets/${ticketId}/comments`, { body: "thanks" })).status, 409);
  const reopened = await ownerA.post(`/support/tickets/${ticketId}/action`, { action: "reporter_reopen", reason: "It happens again" });
  assert.equal(reopened.status, 200);
  assert.equal(reopened.data.ticket.status, "reopened");
  const full = await sa.get(`/superadmin/support/tickets/${ticketId}`);
  assert.equal(full.data.data.ticket.reopenCount, 1);
  assert.ok(full.data.data.history.length >= 15, "full history preserved");
  assert.ok(full.data.data.history.some((h) => h.to === "closed"));
  const notes = await ownerA.get("/support/notifications");
  assert.ok(notes.data.unread > 0);
});

test("roles are real: permissions are editable, enforced per request, and deactivation revokes access", async () => {
  const roles = await sa.get("/superadmin/support/staff/roles");
  assert.equal(roles.data.data.group, "Developer Support & Ticket Management");
  assert.ok(roles.data.data.permissions.length >= 20);
  const bad = await sa.put("/superadmin/support/staff/roles", { rolePermissions: { Developer: ["nope"] } });
  assert.equal(bad.status, 400);
  // remove submit-for-QA from Developer → takes effect immediately for existing sessions
  const next = roles.data.data.rolePermissions.Developer.filter((p) => p !== "tickets.submitForQA");
  assert.equal((await sa.put("/superadmin/support/staff/roles", { rolePermissions: { Developer: next } })).status, 200);
  const r = await dev.c.post(`/dev/tickets/${ticketId}/action`, { action: "start" });
  assert.ok([403, 409].includes(r.status));
  assert.equal((await dev.c.get("/dev/auth/me")).data.data.staff.permissions.includes("tickets.submitForQA"), false);
  await sa.post("/superadmin/support/staff/roles/reset");
  // deactivate: must reassign open tickets; then login and session stop working, history is kept
  const dflt = await sa.post(`/superadmin/support/staff/${dev.id}/deactivate`, {});
  assert.equal(dflt.status, 409);
  assert.equal(dflt.data.code, "REASSIGN_REQUIRED");
  const dev2 = await inviteAndLogin("Developer", "Dev Two", "dev2@dishky.test");
  const ok = await sa.post(`/superadmin/support/staff/${dev.id}/deactivate`, { reassignTo: dev2.id });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal((await dev.c.get("/dev/auth/me")).status, 401);
  assert.equal((await client(ctx.port).post("/dev/auth/login", { email: "dev1@dishky.test", password: "Another-Passw0rd-77" })).status, 401);
  const t = await sa.get(`/superadmin/support/tickets/${ticketId}`);
  assert.equal(t.data.data.ticket.developerId, dev2.id);
  const detail = await sa.get(`/superadmin/support/staff/${dev.id}`);
  assert.equal(detail.data.data.staff.status, "deactivated");
  assert.ok(detail.data.data.historicalTickets.length + detail.data.data.activeTickets.length >= 0);
  const deact = await sa.post("/superadmin/support/tickets/" + ticketId + "/action", { action: "assign", developerId: dev.id, deadline: new Date(Date.now() + 86400000).toISOString() });
  assert.equal(deact.status, 400, "deactivated staff cannot receive assignments");
  const list = await sa.get("/superadmin/support/staff?search=dev&sort=name");
  assert.ok(list.data.data.total >= 2);
});

test("deadline sweep warns and flags overdue but never completes tickets", async () => {
  const { Ticket } = require("../src/modules/support/models");
  const svc = require("../src/modules/support/service");
  await Ticket.updateOne({ ticketId }, { $set: { status: "in_progress", deadline: new Date(Date.now() - 3600000), overdueNotifiedAt: null } });
  const r = await svc.runDeadlineSweep();
  assert.ok(r.overdue >= 1);
  const t = await Ticket.findOne({ ticketId }).lean();
  assert.equal(t.status, "in_progress");
  const list = await sa.get("/superadmin/support/tickets?view=overdue");
  assert.equal(list.data.data.total, 1);
  assert.equal(list.data.data.rows[0].overdue, true);
  assert.equal((await sa.get("/superadmin/support/dashboard")).data.data.counts.overdue, 1);
});

test("every support route requires authentication", async () => {
  const anon = client(ctx.port);
  for (const p of ["/support/tickets", "/support/meta", "/dev/tickets", "/dev/dashboard", "/superadmin/support/tickets", "/superadmin/support/staff"]) {
    assert.equal((await anon.get(p, { "X-Restaurant": "alpha-cafe" })).status, 401, p);
  }
  // restaurant session is not a staff or super-admin session, and vice versa
  assert.equal((await ownerA.get("/dev/tickets")).status, 401);
  assert.equal((await ownerA.get("/superadmin/support/tickets")).status, 401);
  assert.equal((await sa.get("/support/tickets", { "X-Restaurant": "alpha-cafe" })).status, 401);
});

test("restaurant roles: permission matrix gates read/write and non-owners only see their own branch", async () => {
  const bcrypt = require("bcrypt");
  const { runInTenant } = require("../src/core/tenancy");
  const { Restaurant } = require("../src/modules/platform/models");
  const { Admin } = require("../src/modules/auth/auth");
  const { Venue } = require("../src/modules/venues/venues");
  const rest = await Restaurant.findOne({ slug: "alpha-cafe" }).lean();
  const hash = await bcrypt.hash("supersecret1", 4);
  const venueId = await runInTenant(rest.id, async () => {
    const v = await Venue.findOne({}).lean();
    await Admin.create({ id: "chef_a", name: "Chef A", email: "chef@example.com", password: hash, roleGroup: "Manager", roleTitle: "Chef", venueId: v.id });
    await Admin.create({ id: "chef_other", name: "Chef B", email: "chefb@example.com", password: hash, roleGroup: "Manager", roleTitle: "Chef", venueId: "venue-elsewhere" });
    return v.id;
  });
  const chef = client(ctx.port), other = client(ctx.port);
  assert.equal((await chef.post("/staff-auth/login", { restaurant: "alpha-cafe", email: "chef@example.com", password: "supersecret1" })).status, 200);
  assert.equal((await other.post("/staff-auth/login", { restaurant: "alpha-cafe", email: "chefb@example.com", password: "supersecret1" })).status, 200);

  // Chef has default read+write; the owner can restrict to read-only through the matrix → can list, cannot create
  assert.equal((await chef.get("/support/tickets")).status, 200);
  assert.equal((await ownerA.patch("/permissions", { rows: [{ roleTitle: "Chef", module: "supportTickets", canRead: true, canWrite: false }] })).status, 200);
  const denied = await chef.post("/support/tickets", { title: "Chef ticket", description: "Something is broken here", category: "bug", module: "Orders" });
  assert.equal(denied.status, 403);

  // grant write through the existing Roles & Responsibilities matrix → creation works and is pinned to the chef's branch
  const grant = await ownerA.patch("/permissions", { rows: [{ roleTitle: "Chef", module: "supportTickets", canRead: true, canWrite: true }] });
  assert.equal(grant.status, 200, JSON.stringify(grant.data));
  const made = await chef.post("/support/tickets", { title: "Chef ticket", description: "Something is broken here", category: "bug", module: "Orders", venueId: "ignored" });
  assert.equal(made.status, 201, JSON.stringify(made.data));
  assert.equal(made.data.ticket.venueId, venueId);

  // owner (Super Admin role) sees every branch's tickets; a Chef from another branch sees none of them
  assert.ok((await ownerA.get("/support/tickets")).data.total >= 2);
  assert.equal((await other.get("/support/tickets")).data.total, 0);
  assert.equal((await other.get(`/support/tickets/${made.data.ticketId}`)).status, 404);
  assert.equal((await chef.get(`/support/tickets/${made.data.ticketId}`)).status, 200);

  // revoking read removes access entirely
  await ownerA.patch("/permissions", { rows: [{ roleTitle: "Chef", module: "supportTickets", canRead: false, canWrite: false }] });
  assert.equal((await chef.get("/support/tickets")).status, 403);
});

test("a realistically sized screenshot passes the global payload guard (regression: 20 000-character cap)", async () => {
  // A realistically sized screenshot (~150 KB, well over the generic 20 000-character string cap) must pass the global payload guard.
  const bigPng = "data:image/png;base64," + Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(150 * 1024, 1)]).toString("base64");
  const big = await ownerA.post("/support/tickets", { title: "Big screenshot", description: "Ticket with a large screenshot", category: "bug", module: "Orders", attachments: [{ name: "big.png", dataUrl: bigPng }] });
  assert.equal(big.status, 201, JSON.stringify(big.data));
});

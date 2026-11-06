// Attender accounts: created only from the admin panel; attenders sign in and can change their own password.
const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, client } = require("./helpers");

let app, owner, slug;
test.before(async () => { app = await boot(); });
test.after(async () => { await app.close(); });

test("setup owner", async () => {
  owner = client(app.port);
  const su = await owner.post("/platform/auth/signup", { name: "Att Owner", email: "attowner@example.com", password: "supersecret1", restaurantName: "Att Cafe", planKey: "growth", billingCycle: "monthly" });
  assert.equal(su.status, 201, JSON.stringify(su.data));
  slug = su.data.data.restaurant.slug;
  assert.equal((await owner.post("/staff-auth/login", { restaurant: slug, email: "attowner@example.com", password: "supersecret1" })).status, 200);
});

test("no self signup; admin creates the account with Aadhaar", async () => {
  const att = client(app.port, { "X-Restaurant": slug });
  assert.equal((await att.post("/attender-auth/signup", { name: "Ravi Kumar", mobile: "9876543210", password: "secret1" })).status, 404);
  assert.equal((await att.post("/attenders", { name: "Ravi Kumar", mobile: "9876543210", password: "secret1", aadhaarNumber: "123412341234" })).status, 401, "not an admin");

  const bad = (b) => owner.post("/attenders", { name: "Ravi Kumar", mobile: "9876543210", password: "secret1", aadhaarNumber: "123412341234", ...b });
  assert.equal((await bad({ name: "R" })).status, 400);
  assert.equal((await bad({ mobile: "123" })).status, 400);
  assert.equal((await bad({ password: "123" })).status, 400);
  assert.equal((await bad({ aadhaarNumber: "1234" })).status, 400);
  const ok = await bad({});
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.passwordHash, undefined);
  assert.equal((await bad({})).status, 409, "duplicate mobile");
  const list = (await owner.get("/attenders")).data;
  assert.equal(list.length, 1); assert.equal(list[0].aadhaarMasked, "XXXX XXXX 1234"); assert.equal(list[0].aadhaarNumber, undefined, "list never returns the full number");
});

test("attender logs in and changes their own password", async () => {
  const att = client(app.port, { "X-Restaurant": slug });
  assert.equal((await att.post("/attender-auth/login", { mobile: "9876543210", password: "nope-nope" })).status, 401);
  assert.equal((await att.post("/attender-auth/login", { mobile: "9876543210", password: "secret1" })).status, 200);
  assert.equal((await att.get("/attender-auth/me")).status, 200);
  assert.equal((await att.post("/attender-auth/change-password", { currentPassword: "wrong!!", newPassword: "better22" })).status, 401);
  assert.equal((await att.post("/attender-auth/change-password", { currentPassword: "secret1", newPassword: "123" })).status, 400);
  assert.equal((await att.post("/attender-auth/change-password", { currentPassword: "secret1", newPassword: "better22" })).status, 200);
  assert.equal((await att.get("/attender-auth/me")).status, 200, "this device stays signed in");
  const other = client(app.port, { "X-Restaurant": slug });
  assert.equal((await other.post("/attender-auth/login", { mobile: "9876543210", password: "secret1" })).status, 401);
  assert.equal((await other.post("/attender-auth/login", { mobile: "9876543210", password: "better22" })).status, 200);
});

test("admin can reset the password, edit and remove", async () => {
  const id = "attender_9876543210";
  assert.equal((await owner.patch(`/attenders/${id}`, { password: "reset99", name: "Ravi K" })).status, 200);
  const att = client(app.port, { "X-Restaurant": slug });
  assert.equal((await att.post("/attender-auth/login", { mobile: "9876543210", password: "reset99" })).status, 200);
  assert.equal((await owner.get(`/attenders/${id}`)).data.aadhaarNumber, "123412341234");
  assert.equal((await owner.del(`/attenders/${id}`)).status, 200);
  assert.equal((await att.post("/attender-auth/login", { mobile: "9876543210", password: "reset99" })).status, 401);
});

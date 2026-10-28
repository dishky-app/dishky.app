const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, client } = require("./helpers");

let app;
test.before(async () => { app = await boot(); });
test.after(async () => { await app.close(); });

const item = { dishId: "x", name: "Tea", quantity: 1, unitPrice: 50, totalPrice: 50, isCustomized: true };

test("attender: signup, login, me, orders are stamped with the attender, logout", async () => {
  const owner = client(app.port);
  const su = await owner.post("/platform/auth/signup", {
    name: "Ann Owner", email: "annowner@example.com", password: "supersecret1",
    restaurantName: "Ann Cafe", planKey: "growth", billingCycle: "monthly",
  });
  assert.equal(su.status, 201, JSON.stringify(su.data));

  const att = client(app.port, { "X-Restaurant": "ann-cafe" });

  // validation
  assert.equal((await att.post("/attender/signup", { name: "R", mobile: "9876543210", password: "secret1" })).status, 400);
  assert.equal((await att.post("/attender/signup", { name: "Ravi", mobile: "123", password: "secret1" })).status, 400);
  assert.equal((await att.post("/attender/signup", { name: "Ravi", mobile: "9876543210", password: "123" })).status, 400);

  const created = await att.post("/attender/signup", { name: "Ravi Kumar", mobile: "9876543210", password: "secret1" });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.attender.name, "Ravi Kumar");
  assert.equal(created.data.attender.password, undefined, "hash never leaves the server");
  assert.equal((await att.get("/attender/me")).status, 200);

  // duplicate mobile
  const other = client(app.port, { "X-Restaurant": "ann-cafe" });
  assert.equal((await other.post("/attender/signup", { name: "Dup", mobile: "9876543210", password: "secret1" })).status, 409);

  // wrong / right password
  assert.equal((await other.post("/attender/login", { mobile: "9876543210", password: "wrong-pass" })).status, 401);
  assert.equal((await other.post("/attender/login", { mobile: "9000000000", password: "secret1" })).status, 401);
  assert.equal((await other.post("/attender/login", { mobile: "9876543210", password: "secret1" })).status, 200);

  // order for table 5 and table 7 by the same attender
  const o1 = await att.post("/orders", { tableNo: 5, userName: "Window guests", items: [item], attenderName: "FORGED", staffName: "FORGED" });
  assert.equal(o1.status, 201, JSON.stringify(o1.data));
  assert.equal(o1.data.attenderName, "Ravi Kumar");
  assert.equal(o1.data.staffName, "Ravi Kumar");
  assert.equal(o1.data.tableNo, 5);
  assert.equal(o1.data.userName, "Window guests");
  assert.equal(o1.data.userId, undefined, "never attached to a customer account");
  const o2 = await att.post("/orders", { tableNo: "7", items: [item] });
  assert.equal(o2.data.attenderName, "Ravi Kumar");
  assert.equal(o2.data.userName, "Guest");

  // attender must give a table
  assert.equal((await att.post("/orders", { items: [item] })).status, 400);

  // a plain guest cannot forge an attender name
  const guest = client(app.port, { "X-Restaurant": "ann-cafe" });
  const g = await guest.post("/orders", { tableNo: 2, items: [item], attenderName: "FORGED", attenderId: "att_x" });
  assert.equal(g.status, 201);
  assert.equal(g.data.attenderName, undefined);
  assert.equal(g.data.attenderId, undefined);

  // a different restaurant has no such attender
  await owner.post("/platform/auth/signup", { name: "Bo Owner", email: "boowner@example.com", password: "supersecret1", restaurantName: "Bo Bistro", planKey: "growth", billingCycle: "monthly" });
  const bo = client(app.port, { "X-Restaurant": "bo-bistro" });
  assert.equal((await bo.post("/attender/login", { mobile: "9876543210", password: "secret1" })).status, 401);

  // logout ends the session
  assert.equal((await att.post("/attender/logout")).status, 200);
  assert.equal((await att.get("/attender/me")).status, 401);
  const after = await att.post("/orders", { tableNo: 5, items: [item] });
  assert.equal(after.data.attenderName, undefined, "no attender session -> ordinary guest order");
});

test("attender: forgot / reset password", async () => {
  const att = client(app.port, { "X-Restaurant": "ann-cafe" });
  // unknown number answers the same way and sends nothing
  const unknown = await att.post("/attender/forgot-password", { mobile: "9111111111" });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.data.devCode, undefined);

  const known = await att.post("/attender/forgot-password", { mobile: "9876543210" });
  assert.equal(known.status, 200);
  const code = known.data.devCode; // only echoed outside production when no WhatsApp template is configured
  assert.match(code, /^\d{6}$/);

  assert.equal((await att.post("/attender/reset-password", { mobile: "9876543210", otp: "000000", newPassword: "newsecret1" })).status, 400);
  assert.equal((await att.post("/attender/reset-password", { mobile: "9876543210", otp: code, newPassword: "123" })).status, 400);
  assert.equal((await att.post("/attender/reset-password", { mobile: "9876543210", otp: code, newPassword: "newsecret1" })).status, 200);
  // code is single-use
  assert.equal((await att.post("/attender/reset-password", { mobile: "9876543210", otp: code, newPassword: "another1" })).status, 400);

  assert.equal((await att.post("/attender/login", { mobile: "9876543210", password: "secret1" })).status, 401);
  assert.equal((await att.post("/attender/login", { mobile: "9876543210", password: "newsecret1" })).status, 200);
});

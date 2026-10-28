/**
 * Dishky print bridge — runs on a computer at the venue, next to its printer.
 *
 * It connects OUT to the Dishky API (no inbound ports), proves which venue it
 * belongs to, and prints the jobs staff send from the dashboard by handing
 * them to the local print server (src/server.js, port 9001).
 *
 *   DISHKY_API_URL=https://api.dishky.com \
 *   DISHKY_RESTAURANT=dishky DISHKY_VENUE_ID=venue_1 DISHKY_PRINTER_TOKEN=... \
 *   node bridge.js
 *
 * Find the values in the dashboard: Venues -> edit venue -> Print bridge.
 */
const { io } = require("socket.io-client");

const API = process.env.DISHKY_API_URL || "http://localhost:4000";
const restaurant = process.env.DISHKY_RESTAURANT;
const venueId = process.env.DISHKY_VENUE_ID;
const token = process.env.DISHKY_PRINTER_TOKEN;
const LOCAL = process.env.LOCAL_PRINT_SERVER || "http://localhost:9001";

if (!restaurant || !venueId || !token) {
  console.error("Set DISHKY_RESTAURANT, DISHKY_VENUE_ID and DISHKY_PRINTER_TOKEN (see the Venues page in the dashboard).");
  process.exit(1);
}

const socket = io(API, { transports: ["websocket"], reconnectionAttempts: Infinity, reconnectionDelay: 2000 });

socket.on("connect", () => socket.emit("printer:register", { restaurant, venueId, token }));
socket.on("printer:register-ack", (ack) => {
  if (ack && ack.ok) console.log(`Registered as ${restaurant} / ${venueId}. Waiting for print jobs…`);
  else console.error("Registration refused:", ack && ack.error);
});
socket.on("disconnect", (reason) => console.warn("Disconnected:", reason));

const ROUTES = { kot: "/print/kot", bill: "/print/bill" };

socket.on("printer:print", async ({ jobId, jobType, order }) => {
  try {
    const path = jobType === "test" ? "/test-print" : ROUTES[jobType];
    if (!path) throw new Error(`Unknown job type: ${jobType}`);
    const res = await fetch(`${LOCAL}${path}`, jobType === "test"
      ? undefined
      : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order }) });
    const body = await res.json().catch(() => ({}));
    socket.emit("printer:result", { jobId, success: res.ok && body.success !== false, error: body.error, message: body.message });
  } catch (err) {
    socket.emit("printer:result", { jobId, success: false, error: err.message });
  }
});

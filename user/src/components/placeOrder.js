// user panel
// src/components/placeOrder.js   this is the file for placing the order of foods. 
import api from "../api";
import socket from "../socket";
import { printKot } from "../printUtils";
import { stripCustomizedPrefix } from "../pages/shared/bagUtils";
import { fmtDate } from "../utils/dateUtils";

const CGST_RATE = 0.025;
const SGST_RATE = 0.025;

/** Formats an ISO date string as DD-MM-YYYY for the receipt printer. */
const formatForPrinter = (iso) => {
  if (!iso) return "";
  return fmtDate(iso);
};

/** Computes subtotal + CGST/SGST + grand total (all rounded) for a bag. */
const calculateTotals = (bag) => {
  const totalAmount = bag.reduce(
    (sum, item) => sum + Number(item.totalPrice || 0),
    0
  );

  const cgst = Number((totalAmount * CGST_RATE).toFixed(2));
  const sgst = Number((totalAmount * SGST_RATE).toFixed(2));

  return {
    totalAmount,
    totalWithGST: {
      subTotal: Math.round(totalAmount),
      cgst,
      sgst,
      total: Math.round(totalAmount + cgst + sgst)
    }
  };
};

/** Fetches the logged-in user's name/mobile, or "Guest" if none is stored. */
const resolveUser = async (userId) => {
  if (!userId) return { userName: "Guest", mobileNo: null };

  const userRes = await api.get(`/users/me`);
  return {
    userName: userRes.data?.name || "Guest",
    mobileNo: userRes.data?.mobile || null
  };
};

/**
 * NOTE: ingredient stock deduction used to happen here, client-side —
 * the browser would fetch the full ingredients collection and push
 * writes back to it directly. That's now handled server-side inside
 * POST /orders (see server.js), atomically, using the same order
 * payload already being sent. Removed here since (a) it required
 * customer-session write access to inventory data it has no business
 * touching directly, and (b) admin routes are now properly
 * session-gated, so this call would just 401 for every order anyway.
 */

/** Best-effort KOT print request over the socket.io relay — failures are
 *  logged but never block the caller; placing the order already succeeded
 *  by the time this runs, so a printer hiccup shouldn't look like an
 *  order failure to the customer. */
const sendKotToPrinter = (savedOrder, totalWithGST) => {
  const printerOrder = {
    id: savedOrder.id,
    date: formatForPrinter(savedOrder.date),
    time: savedOrder.time,
    tableNo: savedOrder.tableNo,
    staffName: savedOrder.userName,
    // Printed as its own "Attender:" line on the KOT when an attender took the order.
    attenderName: savedOrder.attenderName || undefined,
    // Re-orders join the table's open bill: the kitchen ticket lists only the dishes just ordered.
    items: (savedOrder.newItems || savedOrder.items || []).map(item => ({
      dishName: item.dishName,
      quantity: item.quantity,
      selectedSize: item.selectedSize,
      spiciness: item.spiciness,
      notes: item.notes,
      isCustomized: item.isCustomized,
      ingredients: Array.isArray(item.ingredients) ? item.ingredients : []
    })),
    totalWithGST
  };

  printKot(socket, printerOrder)
    .then((result) => {
      if (!result.success) {
        console.warn("KOT print failed:", result.error);
      }
    })
    .catch((err) => console.warn("KOT print failed:", err));
};

/**
 * Places a new order from the current bag:
 *  1. Resolves the current user (or "Guest")
 *  2. Builds the order payload (items, totals, GST breakdown)
 *  3. Saves the order via the API (server assigns the real id)
 *  4. Deducts consumed ingredients from stock
 *  5. Sends a best-effort KOT print job
 *
 * @param {Array} bag - the current bag/cart items
 * @param {Object} [options]
 * @param {{tableNo: string|number, guest?: string}} [options.attenderTable] - set when an
 *        attender is taking the order for a table: the table comes from the attender's active
 *        tab (not the QR/URL), the order belongs to that table's guest (never to a customer
 *        account on this device), and the server stamps the attender's verified name on it.
 * @returns {Promise<Object>} the saved order, as returned by the API
 */
export const placeOrder = async (bag, options = {}) => {
  if (!Array.isArray(bag) || bag.length === 0) {
    throw new Error("Bag is empty");
  }

  const attenderTable = options.attenderTable || null;
  const userId = attenderTable ? null : localStorage.getItem("userId");

  const rawTableNo = attenderTable ? String(attenderTable.tableNo ?? "") : localStorage.getItem("tableNo");
  // Table ids come from the URL and may be alphanumeric ("A3"); numeric ones
  // stay numbers for compatibility with existing orders.
  const tableNo =
    rawTableNo && rawTableNo.trim() !== ""
      ? (Number.isNaN(Number(rawTableNo)) ? rawTableNo.trim() : Number(rawTableNo))
      : null;

  const mode = tableNo ? "dine in" : "take away";

  const { userName, mobileNo } = attenderTable
    ? { userName: String(attenderTable.guest || "").trim() || "Guest", mobileNo: null }
    : await resolveUser(userId);

  const nowISO = new Date().toISOString();
  const date = nowISO.split("T")[0]; // "2026-02-10"
  const time = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const { totalAmount, totalWithGST } = calculateTotals(bag);

  const newOrder = {
    id: "pending",  // Server assigns the real incremental ID
    ...(userId ? { userId } : {}),
    userName,
    // Server verifies the attender session and stamps attenderId/attenderName itself.
    ...(attenderTable ? { attenderOrder: true } : {}),
    ...(mobileNo ? { mobile: mobileNo } : {}),
    ...(tableNo ? { tableNo } : {}),
    // Branch chosen via the ?branch= QR parameter; the server validates it and
    // falls back to the main branch when absent or unknown.
    ...(localStorage.getItem("branchId") ? { venueId: localStorage.getItem("branchId") } : {}),
    mode,
    date,
    time,
    createdAt: nowISO,
    updatedAt: nowISO,
    status: "placed",
    totalAmount: Math.round(totalAmount),
    totalWithGST,

    items: bag.map(item => ({
      dishId: item.id,
      dishName: stripCustomizedPrefix(item.name),
      categoryId: item.categoryId,
      quantity: Number(item.quantity) || 1,
      unitPrice: Math.round(item.unitPrice || 0),
      totalPrice: Math.round(item.totalPrice || 0),
      status: "placed",
      isCustomized: !!item.isCustomized,
      ...(item.selectedSize ? { selectedSize: item.selectedSize } : {}),
      notes: item.notes || "",
      ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
      createdAt: nowISO,
      ...(item.pickupAt ? { pickupAt: item.pickupAt } : {})
    }))
  };

  /* SAVE ORDER — server generates the real ID and handles user embedding */
  const savedRes = await api.post("/orders", newOrder);
  const savedOrder = savedRes.data;

  /* Ingredient stock deduction now happens server-side, inside POST /orders */

  /* SEND KOT (best effort) */
  sendKotToPrinter(savedOrder, totalWithGST);

  return savedOrder;
};
/**
 * customerSession.js — shared helper for ending a customer's session.
 *
 * Previously "logout" (and "continue as guest") only did
 * localStorage.removeItem("userId") — the server-side session cookie
 * (dishkyid) was left valid, so the account stayed logged in from the
 * server's point of view. This clears both.
 */
import api from "../api";

export async function endCustomerSession() {
  localStorage.removeItem("userId");
  try {
    await api.post("/auth/logout");
  } catch {
    // Best-effort — cookie may already be expired/missing, that's fine.
  }
}

export default endCustomerSession;

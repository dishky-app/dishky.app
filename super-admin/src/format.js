export const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export function bytes(n) {
  n = Number(n || 0);
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let i = -1;
  do { n /= 1024; i += 1; } while (n >= 1024 && i < units.length - 1);
  return `${n >= 100 ? n.toFixed(0) : n.toFixed(1)} ${units[i]}`;
}

// Same display formats as the Admin Panel: DD-MM-YYYY and zero-padded HH:MM AM/PM.
const pad = (n) => String(n).padStart(2, "0");

export const date = (d) => {
  if (!d) return "—";
  const x = new Date(d);
  return `${pad(x.getDate())}-${pad(x.getMonth() + 1)}-${x.getFullYear()}`;
};

export const dateTime = (d) => {
  if (!d) return "—";
  const x = new Date(d);
  const h = x.getHours();
  return `${date(x)} ${pad(h % 12 || 12)}:${pad(x.getMinutes())} ${h >= 12 ? "PM" : "AM"}`;
};

export function daysLabel(days) {
  if (days === null || days === undefined) return "No expiry";
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return "Today";
  return `${days}d left`;
}

export const STATUS_LABEL = {
  trialing: "Trial", active: "Active", past_due: "Past due", cancelled: "Cancelled",
  expired: "Expired", suspended: "Suspended", incomplete: "Incomplete", comped: "Complimentary",
};
export const STATUS_TONE = {
  trialing: "info", active: "ok", past_due: "warn", cancelled: "muted",
  expired: "bad", suspended: "bad", incomplete: "muted", comped: "info",
};
export const PLAN_LABEL = { starter: "Starter", growth: "Sizzle", pro: "Pro", enterprise: "Banquet" };

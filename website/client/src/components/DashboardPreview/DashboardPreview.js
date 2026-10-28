import React from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard, ShoppingBag, Utensils, Layers, Boxes, CalendarDays,
  BookOpen, PartyPopper, ClipboardList, Users, Shield, GitBranch,
  ChefHat, Bell, MapPin, Activity, Wallet, Settings,
} from "lucide-react";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: ShoppingBag, label: "Orders" },
  { icon: Utensils, label: "Dishes" },
  { icon: Layers, label: "Categories" },
  { icon: Boxes, label: "Ingredients" },
  { icon: Boxes, label: "Stocks" },
  { icon: CalendarDays, label: "Events" },
  { icon: BookOpen, label: "Reservations" },
  { icon: PartyPopper, label: "Catering" },
  { icon: ClipboardList, label: "Pre-bookings" },
  { icon: Users, label: "Roles" },
  { icon: GitBranch, label: "Branches" },
  { icon: Shield, label: "Permissions" },
  { icon: ChefHat, label: "KMS" },
  { icon: Bell, label: "SMS" },
  { icon: MapPin, label: "GMS" },
  { icon: Activity, label: "Order Tracking" },
  { icon: Wallet, label: "Payments" },
  { icon: Settings, label: "Settings" },
];

const metrics = [
  { label: "Today's Revenue", value: "₹84,240" },
  { label: "Orders", value: "426" },
  { label: "Active Orders", value: "38" },
  { label: "Guests", value: "284" },
  { label: "Low Stock", value: "12" },
  { label: "Reservations", value: "18" },
];

const barHeights = [40, 65, 50, 80, 60, 90, 70];

export default function DashboardPreview() {
  return (
    <div className="flex w-full min-w-0 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-2xl sm:rounded-3xl">
      {/* Sidebar.
          < md : icon-only rail, so the breadth of modules (the point of the
                 preview) stays visible without stealing width from the data.
          md+  : full labelled sidebar. */}
      <div
        className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-ink/10 bg-cream/60 py-3 md:w-44 md:items-stretch md:p-3"
        aria-hidden="true"
      >
        <p className="mb-2 hidden px-2 font-display text-sm font-bold text-ink md:block">DISHKY</p>
        <p className="mb-1 font-display text-[11px] font-extrabold text-amber md:hidden">D</p>
        <div className="max-h-[300px] w-full space-y-0.5 overflow-hidden md:max-h-[420px]">
          {sidebarItems.map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className={`flex items-center justify-center gap-2 rounded-lg py-1.5 text-[11px] font-medium md:justify-start md:px-2 ${
                active ? "bg-ink text-cream" : "text-ink/55"
              }`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="hidden truncate md:inline">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main panel */}
      <div className="min-w-0 flex-1 p-3 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
          <p className="truncate font-display text-sm font-bold text-ink">Dashboard Overview</p>
          <span className="shrink-0 rounded-full bg-amber/15 px-3 py-1 text-[10px] font-semibold text-amber">
            Live
          </span>
        </div>

        {/* Six metrics: 2 cols on phones (3 rows), 3 cols from sm.
            Values use clamp so "₹84,240" never clips inside a narrow tile. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="min-w-0 rounded-xl bg-cream/70 p-2.5 sm:rounded-2xl sm:p-3">
              <p className="truncate text-[10px] font-medium text-ink/50">{m.label}</p>
              <p className="mt-1 truncate font-display text-[clamp(0.95rem,4.2vw,1.125rem)] font-bold text-ink">
                {m.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-xl bg-cream/70 p-3 sm:mt-4 sm:rounded-2xl sm:p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-ink/40">
            Revenue Trend
          </p>
          <div className="flex h-20 items-end gap-1.5 sm:h-24 sm:gap-2">
            {barHeights.map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                whileInView={{ height: `${h}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="flex-1 rounded-t-md bg-gradient-to-t from-amber to-amberLight"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

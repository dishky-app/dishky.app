/**
 * SalesDashboard.js  —  Dishky Admin Panel
 * Full revenue/sales dashboard — Super Admin roles only
 * (General Manager, Proprietor). Kitchen and Service roles are routed
 * to KitchenReports/ServiceReports instead — see Dashboard.js.
 */

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import dayjs from "dayjs";

import { exportMultiSheet } from "../utils/excelUtils";

import ScheduleSection from './DashboardScheduleSection';
import { useToast } from "../useToast";

import "./Common.css";
import "./SalesDashboard.css";
import {
  PieChart, Pie, Cell, Sector,
  BarChart, Bar,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line,
  CartesianGrid, Area
} from "recharts";
import { format } from "date-fns";
import { CustomDatePicker } from "../components/CustomDatePicker";
import { fmtDate as sharedFmtDateOnly, fmtTime as sharedFmtTime } from "../utils/dateUtils";
import { todayStr, getWeekRange as sharedWeekRange, getMonthRange as sharedMonthRange, getLastMonthRange as sharedLastMonthRange } from "../utils/dateRangeUtils";
import Button3D from "../components/Button3D";
import PageLoader from "../components/PageLoader";
import CollapseChevron from "../components/CollapseChevron";
import CollapseSection from "../components/CollapseSection";
import WorkPlan from "./WorkPlan";
import { useTabLiquid } from "../hooks/useTabLiquid";
import { useDashboardData, DxTip, TipBox, SalesSplitTip, profitOf, ClosingCard, MemosCard, TicketsCard, MoneyShortageCard } from "./DashboardInsights";
import "./DashboardInsights.css";

const COLORS = ["#ff9f43", "#54a0ff", "#FFD700", "#1dd1a1", "#00FFFF", "#e93c3c", "#FFFF00", "#FF8AFF"];
const STAFF_PALETTE = ["#4361ee", "#06d6a0", "#ffd166", "#ef476f", "#7209b7", "#4cc9f0", "#f72585", "#3a0ca3"];

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 6} outerRadius={outerRadius + 14} startAngle={startAngle} endAngle={endAngle} fill={fill} style={{ transition: "all 0.45s cubic-bezier(0.4,0,0.2,1)", filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.25))" }} />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={14} fontWeight={600} fill="#111">{payload.name}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize={13} fill="#555">{value}% (₹{payload.amount})</text>
    </g>
  );
};

const SalaryActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 5} outerRadius={outerRadius + 12} startAngle={startAngle} endAngle={endAngle} fill={fill} style={{ filter: `drop-shadow(0 0 12px ${fill}66)` }} />
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize={13} fontWeight={700} fill="#111">{payload.name}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={12} fill="#555">₹{Number(value).toLocaleString("en-IN")}</text>
    </g>
  );
};

const applyAutoColumnWidth = (sheet, rows) => {
  if (!rows.length) return;
  sheet["!cols"] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2 }));
};

const NoChartData = ({ message = "No data available" }) => (
  <div style={{ height: "100%", minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontWeight: 500, fontSize: 13 }}>{message}</div>
);

const SalesDashboard = ({ adminData, setAdminData, orders = [] }) => {
  // ── Hooks

  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("sales");
  const { containerRef: tabPillsRef, thumbStyle: tabThumbStyle } = useTabLiquid(activeTab);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  const ingredients = adminData.ingredients || [];
  const staff = adminData.staff || [];
  const [activeIndex, setActiveIndex] = useState(null);
  const [activeSalIdx, setActiveSalIdx] = useState(null);
  const today = todayStr();
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [modeFilters, setModeFilters] = useState(new Set());
  const [statusFilters, setStatusFilters] = useState(new Set());

  // ── Handlers

  const toggleFilter = (setter, val) => setter(prev => { const n = new Set(prev); n.has(val) ? n.delete(val) : n.add(val); return n; });
  const [datePreset, setDatePreset] = useState("today");
  // The Staff tab shows THIS MONTH until the user picks a range on the Sales filters, then it follows that range.
  const [rangeTouched, setRangeTouched] = useState(false);

  // Staff table sorting
  const [staffSortKey, setStaffSortKey] = useState("name");
  const [staffSortDir, setStaffSortDir] = useState("asc");

  const applyPreset = React.useCallback((preset) => {
    if (preset === "all") {
      setFromDate("2000-01-01"); setToDate(today);
    } else if (preset === "today") {
      setFromDate(today); setToDate(today);
    } else if (preset === "weekly") {
      // Monday of the current week → today, via the shared dateRangeUtils
      // convention (matches every other page's "This Week" filter).
      const [mon, sun] = sharedWeekRange();
      setFromDate(mon); setToDate(sun);
    } else if (preset === "monthly") {
      const [first] = sharedMonthRange();
      setFromDate(first); setToDate(today);
    } else if (preset === "lastMonth") {
      const [first, last] = sharedLastMonthRange();
      setFromDate(first); setToDate(last);
    }
    setDatePreset(preset);
    setRangeTouched(true);
  }, [today]);

  // ── Helpers

  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const roundTo = (v, d = 2) => Math.round((Number(v) + Number.EPSILON) * 10 ** d) / 10 ** d;
  const resolveQty = (item) => Number(item.qty ?? item.quantity ?? 0);
  const resolveUnitPrice = (item) => item.price != null ? Number(item.price) : resolveQty(item) > 0 ? Number(item.totalPrice || 0) / resolveQty(item) : 0;
  const resolveRevenue = (item) => Number(item.totalPrice ?? resolveUnitPrice(item) * resolveQty(item));

  const baseFilteredOrders = useMemo(() => {
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setHours(23, 59, 59, 999);
    return orders.filter(o => { const d = new Date(o.date); return d >= from && d <= to; });
  }, [orders, fromDate, toDate]);

  const modeFilteredOrders = useMemo(() => modeFilters.size === 0 ? baseFilteredOrders : baseFilteredOrders.filter(o => modeFilters.has((o.mode || "take away").toLowerCase())), [baseFilteredOrders, modeFilters]);
  const statusFilteredOrders = useMemo(() => statusFilters.size === 0 ? baseFilteredOrders : baseFilteredOrders.filter(o => statusFilters.has(o.status?.toLowerCase())), [baseFilteredOrders, statusFilters]);

  const itemStats = useMemo(() => {
    const stats = { total: 0, placed: 0, preparing: 0, servicePickup: 0, completed: 0 };
    const source = modeFilters.size > 0 ? modeFilteredOrders : statusFilters.size > 0 ? statusFilteredOrders : baseFilteredOrders;
    source.forEach(o => { o.items.forEach(i => { const qty = Number(i.quantity ?? 0); const s = i.status?.toLowerCase(); stats.total += qty; if (s === "placed") stats.placed += qty; else if (s === "preparing") stats.preparing += qty; else if (s === "service pickup") stats.servicePickup += qty; else if (s === "completed") stats.completed += qty; }); });
    return stats;
  }, [baseFilteredOrders, modeFilteredOrders, statusFilteredOrders, modeFilters, statusFilters]);

  const orderModeStats = useMemo(() => { let dineIn = 0, takeaway = 0; baseFilteredOrders.forEach(o => { const m = (o.mode || "").toLowerCase(); if (m === "dine in") dineIn++; else takeaway++; }); return { dineIn, takeaway }; }, [baseFilteredOrders]);
  // sales / items / orders per order mode — for the hover details on the header KPIs
  const modeDetail = useMemo(() => {
    const m = { "dine in": { orders: 0, sales: 0, items: 0 }, "take away": { orders: 0, sales: 0, items: 0 } };
    baseFilteredOrders.forEach(o => {
      const k = (o.mode || "").toLowerCase() === "dine in" ? "dine in" : "take away";
      m[k].orders += 1;
      o.items.forEach(i => { m[k].sales += resolveRevenue(i); m[k].items += Number(i.quantity ?? 0); });
    });
    return m;
  }, [baseFilteredOrders]);
  const hasOrders = baseFilteredOrders.length > 0;
  const totalSales = baseFilteredOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + resolveRevenue(i), 0), 0);
  const totalOrders = baseFilteredOrders.length;
  const dx = useDashboardData(fromDate, toDate);
  const profit = profitOf(totalSales, dx.cost);


  const categorySales = useMemo(() => {
    const map = {}, itemsMap = {}, ordersMap = {}; let grand = 0;
    baseFilteredOrders.forEach(o => { const seen = new Set(); o.items.forEach(i => { const a = resolveRevenue(i); if (!a) return; grand += a; map[i.categoryId] = (map[i.categoryId] || 0) + a; itemsMap[i.categoryId] = (itemsMap[i.categoryId] || 0) + resolveQty(i); if (!seen.has(i.categoryId)) { seen.add(i.categoryId); ordersMap[i.categoryId] = (ordersMap[i.categoryId] || 0) + 1; } }); });
    if (!grand) return [];
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([id, v]) => {
      let label = id;
      for (const c of adminData.categories) { if (c.id === id) { label = c.name; break; } const s = (c.subCategories || []).find(s => s.id === id); if (s) { label = s.name; break; } }
      return { name: label, value: Number(((v / grand) * 100).toFixed(1)), amount: roundTo(v, 2), items: itemsMap[id] || 0, orders: ordersMap[id] || 0 };
    });
  }, [baseFilteredOrders, adminData.categories]);

  const categoryItemSummary = useMemo(() => {
    const map = {}; let gRev = 0;
    baseFilteredOrders.forEach(o => { o.items.forEach(i => { const c = i.categoryId || "unknown"; if (!map[c]) map[c] = { category: c, itemsSold: 0, revenue: 0 }; map[c].itemsSold += resolveQty(i); map[c].revenue += resolveRevenue(i); gRev += resolveRevenue(i); }); });
    return Object.values(map).map(r => ({ Category: r.category, "Items Sold": r.itemsSold, "Total Revenue": r.revenue, "Revenue %": gRev > 0 ? Number(((r.revenue / gRev) * 100).toFixed(2)) : 0 }));
  }, [baseFilteredOrders]);

  // Stock figures come from several writers (Ingredients form, Stocks page, the inventory ledger projection), so
  // values may be strings, null or missing. Parse defensively, and when no max is set show the real kg figure
  // with a neutral bar instead of a misleading 0 / 0%.
  const stockData = useMemo(() => ingredients.map(ing => {
    const rem = roundTo(Math.max(0, num(ing.stockRemaining)), 2);
    const mx = roundTo(Math.max(0, num(ing.stockMax)), 2);
    const hasMax = mx > 0;
    const pct = hasMax ? Math.min(100, Math.round((rem / mx) * 100)) : (rem > 0 ? 100 : 0);
    return { name: ing.name, stock: rem, stockMax: mx, hasMax, percent: pct, unit: ing.unit || ing.stockUnit || "kg" };
  }).sort((a, b) => (a.hasMax === b.hasMax ? a.percent - b.percent : a.hasMax ? -1 : 1)), [ingredients]);
  const getStockColor = (v, hasMax = true) => !hasMax ? "#9ca3af" : v >= 60 ? "#1dd1a1" : v >= 35 ? "#ff9f43" : "#ee5253";
  const dailyRevenue = useMemo(() => { const map = {}, cnt = {}, itm = {}; baseFilteredOrders.forEach(o => { cnt[o.date] = (cnt[o.date] || 0) + 1; o.items.forEach(i => { map[o.date] = (map[o.date] || 0) + resolveRevenue(i); itm[o.date] = (itm[o.date] || 0) + resolveQty(i); }); }); return Object.entries(map).sort(([a], [b]) => new Date(a) - new Date(b)).map(([date, revenue]) => ({ date, revenue, orders: cnt[date] || 0, items: itm[date] || 0 })); }, [baseFilteredOrders]);
  const monthlyRevenue = useMemo(() => { const map = {}; baseFilteredOrders.forEach(o => { const month = format(new Date(o.date), "yyyy-MM"); o.items.forEach(i => { map[month] = (map[month] || 0) + resolveRevenue(i); }); }); return Object.entries(map).sort(([a], [b]) => new Date(a) - new Date(b)).map(([month, revenue]) => ({ month, revenue })); }, [baseFilteredOrders]);
  const revenueTrendData = useMemo(() => dailyRevenue.map(d => { const mk = d.date.slice(0, 7); const md = monthlyRevenue.find(m => m.month === mk); return { date: d.date, dailyRevenue: d.revenue, monthlyRevenue: md ? md.revenue : 0, orders: d.orders, items: d.items }; }), [dailyRevenue, monthlyRevenue]);

  // Staff analytics follow the From / To filter: attendance by day, grooming by day, and the salary ledger
  // (advance / deduction) by the months the range touches.
  const staffFrom = rangeTouched ? fromDate : sharedMonthRange()[0];
  const staffTo = rangeTouched ? toDate : today;
  const staffStats = useMemo(() => staff.map(s => {
    const inRange = (d) => { const k = String(d || "").slice(0, 10); return k >= staffFrom && k <= staffTo; };
    const att = (s.attendance || []).filter(a => inRange(a.date));
    const present = att.filter(a => a.status === "present").length;
    const leave = att.filter(a => a.status === "leave").length;
    const absent = att.filter(a => a.status === "absent").length;
    const salary = Number(s.salary) || 0;
    const fromMonth = staffFrom.slice(0, 7), toMonth = staffTo.slice(0, 7);
    const ledger = (s.remainingSalary || []).filter(r => r.month && r.month >= fromMonth && r.month <= toMonth);
    const advance = ledger.reduce((sum, r) => sum + Number(r.advance || 0), 0);
    const deduction = ledger.reduce((sum, r) => sum + Number(r.deduction || 0) + Number(r.penalty || 0), 0);
    const inRangeEntries = (obj = {}) => Object.entries(obj).filter(([d, v]) => typeof v === "object" && v !== null && inRange(d)).map(([, v]) => v);
    const kEntries = inRangeEntries(adminData.grooming?.[s.id]);
    const sEntries = inRangeEntries(adminData.serviceGrooming?.[s.id]);
    const kTotal = kEntries.length, sTotal = sEntries.length;
    const kPassed = kEntries.filter(d => d.uniform && d.shoes && d.groom).length;
    const sPassed = sEntries.filter(d => d.uniform && d.shoes && d.groom).length;
    const groomTotal = Math.max(kTotal, sTotal, 1);
    const groomPassed = kTotal >= sTotal ? kPassed : sPassed;
    const groomPct = Math.min(100, Math.round((groomPassed / groomTotal) * 100));
    const totalTracked = present + leave + absent;
    const attPct = totalTracked > 0 ? Math.round((present / totalTracked) * 100) : 0;
    return { id: s.id, name: s.name, role: s.role || "Staff", workType: s.workType === "full-time" ? "Full-time" : "Part-time", salary, advance, deduction, net: salary - advance - deduction, present, leave, absent, tracked: totalTracked, attPct, groomPct, groomPassed, groomTotal: kTotal >= sTotal ? kTotal : sTotal };
  }), [staff, adminData.grooming, adminData.serviceGrooming, staffFrom, staffTo]);

  const sortedStaffStats = useMemo(() => {
    return [...staffStats].sort((a, b) => {
      const aVal = String(a[staffSortKey] ?? "").toLowerCase();
      const bVal = String(b[staffSortKey] ?? "").toLowerCase();
      return staffSortDir === "asc" ? aVal.localeCompare(bVal, undefined, { numeric: true }) : bVal.localeCompare(aVal, undefined, { numeric: true });
    });
  }, [staffStats, staffSortKey, staffSortDir]);

  const toggleStaffSort = (key) => {
    if (staffSortKey === key) setStaffSortDir(d => d === "asc" ? "desc" : "asc");
    else { setStaffSortKey(key); setStaffSortDir("asc"); }
  };

  const SortIcon = ({ col }) => {
    if (staffSortKey !== col) return <span style={{ color: "#bbb", fontSize: 10 }}>⇅</span>;
    return <span style={{ fontSize: 10 }}>{staffSortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const staffSummary = useMemo(() => ({
    total: staff.length,
    fullTime: staff.filter(s => s.workType === "full-time").length,
    partTime: staff.filter(s => s.workType !== "full-time").length,
    totalSalaryBill: staffStats.reduce((s, x) => s + x.salary, 0),
    totalAdvance: staffStats.reduce((s, x) => s + x.advance, 0),
    avgAttendance: staffStats.length > 0 ? Math.round(staffStats.reduce((s, x) => s + x.attPct, 0) / staffStats.length) : 0,
  }), [staffStats]);

  const attendanceBarData = staffStats.map(s => ({ name: s.name.split(" ")[0], fullName: s.name, role: s.role, present: s.present, leave: s.leave, absent: s.absent, tracked: s.tracked, pct: s.attPct }));
  const salaryPieData = staffStats.map((s, i) => ({ name: s.name.split(" ")[0], fullName: s.name, value: s.salary, color: STAFF_PALETTE[i % STAFF_PALETTE.length], role: s.role, workType: s.workType, advance: s.advance, deduction: s.deduction, net: s.net }));
  const groomBarData = staffStats.map((s, i) => ({ name: s.name.split(" ")[0], fullName: s.name, role: s.role, value: s.groomPct, passed: s.groomPassed, total: s.groomTotal, color: STAFF_PALETTE[i % STAFF_PALETTE.length] }));

  const inr = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const share = (n, t) => (t > 0 ? `${Math.round((n / t) * 1000) / 10}%` : "0%");
  const rangeLabel = fromDate === toDate ? sharedFmtDateOnly(fromDate) : `${sharedFmtDateOnly(fromDate)} – ${sharedFmtDateOnly(toDate)}`;
  const staffRangeLabel = staffFrom === staffTo ? sharedFmtDateOnly(staffFrom) : `${sharedFmtDateOnly(staffFrom)} – ${sharedFmtDateOnly(staffTo)}`;
  const avgOrder = totalOrders > 0 ? totalSales / totalOrders : 0;

  const TrendTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <TipBox title={sharedFmtDateOnly(label)} accent="#54a0ff" rows={[
        ["Revenue", inr(d.dailyRevenue)], ["Orders", d.orders], ["Items sold", d.items],
        ["Avg per order", inr(d.orders ? d.dailyRevenue / d.orders : 0)],
        ["Share of range", share(d.dailyRevenue, totalSales)],
        ["Month total (in range)", inr(d.monthlyRevenue)],
      ]} />
    );
  };
  const StockTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { name, stock, stockMax, hasMax, percent, unit } = payload[0].payload;
    const color = getStockColor(percent, hasMax);
    const state = !hasMax ? "Max not set" : stock <= 0 ? "Out of stock" : percent < 35 ? "Low" : percent < 60 ? "Medium" : "Healthy";
    return (
      <TipBox title={name} accent={color} rows={[
        ["Remaining", `${roundTo(stock, 2)} ${unit}`],
        ["Capacity", hasMax ? `${roundTo(stockMax, 2)} ${unit}` : "—"],
        ["Filled", hasMax ? `${percent}%` : "—"],
        ["Status", state, state === "Healthy" ? "good" : state === "Low" || state === "Out of stock" ? "bad" : undefined],
      ]} foot={hasMax ? `${roundTo(Math.max(0, stockMax - stock), 2)} ${unit} to refill` : "Set a max on the Ingredients page"} />
    );
  };
  const pieRows = (d) => [["Share of sales", `${d.value}%`], ["Sales", inr(d.amount)], ["Items sold", d.items], ["Orders", d.orders], ["Avg per order", inr(d.orders ? d.amount / d.orders : 0)]];
  const PieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return <TipBox title={d.name} accent={payload[0].payload.fill || payload[0].color} rows={pieRows(d)} foot="Click to open these orders" />;
  };
  const SalaryTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return <TipBox title={d.name} subtitle={`${d.role || "Staff"} · ${d.workType}`} accent={d.color} rows={salaryRows(d)} />;
  };
  const salaryRows = (d) => [["Monthly salary", inr(d.value)], ["Share of bill", share(d.value, staffSummary.totalSalaryBill)], ["Advance (range)", inr(d.advance)], ["Deductions (range)", inr(d.deduction)], ["Net payable", inr(d.net), d.net < 0 ? "bad" : undefined]];
  const attRows = (s) => [["Present", `${s.present} day${s.present === 1 ? "" : "s"}`, "good"], ["Leave", `${s.leave} day${s.leave === 1 ? "" : "s"}`], ["Absent", `${s.absent} day${s.absent === 1 ? "" : "s"}`, s.absent ? "bad" : undefined], ["Days recorded", s.tracked], ["Attendance", `${s.pct}%`]];
  const modeTip = (key, title) => {
    const m = modeDetail[key];
    return (<><div className="dx-tip-title">{title}</div>
      <div className="dx-tip-row"><span>Orders</span><b>{m.orders} ({share(m.orders, totalOrders)})</b></div>
      <div className="dx-tip-row"><span>Sales</span><b>{inr(m.sales)} ({share(m.sales, totalSales)})</b></div>
      <div className="dx-tip-row"><span>Items</span><b>{m.items}</b></div>
      <div className="dx-tip-row"><span>Avg per order</span><b>{inr(m.orders ? m.sales / m.orders : 0)}</b></div>
      <div className="dx-tip-foot">{rangeLabel} · click to filter, double-click to open Orders</div></>);
  };
  const statusTip = (title, n) => (
    <><div className="dx-tip-title">{title} items</div>
      <div className="dx-tip-row"><span>Items</span><b>{n}</b></div>
      <div className="dx-tip-row"><span>Share of all items</span><b>{share(n, itemStats.total)}</b></div>
      <div className="dx-tip-row"><span>Orders in range</span><b>{totalOrders}</b></div>
      <div className="dx-tip-foot">{rangeLabel} · click to open Orders</div></>
  );

  const handleExport = () => {
    // Export everything on the page — all orders (all days), staff, schedules
    const allOrders = orders; // not filtered by date
    if (!allOrders.length && !staff.length) { toast.warning("No data available to export"); return; }

    const exportDate = todayStr();

    // ── Sheet 1: All Orders ──────────────────────────────────────────
    const orderRows = [];
    allOrders.forEach(order => {
      order.items.forEach(item => {
        const isCustom = Array.isArray(item.ingredients) && item.ingredients.length > 0 || Boolean(item.notes);
        orderRows.push({
          OrderID: order.id,
          Date: sharedFmtDateOnly(order.date),
          Time: order.time ?? (order.createdAt ? (() => { const d = new Date(order.createdAt); return sharedFmtTime(`${d.getHours()}:${d.getMinutes()}`); })() : "—"),
          Customer: order.userName || "",
          Mode: order.mode || "",
          Category: item.categoryId,
          Dish: item.dishName,
          Quantity: resolveQty(item),
          Customized: isCustom ? "Yes" : "No",
          UnitPrice: resolveUnitPrice(item),
          TotalPrice: resolveRevenue(item),
          Status: item.status || "",
        });
      });
    });

    // ── Sheet 2: Daily Revenue ───────────────────────────────────────
    const allDailyRevMap = {};
    allOrders.forEach(o => { o.items.forEach(i => { allDailyRevMap[o.date] = (allDailyRevMap[o.date] || 0) + resolveRevenue(i); }); });
    const allDailyRevRows = Object.entries(allDailyRevMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ Date: date, TotalRevenue: revenue }));

    // ── Sheet 3: Category Sales ──────────────────────────────────────
    const allCatMap = {}; let allGRev = 0;
    allOrders.forEach(o => { o.items.forEach(i => { const c = i.categoryId || "unknown"; if (!allCatMap[c]) allCatMap[c] = { Category: c, "Items Sold": 0, "Total Revenue": 0 }; allCatMap[c]["Items Sold"] += resolveQty(i); allCatMap[c]["Total Revenue"] += resolveRevenue(i); allGRev += resolveRevenue(i); }); });
    const allCatRows = Object.values(allCatMap).map(r => ({ ...r, "Revenue %": allGRev > 0 ? Number(((r["Total Revenue"] / allGRev) * 100).toFixed(2)) : 0 }));

    // ── Sheet 4: Staff Summary ───────────────────────────────────────
    const staffRows = staffStats.map(s => ({
      Name: s.name, Role: s.role, Salary: s.salary,
      Advance: s.advance, Deduction: s.deduction,
      Present: s.present, Leave: s.leave, Absent: s.absent,
      "Attendance %": s.attPct, "Grooming %": s.groomPct,
    }));

    // ── Sheet 5 & 6: Schedules ───────────────────────────────────────
    const kSched = adminData.kitchenSchedules || [];
    const kRows = kSched.map(s => ({ Work: s.work || "—", Staff: s.staff || "—", Date: s.date || "—", Department: s.department || "—", Status: s.status || "—", "Response (Days)": s.lastRate != null && s.lastRate !== "" ? `${s.lastRate} days` : "—" }));

    const sSched = adminData.serviceSchedules || [];
    const sRows = sSched.map(s => ({ Work: s.work || "—", Staff: s.staff || "—", Date: s.date || "—", Department: s.department || "—", Status: s.status || "—", "Response (Days)": s.lastRate != null && s.lastRate !== "" ? `${s.lastRate} days` : "—" }));

    const ok = exportMultiSheet({
      sheets: [
        { name: "All Orders", rows: orderRows },
        { name: "Daily Revenue", rows: allDailyRevRows },
        { name: "Category Sales", rows: allCatRows },
        { name: "Staff Summary", rows: staffRows },
        { name: "Kitchen Schedules", rows: kRows },
        { name: "Service Schedules", rows: sRows },
      ],
      fileName: `dashboard_full_export_${exportDate}.xlsx`,
    });
    if (ok) toast.success("Full dashboard export complete.");
    else toast.warning("No data available to export");
  };

  return (
    <div className="dashboard-page">
      {/* HEADER */}
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <div className="justify">
            <div className="ae-header-actions">
              <div className="header-title-row">
                <button
                  type="button"
                  className="header-collapse-btn"
                  onClick={() => setHeaderCollapsed(prev => !prev)}
                  data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={headerCollapsed ? "Expand header" : "Collapse header"}
                >
                  <CollapseChevron collapsed={headerCollapsed} />
                </button>
                <h2 className="dashboard-title">Dashboard</h2>
              </div>

              <div className="app-tab-pills" ref={tabPillsRef}>
                <span className="app-tab-pill-liquid" style={tabThumbStyle} />
                <button className={`app-tab-pill ${activeTab === "sales" ? "active" : ""}`} onClick={() => setActiveTab("sales")}>
                  Sales
                </button>
                <button className={`app-tab-pill ${activeTab === "staff" ? "active" : ""}`} onClick={() => setActiveTab("staff")}>
                  Staff
                </button>
                <button className={`app-tab-pill ${activeTab === "memos" ? "active" : ""}`} onClick={() => setActiveTab("memos")}>
                  Complaints & Memos
                </button>
                <button className={`app-tab-pill ${activeTab === "closing" ? "active" : ""}`} onClick={() => setActiveTab("closing")}>
                  Closing
                </button>
                <button className={`app-tab-pill ${activeTab === "schedules" ? "active" : ""}`} onClick={() => setActiveTab("schedules")}>
                  Schedules
                </button>
                <button className={`app-tab-pill ${activeTab === "workplan" ? "active" : ""}`} onClick={() => setActiveTab("workplan")}>
                  Work Plan
                </button>
              </div>
              {activeTab !== "workplan" && <Button3D onClick={handleExport}>Export</Button3D>}
            </div>
          </div>
          <CollapseSection collapsed={headerCollapsed || !["sales", "memos", "closing"].includes(activeTab)}>
            <div className="dashboard-filter-date">
              <div className="dash-preset-btns">
                {[["all", "All"], ["today", "Today"], ["weekly", "This Week"], ["monthly", "This Month"], ["lastMonth", "Last Month"]].map(([k, lbl]) => (
                  <button key={k} className={`filter-pill${datePreset === k ? " active" : ""}`} onClick={() => applyPreset(k)}>{lbl}</button>
                ))}
              </div>
              <div className="dashboard-custom-datepickers">
                <CustomDatePicker label="From" value={fromDate} max={toDate} onChange={(s) => { setFromDate(s); if (s > toDate) setToDate(s); setDatePreset("custom"); setRangeTouched(true); }} />
                <CustomDatePicker label="To" value={toDate} min={fromDate} max={today} onChange={(s) => { setToDate(s); setDatePreset("custom"); setRangeTouched(true); }} />
              </div>
            </div>
          </CollapseSection>
        </div>

        {/* ORDER / ITEM KPIs — one row, wraps instead of overflowing */}
        <div className={`dashboard-header-right dx-fold${!headerCollapsed && activeTab === "sales" ? "" : " dx-fold-closed"}`} aria-hidden={headerCollapsed || activeTab !== "sales"}>
          <div className="dashboard-kpi-grid">
            <DxTip className="dx-kpi-cell" tip={(<><div className="dx-tip-title">Orders</div>
              <div className="dx-tip-row"><span>Total orders</span><b>{totalOrders}</b></div>
              <div className="dx-tip-row"><span>Dine in</span><b>{orderModeStats.dineIn} ({share(orderModeStats.dineIn, totalOrders)})</b></div>
              <div className="dx-tip-row"><span>Take away</span><b>{orderModeStats.takeaway} ({share(orderModeStats.takeaway, totalOrders)})</b></div>
              <div className="dx-tip-row"><span>Items ordered</span><b>{itemStats.total}</b></div>
              <div className="dx-tip-row dx-tip-total"><span>Avg order value</span><b>{inr(avgOrder)}</b></div>
              <div className="dx-tip-foot">{rangeLabel}</div></>)}>
              <div className="kpi-card kpi-small"><p>Total Orders</p><h3>{totalOrders}</h3></div>
            </DxTip>
            <DxTip className="dx-kpi-cell" tip={modeTip("dine in", "Dine in")}>
              <div className={`kpi-card kpi-small link ${modeFilters.has("dine in") ? "active" : ""}`} onClick={() => toggleFilter(setModeFilters, "dine in")} onDoubleClick={() => navigate("/orders", { state: { mode: "dine in", fromDate, toDate } })}><p>Dine In</p><h3>{orderModeStats.dineIn}</h3></div>
            </DxTip>
            <DxTip className="dx-kpi-cell" tip={modeTip("take away", "Take away")}>
              <div className={`kpi-card kpi-small link ${modeFilters.has("take away") ? "active" : ""}`} onClick={() => toggleFilter(setModeFilters, "take away")} onDoubleClick={() => navigate("/orders", { state: { mode: "take away", fromDate, toDate } })}><p>Take Away</p><h3>{orderModeStats.takeaway}</h3></div>
            </DxTip>
            <DxTip className="dx-kpi-cell" tip={(<><div className="dx-tip-title">Items by status</div>
              <div className="dx-tip-row"><span>Placed</span><b>{itemStats.placed}</b></div>
              <div className="dx-tip-row"><span>Preparing</span><b>{itemStats.preparing}</b></div>
              <div className="dx-tip-row"><span>Service pickup</span><b>{itemStats.servicePickup}</b></div>
              <div className="dx-tip-row"><span>Completed</span><b>{itemStats.completed} ({share(itemStats.completed, itemStats.total)})</b></div>
              <div className="dx-tip-row dx-tip-total"><span>Total items</span><b>{itemStats.total}</b></div>
              <div className="dx-tip-foot">{rangeLabel}</div></>)}>
              <div className="kpi-card kpi-small"><p>Total Items</p><h3>{itemStats.total}</h3></div>
            </DxTip>
            {[["placed", "Placed", itemStats.placed, "status-placed"], ["preparing", "Preparing", itemStats.preparing, "status-preparing"], ["service pickup", "Service Pickup", itemStats.servicePickup, "status-service-pickup"], ["completed", "Completed", itemStats.completed, "status-completed"]].map(([key, lbl, n, cls]) => (
              <DxTip key={key} className="dx-kpi-cell" tip={statusTip(lbl, n)}>
                <div className={`kpi-card kpi-small ${cls} link`} onClick={() => { toggleFilter(setStatusFilters, key); navigate("/orders", { state: { status: key, fromDate, toDate } }); }}><p>{lbl}</p><h3>{n}</h3></div>
              </DxTip>
            ))}
          </div>
        </div>
      </div>

      {/* SALES TAB */}
      {activeTab === "sales" && (
        <div className="dashboard-scroll">
          <div className="dashboard-kpis dx-kpi-single">
            <DxTip className="dx-kpi-tip" tip={<SalesSplitTip closings={dx.closings} loading={dx.closings === null} />}>
              <div className="kpi-card"><p>Total Sales</p><h3>₹{totalSales.toLocaleString("en-IN")}</h3></div>
            </DxTip>
            <DxTip className="dx-kpi-tip" tip={(<><div className="dx-tip-title">Orders</div>
              <div className="dx-tip-row"><span>Total orders</span><b>{totalOrders}</b></div>
              <div className="dx-tip-row"><span>Dine in</span><b>{orderModeStats.dineIn} · {inr(modeDetail["dine in"].sales)}</b></div>
              <div className="dx-tip-row"><span>Take away</span><b>{orderModeStats.takeaway} · {inr(modeDetail["take away"].sales)}</b></div>
              <div className="dx-tip-row"><span>Items ordered</span><b>{itemStats.total}</b></div>
              <div className="dx-tip-row dx-tip-total"><span>Avg order value</span><b>{inr(avgOrder)}</b></div>
              <div className="dx-tip-foot">{rangeLabel}</div></>)}>
              <div className="kpi-card"><p>Total Orders</p><h3>{totalOrders}</h3></div>
            </DxTip>
            <DxTip className="dx-kpi-tip" tip={profit ? <><div className="dx-tip-title">Profit</div><div className="dx-tip-row"><span>Sales</span><b>{inr(totalSales)}</b></div><div className="dx-tip-row"><span>Ingredients used</span><b>{inr(dx.cost?.totals?.orderCost)}</b></div><div className="dx-tip-row"><span>Wastage</span><b>{inr(dx.cost?.totals?.wasteCost)}</b></div><div className="dx-tip-row dx-tip-total"><span>Cost of goods</span><b>{inr(profit.goods)}</b></div><div className="dx-tip-row"><span>Profit</span><b className={profit.profit >= 0 ? "dx-good" : "dx-bad"}>{inr(profit.profit)}</b></div><div className="dx-tip-row"><span>Margin</span><b>{profit.margin}%</b></div><div className="dx-tip-foot">Valued from the inventory ledger.{dx.costNote ? ` ${dx.costNote}` : ""}</div></> : <div className="dx-tip-empty">Cost data is not available for these dates (needs inventory items linked to ingredients).</div>}>
              <div className={`kpi-card ${profit ? (profit.profit >= 0 ? "positive" : "negative") : ""}`}><p>Profit{profit ? ` · ${profit.margin}% margin` : ""}</p><h3>{profit ? `₹${profit.profit.toLocaleString("en-IN")}` : "—"}</h3></div>
            </DxTip>
          </div>
          <div className="dashboard-main-layout">
            <div className="dashboard-piechart">
              <div className="chart-card pie">
                <h4>Category-wise Sales (%)</h4>
                {categorySales.length === 0 ? <NoChartData message="No category sales data" /> : (
                  <>
                    <div className="dx-chart-fill dx-pie-box">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categorySales} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="52%" outerRadius="82%" isAnimationActive animationBegin={100} animationDuration={800} animationEasing="cubic-bezier(0.4,0,0.2,1)" activeIndex={activeIndex} activeShape={renderActiveShape} onMouseEnter={(_, i) => setActiveIndex(i)} onMouseLeave={() => setActiveIndex(null)}
                            onClick={(data) => { if (data && data.name) navigate("/orders", { state: { category: data.name, fromDate, toDate } }); }}>
                            {categorySales.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<PieTooltip />} wrapperStyle={{ zIndex: 50, outline: "none" }} allowEscapeViewBox={{ x: true, y: true }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="dx-legend-list">
                      {categorySales.map((c, i) => (
                        <DxTip key={c.name + i} tip={<TipBox title={c.name} accent={COLORS[i % COLORS.length]} rows={pieRows(c)} foot="Click to open these orders" />}>
                          <div className="dx-legend-row" onClick={() => navigate("/orders", { state: { category: c.name, fromDate, toDate } })}>
                            <i style={{ background: COLORS[i % COLORS.length] }} /><span>{c.name}</span><b>{c.value}%</b><em>{inr(c.amount)}</em>
                          </div>
                        </DxTip>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="dashboard-linechart">
              <div className="chart-card line">
                <div className="chart-header"><h4>Revenue Trend</h4></div>
                {revenueTrendData.length === 0 ? <NoChartData message="No revenue data for selected period" /> : (
                  <div className="dx-chart-fill"><ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#e3e3e3" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#777" }} tickFormatter={(d) => sharedFmtDateOnly(d)} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#777" }} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip content={<TrendTooltip />} wrapperStyle={{ zIndex: 50, outline: "none" }} allowEscapeViewBox={{ x: true, y: true }} />
                      <defs><linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#54a0ff" stopOpacity={0.25} /><stop offset="100%" stopColor="#54a0ff" stopOpacity={0} /></linearGradient></defs>
                      <Area type="monotone" dataKey="dailyRevenue" stroke="none" fill="url(#trendGradient)" isAnimationActive />
                      <Line type="monotone" dataKey="dailyRevenue" stroke="#54a0ff" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "#54a0ff", stroke: "#fff", strokeWidth: 2 }} isAnimationActive />
                      <Line type="monotone" dataKey="monthlyRevenue" stroke="#ff9f43" strokeWidth={3} dot={false} name="Monthly Revenue" />
                    </LineChart>
                  </ResponsiveContainer></div>
                )}
              </div>
            </div>

            {/* BAR CHART – INGREDIENT STOCK */}
            <div className="dashboard-barchart">
              <div className="chart-card bar">
                <h4>Ingredient Stock</h4>
                <div className="stock-chart-wrapper">
                  {stockData.length === 0 ? (
                    <NoChartData message="No stock data available" />
                  ) : (
                    <ResponsiveContainer
                      width="100%"
                      height={Math.max(stockData.length * 22, 100)}
                    >
                      <BarChart
                        data={stockData}
                        layout="vertical"
                        barCategoryGap={4}
                      >
                        <XAxis type="number" domain={[0, 100]} unit="%" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#aaa" }} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={120}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: "#111" }}
                        />
                        <Tooltip content={<StockTooltip />} wrapperStyle={{ zIndex: 50, outline: "none" }} allowEscapeViewBox={{ x: true, y: true }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                        <Bar dataKey="percent" barSize={4} radius={[0, 3, 3, 0]}>
                          {stockData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={getStockColor(entry.percent, entry.hasMax)}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPLAINTS & MEMOS TAB */}
      {activeTab === "memos" && (
        <div className="dashboard-scroll">
          <div className="dx-insights dx-insights-2">
            <MemosCard memos={dx.memos} navigate={navigate} />
            <TicketsCard tickets={dx.tickets} fromDate={fromDate} toDate={toDate} navigate={navigate} />
          </div>
        </div>
      )}

      {/* CLOSING TAB */}
      {activeTab === "closing" && (
        <div className="dashboard-scroll">
          <div className="dx-insights dx-insights-2">
            <ClosingCard closings={dx.isToday ? dx.opsClosings : dx.closings} isToday={dx.isToday} opsDay={dx.opsDay} fromDate={fromDate} toDate={toDate} navigate={navigate} />
            <MoneyShortageCard closings={dx.isToday ? dx.opsClosings : dx.closings} isToday={dx.isToday} opsDay={dx.opsDay} navigate={navigate} />
          </div>
        </div>
      )}

      {/* STAFF TAB */}
      {activeTab === "staff" && (
        <div className="dashboard-scroll">
          <>
            <div className="staff-section-title">
              <h3>Staff Overview</h3>
              <span className="staff-section-sub">{rangeTouched ? "" : "This month · "}{staffRangeLabel}</span>
            </div>

            {/* STAFF KPIs */}
            <div className="staff-kpi-row">
              {[
                { label: "Total Staff", value: staffSummary.total, nav: "/staffs", state: {}, rows: [["Full-time", staffSummary.fullTime], ["Part-time", staffSummary.partTime], ...Object.entries(staffStats.reduce((m, x) => { m[x.role] = (m[x.role] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5)] },
                { label: "Full-Time", value: staffSummary.fullTime, nav: "/staffs", state: { workType: "full-time" }, rows: [["Salary bill", inr(staffStats.filter(x => x.workType === "Full-time").reduce((t, x) => t + x.salary, 0))], ["Share of staff", share(staffSummary.fullTime, staffSummary.total)]] },
                { label: "Part-Time", value: staffSummary.partTime, nav: "/staffs", state: { workType: "part-time" }, rows: [["Salary bill", inr(staffStats.filter(x => x.workType === "Part-time").reduce((t, x) => t + x.salary, 0))], ["Share of staff", share(staffSummary.partTime, staffSummary.total)]] },
                { label: "Salary Bill", value: `₹${staffSummary.totalSalaryBill.toLocaleString("en-IN")}`, nav: "/staffs", state: {}, rows: [["Per month", inr(staffSummary.totalSalaryBill)], ["Average per staff", inr(staffSummary.total ? staffSummary.totalSalaryBill / staffSummary.total : 0)], ["Highest", staffStats.length ? `${[...staffStats].sort((a, b) => b.salary - a.salary)[0].name.split(" ")[0]} · ${inr(Math.max(...staffStats.map(x => x.salary)))}` : "—"], ["Advance in range", inr(staffSummary.totalAdvance)], ["Deductions in range", inr(staffStats.reduce((t, x) => t + x.deduction, 0))]] },
                { label: "Avg Attendance", value: `${staffSummary.avgAttendance}%`, nav: "/staff-attendance", state: {}, rows: [["Present days", staffStats.reduce((t, x) => t + x.present, 0)], ["Leave days", staffStats.reduce((t, x) => t + x.leave, 0)], ["Absent days", staffStats.reduce((t, x) => t + x.absent, 0)], ["Staff below 50%", staffStats.filter(x => x.tracked > 0 && x.attPct < 50).length]] },
                { label: "Total Advance", value: `₹${staffSummary.totalAdvance.toLocaleString("en-IN")}`, nav: "/staffs", state: {}, rows: [["Staff with advance", staffStats.filter(x => x.advance > 0).length], ["Largest", staffStats.some(x => x.advance > 0) ? `${[...staffStats].sort((a, b) => b.advance - a.advance)[0].name.split(" ")[0]} · ${inr(Math.max(...staffStats.map(x => x.advance)))}` : "—"]] },
              ].map((k, i) => (
                <DxTip key={i} className="dx-kpi-cell" tip={<TipBox title={k.label} subtitle={staffRangeLabel} rows={k.rows} foot="Click to open" />}>
                  <div className="staff-kpi-card" style={{ cursor: "pointer" }} onClick={() => navigate(k.nav, { state: k.state })}>
                    <div><p>{k.label}</p><h3>{k.value}</h3></div>
                  </div>
                </DxTip>
              ))}
            </div>

            {/* STAFF CHARTS */}
            <div className="staff-charts-grid">
              <div className="chart-card sc-card">
                <div className="sc-card-head">
                  <h4>Attendance</h4>
                  <div className="sc-legend-pills">
                    <span className="sc-pill" style={{ "--c": "#1dd1a1" }}>Present</span>
                    <span className="sc-pill" style={{ "--c": "#ee5253" }}>Leave</span>
                    <span className="sc-pill" style={{ "--c": "#d1d5db" }}>Absent</span>
                  </div>
                </div>
                {attendanceBarData.length === 0 ? <NoChartData /> : (
                  <div className="sc-att-rows">
                    {attendanceBarData.map((s, i) => (
                      <DxTip key={i} tip={<TipBox title={s.fullName} subtitle={`${s.role} · ${staffRangeLabel}`} accent={STAFF_PALETTE[i % STAFF_PALETTE.length]} rows={attRows(s)} />}>
                      <div className="sc-att-row">
                        <div className="sc-att-dot" style={{ background: STAFF_PALETTE[i % STAFF_PALETTE.length] }}>{s.name.charAt(0)}</div>
                        <span className="sc-att-name">{s.name}</span>
                        <div className="sc-att-track">
                          <div className="sc-att-fill" style={{ width: `${s.pct}%`, background: s.pct >= 75 ? "#1dd1a1" : s.pct >= 50 ? "#ff9f43" : "#ee5253" }} />
                        </div>
                        <span className="sc-att-pct" style={{ color: s.pct >= 75 ? "#1dd1a1" : s.pct >= 50 ? "#ff9f43" : "#ee5253" }}>{s.pct}%</span>
                      </div>
                      </DxTip>
                    ))}
                  </div>
                )}
              </div>

              <div className="chart-card sc-card">
                <div className="sc-card-head">
                  <h4>Salary Distribution</h4>
                  <span className="sc-total-badge">₹{staffSummary.totalSalaryBill.toLocaleString("en-IN")}</span>
                </div>
                {salaryPieData.length === 0 ? <NoChartData /> : (
                  <div className="sc-salary-wrap">
                    <div className="sc-salary-pie"><ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={salaryPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={82} isAnimationActive animationDuration={700} activeIndex={activeSalIdx} activeShape={<SalaryActiveShape />} onMouseEnter={(_, i) => setActiveSalIdx(i)} onMouseLeave={() => setActiveSalIdx(null)}>
                          {salaryPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip content={<SalaryTooltip />} wrapperStyle={{ zIndex: 50, outline: "none" }} allowEscapeViewBox={{ x: true, y: true }} />
                      </PieChart>
                    </ResponsiveContainer></div>
                    <div className="sc-salary-legend">
                      <div className="sc-sal-header">
                        <span>Staff</span><span>Salary</span><span>Share</span>
                      </div>
                      <div className="sc-sal-rows">
                      {salaryPieData.map((s, i) => (
                        <DxTip key={i} tip={<TipBox title={s.fullName} subtitle={`${s.role} · ${s.workType}`} accent={s.color} rows={salaryRows(s)} />}>
                        <div className={`sc-sal-row ${activeSalIdx === i ? "sc-sal-active" : ""}`} onMouseEnter={() => setActiveSalIdx(i)} onMouseLeave={() => setActiveSalIdx(null)}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span className="sc-sal-dot" style={{ background: s.color }} />
                            <span className="sc-sal-name">{s.name}</span>
                          </div>
                          <span className="sc-sal-amount">₹{Number(s.value).toLocaleString("en-IN")}</span>
                          <span className="sc-sal-pct-val">{staffSummary.totalSalaryBill > 0 ? Math.round((s.value / staffSummary.totalSalaryBill) * 100) : 0}%</span>
                        </div>
                        </DxTip>
                      ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="chart-card sc-card">
                <div className="sc-card-head">
                  <h4>Grooming Compliance</h4>
                  <span className="sc-week-badge">{rangeTouched ? "Selected range" : "This month"}</span>
                </div>
                {groomBarData.length === 0 ? <NoChartData /> : (
                  <div className="sc-groom-list">
                    {groomBarData.map((g, i) => (
                      <DxTip key={i} tip={<TipBox title={g.fullName} subtitle={`${g.role} · ${staffRangeLabel}`} accent={g.color} rows={[["Days passed", `${g.passed} of ${g.total}`], ["Compliance", `${g.value}%`, g.value >= 80 ? "good" : g.value < 50 ? "bad" : undefined]]} foot="Passed = uniform, shoes and grooming all OK" />}>
                      <div className="sc-groom-row">
                        <div className="sc-groom-avatar" style={{ background: g.color }}>{g.name.charAt(0)}</div>
                        <span className="sc-groom-name">{g.name}</span>
                        <div className="sc-groom-track">
                          <div className="sc-groom-fill" style={{ width: `${g.value}%`, background: g.value >= 80 ? "#1dd1a1" : g.value >= 50 ? "#ff9f43" : "#ee5253" }} />
                        </div>
                        <div className="sc-groom-badge" style={{ background: g.value >= 80 ? "#dcfce7" : g.value >= 50 ? "#fff7e0" : "#fee2e2", color: g.value >= 80 ? "#16a34a" : g.value >= 50 ? "#d97706" : "#dc2626" }}>
                          {g.value}%
                        </div>
                      </div>
                      </DxTip>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        </div>
      )}

      {/* SCHEDULES TAB */}
      {activeTab === "schedules" && (
        <div className="dashboard-scroll">
          <div className="schedule-charts-grid">
            <div className="chart-card sc-card sc-schedules-card">
              <div className="sc-card-head">
                <h4>Schedules Overview</h4>
              </div>
              <ScheduleSection adminData={adminData} navigate={navigate} />
            </div>
          </div>
        </div>
      )}

      {/* WORK PLAN TAB — Super Admin only (this whole component is only
          reachable by Super Admin via Dashboard.js's routing) */}
      {activeTab === "workplan" && (
        <div className="dashboard-scroll">
          <WorkPlan adminData={adminData} setAdminData={setAdminData} />
        </div>
      )}
    </div>
  );
};

export default SalesDashboard;
import { motion, AnimatePresence } from "framer-motion";
import { NavLink, useLocation } from "react-router-dom";
import "./Sidebar.css";
import dashboardIcon from "../../icon/dashboard.png";
import categoriesIcon from "../../icon/categories.png";
import dishesIcon from "../../icon/dishes.png";
import ingredientsIcon from "../../icon/ingredients.png";
import stocksIcon from "../../icon/stocks.png";
import comboIcon from "../../icon/combo.png";
import favouritesIcon from "../../icon/favourites.png";
import ordersIcon from "../../icon/orders.png";
import paymentsIcon from "../../icon/payments.png";
import todoIcon from "../../icon/todo.png";
import memosIcon from "../../icon/memos.png";
import eventsIcon from "../../icon/events.png";
import reservationsIcon from "../../icon/reservations.png";
import celebrationsIcon from "../../icon/celebrations.png";
import preBookingsIcon from "../../icon/pre-bookings.png";
import cateringIcon from "../../icon/catering.png";
import usersIcon from "../../icon/users.png";
import allUsersIcon from "../../icon/all-users.png";
import loyaltySettingsIcon from "../../icon/loyalty-settings.png";
import staffIcon from "../../icon/staff.png";
import allStaffIcon from "../../icon/all-staff.png";
import attendanceIcon from "../../icon/attendance.png";
import salaryIcon from "../../icon/salary.png";
import careerIcon from "../../icon/career.png";
import trainingIcon from "../../icon/training.png";
import kitchenIcon from "../../icon/kitchen.png";
import recipeIcon from "../../icon/recipe.png";
import groomingIcon from "../../icon/grooming.png";
import staffAssigningIcon from "../../icon/staff-assigning.png";
import miseCleaningIcon from "../../icon/mise-cleaning.png";
import activityLogIcon from "../../icon/activity-log.png";
import schedulesIcon from "../../icon/schedules.png";
import reportsIcon from "../../icon/reports.png";
import serviceIcon from "../../icon/service.png";
import serviceGroomingIcon from "../../icon/service-grooming.png";
import serviceStaffAssigningIcon from "../../icon/service-staff-assigning.png";
import serviceMiseCleaningIcon from "../../icon/service-mise-cleaning.png";
import serviceActivityLogIcon from "../../icon/service-activity-log.png";
import serviceSchedulesIcon from "../../icon/service-schedules.png";
import tablesIcon from "../../icon/tables.png";
import serviceReportsIcon from "../../icon/service-reports.png";
import offersIcon from "../../icon/offers.png";
import venuesIcon from "../../icon/venues.png";
import rolesResponsibilitiesIcon from "../../icon/roles-responsibilities.png";
import categoryCardsIcon from "../../icon/category-cards.png";
import auditLogsIcon from "../../icon/audit-logs.png";
import documentsIcon from "../../icon/documents.png";
import bankAccountsIcon from "../../icon/bank-accounts.png";
import themeSettingsIcon from "../../icon/theme-settings.png";
import supportIcon from "../../icon/chat.png"; // Support & Complaints (no dedicated icon in the old set)
import logo from "../../icon/logo.png";
import logoShrink from "../../icon/logo-shrink.png";
import React, { useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useCategoryCards } from "../../context/CategoryCardsContext";

const BASE_MENU = [
  { label: "Dashboard", path: "/", icon: dashboardIcon },
  { label: "Categories", path: "/categories", icon: categoriesIcon, module: "categories" },
  { label: "Dishes", path: "/dishes", icon: dishesIcon, module: "categories" },
  { label: "Ingredients", path: "/ingredients", icon: ingredientsIcon, module: "ingredients" },
  { label: "Stocks", path: "/stocks", icon: stocksIcon, module: "ingredients" },
  {
    label: "Purchase & Inventory",
    icon: stocksIcon,
    children: [
      { label: "Suppliers", path: "/inventory/suppliers", icon: usersIcon, module: "suppliers" },
      { label: "Inventory Items", path: "/inventory/items", icon: ingredientsIcon, module: "inventoryItems" },
      { label: "Storage Locations", path: "/inventory/locations", icon: venuesIcon, module: "inventoryItems" },
      { label: "Stock Overview", path: "/inventory/stock", icon: stocksIcon, module: "inventoryStock" },
      { label: "Stock Ledger", path: "/inventory/ledger", icon: reportsIcon, module: "stockLedger" },
      { label: "Purchase Requests", path: "/purchase/requests", icon: ordersIcon, module: "purchaseRequests" },
      { label: "Reorder Planning", path: "/purchase/reorder", icon: stocksIcon, module: "purchaseRequests" },
      { label: "RFQs & Quotations", path: "/purchase/rfqs", icon: reportsIcon, module: "purchaseRfq" },
      { label: "Purchase Orders", path: "/purchase/orders", icon: ordersIcon, module: "purchaseOrders" },
      { label: "Goods Receipts", path: "/purchase/receipts", icon: stocksIcon, module: "purchaseReceiving" },
      { label: "Returns & Quarantine", path: "/purchase/returns", icon: ordersIcon, module: "purchaseReturns" },
      { label: "Supplier Invoices", path: "/purchase/invoices", icon: paymentsIcon, module: "purchaseInvoices" },
      { label: "Supplier Payments", path: "/purchase/payments", icon: paymentsIcon, module: "purchasePayments" },
      { label: "Purchase Reports", path: "/purchase/reports", icon: reportsIcon, module: "purchaseReports" },
      { label: "Inventory Alerts", path: "/inventory/alerts", icon: stocksIcon, module: "inventoryAlerts" },
      { label: "Stock Audits", path: "/inventory/audits", icon: reportsIcon, module: "stockAudits" },
      { label: "Forecast & Usage", path: "/inventory/forecast", icon: reportsIcon, module: "inventoryAlerts" },
      { label: "Supplier Scorecards", path: "/purchase/scorecards", icon: usersIcon, module: "supplierScorecards" },
      { label: "WhatsApp Purchase List", path: "/purchase/whatsapp", icon: ordersIcon, module: "purchaseWhatsapp" },
      { label: "Purchase Settings", path: "/purchase/settings", icon: reportsIcon, module: "purchaseSettings" },
      { label: "Automation Settings", path: "/purchase/automation", icon: reportsIcon, module: "purchaseSettings" },
    ],
  },
  { label: "Combo", path: "/combo-offers", icon: comboIcon, module: "combo_offers", cardKey: "combo" },
  { label: "Favourites", path: "/favourites", icon: favouritesIcon, module: "favourites" },
  { label: "Orders", path: "/orders", icon: ordersIcon, module: "orders" },
  { label: "Payments", path: "/payments", icon: paymentsIcon, module: "payments" },
  { label: "To-Do", path: "/todo", icon: todoIcon },
  { label: "Memos", path: "/memos", icon: memosIcon, planModule: "memos" },
  { label: "Support & Complaints", path: "/support", icon: supportIcon, module: "supportTickets", planModule: "supportTickets" },
  {
    label: "Events",
    icon: eventsIcon,
    module: "events",
    cardKey: "events",
    children: [
      { label: "Events", path: "/events", icon: eventsIcon },
      { label: "Reservations", path: "/reservations", icon: reservationsIcon },
      { label: "Celebrations", path: "/celebrations", icon: celebrationsIcon },
      { label: "Pre Bookings", path: "/prebookings", icon: preBookingsIcon },
      { label: "Catering", path: "/catering", icon: cateringIcon },
    ],
  },
  {
    label: "Users",
    icon: usersIcon,
    module: "users",
    children: [
      { label: "All Users", path: "/users", icon: allUsersIcon },
      { label: "Loyalty Settings", path: "/users-loyalty-settings", icon: loyaltySettingsIcon },
    ],
  },
  {
    label: "Staff",
    icon: staffIcon,
    module: "staff",
    children: [
      { label: "All Staff", path: "/staffs", icon: allStaffIcon },
      { label: "Attendance", path: "/staff-attendance", icon: attendanceIcon },
      { label: "Salary", path: "/staff-salary", icon: salaryIcon },
      { label: "Career", path: "/staff-career", icon: careerIcon },
      { label: "Training", path: "/staff-training", icon: trainingIcon },
    ],
  },
  {
    label: "Kitchen",
    icon: kitchenIcon,
    department: "kitchen",
    planModule: "kitchenActivity",
    children: [
      { label: "Recipe", path: "/kitchen-recipe", icon: recipeIcon },
      { label: "Grooming", path: "/kitchen-grooming", icon: groomingIcon },
      { label: "Staff Assigning", path: "/kitchen-assign", icon: staffAssigningIcon },
      { label: "Mise & Cleaning", path: "/kitchen-mise", icon: miseCleaningIcon },
      { label: "Activity Log", path: "/kitchen-activity", icon: activityLogIcon },
      { label: "Schedules", path: "/kitchen-schedules", icon: schedulesIcon },
      { label: "Reports", path: "/kitchen-reports", icon: reportsIcon },
    ],
  },
  {
    label: "Service",
    icon: serviceIcon,
    department: "service",
    children: [
      { label: "Grooming", path: "/service-grooming", planModule: "serviceGrooming", icon: serviceGroomingIcon },
      { label: "Staff Assigning", path: "/service-assign", planModule: "serviceAssign", icon: serviceStaffAssigningIcon },
      { label: "Mise & Cleaning", path: "/service-mise", planModule: "serviceMise", icon: serviceMiseCleaningIcon },
      { label: "Activity Log", path: "/service-activity", planModule: "serviceActivity", icon: serviceActivityLogIcon },
      { label: "Schedules", path: "/service-schedules", planModule: "serviceSchedules", icon: serviceSchedulesIcon },
      { label: "Tables", path: "/tables", planModule: "tables", icon: tablesIcon },
      { label: "Reports", path: "/service-reports", planModule: "serviceActivity", icon: serviceReportsIcon },
    ],
  },
  { label: "Offers", path: "/offers", icon: offersIcon, module: "offers", cardKey: "offers" },
  { label: "Venues", path: "/venues", icon: venuesIcon, superAdminOnly: true, planModule: "venues" },
  { label: "Roles and Responsibilities", path: "/permissions", icon: rolesResponsibilitiesIcon, superAdminOnly: true, planModule: "permissions" },
  { label: "Category Cards", path: "/category-cards", icon: categoryCardsIcon, superAdminOnly: true, planModule: "categoryCards" },
  { label: "Audit Logs", path: "/audit-logs", icon: auditLogsIcon, superAdminOnly: true, planModule: "auditLogs" },
  { label: "Documents", path: "/documents", icon: documentsIcon, superAdminOnly: true, planModule: "documents" },
  { label: "Bank Accounts", path: "/bank-account", icon: bankAccountsIcon, superAdminOnly: true, planModule: "bankAccount" },
  { label: "Theme Settings", path: "/theme-settings", icon: themeSettingsIcon, superAdminOnly: true, planModule: "theme" },
];

// Inline defaults so sub-link icons look right even before any CSS is added.
// Override with .sublink-icon-img in Sidebar.css if you want.
const SUBLINK_ICON_STYLE = { width: 18, height: 18, flexShrink: 0, marginRight: 10, verticalAlign: "middle" };

const HOVER_CLOSE_DELAY = 120; // ms grace period so moving link -> menu doesn't flicker-close

// Positions the floating submenu next to a collapsed sidebar-link, clamped
// to stay within the viewport vertically.
const computeHoverPosition = (index, rect) => {
  const dropdownHeight = 220; // approx height
  const viewportHeight = window.innerHeight;

  let top = rect.top;
  if (top + dropdownHeight > viewportHeight - 10) {
    top = viewportHeight - dropdownHeight - 10;
  }
  if (top < 10) {
    top = 10;
  }

  return { index, top, left: rect.right + 8 };
};

const Sidebar = ({ isOpen, setIsOpen }) => {
  const [openMenu, setOpenMenu] = useState(null);
  const [hoverMenu, setHoverMenu] = useState(null);
  const location = useLocation();
  const closeTimerRef = React.useRef(null);
  const { admin, isSuperAdmin, hasModulePermission, isModuleInPlan, subscription } = useAuth();
  const { isComboEnabled, isOffersEnabled, isEventsEnabled } = useCategoryCards();

  // Whether a card-gated item's underlying card is enabled. Combo/Offers/
  // Events are hidden from BOTH panels when their card is disabled — that
  // decision lives with the Super Admin via the Category Cards page and
  // applies here regardless of role, including Super Admin themself, so
  // the module truly disappears rather than just being hidden from staff.
  const CARD_ENABLED = {
    combo: isComboEnabled,
    offers: isOffersEnabled,
    events: isEventsEnabled,
  };

  // Build the visible menu for this admin:
  //  - Card-gated items (Combo/Offers/Events) are dropped for everyone,
  //    including Super Admin, whenever their category card is disabled.
  //  - Super Admin: sees everything else, including the admin-only screens
  //  - Everyone else: department-gated items (Kitchen/Service) only show
  //    for their own department; module-gated items only show if their
  //    roleTitle has at least read access per the permission matrix;
  //    superAdminOnly items never show.
  const menu = useMemo(() => {
    // Modules outside the restaurant's plan disappear for everyone, Super
    // Admin included (they can upgrade from Manage plan in the banner).
    const inPlan = (x) => isModuleInPlan(x.module || x.planModule || "") || !(x.module || x.planModule);
    const cardFiltered = BASE_MENU
      .filter((item) => !item.cardKey || CARD_ENABLED[item.cardKey] !== false)
      .filter(inPlan)
      .map((item) => (item.children ? { ...item, children: item.children.filter(inPlan) } : item))
      .filter((item) => !item.children || item.children.length > 0);
    if (isSuperAdmin) return cardFiltered;
    // children may carry their own module: show only the ones this role can read
    const withChildAccess = cardFiltered
      .map((item) => (item.children
        ? { ...item, children: item.children.filter((c) => !c.module || hasModulePermission(c.module, "read")) }
        : item))
      .filter((item) => !item.children || item.children.length > 0);
    return withChildAccess.filter((item) => {
      if (item.superAdminOnly) return false;
      if (item.department && item.department !== admin?.department) return false;
      if (item.module && !hasModulePermission(item.module, "read")) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, admin, hasModulePermission, isModuleInPlan, isComboEnabled, isOffersEnabled, isEventsEnabled]);

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      setHoverMenu(null);
      closeTimerRef.current = null;
    }, HOVER_CLOSE_DELAY);
  };

  React.useEffect(() => () => cancelClose(), []);

  // Auto-open submenu if a child route is active
  React.useEffect(() => {
    menu.forEach((item, index) => {
      if (item.children) {
        const isChildActive = item.children.some(
          (child) => location.pathname === child.path || location.pathname.startsWith(child.path + "/")
        );
        if (isChildActive) setOpenMenu(index);
      }
    });
  }, [location.pathname, menu]);

  // Auto-collapse the sidebar on narrow screens (<578px)
  React.useEffect(() => {
    const AUTO_COLLAPSE_BREAKPOINT = 578;

    const handleResize = () => {
      if (window.innerWidth < AUTO_COLLAPSE_BREAKPOINT) {
        setIsOpen(false);
      }
    };

    // Check on mount in case the page already loads narrow
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setIsOpen]);

  return (
    <motion.aside
      className="sidebar"
      initial={false}
      animate={{ width: isOpen ? 248 : 72 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* ── BRAND ── */}
      <div
        className="sidebar-brand"
        onClick={() => setIsOpen((prev) => !prev)}
        data-bs-toggle="tooltip"
        data-bs-placement="right"
        data-bs-title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        <div className="brand-icon-wrap">
          <img src={logoShrink} alt="Dishky" className="brand-icon-img" />
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="brand-logo-wrap"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
            >
              <img src={logo} alt="Dishky" className="brand-logo-img" />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="sidebar-toggle-icon"
          animate={{ rotate: isOpen ? 0 : 180 }}
          transition={{ duration: 0.3 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </div>

      {/* ── NAV ── */}
      <nav className="sidebar-nav">
        <div className="sidebar-menu">
          {menu.map((item, index) => {
            if (item.children) {
              const isAnyChildActive = item.children.some(
                (child) => location.pathname === child.path || location.pathname.startsWith(child.path + "/")
              );
              const isExpanded = openMenu === index;

              return (
                <div key={index} className="sidebar-group">
                  <button
                    className={`sidebar-link ${isAnyChildActive ? "sidebar-link-active" : ""}`}
                    onClick={(e) => {
                      if (isOpen) {
                        setOpenMenu(isExpanded ? null : index);
                      } else {
                        // Stage 4: clicking the trigger toggles the
                        // floating menu open/closed in collapsed mode.
                        cancelClose();
                        setHoverMenu((prev) =>
                          prev?.index === index ? null : computeHoverPosition(index, e.currentTarget.getBoundingClientRect())
                        );
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (!isOpen) {
                        cancelClose();
                        setHoverMenu(computeHoverPosition(index, e.currentTarget.getBoundingClientRect()));
                      }
                    }}
                    onMouseLeave={() => {
                      if (!isOpen) {
                        // Stage 3: unhovering the trigger schedules a close;
                        // moving onto the floating menu cancels it (stage 1
                        // then governs when it actually closes).
                        scheduleClose();
                      }
                    }}
                  >
                    <span className="sidebar-icon-wrap">
                      <img src={item.icon} alt="" className="sidebar-icon-img" />
                    </span>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.span
                          className="sidebar-label"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {isOpen && (
                      <motion.span
                        className="sidebar-chevron"
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.22 }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </motion.span>
                    )}
                  </button>

                  <AnimatePresence>
                    {/* NORMAL EXPAND */}
                    {isOpen && isExpanded && (
                      <motion.div
                        className="sidebar-submenu"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                      >
                        <div className="sidebar-submenu-inner">
                          {item.children.map((sub) => (
                            <NavLink
                              key={sub.path}
                              to={sub.path}
                              className={({ isActive }) =>
                                `sidebar-sublink ${isActive ? "sublink-active" : ""}`
                              }
                            >
                              <img src={sub.icon} alt="" className="sublink-icon-img" style={SUBLINK_ICON_STYLE} />
                              <span className="sublink-label">{sub.label}</span>
                            </NavLink>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* FLOATING DROPDOWN */}
                    {!isOpen && hoverMenu?.index === index && (
                      <div
                        className="sidebar-floating-menu"
                        style={{
                          top: hoverMenu.top,
                          left: hoverMenu.left
                        }}
                        onMouseEnter={cancelClose}
                        onMouseLeave={scheduleClose}
                      >
                        {item.children.map((sub) => (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            className={({ isActive }) =>
                              `sidebar-sublink ${isActive ? "sublink-active" : ""}`
                            }
                            onClick={() => {
                              cancelClose();
                              setHoverMenu(null);
                            }}
                          >
                            <img src={sub.icon} alt="" className="sublink-icon-img" style={SUBLINK_ICON_STYLE} />
                            <span className="sublink-label">{sub.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
                }
                {...(!isOpen ? { "data-bs-toggle": "tooltip", "data-bs-placement": "right", "data-bs-title": item.label } : {})}
              >
                <span className="sidebar-icon-wrap">
                  <img src={item.icon} alt="" className="sidebar-icon-img" />
                </span>

                <AnimatePresence>
                  {isOpen && (
                    <motion.span
                      className="sidebar-label"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* ── FOOTER ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="sidebar-footer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="sidebar-footer-inner">
              <div className="sidebar-footer-info">
                <span className="sidebar-footer-name">{subscription?.restaurant?.name || "Dishky"}</span>
                <span className="sidebar-footer-role">Admin Panel</span>
              </div>
              {isSuperAdmin && (
                <a
                  className="sidebar-upgrade"
                  href={subscription?.manageUrl || "https://www.dishky.com/account/billing"}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Upgrade plan"
                  data-bs-toggle="tooltip"
                  data-bs-placement="top"
                  data-bs-title="Upgrade plan"
                >
                  <svg className="sidebar-upgrade-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" />
                  </svg>
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
};

export default Sidebar;
import { lazy } from "react";

// Each module page shows one interactive demo. Lazy-loaded so the home page
// and other pages don't pay for demos they don't show.
const demos = {
  QrOrderingDemo: lazy(() => import("./QrOrderingDemo.js")),
  OrdersDemo: lazy(() => import("./OrdersDemo.js")),
  KitchenDisplayDemo: lazy(() => import("./KitchenDisplayDemo.js")),
  KitchenManagementDemo: lazy(() => import("./KitchenManagementDemo.js")),
  ServiceManagementDemo: lazy(() => import("./ServiceManagementDemo.js")),
  GuestManagementDemo: lazy(() => import("./GuestManagementDemo.js")),
  InventoryDemo: lazy(() => import("./InventoryDemo.js")),
  MenuDemo: lazy(() => import("./MenuDemo.js")),
  PaymentsDemo: lazy(() => import("./PaymentsDemo.js")),
  AnalyticsDemo: lazy(() => import("./AnalyticsDemo.js")),
  StaffRolesDemo: lazy(() => import("./StaffRolesDemo.js")),
  MultiBranchDemo: lazy(() => import("./MultiBranchDemo.js")),
  PromotionsDemo: lazy(() => import("./PromotionsDemo.js")),
  EventsDemo: lazy(() => import("./EventsDemo.js")),
};
export default demos;

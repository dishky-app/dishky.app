import KdsBoard from "./KdsBoard.js";
import OrderFlow from "./OrderFlow.js";
import StockSim from "./StockSim.js";
import RolesSim from "./RolesSim.js";
import BranchCompare from "./BranchCompare.js";
import PromoCarousel from "./PromoCarousel.js";
import PromoReach from "./PromoReach.js";
import EventBuilder from "./EventBuilder.js";
import BookingPlanner from "./BookingPlanner.js";
import PaymentsLedger from "./PaymentsLedger.js";
import QrPhone from "./QrPhone.js";
import LoyaltyTiers from "./LoyaltyTiers.js";
import CampaignChat from "./CampaignChat.js";
import StaffRoster from "./StaffRoster.js";
import FloorPlan from "./FloorPlan.js";
import MenuToggle from "./MenuToggle.js";
import AnalyticsDash from "./AnalyticsDash.js";
import TodoBoard from "./TodoBoard.js";
import Memos from "./Memos.js";
import Assign from "./Assign.js";
import AuditFeed from "./AuditFeed.js";

/** Widget registry: module config refers to these by name. */
const widgets = {
  kds: KdsBoard, orderflow: OrderFlow, stock: StockSim, roles: RolesSim, branches: BranchCompare,
  promo: PromoCarousel, reach: PromoReach, event: EventBuilder, booking: BookingPlanner,
  payments: PaymentsLedger, qr: QrPhone, loyalty: LoyaltyTiers, campaign: CampaignChat,
  staff: StaffRoster, tables: FloorPlan, menu: MenuToggle, analytics: AnalyticsDash,
  todo: TodoBoard, memos: Memos, assign: Assign, audit: AuditFeed,
};

export function Widget({ type, props = {}, dark = false }) {
  const C = widgets[type];
  return C ? <C dark={dark} {...props} /> : null;
}
export default widgets;

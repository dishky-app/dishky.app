import React from "react";
import { ClipboardCheck, Sparkles } from "lucide-react";
import { KdsDemo, LiveOrderDemo, TablesDemo, InventoryDemo, PaymentsDemo } from "./demosOps.js";
import {
  PromoDemo, EventsDemo, StaffDemo, LoyaltyDemo, AnalyticsDemo, BranchDemo, RolesDemo, MenuDemo,
  GuestAppDemo, ChecklistDemo, BackOfficeDemo,
} from "./demosBiz.js";
import {
  ReservationsDemo, CelebrationsDemo, CateringDemo, PreBookDemo, AttendanceDemo, SalaryDemo, CareersDemo,
  OffersDemo, GuestsDemo, TrackingDemo, KmsDemo, SmsDemo,
} from "./demosMore.js";
import { Window } from "../ui/kit.js";

const kitchenItems = [
  "Prep station set up",
  "Sauces and stocks ready",
  "Fridge temperatures logged",
  "Grooming check done",
  "Stations cleaned and signed off",
];
const serviceItems = [
  "Tables wiped and laid",
  "Menus and QR codes checked",
  "Staff grooming check",
  "Section assignments confirmed",
  "Closing clean signed off",
];

/** key -> element. A demo key in data/modules.js picks its interactive here. */
export const demoFor = {
  kds: () => <KdsDemo />,
  orders: () => <LiveOrderDemo />,
  tables: () => <TablesDemo />,
  inventory: () => <InventoryDemo />,
  payments: () => <PaymentsDemo />,
  promo: () => <PromoDemo />,
  events: () => <EventsDemo />,
  staff: () => <StaffDemo />,
  loyalty: () => <LoyaltyDemo />,
  analytics: () => <AnalyticsDemo />,
  branches: () => <BranchDemo />,
  roles: () => <RolesDemo />,
  menu: () => <MenuDemo />,
  guest: () => <GuestAppDemo />,
  backoffice: () => <BackOfficeDemo />,
  reservations: () => <ReservationsDemo />,
  celebrations: () => <CelebrationsDemo />,
  catering: () => <CateringDemo />,
  prebook: () => <PreBookDemo />,
  attendance: () => <AttendanceDemo />,
  salary: () => <SalaryDemo />,
  careers: () => <CareersDemo />,
  offers: () => <OffersDemo />,
  guests: () => <GuestsDemo />,
  tracking: () => <TrackingDemo />,
  kms: () => <KmsDemo />,
  sms: () => <SmsDemo />,
  kitchenChecklist: () => <ChecklistDemo title="Kitchen · Mise & cleaning" items={kitchenItems} icon={ClipboardCheck} />,
  serviceChecklist: () => <ChecklistDemo title="Service · Opening routine" items={serviceItems} icon={Sparkles} />,
};

export function Demo({ name }) {
  const f = demoFor[name];
  return f ? f() : <Window title="Dishky" />;
}

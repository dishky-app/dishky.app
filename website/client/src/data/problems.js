import { BellRing, Boxes, ShieldCheck, Wallet, CalendarDays, GitBranch, ScanLine, ScrollText, Salad, Smartphone } from "lucide-react";
import { images } from "../assets/images/imageUrls.js";

// Each card shows the pain (grey, struck through) turning into the fix.
// Two or three words each: the photo and the motion carry the rest.
export const adminProblems = [
  { icon: BellRing, pain: "Lost orders", fix: "One live board", img: images.serviceOrder, art: "p-lost" },
  { icon: Boxes, pain: "Surprise stock-outs", fix: "Low-stock alerts", img: images.foodSpread, art: "p-stock" },
  { icon: ShieldCheck, pain: "Open access", fix: "Roles per module", img: images.kitchenAction, art: "p-access" },
  { icon: Wallet, pain: "Cash that never adds up", fix: "Paid or pending, always", img: images.servicePay, art: "p-cash" },
  { icon: CalendarDays, pain: "Double-booked tables", fix: "One shared schedule", img: images.restaurantTable, art: "p-double" },
  { icon: GitBranch, pain: "Can't be everywhere", fix: "All branches, one login", img: images.dining, art: "p-branches" },
];

export const guestProblems = [
  { icon: ScanLine, pain: "Waiting for a menu", fix: "Scan and order", img: images.dishBiryani, art: "p-menu" },
  { icon: ScrollText, pain: "“Where's my food?”", fix: "Live tracking", img: images.serviceServe, art: "p-food" },
  { icon: Salad, pain: "What's in this dish?", fix: "Ingredients shown", img: images.salad, art: "p-ingredients" },
  { icon: Smartphone, pain: "Waiting for the bill", fix: "Pay from the phone", img: images.dishDessert, art: "p-bill" },
];


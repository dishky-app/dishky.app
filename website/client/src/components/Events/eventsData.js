import {
  UtensilsCrossed, ChefHat, Sparkles, Store, PartyPopper, Handshake,
  ClipboardList, Users, Megaphone, QrCode, Camera, CalendarCheck,
} from "lucide-react";

// Single source of truth for the event-collaboration story. Short on purpose.
export const eventTypes = [
  { icon: UtensilsCrossed, title: "Tasting nights", text: "Curated menus, ticketed." },
  { icon: ChefHat, title: "Chef’s table", text: "Small, special evenings." },
  { icon: Sparkles, title: "Festive menus", text: "Festivals as events." },
  { icon: Store, title: "Pop-ups", text: "A shared stage." },
  { icon: PartyPopper, title: "Launch parties", text: "New menu, new branch." },
  { icon: Handshake, title: "Brand tie-ups", text: "Joint nights with brands." },
];

export const eventSteps = [
  { n: "01", icon: ClipboardList, title: "Share your idea" },
  { n: "02", icon: Users, title: "Plan it together" },
  { n: "03", icon: Megaphone, title: "Dishky promotes it" },
  { n: "04", icon: QrCode, title: "Run it on Dishky" },
  { n: "05", icon: Camera, title: "Recap and keep" },
];

export const eventPowers = [
  { icon: QrCode, title: "QR ordering on the night" },
  { icon: CalendarCheck, title: "Bookings built in" },
  { icon: Users, title: "Roles and branches" },
];

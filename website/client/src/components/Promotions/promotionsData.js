import { Megaphone, Handshake, CalendarHeart, BadgePercent } from "lucide-react";

// Single source of truth for the promotions story (homepage section and the
// promotions page). Short on purpose: the visuals carry the message.
export const promoOfferings = [
  { icon: Megaphone, title: "Featured on Dishky", text: "In front of our audience." },
  { icon: Handshake, title: "Co-created content", text: "Posts and reels, made with you." },
  { icon: BadgePercent, title: "Offers amplified", text: "Specials go further." },
  { icon: CalendarHeart, title: "Events promoted", text: "Announced to everyone." },
];

export const promoSteps = [
  { n: "01", title: "Share your story" },
  { n: "02", title: "Plan it together" },
  { n: "03", title: "Dishky publishes" },
  { n: "04", title: "Guests order" },
];

export const promoFormats = [
  "Restaurant spotlights",
  "Dish and menu features",
  "Offer announcements",
  "Launch campaigns",
  "Event promotion",
  "Joint content",
];

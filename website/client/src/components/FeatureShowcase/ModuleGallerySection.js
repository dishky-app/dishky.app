import React from "react";
import HorizontalFeatureGallery from "../Showcase/HorizontalFeatureGallery.js";
import { artFor } from "../ui/Art.js";
import { bySlug } from "../../data/modules.js";

// The wider ecosystem as a product tour.
const tour = [
  ["guest-app", "Guest experience"], ["menu", "Guest experience"], ["promotions", "Growth"], ["kitchen", "Operations"],
  ["inventory", "Operations"], ["reservations", "Bookings & events"], ["guests", "Growth"], ["roles", "People & management"],
  ["branches", "Management"], ["analytics", "Insight"],
];
const items = tour.map(([slug, kicker]) => {
  const m = bySlug[slug];
  return { id: slug, kicker, title: m.name, text: m.short, to: m.path, art: artFor[slug], photo: m.photo, demo: m.demo };
});

export default function ModuleGallerySection() {
  return <HorizontalFeatureGallery items={items} title={"A TOUR OF\nTHE WHOLE PLATFORM."} />;
}

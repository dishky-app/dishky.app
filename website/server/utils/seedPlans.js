import dotenv from "dotenv";
import connectAtlas from "../config/atlas.js";
import Plan from "../models/Plan.js";
import mongoose from "mongoose";

dotenv.config();

const plans = [
  {
    name: "Essential",
    tagline: "For smaller restaurants and cafés",
    monthlyPrice: 999,
    yearlyPrice: 9990,
    currency: "INR",
    features: [
      "Dishky User Panel",
      "QR ordering",
      "Digital menu",
      "Basic order management",
      "Basic dashboard",
      "Single branch",
    ],
    mostPopular: false,
    ctaLabel: "Get Started",
    order: 1,
    active: true,
  },
  {
    name: "Professional",
    tagline: "For growing restaurants",
    monthlyPrice: 2999,
    yearlyPrice: 29990,
    currency: "INR",
    features: [
      "Everything in Essential",
      "Advanced order management",
      "Inventory management",
      "Staff management",
      "Reservations & events",
      "Guest Management (GMS)",
      "Kitchen Management (KMS)",
      "Service Management (SMS)",
      "Advanced analytics",
      "Multiple staff accounts",
    ],
    mostPopular: true,
    ctaLabel: "Choose Professional",
    order: 2,
    active: true,
  },
  {
    name: "Premium",
    tagline: "For multi-outlet restaurants",
    monthlyPrice: 5999, // placeholder: keep in sync with the fallback plans in client/src/components/PricingCard/PricingSection.js
    yearlyPrice: 59990,
    currency: "INR",
    features: [
      "Everything in Professional",
      "Multi-branch management",
      "Advanced roles & permissions",
      "Offers & promotions",
      "Advanced analytics",
    ],
    mostPopular: false,
    ctaLabel: "Choose Premium",
    order: 3,
    active: true,
  },
  {
    name: "Custom",
    tagline: "For restaurant groups and chains",
    monthlyPrice: 0, // placeholder — contact sales
    yearlyPrice: 0,
    currency: "INR",
    features: [
      "Everything in Premium",
      "Centralized management",
      "Advanced analytics",
      "Custom workflows",
      "Priority support",
      "Custom integrations",
    ],
    mostPopular: false,
    ctaLabel: "Talk to Sales",
    order: 4,
    active: true,
  },
];

const run = async () => {
  await connectAtlas();

  // Plans were renamed over time (Growth/Sizzle -> Professional, Enterprise/Banquet -> Custom,
  // Starter -> Essential, Pro -> Premium): update the old records in place instead of creating duplicates.
  const LEGACY = {
    Essential: ["Starter"],
    Professional: ["Sizzle", "Growth"],
    Premium: ["Pro"],
    Custom: ["Banquet", "Enterprise"],
  };
  for (const plan of plans) {
    const legacy = LEGACY[plan.name] || [];
    if (legacy.length) await Plan.updateMany({ name: { $in: legacy } }, { $set: { name: plan.name } });
    await Plan.findOneAndUpdate({ name: plan.name }, plan, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    console.log(`[seed] Upserted plan: ${plan.name}`);
  }

  console.log("[seed] Done.");
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});

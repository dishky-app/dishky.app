import React from "react";
import Hero from "../components/Hero/Hero.js";
import WhatIsDishky from "../components/FeatureShowcase/WhatIsDishky.js";
import ImageStorySection from "../components/FeatureShowcase/ImageStorySection.js";
import ProblemSection from "../components/FeatureShowcase/ProblemSection.js";
import DailyProblemsSection from "../components/FeatureShowcase/DailyProblemsSection.js";
import BeforeAfterSection from "../components/FeatureShowcase/BeforeAfterSection.js";
import TransitionSection from "../components/FeatureShowcase/TransitionSection.js";
import PromotionsSection from "../components/FeatureShowcase/PromotionsSection.js";
import EventCollabSection from "../components/FeatureShowcase/EventCollabSection.js";
import QrOrderingSection from "../components/FeatureShowcase/QrOrderingSection.js";
import UserPanelSection from "../components/UserPanelPreview/UserPanelSection.js";
import AdminPanelSection from "../components/AdminPanelPreview/AdminPanelSection.js";
import RolesPermissionsSection from "../components/FeatureShowcase/RolesPermissionsSection.js";
import MultiBranchSection from "../components/FeatureShowcase/MultiBranchSection.js";
import BusinessBenefitsSection from "../components/FeatureShowcase/BusinessBenefitsSection.js";
import FeatureSpotlight from "../components/FeatureShowcase/FeatureSpotlight.js";
import ChapterBreak from "../components/FeatureShowcase/ChapterBreak.js";
import ModuleTilesSection from "../components/FeatureShowcase/ModuleTilesSection.js";
import PricingSection from "../components/PricingCard/PricingSection.js";
import FinalCTASection from "../components/CTA/FinalCTASection.js";

const N = 15; // standout feature sections

// Story: what is Dishky -> why Dishky -> every standout feature, one full
// section each -> everything else -> pricing -> get started.
export default function Home() {
  return (
    <>
      <Hero />

      {/* 1. What is Dishky */}
      <WhatIsDishky />
      <ImageStorySection />

      {/* 2. Why Dishky */}
      <ChapterBreak number="02" title="Why restaurants choose Dishky" words="WHY DISHKY" art="orders" />
      <ProblemSection />
      <DailyProblemsSection />
      <BeforeAfterSection />
      <TransitionSection />

      {/* 3. Standout features, one full section each */}
      <ChapterBreak number="03" title="What no other ordering app gives you" words="STANDOUTS" art="promotions" />
      <div id="features-start" />
      <PromotionsSection />
      <EventCollabSection />
      <FeatureSpotlight slug="reservations" tone="dark" variant="split" also={["celebrations", "catering", "prebookings"]} index={3} total={N} />
      <FeatureSpotlight slug="orders" tone="light" variant="chapters" flip also={["order-tracking"]} index={4} total={N} />
      <FeatureSpotlight slug="kitchen" tone="dark" variant="collage" also={["kitchen-management"]} index={5} total={N} />
      <FeatureSpotlight slug="kitchen-management" tone="light" variant="split" index={6} total={N} />
      <QrOrderingSection />
      <UserPanelSection />
      <FeatureSpotlight slug="service" tone="dark" drift variant="stage" also={["service-management"]} index={9} total={N} />
      <AdminPanelSection />
      <FeatureSpotlight slug="staff" tone="light" variant="collage" also={["attendance", "salary", "careers"]} index={11} total={N} />
      <FeatureSpotlight slug="inventory" tone="dark" variant="chapters" index={12} total={N} />
      <FeatureSpotlight slug="loyalty" tone="light" variant="split" flip also={["guests", "offers"]} index={13} total={N} />
      <FeatureSpotlight slug="payments" tone="dark" variant="collage" index={14} total={N} />
      <FeatureSpotlight slug="analytics" tone="light" variant="stage" index={15} total={N} />

      {/* 4. Everything else */}
      <ChapterBreak number="04" title="And everything that keeps the doors open" words="EVERYTHING ELSE" art="backoffice" tone="light" />
      <RolesPermissionsSection />
      <MultiBranchSection />
      <FeatureSpotlight slug="back-office" tone="light" variant="chapters" flip />
      <BusinessBenefitsSection />
      <ModuleTilesSection />
      <div id="features-end" />

      {/* 5. Plans and 6. Get started */}
      <PricingSection />
      <FinalCTASection />

    </>
  );
}

// src/pages/ParentSafety.tsx
// Safety page for parents - manages blocked contacts, reports, and safety mode

import { ParentLayout } from "@/components/layout/ParentLayout";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { SafetyReportsTab } from "@/features/safety/components/SafetyReportsTab";
import { useFamilyMemberRedirect } from "@/hooks/useFamilyMemberRedirect";

const ParentSafety = () => {
  // Redirect family members away from parent routes
  useFamilyMemberRedirect();

  return (
    <ParentLayout>
      <OnboardingTour role="parent" pageKey="parent_safety" />
      <HelpBubble role="parent" pageKey="parent_safety" />
      
      <div className="p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="mt-2">
            <h1 className="text-3xl font-bold">Safety</h1>
            <p className="text-muted-foreground mt-2">
              Manage blocked contacts, safety reports, and safety mode settings
            </p>
          </div>

          <SafetyReportsTab />
        </div>
      </div>
    </ParentLayout>
  );
};

export default ParentSafety;


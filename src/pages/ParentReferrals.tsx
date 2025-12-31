// src/pages/ParentReferrals.tsx
// Purpose: Referrals page for parents - manages referral rewards and sharing

import { ParentLayout } from "@/components/layout/ParentLayout";
import { ReferralsTab } from "@/features/referrals";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { useFamilyMemberRedirect } from "@/hooks/useFamilyMemberRedirect";

const ParentReferrals = () => {
  // Redirect family members away from parent routes
  useFamilyMemberRedirect();

  return (
    <ParentLayout>
      <OnboardingTour role="parent" pageKey="parent_referrals" />
      <HelpBubble role="parent" pageKey="parent_referrals" />
      
      <div className="p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="mt-2">
            <h1 className="text-3xl font-bold">Referrals</h1>
            <p className="text-muted-foreground mt-2">
              Share Kids Call Home and earn free subscription time
            </p>
          </div>

          <ReferralsTab />
        </div>
      </div>
    </ParentLayout>
  );
};

export default ParentReferrals;


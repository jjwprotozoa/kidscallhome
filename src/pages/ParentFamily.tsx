// src/pages/ParentFamily.tsx
// Purpose: Family management page for parents - manages family members

import { ParentLayout } from "@/components/layout/ParentLayout";
import AddFamilyMemberDialog from "@/components/AddFamilyMemberDialog";
import { FamilyTab } from "@/features/family/components/FamilyTab";
import { FamilyCodeCard } from "@/features/family/components/FamilyCodeCard";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { useFamilyMemberRedirect } from "@/hooks/useFamilyMemberRedirect";
import { useParentData } from "@/hooks/useParentData";
import { useDashboardData } from "@/pages/ParentDashboard/useDashboardData";
import { useFamilyMemberHandlers } from "@/pages/ParentDashboard/useFamilyMemberHandlers";
import { useEffect, useState, useCallback } from "react";
import { FamilyMember } from "@/pages/ParentDashboard/types";

const ParentFamily = () => {
  // Redirect family members away from parent routes
  useFamilyMemberRedirect();
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [familyMembersLoading, setFamilyMembersLoading] = useState(false);
  const [showAddFamilyMember, setShowAddFamilyMember] = useState(false);
  const { familyCode, refreshCanAddMoreChildren } = useParentData();
  const { fetchFamilyMembers } = useDashboardData(refreshCanAddMoreChildren);

  const loadFamilyMembers = useCallback(async () => {
    setFamilyMembersLoading(true);
    const data = await fetchFamilyMembers();
    setFamilyMembers(data);
    setFamilyMembersLoading(false);
  }, [fetchFamilyMembers]);

  useEffect(() => {
    loadFamilyMembers();
  }, [loadFamilyMembers]);

  const {
    handleSuspend: handleSuspendFamilyMember,
    handleActivate: handleActivateFamilyMember,
    handleResendInvitation,
    handleRemove: handleRemoveFamilyMember,
  } = useFamilyMemberHandlers(loadFamilyMembers);

  const handleOpenAddFamilyMember = useCallback(() => {
    setShowAddFamilyMember(true);
  }, []);

  return (
    <ParentLayout>
      <OnboardingTour role="parent" pageKey="parent_family" />
      <HelpBubble role="parent" pageKey="parent_family" />
      
      <div className="p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="mt-2">
            <h1 className="text-3xl font-bold">Family</h1>
            <p className="text-muted-foreground mt-2">
              Manage family members and invitations
            </p>
          </div>

          {/* Family Code Card - prominently displayed */}
          <FamilyCodeCard familyCode={familyCode} />

          <FamilyTab
            familyMembers={familyMembers}
            loading={familyMembersLoading}
            onAddFamilyMember={handleOpenAddFamilyMember}
            onSuspend={handleSuspendFamilyMember}
            onActivate={handleActivateFamilyMember}
            onResendInvitation={handleResendInvitation}
            onRemove={handleRemoveFamilyMember}
          />
        </div>
      </div>

      <AddFamilyMemberDialog
        open={showAddFamilyMember}
        onOpenChange={setShowAddFamilyMember}
        onFamilyMemberAdded={loadFamilyMembers}
      />
    </ParentLayout>
  );
};

export default ParentFamily;


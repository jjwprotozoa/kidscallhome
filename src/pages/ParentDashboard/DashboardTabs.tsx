// src/pages/ParentDashboard/DashboardTabs.tsx
// Purpose: Dashboard content renderer - shows content based on URL tab query param
// Navigation is handled by side menu, no tabs UI here
// Safety and Connections are now separate pages, removed from here

import { FamilySetupTab } from "@/features/family/components/FamilySetupTab";
import { FamilyTab } from "@/features/family/components/FamilyTab";
import { ReferralsTab } from "@/features/referrals";
import React from "react";
import { FamilyMember, ValidTab } from "./types";

interface DashboardTabsProps {
  activeTab: ValidTab;
  familyMembers: FamilyMember[];
  familyMembersLoading: boolean;
  onAddFamilyMember: () => void;
  onSuspend: (id: string) => void;
  onActivate: (id: string) => void;
  onResendInvitation: (id: string, email: string) => void;
  onRemove: (idOrEmail: string) => void;
}

export const DashboardTabs = React.memo((props: DashboardTabsProps) => {
  const {
    activeTab,
    familyMembers,
    familyMembersLoading,
    onAddFamilyMember,
    onSuspend,
    onActivate,
    onResendInvitation,
    onRemove,
  } = props;

  // Render content based on activeTab (from URL query param)
  // Default to "family" if no tab specified
  // Safety and Connections are now separate pages
  const renderContent = () => {
    switch (activeTab) {
      case "family":
        return (
          <FamilyTab
            familyMembers={familyMembers}
            loading={familyMembersLoading}
            onAddFamilyMember={onAddFamilyMember}
            onSuspend={onSuspend}
            onActivate={onActivate}
            onResendInvitation={onResendInvitation}
            onRemove={onRemove}
          />
        );
      case "referrals":
        return <ReferralsTab />;
      case "setup":
        return <FamilySetupTab />;
      default:
        // Default to Family Members
        return (
          <FamilyTab
            familyMembers={familyMembers}
            loading={familyMembersLoading}
            onAddFamilyMember={onAddFamilyMember}
            onSuspend={onSuspend}
            onActivate={onActivate}
            onResendInvitation={onResendInvitation}
            onRemove={onRemove}
          />
        );
    }
  };

  return (
    <div className="w-full min-h-[400px]">
      {renderContent()}
    </div>
  );
});

DashboardTabs.displayName = "DashboardTabs";

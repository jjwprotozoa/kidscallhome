// src/pages/ParentDashboard/DashboardTabs.tsx
// Purpose: Dashboard tabs container

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChildConnectionsTab } from "@/features/family/components/ChildConnectionsTab";
import { ChildrenTab } from "@/features/family/components/ChildrenTab";
import { FamilySetupTab } from "@/features/family/components/FamilySetupTab";
import { FamilyTab } from "@/features/family/components/FamilyTab";
import { SafetyReportsTab } from "@/features/safety/components/SafetyReportsTab";
import { ValidTab, Child, FamilyMember } from "./types";

interface DashboardTabsProps {
  activeTab: ValidTab;
  onTabChange: (value: string) => void;
  children: Child[];
  loading: boolean;
  canAddMoreChildren: boolean;
  allowedChildren: number;
  hasNotifications: boolean;
  totalUnreadMessages: number;
  totalMissedCalls: number;
  isChildOnline: (childId: string) => boolean;
  familyMembers: FamilyMember[];
  familyMembersLoading: boolean;
  getFullLoginCode: (child: Child) => string;
  onAddChild: () => void;
  onClearAllNotifications: () => void;
  onEditCode: (child: Child) => void;
  onCopyCode: (code: string) => void;
  onCopyMagicLink: (child: Child) => void;
  onPrintCode: (child: Child) => void;
  onViewQR: (child: Child) => void;
  onCall: (childId: string) => void;
  onChat: (childId: string) => void;
  onDelete: (child: Child) => void;
  onAddFamilyMember: () => void;
  onSuspend: (id: string) => void;
  onActivate: (id: string) => void;
  onResendInvitation: (id: string, email: string) => void;
  onRemove: (idOrEmail: string) => void;
}

export const DashboardTabs = ({
  activeTab,
  onTabChange,
  children,
  loading,
  canAddMoreChildren,
  allowedChildren,
  hasNotifications,
  totalUnreadMessages,
  totalMissedCalls,
  isChildOnline,
  familyMembers,
  familyMembersLoading,
  getFullLoginCode,
  onAddChild,
  onClearAllNotifications,
  onEditCode,
  onCopyCode,
  onCopyMagicLink,
  onPrintCode,
  onViewQR,
  onCall,
  onChat,
  onDelete,
  onAddFamilyMember,
  onSuspend,
  onActivate,
  onResendInvitation,
  onRemove,
}: DashboardTabsProps) => {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="children">Children</TabsTrigger>
        <TabsTrigger value="family">Family</TabsTrigger>
        <TabsTrigger value="connections">Connections</TabsTrigger>
        <TabsTrigger value="safety">Safety</TabsTrigger>
        <TabsTrigger value="setup">Setup</TabsTrigger>
      </TabsList>

      <ChildrenTab
        children={children}
        loading={loading}
        canAddMoreChildren={canAddMoreChildren}
        allowedChildren={allowedChildren}
        hasNotifications={hasNotifications}
        totalUnreadMessages={totalUnreadMessages}
        totalMissedCalls={totalMissedCalls}
        isChildOnline={isChildOnline}
        getFullLoginCode={getFullLoginCode}
        onAddChild={onAddChild}
        onClearAllNotifications={onClearAllNotifications}
        onEditCode={onEditCode}
        onCopyCode={onCopyCode}
        onCopyMagicLink={onCopyMagicLink}
        onPrintCode={onPrintCode}
        onViewQR={onViewQR}
        onCall={onCall}
        onChat={onChat}
        onDelete={onDelete}
      />

      <FamilyTab
        familyMembers={familyMembers}
        loading={familyMembersLoading}
        onAddFamilyMember={onAddFamilyMember}
        onSuspend={onSuspend}
        onActivate={onActivate}
        onResendInvitation={onResendInvitation}
        onRemove={onRemove}
      />

      {activeTab === "connections" && (
        <ChildConnectionsTab children={children} />
      )}

      {activeTab === "safety" && (
        <SafetyReportsTab />
      )}

      {activeTab === "setup" && (
        <FamilySetupTab />
      )}
    </Tabs>
  );
};




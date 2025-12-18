// src/pages/ParentDashboard/DashboardTabs.tsx
// Purpose: Dashboard tabs container - memoized to prevent re-renders on parent state changes

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChildConnectionsTab } from "@/features/family/components/ChildConnectionsTab";
import { ChildrenTab } from "@/features/family/components/ChildrenTab";
import { FamilySetupTab } from "@/features/family/components/FamilySetupTab";
import { FamilyTab } from "@/features/family/components/FamilyTab";
import { ReferralsTab } from "@/features/referrals";
import { SafetyReportsTab } from "@/features/safety/components/SafetyReportsTab";
import { Baby, Gift, Link2, Settings, Shield, Users } from "lucide-react";
import React from "react";
import { Child, FamilyMember, ValidTab } from "./types";

const TAB_OPTIONS: { value: ValidTab; label: string; icon: React.ElementType }[] = [
  { value: "children", label: "Children", icon: Baby },
  { value: "family", label: "Family", icon: Users },
  { value: "connections", label: "Connections", icon: Link2 },
  { value: "safety", label: "Safety", icon: Shield },
  { value: "referrals", label: "Referrals", icon: Gift },
  { value: "setup", label: "Setup", icon: Settings },
];

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

export const DashboardTabs = React.memo((props: DashboardTabsProps) => {
  const {
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
  } = props;

  const currentTab = TAB_OPTIONS.find((tab) => tab.value === activeTab);

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      {/* Mobile: Dropdown selector */}
      <div className="sm:hidden mb-2">
        <Select value={activeTab} onValueChange={onTabChange}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {currentTab && (
                <span className="flex items-center gap-2">
                  <currentTab.icon className="h-4 w-4" />
                  {currentTab.label}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TAB_OPTIONS.map((tab) => {
              const Icon = tab.icon;
              return (
                <SelectItem key={tab.value} value={tab.value}>
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Tab list */}
      <TabsList className="hidden sm:grid w-full grid-cols-6">
        <TabsTrigger value="children">Children</TabsTrigger>
        <TabsTrigger value="family">Family</TabsTrigger>
        <TabsTrigger value="connections">Connections</TabsTrigger>
        <TabsTrigger value="safety">Safety</TabsTrigger>
        <TabsTrigger value="referrals" className="flex items-center gap-1">
          <Gift className="h-3 w-3" />
          Referrals
        </TabsTrigger>
        <TabsTrigger value="setup">Setup</TabsTrigger>
      </TabsList>

      {/* Fixed-height container with absolutely positioned panels - prevents layout jump on tab switch */}
      <div className="relative min-h-[400px] mt-2">
        <TabsContent value="children" className="absolute inset-0">
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
        </TabsContent>

        <TabsContent value="family" className="absolute inset-0">
          <FamilyTab
            familyMembers={familyMembers}
            loading={familyMembersLoading}
            onAddFamilyMember={onAddFamilyMember}
            onSuspend={onSuspend}
            onActivate={onActivate}
            onResendInvitation={onResendInvitation}
            onRemove={onRemove}
          />
        </TabsContent>

        <TabsContent value="connections" className="absolute inset-0">
          <ChildConnectionsTab children={children} />
        </TabsContent>

        <TabsContent value="safety" className="absolute inset-0">
          <SafetyReportsTab />
        </TabsContent>

        <TabsContent value="setup" className="absolute inset-0">
          <FamilySetupTab />
        </TabsContent>

        <TabsContent value="referrals" className="absolute inset-0">
          <ReferralsTab />
        </TabsContent>
      </div>
    </Tabs>
  );
});

DashboardTabs.displayName = "DashboardTabs";

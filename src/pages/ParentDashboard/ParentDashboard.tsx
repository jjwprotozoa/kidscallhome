// src/pages/ParentDashboard/ParentDashboard.tsx
// Purpose: Main page orchestrator for parent dashboard (max 250 lines)

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useParentData } from "@/hooks/useParentData";
import { useParentIncomingCallSubscription } from "@/hooks/useParentIncomingCallSubscription";
import { useTotalMissedBadge, useTotalUnreadBadge } from "@/stores/badgeStore";
import { useChildrenPresence } from "@/features/presence/useChildrenPresence";
import { clearAllNotifications } from "@/utils/clearAllNotifications";
import { safeLog } from "@/utils/security";
import { useFamilyMemberRedirect } from "@/hooks/useFamilyMemberRedirect";
import Navigation from "@/components/Navigation";
import { PageContentLayout } from "@/components/layout/PageContentLayout";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import AddChildDialog from "@/components/AddChildDialog";
import AddFamilyMemberDialog from "@/components/AddFamilyMemberDialog";
import { CodeManagementDialogs } from "@/components/CodeManagementDialogs";
import { IncomingCallDialog } from "@/components/IncomingCallDialog";
import { useDashboardData } from "./useDashboardData";
import { useFamilyMemberHandlers } from "./useFamilyMemberHandlers";
import { useChildHandlers } from "./useChildHandlers";
import { useCodeHandlers } from "./useCodeHandlers";
import { useIncomingCallHandlers } from "./useIncomingCallHandlers";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardTabs } from "./DashboardTabs";
import { Child, IncomingCall, FamilyMember, ValidTab } from "./types";

const ParentDashboard = () => {
  // Redirect family members away from parent routes
  useFamilyMemberRedirect();
  const [children, setChildren] = useState<Child[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [familyMembersLoading, setFamilyMembersLoading] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [showAddFamilyMember, setShowAddFamilyMember] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [showCodeDialog, setShowCodeDialog] = useState<{ child: Child } | null>(null);
  const [childToDelete, setChildToDelete] = useState<Child | null>(null);
  const [childToEditCode, setChildToEditCode] = useState<Child | null>(null);
  const [isUpdatingCode, setIsUpdatingCode] = useState(false);
  const [printViewChild, setPrintViewChild] = useState<Child | null>(null);
  const incomingCallRef = useRef<IncomingCall | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const validTabs = useMemo(() => ["family", "setup", "referrals"] as const, []);
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<ValidTab>(() => {
    return tabFromUrl && validTabs.includes(tabFromUrl as ValidTab) ? tabFromUrl as ValidTab : "family";
  });

  // Backwards compatibility: redirect old tab query params to new routes
  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab === "safety") {
      navigate("/parent/safety", { replace: true });
      return;
    }
    if (urlTab === "connections") {
      navigate("/parent/connections", { replace: true });
      return;
    }
    // Handle valid tabs
    const validUrlTab = urlTab && validTabs.includes(urlTab as ValidTab) ? urlTab as ValidTab : "family";
    if (validUrlTab !== activeTab) {
      setActiveTab(validUrlTab);
    }
  }, [searchParams, activeTab, validTabs, navigate]);

  const {
    parentName,
    familyCode,
    allowedChildren,
    canAddMoreChildren,
    checkAuth,
    refreshCanAddMoreChildren,
  } = useParentData();

  const { fetchChildren, fetchFamilyMembers } = useDashboardData(refreshCanAddMoreChildren);

  // NOTE: Children data is loaded for presence tracking and code management dialogs,
  // not for direct rendering in DashboardTabs. Loading is async and non-blocking.
  const childIds = useMemo(() => children.map((child) => child.id), [children]);
  const { isChildOnline } = useChildrenPresence({
    childIds,
    enabled: children.length > 0,
  });

  const totalUnreadMessages = useTotalUnreadBadge();
  const totalMissedCalls = useTotalMissedBadge();
  const hasNotifications = totalUnreadMessages > 0 || totalMissedCalls > 0;

  const loadChildren = useCallback(async () => {
    setLoading(true);
    const data = await fetchChildren();
    setChildren(data);
    setLoading(false);
  }, [fetchChildren]);

  const loadFamilyMembers = useCallback(async () => {
    setFamilyMembersLoading(true);
    const data = await fetchFamilyMembers();
    setFamilyMembers(data);
    setFamilyMembersLoading(false);
  }, [fetchFamilyMembers]);

  const {
    handleSuspend: handleSuspendFamilyMember,
    handleActivate: handleActivateFamilyMember,
    handleResendInvitation,
    handleRemove: handleRemoveFamilyMember,
  } = useFamilyMemberHandlers(loadFamilyMembers);

  const { handleDelete: handleDeleteChild, handleCall, handleChat } = useChildHandlers(loadChildren);

  // Optimistic update function for child login code
  const updateChildLoginCode = useCallback((childId: string, newCode: string) => {
    setChildren(prevChildren => 
      prevChildren.map(child => 
        child.id === childId 
          ? { ...child, login_code: newCode }
          : child
      )
    );
  }, []);

  const {
    getFullLoginCode,
    handleCopyCode,
    handleCopyMagicLink,
    handleUpdateLoginCode,
  } = useCodeHandlers(familyCode, updateChildLoginCode);

  const { isAnsweringRef, handleAnswer, handleDecline } = useIncomingCallHandlers();

  const handleAnswerCall = useCallback(() => {
    if (incomingCall) {
      handleAnswer(incomingCall, setIncomingCall);
    }
  }, [incomingCall, handleAnswer]);

  const handleDeclineCall = useCallback(async () => {
    if (incomingCall) {
      await handleDecline(incomingCall, setIncomingCall);
    }
  }, [incomingCall, handleDecline]);

  const handleClearAllNotifications = useCallback(async () => {
    if (!hasNotifications) return;
    try {
      const result = await clearAllNotifications(childIds);
      const messageText = result.clearedMessageCount > 0 ? `${result.clearedMessageCount} unread message${result.clearedMessageCount !== 1 ? "s" : ""}` : "";
      const callText = result.clearedCallCount > 0 ? `${result.clearedCallCount} missed call${result.clearedCallCount !== 1 ? "s" : ""}` : "";
      const description = [messageText, callText].filter(Boolean).join(" and ");
      toast({
        title: "Notifications cleared",
        description: description || "All notifications cleared.",
      });
    } catch (error) {
      console.error("Error clearing notifications:", error);
      toast({
        title: "Error",
        description: "Failed to clear some notifications. Please try again.",
        variant: "destructive",
      });
    }
  }, [hasNotifications, childIds, toast]);

  const handleUpdateLoginCodeWrapper = useCallback(async () => {
    if (childToEditCode) {
      await handleUpdateLoginCode(childToEditCode, setIsUpdatingCode);
      setChildToEditCode(null);
    }
  }, [childToEditCode, handleUpdateLoginCode]);

  // Memoized callbacks for DashboardTabs to prevent re-renders
  const handleOpenAddChild = useCallback(() => setShowAddChild(true), []);
  const handleOpenAddFamilyMember = useCallback(() => setShowAddFamilyMember(true), []);
  const handlePrintCode = useCallback((child: Child) => setPrintViewChild(child), []);
  const handleViewQR = useCallback((child: Child) => setShowCodeDialog({ child }), []);

  useEffect(() => {
    loadChildren();
    loadFamilyMembers();
  }, [loadChildren, loadFamilyMembers]);

  useEffect(() => {
    const childSession = localStorage.getItem("childSession");
    if (childSession) {
      safeLog.log("🧹 [PARENT DASHBOARD] Clearing childSession for parent user");
      localStorage.removeItem("childSession");
    }
    checkAuth().catch((error) => {
      console.error("Error checking auth:", error);
    });
  }, [checkAuth]);

  const handleIncomingCall = useCallback((call: IncomingCall) => {
    setIncomingCall(call);
    incomingCallRef.current = call;
  }, []);

  const handleCallCleared = useCallback(() => {
    setIncomingCall(null);
    incomingCallRef.current = null;
  }, []);

  useParentIncomingCallSubscription({
    onIncomingCall: handleIncomingCall,
    onCallCleared: handleCallCleared,
    currentIncomingCall: incomingCall,
    enabled: true,
  });

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  return (
    <div className="min-h-[100dvh] bg-background w-full overflow-x-hidden">
      <Navigation />
      <OnboardingTour role="parent" pageKey="parent_dashboard" />
      <HelpBubble role="parent" pageKey="parent_dashboard" />
      
      <PageContentLayout>
        <DashboardHeader
          parentName={parentName}
          familyCode={familyCode}
        />

        <div className="p-4">
          <div className="max-w-4xl mx-auto space-y-6">
            <DashboardTabs
              activeTab={activeTab}
              familyMembers={familyMembers}
              familyMembersLoading={familyMembersLoading}
              onAddFamilyMember={handleOpenAddFamilyMember}
              onSuspend={handleSuspendFamilyMember}
              onActivate={handleActivateFamilyMember}
              onResendInvitation={handleResendInvitation}
              onRemove={handleRemoveFamilyMember}
            />
          </div>
        </div>

        <AddChildDialog
          open={showAddChild}
          onOpenChange={setShowAddChild}
          onChildAdded={loadChildren}
        />

        <AddFamilyMemberDialog
          open={showAddFamilyMember}
          onOpenChange={setShowAddFamilyMember}
          onFamilyMemberAdded={loadFamilyMembers}
        />

        <CodeManagementDialogs
          showCodeDialog={showCodeDialog}
          onCloseCodeDialog={() => setShowCodeDialog(null)}
          getFullLoginCode={getFullLoginCode}
          onCopyCode={handleCopyCode}
          onCopyMagicLink={handleCopyMagicLink}
          onPrintCode={(child) => setPrintViewChild(child)}
          childToEditCode={childToEditCode}
          onCloseEditCode={() => setChildToEditCode(null)}
          onUpdateLoginCode={handleUpdateLoginCodeWrapper}
          isUpdatingCode={isUpdatingCode}
          childToDelete={childToDelete}
          onCloseDelete={() => setChildToDelete(null)}
          onDeleteChild={async () => {
            if (childToDelete) {
              await handleDeleteChild(childToDelete);
              setChildToDelete(null);
            }
          }}
          printViewChild={printViewChild}
          onClosePrintView={() => setPrintViewChild(null)}
          onPrintFromModal={() => window.print()}
        />

        <IncomingCallDialog
          incomingCall={incomingCall}
          isAnsweringRef={isAnsweringRef}
          onAnswer={handleAnswerCall}
          onDecline={handleDeclineCall}
          onOpenChange={() => {}}
        />
      </PageContentLayout>
    </div>
  );
};

export default ParentDashboard;


import AddChildDialog from "@/components/AddChildDialog";
import { ChildCard } from "@/components/ChildCard";
import { CodeManagementDialogs } from "@/components/CodeManagementDialogs";
import { IncomingCallDialog } from "@/components/IncomingCallDialog";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useIncomingCallNotifications } from "@/features/calls/hooks/useIncomingCallNotifications";
import { endCall as endCallUtil } from "@/features/calls/utils/callEnding";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { useChildrenPresence } from "@/features/presence/useChildrenPresence";
import { useParentData } from "@/hooks/useParentData";
import { useParentIncomingCallSubscription } from "@/hooks/useParentIncomingCallSubscription";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useTotalMissedBadge,
  useTotalUnreadBadge,
} from "@/stores/badgeStore";
import { clearAllNotifications } from "@/utils/clearAllNotifications";
import { isPWA } from "@/utils/platformDetection";
import { BellOff, Copy, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Child {
  id: string;
  name: string;
  login_code: string;
  avatar_color: string;
}

interface IncomingCall {
  id: string;
  child_id: string;
  child_name: string;
  child_avatar_color: string;
}


const ParentDashboard = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [showCodeDialog, setShowCodeDialog] = useState<{ child: Child } | null>(
    null
  );
  const [childToDelete, setChildToDelete] = useState<Child | null>(null);
  const [childToEditCode, setChildToEditCode] = useState<Child | null>(null);
  const [isUpdatingCode, setIsUpdatingCode] = useState(false);
  const [printViewChild, setPrintViewChild] = useState<Child | null>(null);
  const incomingCallRef = useRef<IncomingCall | null>(null); // Ref to track latest incomingCall for subscription callbacks
  const isAnsweringRef = useRef(false); // Track if user is answering to prevent auto-decline
  const navigate = useNavigate();
  const { toast } = useToast();
  const { stopIncomingCall } = useIncomingCallNotifications({
      enabled: true,
      volume: 0.7,
  });

  // Use parent data hook
  const {
    parentName,
    familyCode,
    allowedChildren,
    canAddMoreChildren,
    checkAuth,
    refreshCanAddMoreChildren,
  } = useParentData();

  // Track children's online presence
  // Memoize childIds to prevent unnecessary re-subscriptions
  const childIds = useMemo(() => children.map((child) => child.id), [children]);
  const { isChildOnline } = useChildrenPresence({
    childIds,
    enabled: children.length > 0,
    // Optional: Uncomment to enable status change notifications
    // onStatusChange: (childId, isOnline) => {
    //   const child = children.find((c) => c.id === childId);
    //   if (child) {
    //     toast({
    //       title: isOnline ? `${child.name} is online` : `${child.name} went offline`,
    //       description: isOnline
    //         ? "They're available for calls"
    //         : "They're no longer available",
    //     });
    //   }
    // },
  });

  // Get total badge counts
  const totalUnreadMessages = useTotalUnreadBadge();
  const totalMissedCalls = useTotalMissedBadge();
  const hasNotifications = totalUnreadMessages > 0 || totalMissedCalls > 0;

  const fetchChildren = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("children")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChildren(data || []);
      
      // Refresh subscription check after fetching children (non-blocking)
      refreshCanAddMoreChildren().catch((err) => {
        console.warn("Failed to refresh subscription check:", err);
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Error loading children",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, refreshCanAddMoreChildren]);

  useEffect(() => {
    // Clear childSession if it exists - parents should not have childSession
    // This prevents routing issues where parent might be treated as child
    const childSession = localStorage.getItem("childSession");
    if (childSession) {
      console.log(
        "🧹 [PARENT DASHBOARD] Clearing childSession for parent user"
      );
      localStorage.removeItem("childSession");
    }

    // Run auth check and fetch children in parallel (non-blocking)
    // UI renders immediately, only children list shows loading state
    checkAuth().catch((error) => {
      console.error("Error checking auth:", error);
    });
    
    fetchChildren().catch((error) => {
      console.error("Error fetching children:", error);
    });
  }, [checkAuth, fetchChildren]);

  // Stable callbacks for incoming call subscription
  const handleIncomingCall = useCallback((call: IncomingCall) => {
    setIncomingCall(call);
    incomingCallRef.current = call;
  }, []);

  const handleCallCleared = useCallback(() => {
                setIncomingCall(null);
                incomingCallRef.current = null;
  }, []);

  // Use incoming call subscription hook
  useParentIncomingCallSubscription({
    onIncomingCall: handleIncomingCall,
    onCallCleared: handleCallCleared,
    currentIncomingCall: incomingCall,
    enabled: true,
  });

  // Keep ref in sync with state so we can check it in handlers
  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  // Stop notifications when incoming call is cleared
  useEffect(() => {
    if (!incomingCall && incomingCallRef.current) {
      stopIncomingCall(incomingCallRef.current.id);
    }
  }, [incomingCall, stopIncomingCall]);

  const handleChat = (childId: string) => {
    navigate(`/chat/${childId}`);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: "Login code copied to clipboard",
    });
  };

  // Helper function to get full login code (prepend family code if missing)
  const getFullLoginCode = (child: Child): string => {
    // Check if login_code already includes family code (has 3 parts: familyCode-color-number)
    const parts = child.login_code.split("-");
    if (parts.length === 3 && familyCode) {
      // Already has family code, return as-is
      return child.login_code;
    }
    // Old format (color-number), prepend family code
    if (parts.length === 2 && familyCode) {
      return `${familyCode}-${child.login_code}`;
    }
    // Fallback: return as-is if family code not available
    return child.login_code;
  };

  const handleCopyMagicLink = (child: Child) => {
    // Magic link includes full login code: familyCode-color/animal-number
    // For existing children, prepend family code if missing
    const fullCode = getFullLoginCode(child);
    const encodedCode = encodeURIComponent(fullCode);
    const magicLink = `${window.location.origin}/child/login?code=${encodedCode}`;
    navigator.clipboard.writeText(magicLink);
    toast({
      title: "Copied!",
      description: "Magic link copied to clipboard",
    });
  };

  const handlePrintCode = (child: Child) => {
    // Always show print view in a modal (works on all devices)
    setPrintViewChild(child);
  };

  const handlePrintFromModal = () => {
    if (!printViewChild) return;
    window.print();
  };

  const handleCall = async (childId: string) => {
    // Acknowledge missed calls from this child when clicking call button
    // This clears the badge immediately and syncs to all devices
    try {
      const { acknowledgeMissedCalls } = await import(
        "@/utils/acknowledgeMissedCalls"
      );
      await acknowledgeMissedCalls(childId, "child");
    } catch (error) {
      // Log error but don't block navigation
      console.error("Error acknowledging missed calls:", error);
    }
    navigate(`/call/${childId}`);
  };

  const handleClearAllNotifications = useCallback(async () => {
    if (!hasNotifications) return;

    try {
      const result = await clearAllNotifications(childIds);

      const messageText =
        result.clearedMessageCount > 0
          ? `${result.clearedMessageCount} unread message${
              result.clearedMessageCount !== 1 ? "s" : ""
            }`
          : "";
      const callText =
        result.clearedCallCount > 0
          ? `${result.clearedCallCount} missed call${
              result.clearedCallCount !== 1 ? "s" : ""
            }`
          : "";
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

  const handleDeleteChild = async () => {
    if (!childToDelete) return;

    try {
      const { error } = await supabase
        .from("children")
        .delete()
        .eq("id", childToDelete.id);

      if (error) throw error;

      toast({
        title: "Child removed",
        description: `${childToDelete.name} has been removed.`,
      });

      setChildToDelete(null);
      fetchChildren();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Error removing child",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleUpdateLoginCode = async () => {
    if (!childToEditCode) return;

    setIsUpdatingCode(true);
    try {
      // Generate a new unique login code using the database function
      const { data: newCode, error: rpcError } = await supabase.rpc(
        "generate_unique_login_code"
      );

      if (rpcError) throw rpcError;
      if (!newCode) throw new Error("Failed to generate new code");

      // Update the child's login code
      const { error: updateError } = await supabase
        .from("children")
        .update({ login_code: newCode })
        .eq("id", childToEditCode.id);

      if (updateError) throw updateError;

      toast({
        title: "Login code updated",
        description: `${childToEditCode.name}'s new login code is: ${newCode}`,
      });

      setChildToEditCode(null);
      fetchChildren();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Error updating login code",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingCode(false);
    }
  };

  const handleAnswerCall = () => {
    if (incomingCall) {
      // Stop incoming call notifications
      stopIncomingCall(incomingCall.id);
      // Mark that we're answering to prevent onOpenChange from declining
      isAnsweringRef.current = true;
      const childId = incomingCall.child_id;
      const callId = incomingCall.id;
      setIncomingCall(null);
      // CRITICAL: Include callId in URL so useVideoCall can detect it's an incoming call immediately
      navigate(`/call/${childId}?callId=${callId}`);
      // Reset the flag after navigation completes (longer delay to ensure navigation happened)
      setTimeout(() => {
        isAnsweringRef.current = false;
      }, 2000); // Increased from 500ms to 2000ms to ensure navigation completed
    }
  };

  const handleDeclineCall = async () => {
    if (incomingCall) {
      // Don't decline if we're in the process of answering
      if (isAnsweringRef.current) {
        return;
      }

      // Use shared endCall function for idempotent ending
      try {
        await endCallUtil({
          callId: incomingCall.id,
          by: "parent",
          reason: "declined",
        });
      } catch (error: unknown) {
        console.error("❌ [USER ACTION] Error declining call:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        toast({
          title: "Error",
          description: "Failed to decline call: " + errorMessage,
          variant: "destructive",
        });
      }
      // Stop incoming call notifications when declining
      stopIncomingCall(incomingCall.id);
      setIncomingCall(null);
    }
  };

  // No longer blocking render - show UI immediately with loading states for specific sections

  return (
    <div className="min-h-[100dvh] bg-background w-full overflow-x-hidden">
      <Navigation />
      <OnboardingTour role="parent" pageKey="parent_dashboard" />
      <HelpBubble role="parent" pageKey="parent_dashboard" />
      <div
        className="px-4 pb-4"
        style={{
          paddingTop: "calc(0.5rem + 64px + var(--safe-area-inset-top) * 0.15)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          <p className="text-sm text-muted-foreground mb-4">
            Welcome back{parentName ? `, ${parentName}` : ""}!
          </p>
        </div>
      </div>
      <div className="p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="mt-2 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold">My Children</h1>
              <p className="text-muted-foreground mt-2">
                Manage your children's profiles, login codes, and settings
              </p>
            </div>
            {isPWA() && (
              <Button
                variant="outline"
                onClick={() => navigate("/parent/upgrade")}
                className="flex-shrink-0"
                data-tour="parent-upgrade-plan"
              >
                Upgrade Plan
              </Button>
            )}
          </div>

          {familyCode && (
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Your Family Code
                  </p>
                  <p className="text-2xl font-mono font-bold text-blue-700 dark:text-blue-300">
                    {familyCode}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Share this code with your children for login
                  </p>
                </div>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(familyCode);
                    toast({
                      title: "Copied!",
                      description: "Family code copied to clipboard",
                    });
                  }}
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </Card>
          )}

          {!canAddMoreChildren && (
            <Card className="p-4 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 mb-4">
              <div className="space-y-3">
                <p className="text-sm text-yellow-900 dark:text-yellow-100">
                  <strong>Subscription Limit Reached:</strong> You have{" "}
                  {children.length} /{" "}
                  {allowedChildren === 999 ? "∞" : allowedChildren || 1}{" "}
                  children.
                </p>
                {isPWA() ? (
                  <Button
                    onClick={() => navigate("/parent/upgrade")}
                    variant="default"
                    size="sm"
                    className="w-full sm:w-auto"
                    data-tour="parent-upgrade-limit"
                  >
                    Upgrade Your Plan
                  </Button>
                ) : (
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Please upgrade through your app store to add more children.
                  </p>
                )}
              </div>
            </Card>
          )}
          <div className="flex gap-2">
            <Button
              onClick={() => setShowAddChild(true)}
              className="flex-1"
              size="lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              Add Child
            </Button>
            {hasNotifications && (
              <Button
                onClick={handleClearAllNotifications}
                variant="outline"
                size="lg"
                className="flex-shrink-0"
                title={`Clear all notifications (${totalUnreadMessages} messages, ${totalMissedCalls} missed calls)`}
              >
                <BellOff className="mr-2 h-5 w-5" />
                Clear All
              </Button>
            )}
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2].map((i) => (
                <Card key={i} className="p-6 space-y-4 min-h-[220px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
                      <div className="space-y-2">
                        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
                        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-10 flex-1 bg-muted rounded animate-pulse" />
                    <div className="h-10 flex-1 bg-muted rounded animate-pulse" />
                  </div>
                </Card>
              ))}
            </div>
          ) : children.length === 0 ? (
            <Card className="p-12 text-center min-h-[220px]">
              <p className="text-muted-foreground mb-4">
                You haven't added any children yet.
              </p>
              <p className="text-sm text-muted-foreground">
                Click "Add Child" above to create a profile and login code.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {children.map((child, index) => (
                <ChildCard
                  key={child.id}
                  child={child}
                  index={index}
                        isOnline={isChildOnline(child.id)}
                  fullLoginCode={getFullLoginCode(child)}
                  onEditCode={() => setChildToEditCode(child)}
                  onCopyCode={() => handleCopyCode(getFullLoginCode(child))}
                  onCopyMagicLink={() => handleCopyMagicLink(child)}
                  onPrintCode={() => handlePrintCode(child)}
                  onViewQR={() => setShowCodeDialog({ child })}
                      onCall={() => handleCall(child.id)}
                      onChat={() => handleChat(child.id)}
                  onDelete={() => setChildToDelete(child)}
                />
              ))}
            </div>
          )}
        </div>

        <AddChildDialog
          open={showAddChild}
          onOpenChange={setShowAddChild}
          onChildAdded={fetchChildren}
        />

        {/* Code Management Dialogs */}
        <CodeManagementDialogs
          showCodeDialog={showCodeDialog}
          onCloseCodeDialog={() => setShowCodeDialog(null)}
          getFullLoginCode={getFullLoginCode}
          onCopyCode={handleCopyCode}
          onCopyMagicLink={handleCopyMagicLink}
          onPrintCode={handlePrintCode}
          childToEditCode={childToEditCode}
          onCloseEditCode={() => setChildToEditCode(null)}
          onUpdateLoginCode={handleUpdateLoginCode}
          isUpdatingCode={isUpdatingCode}
          childToDelete={childToDelete}
          onCloseDelete={() => setChildToDelete(null)}
          onDeleteChild={handleDeleteChild}
          printViewChild={printViewChild}
          onClosePrintView={() => setPrintViewChild(null)}
          onPrintFromModal={handlePrintFromModal}
        />

        {/* Incoming Call Dialog */}
        <IncomingCallDialog
          incomingCall={incomingCall}
          isAnsweringRef={isAnsweringRef}
          onAnswer={handleAnswerCall}
          onDecline={handleDeclineCall}
          onOpenChange={() => {}}
        />
      </div>
    </div>
  );
};

export default ParentDashboard;

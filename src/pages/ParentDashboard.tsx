import AddChildDialog from "@/components/AddChildDialog";
import Navigation from "@/components/Navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useIncomingCallNotifications } from "@/features/calls/hooks/useIncomingCallNotifications";
import { endCall as endCallUtil } from "@/features/calls/utils/callEnding";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { StatusIndicator } from "@/features/presence/StatusIndicator";
import { useChildrenPresence } from "@/features/presence/useChildrenPresence";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useMissedBadgeForChild,
  useUnreadBadgeForChild,
} from "@/stores/badgeStore";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Copy,
  Edit,
  ExternalLink,
  MessageCircle,
  Phone,
  Plus,
  Printer,
  QrCode,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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

interface CallRecord {
  id: string;
  child_id: string;
  parent_id: string;
  caller_type: string;
  status: string;
  created_at: string;
  ended_at?: string | null;
}

// CLS: Badges reserve space with invisible class when count is 0 to prevent button width changes
// Component for Call button with missed call badge
const ChildCallButton = ({
  childId,
  onCall,
}: {
  childId: string;
  onCall: () => void;
}) => {
  const missedCallCount = useMissedBadgeForChild(childId);

  return (
    <Button
      onClick={onCall}
      className="flex-1 relative"
      variant="secondary"
      data-tour="parent-call-button"
    >
      <Video className="mr-2 h-4 w-4" />
      Call
      {/* CLS: Reserve space for badge to prevent layout shift */}
      <span
        className={`ml-2 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
          missedCallCount === 0 ? "invisible" : ""
        }`}
      >
        {missedCallCount > 99 ? "99+" : missedCallCount}
      </span>
    </Button>
  );
};

// Component for Chat button with unread message badge
const ChildChatButton = ({
  childId,
  onChat,
}: {
  childId: string;
  onChat: () => void;
}) => {
  const unreadMessageCount = useUnreadBadgeForChild(childId);

  return (
    <Button
      onClick={onChat}
      className="flex-1 relative bg-chat-accent text-chat-accent-foreground hover:bg-chat-accent/90"
      variant="default"
      data-tour="parent-messages"
    >
      <MessageCircle className="mr-2 h-4 w-4" />
      Chat
      {/* CLS: Reserve space for badge to prevent layout shift */}
      <span
        className={`ml-2 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
          unreadMessageCount === 0 ? "invisible" : ""
        }`}
      >
        {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
      </span>
    </Button>
  );
};

const ParentDashboard = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [parentName, setParentName] = useState<string | null>(null);
  const [showCodeDialog, setShowCodeDialog] = useState<{ child: Child } | null>(
    null
  );
  const [childToDelete, setChildToDelete] = useState<Child | null>(null);
  const [childToEditCode, setChildToEditCode] = useState<Child | null>(null);
  const [isUpdatingCode, setIsUpdatingCode] = useState(false);
  const [printViewChild, setPrintViewChild] = useState<Child | null>(null);
  const incomingCallRef = useRef<IncomingCall | null>(null); // Ref to track latest incomingCall for subscription callbacks
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isAnsweringRef = useRef(false); // Track if user is answering to prevent auto-decline
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { handleIncomingCall, stopIncomingCall } = useIncomingCallNotifications(
    {
      enabled: true,
      volume: 0.7,
    }
  );
  const handleIncomingCallRef = useRef(handleIncomingCall); // Ref to track latest handleIncomingCall for subscription callbacks

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

  const checkAuth = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/parent/auth");
      return;
    }
    // Fetch parent name from database
    const { data: parentData } = await supabase
      .from("parents")
      .select("name")
      .eq("id", session.user.id)
      .maybeSingle();

    setParentName(parentData?.name || null);
  }, [navigate]);

  const fetchChildren = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("children")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChildren(data || []);
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
  }, [toast]);

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

    checkAuth();
    fetchChildren();

    let lastCheckedCallId: string | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const setupSubscription = async () => {
      // Use getSession() instead of getUser() - lighter weight, no auth endpoint call
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const userId = session.user.id; // Cache user ID to avoid repeated calls

      // Function to handle incoming call notification
      const handleIncomingCallNotification = async (call: CallRecord) => {
        // Skip if we already showed this call
        if (call.id === lastCheckedCallId) return;

        // IMPORTANT: Don't show incoming call notification if user is already on the call page
        // This prevents showing notifications for calls the parent initiated
        if (location.pathname.startsWith("/call/")) {
          return;
        }

        lastCheckedCallId = call.id;

        const { data: childData } = await supabase
          .from("children")
          .select("name, avatar_color")
          .eq("id", call.child_id)
          .single();

        if (childData) {
          if (import.meta.env.DEV) {
            console.log("📞 [PARENT DASHBOARD] Incoming call:", childData.name);
          }
          setIncomingCall({
            id: call.id,
            child_id: call.child_id,
            child_name: childData.name,
            child_avatar_color: childData.avatar_color,
          });
          // Handle incoming call with notifications (push notification if tab inactive, ringtone if active)
          handleIncomingCallRef.current({
            callId: call.id,
            callerName: childData.name,
            callerId: call.child_id,
            url: `/call/${call.child_id}?callId=${call.id}`,
          });
        } else {
          console.error("Failed to fetch child data for call");
        }
      };

      // Check for existing ringing calls from children (in case subscription missed them)
      // Check calls created in the last 2 minutes to catch calls that might have been created
      // while the dashboard was loading or subscription was setting up
      const checkExistingCalls = async () => {
        const twoMinutesAgo = new Date(
          Date.now() - 2 * 60 * 1000
        ).toISOString();
        const { data: existingCalls } = await supabase
          .from("calls")
          .select("*")
          .eq("parent_id", userId)
          .eq("caller_type", "child")
          .eq("status", "ringing")
          .gte("created_at", twoMinutesAgo)
          .order("created_at", { ascending: false })
          .limit(1);

        if (existingCalls && existingCalls.length > 0) {
          const call = existingCalls[0];
          if (call.id !== lastCheckedCallId) {
            await handleIncomingCallNotification(call);
          }
        }
      };

      // Polling function to check for new calls (fallback for realtime)
      // IMPORTANT: Only check for child-initiated calls, not parent-initiated ones
      // Use a 1-minute window since we poll every 30 seconds
      const pollForCalls = async () => {
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
        const { data: newCalls, error: pollError } = await supabase
          .from("calls")
          .select("*")
          .eq("parent_id", userId)
          .eq("caller_type", "child") // Only child-initiated calls
          .eq("status", "ringing")
          .gte("created_at", oneMinuteAgo)
          .order("created_at", { ascending: false })
          .limit(1);

        if (pollError) {
          console.error("❌ [PARENT DASHBOARD] Polling error:", pollError);
          return;
        }

        if (newCalls && newCalls.length > 0) {
          const call = newCalls[0];
          if (call.id !== lastCheckedCallId) {
            await handleIncomingCallNotification(call);
          }
        }
      };

      // Check immediately
      await checkExistingCalls();

      // Set up polling as a fallback (every 60 seconds - reduced frequency to minimize console noise)
      // Realtime subscriptions should handle most cases, this is just a safety net
      pollInterval = setInterval(pollForCalls, 60000);

      // Subscribe to new calls from children
      // Listen to both INSERT and UPDATE events to catch calls that are reset to ringing

      channelRef.current = supabase
        .channel("parent-incoming-calls")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "calls",
            filter: `parent_id=eq.${userId}`,
          },
          async (payload) => {
            const call = payload.new as CallRecord;

            // Verify this call is from a child, for this parent, and is ringing
            // IMPORTANT: Only show incoming call dialog for child-initiated calls, not parent-initiated ones
            if (
              call.caller_type === "child" &&
              call.parent_id === userId &&
              call.status === "ringing"
            ) {
              await handleIncomingCallNotification(call);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "calls",
            filter: `parent_id=eq.${userId}`,
          },
          async (payload) => {
            const call = payload.new as CallRecord;
            const oldCall = payload.old as CallRecord;

            // CRITICAL: Always ignore parent-initiated calls - they should never show notifications
            // Parent-initiated calls are handled by the call page, not the dashboard
            if (call.caller_type === "parent") {
              return; // Early return - don't process parent-initiated calls at all
            }

            // Don't process updates if user is on the call page
            if (location.pathname.startsWith("/call/")) {
              return;
            }

            // Clear incoming call if it was answered or ended
            // Use ref to get latest value without needing to re-run subscription
            if (
              incomingCallRef.current &&
              incomingCallRef.current.id === call.id
            ) {
              if (call.status === "active" || call.status === "ended") {
                setIncomingCall(null);
                incomingCallRef.current = null;
              }
            }

            // Check if status changed to "ringing" for a child-initiated call
            // IMPORTANT: Only show incoming call dialog for child-initiated calls
            if (
              call.caller_type === "child" &&
              call.parent_id === userId &&
              call.status === "ringing" &&
              oldCall.status !== "ringing"
            ) {
              await handleIncomingCallNotification(call);
            }
          }
        )
        .subscribe((status, err) => {
          if (err) {
            console.error(
              "❌ [PARENT DASHBOARD] Realtime subscription error:",
              err
            );
          }
          // Silent subscription success - only log errors
        });
    };

    setupSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
    // checkAuth and fetchChildren are stable useCallback hooks, so they won't cause unnecessary re-runs
    // Only re-run subscription when location changes (e.g., navigating between pages)
  }, [checkAuth, fetchChildren, location.pathname]);

  // Keep refs in sync with state/hooks so subscription callbacks always have latest values
  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    handleIncomingCallRef.current = handleIncomingCall;
  }, [handleIncomingCall]);

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

  const handleCopyMagicLink = (child: Child) => {
    const magicLink = `${window.location.origin}/child/login?code=${child.login_code}`;
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

  // CLS: Reserve space for loading state to match final layout structure
  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background w-full overflow-x-hidden">
        <Navigation />
        <div
          className="p-4"
          style={{
            paddingTop: "calc(1rem + 64px + var(--safe-area-inset-top) * 0.15)",
          }}
        >
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="mt-2">
              <div className="h-9 w-48 bg-muted rounded animate-pulse mb-2" />
              <div className="h-6 w-96 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-12 w-full bg-muted rounded animate-pulse" />
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
          </div>
        </div>
      </div>
    );
  }

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
          <div className="mt-2">
            <h1 className="text-3xl font-bold">My Children</h1>
            <p className="text-muted-foreground mt-2">
              Manage your children's profiles, login codes, and settings
            </p>
          </div>

          <Button
            onClick={() => setShowAddChild(true)}
            className="w-full"
            size="lg"
          >
            <Plus className="mr-2 h-5 w-5" />
            Add Child
          </Button>

          {children.length === 0 ? (
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
                <Card
                  key={child.id}
                  className="p-6 space-y-4 min-h-[220px]"
                  style={{
                    borderLeft: `4px solid ${child.avatar_color}`,
                  }}
                  data-tour={
                    index === 0 ? "parent-status-indicator" : undefined
                  }
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl sm:text-3xl font-bold">
                        {child.name}
                      </h3>
                      <StatusIndicator
                        isOnline={isChildOnline(child.id)}
                        size="md"
                        showPulse={isChildOnline(child.id)}
                      />
                    </div>
                    <div className="bg-muted p-3 rounded-lg relative">
                      <p className="text-xs text-muted-foreground mb-1">
                        Login Code
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xl sm:text-2xl font-mono font-bold tracking-wider flex-1">
                          {child.login_code}
                        </p>
                        <Button
                          onClick={() => setChildToEditCode(child)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Generate new login code"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        onClick={() => handleCopyCode(child.login_code)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Code
                      </Button>
                      <Button
                        onClick={() => handleCopyMagicLink(child)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Copy Link
                      </Button>
                      <Button
                        onClick={() => handlePrintCode(child)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                      </Button>
                      <Button
                        onClick={() => setShowCodeDialog({ child })}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <QrCode className="mr-2 h-4 w-4" />
                        View QR
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <ChildCallButton
                      childId={child.id}
                      onCall={() => handleCall(child.id)}
                    />
                    <ChildChatButton
                      childId={child.id}
                      onChat={() => handleChat(child.id)}
                    />
                    <Button
                      onClick={() => setChildToDelete(child)}
                      variant="destructive"
                      size="icon"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <AddChildDialog
          open={showAddChild}
          onOpenChange={setShowAddChild}
          onChildAdded={fetchChildren}
        />

        {/* Code View Dialog */}
        {showCodeDialog && (
          <AlertDialog
            open={!!showCodeDialog}
            onOpenChange={(open) => !open && setShowCodeDialog(null)}
          >
            <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
              <button
                onClick={() => setShowCodeDialog(null)}
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-lg sm:text-xl">
                  {showCodeDialog.child.name}'s Login Code
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm">
                  Share this code or QR code with your child to log in
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4">
                <div className="bg-muted p-3 sm:p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-2">
                    Login Code
                  </p>
                  <p className="text-2xl sm:text-3xl font-mono font-bold break-all">
                    {showCodeDialog.child.login_code}
                  </p>
                </div>
                <div className="flex justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                      `${window.location.origin}/child/login?code=${showCodeDialog.child.login_code}`
                    )}`}
                    alt="QR Code"
                    className="border-2 border-muted rounded-lg w-[200px] h-[200px] sm:w-[250px] sm:h-[250px] object-contain"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() =>
                      handleCopyCode(showCodeDialog.child.login_code)
                    }
                    variant="outline"
                    className="flex-1 w-full sm:w-auto"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Code
                  </Button>
                  <Button
                    onClick={() => handleCopyMagicLink(showCodeDialog.child)}
                    variant="outline"
                    className="flex-1 w-full sm:w-auto"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Copy Link
                  </Button>
                  <Button
                    onClick={() => handlePrintCode(showCodeDialog.child)}
                    variant="outline"
                    className="flex-1 w-full sm:w-auto"
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Button>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Edit Login Code Confirmation Dialog */}
        <AlertDialog
          open={!!childToEditCode}
          onOpenChange={(open) => !open && setChildToEditCode(null)}
        >
          <AlertDialogContent>
            <button
              onClick={() => setChildToEditCode(null)}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
              disabled={isUpdatingCode}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
            <AlertDialogHeader>
              <AlertDialogTitle>Generate New Login Code</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to generate a new login code for{" "}
                {childToEditCode?.name}? The current code (
                {childToEditCode?.login_code}) will no longer work. Make sure to
                share the new code with your child.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isUpdatingCode}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleUpdateLoginCode}
                disabled={isUpdatingCode}
              >
                {isUpdatingCode ? "Generating..." : "Generate New Code"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Child Confirmation Dialog */}
        <AlertDialog
          open={!!childToDelete}
          onOpenChange={(open) => !open && setChildToDelete(null)}
        >
          <AlertDialogContent>
            <button
              onClick={() => setChildToDelete(null)}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Child</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove {childToDelete?.name}? This
                action cannot be undone and will delete all associated data
                including messages and call history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteChild}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Incoming Call Dialog */}
        <AlertDialog
          open={!!incomingCall}
          onOpenChange={(open) => {
            // Only decline if dialog is being closed AND user didn't click Answer
            // Don't decline if user is answering (isAnsweringRef will be true)
            if (!open && incomingCall && !isAnsweringRef.current) {
              handleDeclineCall();
            }
          }}
        >
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                  style={{
                    backgroundColor:
                      incomingCall?.child_avatar_color || "#3B82F6",
                  }}
                >
                  {incomingCall?.child_name[0]}
                </div>
                <div>
                  <AlertDialogTitle className="text-xl">
                    Incoming Call
                  </AlertDialogTitle>
                  <p className="text-base font-normal text-muted-foreground">
                    {incomingCall?.child_name} is calling...
                  </p>
                </div>
              </div>
              <div className="pt-4">
                <AlertDialogDescription className="sr-only">
                  Incoming call from {incomingCall?.child_name}
                </AlertDialogDescription>
                <div className="flex items-center justify-center gap-2 text-4xl animate-pulse">
                  <Phone className="h-12 w-12" />
                </div>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center gap-2">
              <AlertDialogCancel
                onClick={handleDeclineCall}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Decline
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleAnswerCall}
                className="bg-green-600 hover:bg-green-700"
              >
                Answer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Print View Modal (Mobile) */}
        {printViewChild && (
          <AlertDialog
            open={!!printViewChild}
            onOpenChange={(open) => !open && setPrintViewChild(null)}
          >
            <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md print:hidden">
              <button
                onClick={() => setPrintViewChild(null)}
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none print:hidden"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-lg sm:text-xl">
                  {printViewChild.name}'s Login Code
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm">
                  Print or share this code with your child
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4">
                <div className="bg-muted p-3 sm:p-4 rounded-lg text-center print:border-2 print:border-gray-800">
                  <p className="text-xs text-muted-foreground mb-2 print:text-gray-600">
                    Login Code
                  </p>
                  <p className="text-2xl sm:text-3xl font-mono font-bold break-all print:text-3xl">
                    {printViewChild.login_code}
                  </p>
                </div>
                <div className="flex justify-center print:my-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                      `${window.location.origin}/child/login?code=${printViewChild.login_code}`
                    )}`}
                    alt="QR Code"
                    className="border-2 border-muted rounded-lg w-[250px] h-[250px] sm:w-[300px] sm:h-[300px] object-contain print:border-gray-800"
                  />
                </div>
                <div className="instructions print:mt-4 print:text-sm print:text-gray-600">
                  <p>Scan the QR code or use the code above to log in</p>
                  <p>Visit: {window.location.origin}/child/login</p>
                </div>
              </div>
              <AlertDialogFooter className="print:hidden">
                <Button
                  onClick={handlePrintFromModal}
                  variant="default"
                  className="flex-1"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
                <AlertDialogCancel>Close</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
};

export default ParentDashboard;

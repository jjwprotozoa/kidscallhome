import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Video, MessageCircle, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { endCall as endCallUtil } from "@/features/calls/utils/callEnding";
import type { RealtimeChannel } from "@supabase/supabase-js";
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
import { useToast } from "@/hooks/use-toast";
import { useIncomingCallNotifications } from "@/features/calls/hooks/useIncomingCallNotifications";
import Navigation from "@/components/Navigation";
import { useMissedBadgeForChild, useUnreadBadgeForChild } from "@/stores/badgeStore";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { usePresence } from "@/features/presence/usePresence";
import { useParentPresence } from "@/features/presence/useParentPresence";
import { StatusIndicator } from "@/features/presence/StatusIndicator";

interface ChildSession {
  id: string;
  name: string;
  avatar_color: string;
  parent_id: string;
}

interface IncomingCall {
  id: string;
  parent_id: string;
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

const ChildDashboard = () => {
  const [child, setChild] = useState<ChildSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [parentName, setParentName] = useState<string>("Parent");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const parentNameRef = useRef<string>("Parent"); // Ref to track latest parentName for subscription callbacks
  
  // Get badge counts from store (derived, no DB reads)
  const missedCallCount = useMissedBadgeForChild(child?.id || null);
  const unreadMessageCount = useUnreadBadgeForChild(child?.id || null);
  const incomingCallRef = useRef<IncomingCall | null>(null); // Ref to track latest incomingCall for subscription callbacks
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isAnsweringRef = useRef(false); // Track if user is answering to prevent auto-decline
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { handleIncomingCall, stopIncomingCall } = useIncomingCallNotifications({
    enabled: true,
    volume: 0.7,
  });
  const handleIncomingCallRef = useRef(handleIncomingCall); // Ref to track latest handleIncomingCall for subscription callbacks

  useEffect(() => {
    const sessionData = localStorage.getItem("childSession");
    if (!sessionData) {
      navigate("/child/login");
      return;
    }
    const childData = JSON.parse(sessionData);
    setChild(childData);

    // Check if a parent was selected from the parents list
    const storedParentId = localStorage.getItem("selectedParentId");
    if (storedParentId) {
      setSelectedParentId(storedParentId);
    }

    // Fetch parent name
    const fetchParentName = async () => {
      try {
        // Use selected parent ID if available, otherwise use child's parent_id
        let parentIdToFetch: string;
        
        if (storedParentId) {
          parentIdToFetch = storedParentId;
        } else {
          // First get the child's parent_id from the database
          const { data: childRecord, error: childError } = await supabase
            .from("children")
            .select("parent_id")
            .eq("id", childData.id)
            .single();

          if (childError || !childRecord) {
            console.error("Error fetching child record:", childError);
            return;
          }
          parentIdToFetch = childRecord.parent_id;
          setSelectedParentId(parentIdToFetch);
        }

        // Then fetch the parent's name
        const { data: parentData, error: parentError } = await supabase
          .from("parents")
          .select("name")
          .eq("id", parentIdToFetch)
          .maybeSingle();

        if (parentError) {
          console.error("Error fetching parent name:", parentError);
          return;
        }

        if (parentData?.name) {
          setParentName(parentData.name);
          parentNameRef.current = parentData.name;
        } else {
          // Parent name not found, use default
          if (import.meta.env.DEV) {
            console.warn("Parent name not found for parent_id:", parentIdToFetch);
          }
          setParentName("Parent");
          parentNameRef.current = "Parent";
        }
      } catch (error) {
        console.error("Error fetching parent name:", error);
      }
    };

    fetchParentName();

    let lastCheckedCallId: string | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const setupSubscription = async () => {
      // Function to handle incoming call notification
      const handleIncomingCallNotification = async (call: CallRecord) => {
        // Skip if we already showed this call
        if (call.id === lastCheckedCallId) return;

        // IMPORTANT: Don't show incoming call notification if user is already on the call page
        // This prevents showing notifications for calls the child initiated
        if (location.pathname.startsWith("/call/")) {
          return;
        }

        lastCheckedCallId = call.id;
        setIncomingCall({
          id: call.id,
          parent_id: call.parent_id,
        });
        // Handle incoming call with notifications (push notification if tab inactive, ringtone if active)
        handleIncomingCallRef.current({
          callId: call.id,
          callerName: parentNameRef.current,
          callerId: call.parent_id,
          url: `/call/${childData.id}?callId=${call.id}`,
        });
      };

      // Check for existing ringing calls from parent (in case subscription missed them)
      // Check calls created in the last 2 minutes to catch calls that might have been created
      // while the dashboard was loading or subscription was setting up
      const checkExistingCalls = async () => {
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const { data: existingCalls } = await supabase
          .from("calls")
          .select("*")
          .eq("child_id", childData.id)
          .eq("caller_type", "parent")
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
      // IMPORTANT: Only check for parent-initiated calls, not child-initiated ones
      // Use a 1-minute window since we poll every 10 seconds
      const pollForCalls = async () => {
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
        const { data: newCalls } = await supabase
          .from("calls")
          .select("*")
          .eq("child_id", childData.id)
          .eq("caller_type", "parent") // Only parent-initiated calls
          .eq("status", "ringing")
          .gte("created_at", oneMinuteAgo)
          .order("created_at", { ascending: false })
          .limit(1);

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

      // Subscribe to new calls from parent
      // Listen to both INSERT and UPDATE events to catch calls that are reset to ringing
      channelRef.current = supabase
        .channel("child-incoming-calls")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "calls",
            filter: `child_id=eq.${childData.id}`,
          },
          async (payload) => {
            const call = payload.new as CallRecord;

            // Verify this call is from a parent, for this child, and is ringing
            // IMPORTANT: Only show incoming call dialog for parent-initiated calls, not child-initiated ones
            if (
              call.caller_type === "parent" &&
              call.child_id === childData.id &&
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
            filter: `child_id=eq.${childData.id}`,
          },
          async (payload) => {
            const call = payload.new as CallRecord;
            const oldCall = payload.old as CallRecord;

            // CRITICAL: Always ignore child-initiated calls - they should never show notifications
            // Child-initiated calls are handled by the call page, not the dashboard
            if (call.caller_type === "child") {
              return; // Early return - don't process child-initiated calls at all
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

            // Check if status changed to "ringing" for a parent-initiated call
            // IMPORTANT: Only show incoming call dialog for parent-initiated calls
            if (
              call.caller_type === "parent" &&
              call.child_id === childData.id &&
              call.status === "ringing" &&
              oldCall.status !== "ringing"
            ) {
              await handleIncomingCallNotification(call);
            }
          }
        )
        .subscribe((status, err) => {
          if (err) {
            console.error("❌ [CHILD DASHBOARD] Realtime subscription error:", err);
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
  }, [navigate, location.pathname]);

  // Keep refs in sync with state/hooks so subscription callbacks always have latest values
  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);
  
  useEffect(() => {
    handleIncomingCallRef.current = handleIncomingCall;
  }, [handleIncomingCall]);

  // Track child's online presence
  usePresence({
    userId: child?.id || "",
    userType: "child",
    name: child?.name,
    enabled: !!child,
  });

  // Track parent's online presence
  const { isOnline: isParentOnline } = useParentPresence({
    parentId: selectedParentId || child?.parent_id || "",
    enabled: !!(selectedParentId || child?.parent_id),
  });

  // Stop notifications when incoming call is cleared
  useEffect(() => {
    if (!incomingCall && incomingCallRef.current) {
      stopIncomingCall(incomingCallRef.current.id);
    }
  }, [incomingCall, stopIncomingCall]);


  const handleCall = async () => {
    if (child && selectedParentId) {
      // Acknowledge missed calls from parent when clicking call button
      // This clears the badge immediately and syncs to all devices
      try {
        const { acknowledgeMissedCalls } = await import("@/utils/acknowledgeMissedCalls");
        await acknowledgeMissedCalls(child.id, "parent");
      } catch (error) {
        // Log error but don't block navigation
        console.error("Error acknowledging missed calls:", error);
      }
      // Navigate directly to call page (no extra "Start Call" step)
      navigate(`/call/${child.id}`);
    } else if (!selectedParentId) {
      // If no parent selected, navigate to parents list
      navigate("/child/parents");
    }
  };

  const handleChat = () => {
    if (child && selectedParentId) {
      navigate(`/chat/${child.id}`);
    } else if (!selectedParentId) {
      // If no parent selected, navigate to parents list
      navigate("/child/parents");
    }
  };

  const handleAnswerCall = () => {
    if (incomingCall && child) {
      // Stop incoming call notifications
      stopIncomingCall(incomingCall.id);
      // Mark that we're answering to prevent onOpenChange from declining
      isAnsweringRef.current = true;
      const callId = incomingCall.id;
      setIncomingCall(null);
      // Pass callId as URL param so VideoCall can find the specific incoming call
      navigate(`/call/${child.id}?callId=${callId}`);
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
          by: "child",
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

  if (!child) return null;

  return (
    <div className="min-h-[100dvh] bg-primary/5">
      <Navigation />
      <OnboardingTour role="child" pageKey="child_dashboard" />
      <HelpBubble role="child" pageKey="child_dashboard" />
      <div className="p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="mt-8">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold text-white"
                style={{ backgroundColor: child.avatar_color }}
              >
                {child.name[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold">Hi {child.name}!</h1>
                </div>
                <div className="text-muted-foreground">
                  {selectedParentId ? (
                    <span className="flex items-center gap-2">
                      Ready to connect with {parentName}?
                      {selectedParentId && (
                        <StatusIndicator
                          isOnline={isParentOnline}
                          size="sm"
                          showPulse={isParentOnline}
                        />
                      )}
                    </span>
                  ) : (
                    "Select a parent to contact"
                  )}
                </div>
              </div>
            </div>
          </div>

        {!selectedParentId ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground mb-4">
              Please select a parent first
            </p>
            <Button onClick={() => navigate("/child/parents")} size="lg">
              Select Parent
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
          <Card
            className="p-8 cursor-pointer hover:shadow-lg transition-all border-4 relative"
            style={{ borderColor: child.avatar_color }}
            onClick={handleCall}
            data-tour="child-answer-button"
          >
            {missedCallCount > 0 && (
              <span className="absolute top-4 right-4 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-[24px] h-6 flex items-center justify-center px-2 border-2 border-background">
                {missedCallCount > 99 ? "99+" : missedCallCount}
              </span>
            )}
            <div className="flex items-center gap-6">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: child.avatar_color }}
              >
                <Video className="h-10 w-10 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-3xl font-bold mb-2">Call {parentName}</h2>
                  <StatusIndicator
                    isOnline={isParentOnline}
                    size="md"
                    showPulse={isParentOnline}
                  />
                </div>
                <p className="text-muted-foreground">
                  {isParentOnline ? "Parent is online" : "Parent is offline"}
                </p>
              </div>
            </div>
          </Card>

          <Card
            className="p-8 cursor-pointer hover:shadow-lg transition-all border-4 relative"
            style={{ borderColor: child.avatar_color }}
            onClick={handleChat}
            data-tour="child-messages"
          >
            {unreadMessageCount > 0 && (
              <span className="absolute top-4 right-4 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-[24px] h-6 flex items-center justify-center px-2 border-2 border-background">
                {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
              </span>
            )}
            <div className="flex items-center gap-6">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: child.avatar_color }}
              >
                <MessageCircle className="h-10 w-10 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-3xl font-bold mb-2">Send Message</h2>
                  <StatusIndicator
                    isOnline={isParentOnline}
                    size="md"
                    showPulse={isParentOnline}
                  />
                </div>
                <p className="text-muted-foreground">
                  Chat with {parentName} {isParentOnline ? "(online)" : "(offline)"}
                </p>
              </div>
            </div>
          </Card>
        </div>
        )}
        </div>
      </div>

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
                  backgroundColor: child?.avatar_color || "#3B82F6",
                }}
              >
                📞
              </div>
              <div>
                <AlertDialogTitle className="text-xl">Incoming Call</AlertDialogTitle>
                <p className="text-base font-normal text-muted-foreground">
                  {parentName} is calling...
                </p>
              </div>
            </div>
            <div className="pt-4">
              <AlertDialogDescription className="sr-only">
                Incoming call from {parentName}
              </AlertDialogDescription>
              <div className="flex items-center justify-center gap-2 text-4xl animate-pulse">
                <Phone className="h-12 w-12" />
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2">
            <AlertDialogCancel onClick={handleDeclineCall} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Decline
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleAnswerCall} className="bg-green-600 hover:bg-green-700">
              Answer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChildDashboard;

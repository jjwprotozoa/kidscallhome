import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Video, MessageCircle, LogOut, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { endCall as endCallUtil } from "@/utils/callEnding";
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
import { useIncomingCallNotifications } from "@/hooks/useIncomingCallNotifications";

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
  const [parentName, setParentName] = useState<string>("Mom/Dad");
  const parentNameRef = useRef<string>("Mom/Dad"); // Ref to track latest parentName for subscription callbacks
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

  useEffect(() => {
    const sessionData = localStorage.getItem("childSession");
    if (!sessionData) {
      navigate("/child/login");
      return;
    }
    const childData = JSON.parse(sessionData);
    setChild(childData);

    // Fetch parent name
    const fetchParentName = async () => {
      try {
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

        // Then fetch the parent's name
        const { data: parentData, error: parentError } = await supabase
          .from("parents")
          .select("name")
          .eq("id", childRecord.parent_id)
          .maybeSingle();

        if (parentError) {
          console.error("Error fetching parent name:", parentError);
          return;
        }

        if (parentData?.name) {
          setParentName(parentData.name);
          parentNameRef.current = parentData.name;
        } else {
          // Parent name not found, keep default "Mom/Dad"
          console.warn("Parent name not found for parent_id:", childRecord.parent_id);
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
          console.log(
            "📞 [CHILD DASHBOARD] User is on call page, not showing incoming call notification"
          );
          return;
        }

        lastCheckedCallId = call.id;

        console.log("Setting incoming call from parent:", call.id);
        setIncomingCall({
          id: call.id,
          parent_id: call.parent_id,
        });
        // Handle incoming call with notifications (push notification if tab inactive, ringtone if active)
        handleIncomingCall({
          callId: call.id,
          callerName: parentNameRef.current,
          callerId: call.parent_id,
          url: `/call/${childData.id}?callId=${call.id}`,
        });
      };

      // Check for existing ringing calls from parent (in case subscription missed them)
      // Only show calls created in the last 30 seconds to avoid showing stale calls
      const checkExistingCalls = async () => {
        const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
        const { data: existingCalls } = await supabase
          .from("calls")
          .select("*")
          .eq("child_id", childData.id)
          .eq("caller_type", "parent")
          .eq("status", "ringing")
          .gte("created_at", thirtySecondsAgo)
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
      // Use a longer time window since we poll less frequently
      const pollForCalls = async () => {
        const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
        const { data: newCalls } = await supabase
          .from("calls")
          .select("*")
          .eq("child_id", childData.id)
          .eq("caller_type", "parent") // Only parent-initiated calls
          .eq("status", "ringing")
          .gte("created_at", thirtySecondsAgo)
          .order("created_at", { ascending: false })
          .limit(1);

        if (newCalls && newCalls.length > 0) {
          const call = newCalls[0];
          if (call.id !== lastCheckedCallId) {
            console.log(
              "📞 [CHILD DASHBOARD] Polling found parent-initiated call:",
              call.id
            );
            await handleIncomingCallNotification(call);
          }
        }
      };

      // Check immediately
      await checkExistingCalls();

      // Set up polling as a fallback (every 30 seconds to reduce database queries)
      // Realtime subscriptions should handle most cases, this is just a safety net
      pollInterval = setInterval(pollForCalls, 30000);

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
          },
          async (payload) => {
            const call = payload.new as CallRecord;
            console.log("Received call INSERT event:", call);

            // Verify this call is from a parent, for this child, and is ringing
            // IMPORTANT: Only show incoming call dialog for parent-initiated calls, not child-initiated ones
            if (
              call.caller_type === "parent" &&
              call.child_id === childData.id &&
              call.status === "ringing"
            ) {
              console.log("Call is for this child, showing notification...");
              await handleIncomingCallNotification(call);
            } else {
              console.log("Call not for this child or not ringing:", {
                callerType: call.caller_type,
                callChildId: call.child_id,
                currentChildId: childData.id,
                status: call.status,
                reason:
                  call.caller_type === "child"
                    ? "Child-initiated call - not showing notification"
                    : "Not a ringing parent-initiated call",
              });
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "calls",
          },
          async (payload) => {
            const call = payload.new as CallRecord;
            const oldCall = payload.old as CallRecord;
            console.log("Received call UPDATE event:", {
              new: call,
              old: oldCall,
            });

            // CRITICAL: Always ignore child-initiated calls - they should never show notifications
            // Child-initiated calls are handled by the call page, not the dashboard
            if (call.caller_type === "child") {
              console.log(
                "📞 [CHILD DASHBOARD] Ignoring child-initiated call update:",
                {
                  callId: call.id,
                  status: call.status,
                  oldStatus: oldCall?.status,
                  reason:
                    "Child-initiated calls should not show notifications - handled by call page",
                }
              );
              return; // Early return - don't process child-initiated calls at all
            }

            // Don't process updates if user is on the call page
            if (location.pathname.startsWith("/call/")) {
              console.log(
                "📞 [CHILD DASHBOARD] User is on call page, ignoring UPDATE event"
              );
              return;
            }

            // Clear incoming call if it was answered or ended
            // Use ref to get latest value without needing to re-run subscription
            if (
              incomingCallRef.current &&
              incomingCallRef.current.id === call.id
            ) {
              if (call.status === "active" || call.status === "ended") {
                console.log(
                  "Call was answered or ended, clearing incoming call notification"
                );
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
              console.log(
                "Call status changed to ringing, showing notification..."
              );
              await handleIncomingCallNotification(call);
            }
          }
        )
        .subscribe();
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
  }, [navigate, location.pathname, handleIncomingCall, parentName]);

  // Keep ref in sync with state so subscription callbacks always have latest value
  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  // Stop notifications when incoming call is cleared
  useEffect(() => {
    if (!incomingCall && incomingCallRef.current) {
      stopIncomingCall(incomingCallRef.current.id);
    }
  }, [incomingCall, stopIncomingCall]);

  const handleLogout = () => {
    localStorage.removeItem("childSession");
    navigate("/child/login");
  };

  const handleCall = () => {
    if (child) {
      console.log("📞 [CHILD DASHBOARD] Child clicked 'Call' button, navigating to call page:", {
        childId: child.id,
        timestamp: new Date().toISOString()
      });
      navigate(`/call/${child.id}`);
    }
  };

  const handleChat = () => {
    if (child) {
      navigate(`/chat/${child.id}`);
    }
  };

  const handleAnswerCall = () => {
    if (incomingCall && child) {
      console.log("📞 [USER ACTION] Child answering call", {
        callId: incomingCall.id,
        childId: child.id,
        timestamp: new Date().toISOString(),
      });
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
        console.log(
          "📞 [USER ACTION] Resetting isAnswering flag after navigation"
        );
        isAnsweringRef.current = false;
      }, 2000); // Increased from 500ms to 2000ms to ensure navigation completed
    }
  };

  const handleDeclineCall = async () => {
    if (incomingCall) {
      console.log("🛑 [USER ACTION] Child declining call", {
        callId: incomingCall.id,
        isAnswering: isAnsweringRef.current,
        timestamp: new Date().toISOString(),
      });

      // Don't decline if we're in the process of answering
      if (isAnsweringRef.current) {
        console.log(
          "⚠️ [USER ACTION] Prevented decline - call is being answered"
        );
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
    <div className="min-h-screen bg-primary/5 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold text-white"
              style={{ backgroundColor: child.avatar_color }}
            >
              {child.name[0]}
            </div>
            <div>
              <h1 className="text-3xl font-bold">Hi {child.name}!</h1>
              <p className="text-muted-foreground">Ready to connect?</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" size="sm">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-4">
          <Card
            className="p-8 cursor-pointer hover:shadow-lg transition-all border-4"
            style={{ borderColor: child.avatar_color }}
            onClick={handleCall}
          >
            <div className="flex items-center gap-6">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: child.avatar_color }}
              >
                <Video className="h-10 w-10 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-2">Call {parentName}</h2>
                <p className="text-muted-foreground">Start a video call</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-8 cursor-pointer hover:shadow-lg transition-all border-4"
            style={{ borderColor: child.avatar_color }}
            onClick={handleChat}
          >
            <div className="flex items-center gap-6">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: child.avatar_color }}
              >
                <MessageCircle className="h-10 w-10 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-2">Send Message</h2>
                <p className="text-muted-foreground">Chat with {parentName}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Incoming Call Dialog */}
      <AlertDialog
        open={!!incomingCall}
        onOpenChange={(open) => {
          console.log("📞 [UI EVENT] Incoming call dialog open state changed", {
            open: open,
            hasIncomingCall: !!incomingCall,
            isAnswering: isAnsweringRef.current,
            timestamp: new Date().toISOString(),
          });
          // Only decline if dialog is being closed AND user didn't click Answer
          // Don't decline if user is answering (isAnsweringRef will be true)
          if (!open && incomingCall && !isAnsweringRef.current) {
            console.log(
              "🛑 [UI EVENT] Dialog closed without answering - declining call"
            );
            handleDeclineCall();
          } else if (!open && isAnsweringRef.current) {
            console.log(
              "✅ [UI EVENT] Dialog closed but call is being answered - not declining"
            );
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

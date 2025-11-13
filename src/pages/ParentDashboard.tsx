import AddChildDialog from "@/components/AddChildDialog";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { endCall as endCallUtil } from "@/utils/callEnding";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { LogOut, MessageCircle, Phone, Plus, Video } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

const ParentDashboard = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const incomingCallRef = useRef<IncomingCall | null>(null); // Ref to track latest incomingCall for subscription callbacks
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isAnsweringRef = useRef(false); // Track if user is answering to prevent auto-decline
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const checkAuth = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/parent/auth");
    }
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
    checkAuth();
    fetchChildren();

    let lastCheckedCallId: string | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const setupSubscription = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Function to handle incoming call notification
      const handleIncomingCall = async (call: CallRecord) => {
        // Skip if we already showed this call
        if (call.id === lastCheckedCallId) return;

        // IMPORTANT: Don't show incoming call notification if user is already on the call page
        // This prevents showing notifications for calls the parent initiated
        if (location.pathname.startsWith("/call/")) {
          console.log(
            "📞 [PARENT DASHBOARD] User is on call page, not showing incoming call notification"
          );
          return;
        }

        lastCheckedCallId = call.id;

        const { data: childData } = await supabase
          .from("children")
          .select("name, avatar_color")
          .eq("id", call.child_id)
          .single();

        if (childData) {
          console.log("Setting incoming call:", childData.name);
          setIncomingCall({
            id: call.id,
            child_id: call.child_id,
            child_name: childData.name,
            child_avatar_color: childData.avatar_color,
          });
        } else {
          console.error("Failed to fetch child data for call");
        }
      };

      // Check for existing ringing calls from children (in case subscription missed them)
      // Only show calls created in the last 30 seconds to avoid showing stale calls
      const checkExistingCalls = async () => {
        const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
        const { data: existingCalls } = await supabase
          .from("calls")
          .select("*")
          .eq("parent_id", user.id)
          .eq("caller_type", "child")
          .eq("status", "ringing")
          .gte("created_at", thirtySecondsAgo)
          .order("created_at", { ascending: false })
          .limit(1);

        if (existingCalls && existingCalls.length > 0) {
          const call = existingCalls[0];
          if (call.id !== lastCheckedCallId) {
            await handleIncomingCall(call);
          }
        }
      };

      // Polling function to check for new calls (fallback for realtime)
      // IMPORTANT: Only check for child-initiated calls, not parent-initiated ones
      const pollForCalls = async () => {
        const twoSecondsAgo = new Date(Date.now() - 2 * 1000).toISOString();
        const { data: newCalls, error: pollError } = await supabase
          .from("calls")
          .select("*")
          .eq("parent_id", user.id)
          .eq("caller_type", "child") // Only child-initiated calls
          .eq("status", "ringing")
          .gte("created_at", twoSecondsAgo)
          .order("created_at", { ascending: false })
          .limit(1);

        if (pollError) {
          console.error("❌ [PARENT DASHBOARD] Polling error:", pollError);
          return;
        }

        if (newCalls && newCalls.length > 0) {
          const call = newCalls[0];
          if (call.id !== lastCheckedCallId) {
            console.log(
              "📞 [PARENT DASHBOARD] Polling found child-initiated call:",
              {
                callId: call.id,
                childId: call.child_id,
                status: call.status,
                createdAt: call.created_at,
              }
            );
            await handleIncomingCall(call);
          }
        }
      };

      // Check immediately
      await checkExistingCalls();

      // Set up polling as a fallback (every 2 seconds)
      pollInterval = setInterval(pollForCalls, 2000);

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
            filter: `parent_id=eq.${user.id}`,
          },
          async (payload) => {
            const call = payload.new as CallRecord;
            console.log("📞 [PARENT DASHBOARD] Received call INSERT event:", {
              callId: call.id,
              callerType: call.caller_type,
              parentId: call.parent_id,
              childId: call.child_id,
              status: call.status,
              currentUserId: user.id,
              matches:
                call.caller_type === "child" &&
                call.parent_id === user.id &&
                call.status === "ringing",
            });

            // Verify this call is from a child, for this parent, and is ringing
            // IMPORTANT: Only show incoming call dialog for child-initiated calls, not parent-initiated ones
            if (
              call.caller_type === "child" &&
              call.parent_id === user.id &&
              call.status === "ringing"
            ) {
              console.log(
                "✅ [PARENT DASHBOARD] Call is for this parent, fetching child details..."
              );
              await handleIncomingCall(call);
            } else {
              console.log(
                "❌ [PARENT DASHBOARD] Call not for this parent or not ringing:",
                {
                  callerType: call.caller_type,
                  callParentId: call.parent_id,
                  currentUserId: user.id,
                  status: call.status,
                  reason:
                    call.caller_type === "parent"
                      ? "Parent-initiated call - not showing notification"
                      : call.parent_id !== user.id
                      ? "Call is for a different parent"
                      : call.status !== "ringing"
                      ? "Call is not in ringing status"
                      : "Not a ringing child-initiated call",
                }
              );
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

            // CRITICAL: Always ignore parent-initiated calls - they should never show notifications
            // Parent-initiated calls are handled by the call page, not the dashboard
            if (call.caller_type === "parent") {
              console.log(
                "📞 [PARENT DASHBOARD] Ignoring parent-initiated call update:",
                {
                  callId: call.id,
                  status: call.status,
                  oldStatus: oldCall?.status,
                  reason:
                    "Parent-initiated calls should not show notifications - handled by call page",
                }
              );
              return; // Early return - don't process parent-initiated calls at all
            }

            // Don't process updates if user is on the call page
            if (location.pathname.startsWith("/call/")) {
              console.log(
                "📞 [PARENT DASHBOARD] User is on call page, ignoring UPDATE event"
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

            // Check if status changed to "ringing" for a child-initiated call
            // IMPORTANT: Only show incoming call dialog for child-initiated calls
            if (
              call.caller_type === "child" &&
              call.parent_id === user.id &&
              call.status === "ringing" &&
              oldCall.status !== "ringing"
            ) {
              console.log(
                "Call status changed to ringing, fetching child details..."
              );
              await handleIncomingCall(call);
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
  }, [checkAuth, fetchChildren, location.pathname]);

  // Keep ref in sync with state so subscription callbacks always have latest value
  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/parent/auth");
  };

  const handleChat = (childId: string) => {
    navigate(`/chat/${childId}`);
  };

  const handleCall = (childId: string) => {
    navigate(`/call/${childId}`);
  };

  const handleAnswerCall = () => {
    if (incomingCall) {
      console.log("📞 [USER ACTION] Parent answering call", {
        callId: incomingCall.id,
        childId: incomingCall.child_id,
        timestamp: new Date().toISOString(),
      });
      // Mark that we're answering to prevent onOpenChange from declining
      isAnsweringRef.current = true;
      const childId = incomingCall.child_id;
      const callId = incomingCall.id;
      setIncomingCall(null);
      navigate(`/call/${childId}`);
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
      console.log("🛑 [USER ACTION] Parent declining call", {
        callId: incomingCall.id,
        childId: incomingCall.child_id,
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
      setIncomingCall(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">My Children</h1>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
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
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">
              You haven't added any children yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Click "Add Child" above to create a profile and login code.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {children.map((child) => (
              <Card
                key={child.id}
                className="p-6 space-y-4"
                style={{
                  borderLeft: `4px solid ${child.avatar_color}`,
                }}
              >
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">{child.name}</h3>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">
                      Login Code
                    </p>
                    <p className="text-2xl font-mono font-bold tracking-wider">
                      {child.login_code}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleCall(child.id)}
                    className="flex-1"
                    variant="secondary"
                  >
                    <Video className="mr-2 h-4 w-4" />
                    Call
                  </Button>
                  <Button
                    onClick={() => handleChat(child.id)}
                    className="flex-1"
                    variant="default"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Chat
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
    </div>
  );
};

export default ParentDashboard;

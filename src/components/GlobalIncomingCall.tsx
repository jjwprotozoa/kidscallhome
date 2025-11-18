// src/components/GlobalIncomingCall.tsx
// Global incoming call handler - shows incoming call dialog on any page

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIncomingCallNotifications } from "@/features/calls/hooks/useIncomingCallNotifications";
import { endCall as endCallUtil } from "@/features/calls/utils/callEnding";
import { AndroidIncomingCall } from "@/components/native/AndroidIncomingCall";
import { isNativeAndroid } from "@/utils/nativeAndroid";
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
import { Phone } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface CallRecord {
  id: string;
  child_id: string;
  parent_id: string;
  caller_type: string;
  status: string;
  created_at: string;
  ended_at?: string | null;
}

interface IncomingCall {
  id: string;
  child_id?: string;
  parent_id?: string;
  child_name?: string;
  child_avatar_color?: string;
  parent_name?: string;
}

export const GlobalIncomingCall = () => {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const incomingCallRef = useRef<IncomingCall | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isAnsweringRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { handleIncomingCall, stopIncomingCall } = useIncomingCallNotifications({
    enabled: true,
    volume: 0.7,
  });
  const handleIncomingCallRef = useRef(handleIncomingCall);

  // Keep refs in sync
  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    handleIncomingCallRef.current = handleIncomingCall;
  }, [handleIncomingCall]);

  useEffect(() => {
    let lastCheckedCallId: string | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let cachedUserId: string | null = null; // Cache user ID to avoid repeated getUser() calls

    const setupSubscription = async () => {
      // Check if user is authenticated (parent) or has child session (child)
      const { data: { session } } = await supabase.auth.getSession();
      const childSession = localStorage.getItem("childSession");
      
      // Determine user type
      const isChild = !session && !!childSession;
      
      if (!session && !childSession) {
        // No session - don't set up subscriptions
        return;
      }

      // Cache user ID once at setup (for parents)
      if (!isChild && session?.user?.id) {
        cachedUserId = session.user.id;
      }

      const handleIncomingCallNotification = async (call: CallRecord) => {
        // Skip if we already showed this call
        if (call.id === lastCheckedCallId) return;

        // IMPORTANT: Don't show incoming call notification if user is already on the call page
        if (location.pathname.startsWith("/call/")) {
          return;
        }

        lastCheckedCallId = call.id;

        if (isChild) {
          // Child receiving call from parent
          const { data: parentData } = await supabase
            .from("parents")
            .select("name")
            .eq("id", call.parent_id)
            .maybeSingle();

          setIncomingCall({
            id: call.id,
            parent_id: call.parent_id,
            parent_name: parentData?.name || "Parent",
          });

          handleIncomingCallRef.current({
            callId: call.id,
            callerName: parentData?.name || "Parent",
            callerId: call.parent_id,
            url: `/call/${call.child_id}?callId=${call.id}`,
          });
        } else {
          // Parent receiving call from child
          const { data: childData } = await supabase
            .from("children")
            .select("name, avatar_color")
            .eq("id", call.child_id)
            .single();

          if (childData) {
            setIncomingCall({
              id: call.id,
              child_id: call.child_id,
              child_name: childData.name,
              child_avatar_color: childData.avatar_color,
            });

            handleIncomingCallRef.current({
              callId: call.id,
              callerName: childData.name,
              callerId: call.child_id,
              url: `/call/${call.child_id}?callId=${call.id}`,
            });
          }
        }
      };

      // Check for existing ringing calls
      const checkExistingCalls = async () => {
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        
        if (isChild) {
          const childData = JSON.parse(childSession!);
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
        } else {
          // Use cached user ID instead of calling getUser()
          if (!cachedUserId) {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) return;
            cachedUserId = session.user.id;
          }

          const { data: existingCalls } = await supabase
            .from("calls")
            .select("*")
            .eq("parent_id", cachedUserId)
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
        }
      };

      // Polling fallback
      const pollForCalls = async () => {
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
        
        if (isChild) {
          const childData = JSON.parse(childSession!);
          const { data: newCalls } = await supabase
            .from("calls")
            .select("*")
            .eq("child_id", childData.id)
            .eq("caller_type", "parent")
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
        } else {
          // Use cached user ID instead of calling getUser() every poll
          if (!cachedUserId) {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) return;
            cachedUserId = session.user.id;
          }

          const { data: newCalls } = await supabase
            .from("calls")
            .select("*")
            .eq("parent_id", cachedUserId)
            .eq("caller_type", "child")
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
        }
      };

      await checkExistingCalls();
      // Increased polling interval to 60s - realtime handles most cases, polling is just a safety net
      pollInterval = setInterval(pollForCalls, 60000);

      // Set up realtime subscription
      if (isChild) {
        const childData = JSON.parse(childSession!);
        channelRef.current = supabase
          .channel("global-child-incoming-calls")
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

              if (call.caller_type === "child") return;

              if (
                incomingCallRef.current &&
                incomingCallRef.current.id === call.id
              ) {
                if (call.status === "active" || call.status === "ended") {
                  setIncomingCall(null);
                  incomingCallRef.current = null;
                }
              }

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
          .subscribe();
      } else {
        // Use cached user ID instead of calling getUser()
        if (!cachedUserId) {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user?.id) return;
          cachedUserId = session.user.id;
        }

        channelRef.current = supabase
          .channel("global-parent-incoming-calls")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "calls",
              filter: `parent_id=eq.${cachedUserId}`,
            },
            async (payload) => {
              const call = payload.new as CallRecord;
              if (
                call.caller_type === "child" &&
                call.parent_id === cachedUserId &&
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
              filter: `parent_id=eq.${cachedUserId}`,
            },
            async (payload) => {
              const call = payload.new as CallRecord;
              const oldCall = payload.old as CallRecord;

              if (call.caller_type === "parent") return;

              if (
                incomingCallRef.current &&
                incomingCallRef.current.id === call.id
              ) {
                if (call.status === "active" || call.status === "ended") {
                  setIncomingCall(null);
                  incomingCallRef.current = null;
                }
              }

              if (
                call.caller_type === "child" &&
                call.parent_id === cachedUserId &&
                call.status === "ringing" &&
                oldCall.status !== "ringing"
              ) {
                await handleIncomingCallNotification(call);
              }
            }
          )
          .subscribe();
      }

      return () => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
        }
        if (pollInterval) {
          clearInterval(pollInterval);
        }
      };
    };

    setupSubscription();
  }, [location.pathname]);

  const handleAnswerCall = () => {
    if (incomingCall) {
      // Silent answer - navigation handles it
      stopIncomingCall(incomingCall.id);
      isAnsweringRef.current = true;
      const callId = incomingCall.id;
      
      if (incomingCall.child_id) {
        // Parent answering child's call
        navigate(`/call/${incomingCall.child_id}?callId=${callId}`);
      } else if (incomingCall.parent_id) {
        // Child answering parent's call - need child ID from session
        const childSession = localStorage.getItem("childSession");
        if (childSession) {
          const childData = JSON.parse(childSession);
          navigate(`/call/${childData.id}?callId=${callId}`);
        }
      }
      
      setIncomingCall(null);
      setTimeout(() => {
        isAnsweringRef.current = false;
      }, 2000);
    }
  };

  const handleDeclineCall = async () => {
    if (incomingCall) {
      // Silent decline
      
      const { data: { session } } = await supabase.auth.getSession();
      const childSession = localStorage.getItem("childSession");
      const isChild = !session && !!childSession;
      const by = isChild ? 'child' : 'parent';

      try {
        await endCallUtil({ callId: incomingCall.id, by, reason: 'declined' });
      } catch (error) {
        console.error("Error declining call:", error);
      }

      stopIncomingCall(incomingCall.id);
      setIncomingCall(null);
    }
  };

  // Stop notifications when incoming call is cleared
  useEffect(() => {
    if (!incomingCall && incomingCallRef.current) {
      stopIncomingCall(incomingCallRef.current.id);
    }
  }, [incomingCall, stopIncomingCall]);

  if (!incomingCall) return null;

  return (
    <>
      {/* Native Android incoming call enhancement */}
      {isNativeAndroid() && (
        <AndroidIncomingCall
          callId={incomingCall.id}
          callerName={incomingCall.child_name || incomingCall.parent_name || "Caller"}
          callerId={incomingCall.child_id || incomingCall.parent_id || ""}
          onAccept={handleAnswerCall}
          onDecline={handleDeclineCall}
          isActive={!!incomingCall}
        />
      )}
      <AlertDialog
        open={!!incomingCall}
        onOpenChange={(open) => {
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
                backgroundColor: incomingCall.child_avatar_color || "#3B82F6",
              }}
            >
              {incomingCall.child_name?.[0] || "📞"}
            </div>
            <div>
              <AlertDialogTitle className="text-xl">Incoming Call</AlertDialogTitle>
              <p className="text-base font-normal text-muted-foreground">
                {incomingCall.child_name || incomingCall.parent_name} is calling...
              </p>
            </div>
          </div>
          <div className="pt-4">
            <AlertDialogDescription className="sr-only">
              Incoming call from {incomingCall.child_name || incomingCall.parent_name}
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
    </>
  );
};


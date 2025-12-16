// src/components/GlobalIncomingCall/useIncomingCallState.ts
// Purpose: State management hook for incoming calls (subscriptions, polling, notifications)
// CRITICAL: This hook manages WebRTC-related subscriptions - do not modify subscription logic

import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIncomingCallNotifications } from "@/features/calls/hooks/useIncomingCallNotifications";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { CallRecord, IncomingCall } from "./types";

export const useIncomingCallState = () => {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const incomingCallRef = useRef<IncomingCall | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
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
    let cachedUserId: string | null = null;

    const setupSubscription = async () => {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      const { getChildSessionLegacy } = await import("@/lib/childSession");
      const childSession = getChildSessionLegacy();
      const isChild = !session && !!childSession;
      
      if (!session && !childSession) {
        return;
      }

      if (!isChild && session?.user?.id) {
        cachedUserId = session.user.id;
      }

      const handleIncomingCallNotification = async (call: CallRecord) => {
        if (call.id === lastCheckedCallId) return;

        // CRITICAL: Don't show incoming call notification if user is already on the call page
        if (location.pathname.startsWith("/call/")) {
          return;
        }

        lastCheckedCallId = call.id;

        if (isChild) {
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

      const checkExistingCalls = async () => {
        if (location.pathname.startsWith("/call/")) {
          return;
        }
        
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        
        if (isChild) {
          const { getChildSessionLegacy } = await import("@/lib/childSession");
          const childData = getChildSessionLegacy();
          
          if (!childData?.id) {
            console.error("❌ [GLOBAL INCOMING CALL] Child session missing id");
            return;
          }
          
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

      const pollForCalls = async () => {
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
        
        if (isChild) {
          let childData;
          try {
            childData = JSON.parse(childSession!);
          } catch (error) {
            console.error("❌ [GLOBAL INCOMING CALL] Invalid child session data in poll:", error);
            return;
          }
          
          if (!childData?.id) {
            return;
          }
          
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
      pollInterval = setInterval(pollForCalls, 60000);

      // Set up realtime subscription
      if (isChild) {
        const { getChildSessionLegacy } = await import("@/lib/childSession");
        const childData = getChildSessionLegacy();
        
        if (!childData?.id) {
          console.error("❌ [GLOBAL INCOMING CALL] Child session missing id in subscription");
          return;
        }
        
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

              if (call.status === "active" || call.status === "ended") {
                if (
                  incomingCallRef.current &&
                  incomingCallRef.current.id === call.id
                ) {
                  setIncomingCall(null);
                  incomingCallRef.current = null;
                }
                stopIncomingCall(call.id);
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

              if (call.status === "active" || call.status === "ended") {
                if (
                  incomingCallRef.current &&
                  incomingCallRef.current.id === call.id
                ) {
                  setIncomingCall(null);
                  incomingCallRef.current = null;
                }
                stopIncomingCall(call.id);
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
  }, [location.pathname, stopIncomingCall]);

  // Stop notifications when incoming call is cleared
  useEffect(() => {
    if (!incomingCall && incomingCallRef.current) {
      stopIncomingCall(incomingCallRef.current.id);
    }
  }, [incomingCall, stopIncomingCall]);

  return {
    incomingCall,
    setIncomingCall,
    stopIncomingCall,
  };
};






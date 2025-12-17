// src/pages/ChildDashboard/useDashboardData.ts
// Purpose: Data fetching hook for child dashboard (child session, parent name, subscriptions)

import { useIncomingCallNotifications } from "@/features/calls/hooks/useIncomingCallNotifications";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CallRecord, ChildSession, IncomingCall } from "./types";

export const useDashboardData = () => {
  const [child, setChild] = useState<ChildSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [parentName, setParentName] = useState<string>("Parent");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const parentNameRef = useRef<string>("Parent");
  const incomingCallRef = useRef<IncomingCall | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { handleIncomingCall, stopIncomingCall } = useIncomingCallNotifications(
    {
      enabled: true,
      volume: 0.7,
    }
  );
  const handleIncomingCallRef = useRef(handleIncomingCall);
  const hasCheckedSession = useRef(false);

  useEffect(() => {
    // Only check session once on mount, not on every render/navigation
    // This prevents redirecting to login when using back button
    if (hasCheckedSession.current) {
      return;
    }

    const loadChildSession = async () => {
      const { getChildSessionLegacy } = await import("@/lib/childSession");
      const childData = getChildSessionLegacy();
      if (!childData) {
        hasCheckedSession.current = true;
        navigate("/child/login");
        return;
      }
      hasCheckedSession.current = true;
      setChild(childData);

      const storedParentId = localStorage.getItem("selectedParentId");
      if (storedParentId) {
        setSelectedParentId(storedParentId);
      }

      const fetchParentName = async () => {
        try {
          let parentIdToFetch: string | null = null;

          if (storedParentId) {
            parentIdToFetch = storedParentId;
          } else if (childData.parent_id) {
            parentIdToFetch = childData.parent_id;
            setSelectedParentId(parentIdToFetch);
          } else {
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

          if (!parentIdToFetch) {
            setParentName("Parent");
            parentNameRef.current = "Parent";
            return;
          }

          // Try multiple approaches to get the adult name:
          // 1. Try to get from conversations (works for both parents and family members)
          // 2. Try parents table (legacy)
          // 3. Try adult_profiles (new system)
          // 4. Fallback to "Parent"

          let adultName: string | null = null;

          // Approach 1: Try to get from conversations (most reliable for children)
          try {
            // @ts-expect-error - conversations table exists but not in types
            const { data: conversations, error: convError } = await supabase
              .from("conversations")
              .select("adult_id, adult_role")
              .eq("child_id", childData.id)
              .limit(1);

            if (!convError && conversations && conversations.length > 0) {
              const conv = conversations[0] as { adult_id: string; adult_role: string };
              
              // Try to get adult profile name
              // @ts-expect-error - adult_profiles table exists but not in types
              const { data: adultProfile, error: profileError } = await supabase
                .from("adult_profiles")
                .select("name, user_id")
                .eq("id", conv.adult_id)
                .maybeSingle();

              if (!profileError && adultProfile?.name) {
                // Check if this matches the parentIdToFetch (either by user_id or adult_id)
                if (adultProfile.user_id === parentIdToFetch || conv.adult_id === parentIdToFetch) {
                  adultName = adultProfile.name;
                }
              }
            }
          } catch (error) {
            // Silent fail, try next approach
          }

          // Approach 2: Try parents table (legacy system)
          if (!adultName) {
            try {
              const { data: parentData, error: parentError } = await supabase
                .from("parents")
                .select("name")
                .eq("id", parentIdToFetch)
                .maybeSingle();

              if (!parentError && parentData?.name) {
                adultName = parentData.name;
              }
            } catch (error) {
              // Silent fail, try next approach
            }
          }

          // Approach 3: Try adult_profiles directly (new system)
          if (!adultName) {
            try {
              // @ts-expect-error - adult_profiles table exists but not in types
              const { data: adultProfile, error: profileError } = await supabase
                .from("adult_profiles")
                .select("name, user_id")
                .eq("user_id", parentIdToFetch)
                .maybeSingle();

              if (!profileError && adultProfile?.name) {
                adultName = adultProfile.name;
              }
            } catch (error) {
              // Silent fail, use fallback
            }
          }

          // Set the name (or fallback to "Parent")
          if (adultName) {
            setParentName(adultName);
            parentNameRef.current = adultName;
          } else {
            // Fallback to "Parent" if we couldn't find the name
            // This is expected if the parent_id is invalid or RLS blocks access
            if (import.meta.env.DEV) {
              console.warn(
                "Parent name not found for parent_id:",
                parentIdToFetch,
                "- using fallback 'Parent'"
              );
            }
            setParentName("Parent");
            parentNameRef.current = "Parent";
          }
        } catch (error) {
          console.error("Error fetching parent name:", error);
          setParentName("Parent");
          parentNameRef.current = "Parent";
        }
      };

      await fetchParentName();

      let lastCheckedCallId: string | null = null;

      const setupSubscription = async () => {
        const handleIncomingCallNotification = async (call: CallRecord) => {
          if (call.id === lastCheckedCallId) return;
          if (location.pathname.startsWith("/call/")) {
            return;
          }

          lastCheckedCallId = call.id;
          // Handle both parent and family member calls
          const callerId = call.parent_id || call.family_member_id;
          setIncomingCall({
            id: call.id,
            parent_id: callerId, // Use parent_id field for compatibility
          });
          handleIncomingCallRef.current({
            callId: call.id,
            callerName: parentNameRef.current,
            callerId: callerId,
            url: `/call/${childData.id}?callId=${call.id}`,
          });
        };

        const checkExistingCalls = async () => {
          const twoMinutesAgo = new Date(
            Date.now() - 2 * 60 * 1000
          ).toISOString();
          const { data: existingCalls } = await supabase
            .from("calls")
            .select("*")
            .eq("child_id", childData.id)
            .in("caller_type", ["parent", "family_member"])
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

        const pollForCalls = async () => {
          const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
          const { data: newCalls } = await supabase
            .from("calls")
            .select("*")
            .eq("child_id", childData.id)
            .in("caller_type", ["parent", "family_member"])
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

        await checkExistingCalls();
        pollIntervalRef.current = setInterval(pollForCalls, 90000); // 90 seconds (fallback only)

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
              if (
                (call.caller_type === "parent" || call.caller_type === "family_member") &&
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

              if (call.caller_type === "child") {
                return;
              }

              if (location.pathname.startsWith("/call/")) {
                return;
              }

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
                (call.caller_type === "parent" || call.caller_type === "family_member") &&
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
              console.error(
                "❌ [CHILD DASHBOARD] Realtime subscription error:",
                err
              );
            }
          });
      };

      await setupSubscription();
    };

    loadChildSession();

    // Return cleanup function
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [navigate, location.pathname]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    handleIncomingCallRef.current = handleIncomingCall;
  }, [handleIncomingCall]);

  useEffect(() => {
    if (!incomingCall && incomingCallRef.current) {
      stopIncomingCall(incomingCallRef.current.id);
    }
  }, [incomingCall, stopIncomingCall]);

  return {
    child,
    incomingCall,
    setIncomingCall,
    parentName,
    selectedParentId,
    stopIncomingCall,
  };
};

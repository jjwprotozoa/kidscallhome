// src/features/calls/hooks/modules/useIncomingCallSubscription.ts
// Incoming call subscription setup with role-based filtering
// Handles role detection and subscription filtering for all roles

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect } from "react";
import type { CallState } from "./useCallStateMachine";

export interface UseIncomingCallSubscriptionParams {
  state: CallState;
  localProfileId: string;
  role: "parent" | "child" | "family_member";
  callChannelRef: React.MutableRefObject<RealtimeChannel | null>;
  setCallId: (callId: string) => void;
  setStateWithLogging: (
    newState: CallState,
    reason: string,
    context?: Record<string, unknown>
  ) => void;
}

export const useIncomingCallSubscription = ({
  state,
  localProfileId,
  role,
  callChannelRef,
  setCallId,
  setStateWithLogging,
}: UseIncomingCallSubscriptionParams) => {
  useEffect(() => {
    if (state !== "idle" || !localProfileId) return;

    // CRITICAL: Verify actual user role from adult_profiles (canonical source)
    // Don't rely solely on the role prop - check the database to ensure correct subscription
    const setupSubscription = async () => {
      let actualRole = role;
      let subscriptionFilter = "";

      // For adults (parent/family_member), check their actual role from adult_profiles
      if (role === "parent" || role === "family_member") {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: adultProfile } = (await (supabase as any)
            .from("adult_profiles")
            .select("role")
            .eq("user_id", localProfileId)
            .maybeSingle()) as { data: { role: string } | null };

          if (adultProfile?.role === "family_member") {
            actualRole = "family_member";
            // CRITICAL: Use recipient_type filter to prevent cross-notifications
            subscriptionFilter = `recipient_type=eq.family_member`;
            // eslint-disable-next-line no-console
            console.log(
              "✅ [INCOMING SUBSCRIPTION] User is family_member (from adult_profiles), using recipient_type=family_member subscription"
            );
          } else if (adultProfile?.role === "parent") {
            actualRole = "parent";
            // CRITICAL: Use recipient_type filter to prevent cross-notifications
            subscriptionFilter = `recipient_type=eq.parent`;
            // eslint-disable-next-line no-console
            console.log(
              "✅ [INCOMING SUBSCRIPTION] User is parent (from adult_profiles), using recipient_type=parent subscription"
            );
          } else {
            // Fallback to role prop if no adult_profiles record found
            actualRole = role;
            subscriptionFilter =
              role === "parent"
                ? `recipient_type=eq.parent`
                : `recipient_type=eq.family_member`;
            console.warn(
              "⚠️ [INCOMING SUBSCRIPTION] No adult_profiles record found, using role prop:",
              role
            );
          }
        } catch (error) {
          console.error("Error checking adult_profiles role:", error);
          // Fallback to role prop on error
          actualRole = role;
          subscriptionFilter =
            role === "parent"
              ? `recipient_type=eq.parent`
              : `recipient_type=eq.family_member`;
        }
      } else {
        // Child role - use recipient_type filter
        subscriptionFilter = `recipient_type=eq.child`;
      }

      const channel = supabase
        .channel(`incoming-calls:${localProfileId}:${actualRole}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "calls",
            filter: subscriptionFilter,
          },
          async (payload) => {
            const call = payload.new as {
              id: string;
              status: string;
              caller_type: string;
              recipient_type?: string;
              offer: Json | null;
              family_member_id?: string | null;
              parent_id?: string | null;
              child_id?: string | null;
            };

            // CRITICAL: Verify recipient_type matches actualRole FIRST
            const callRecipientType = call.recipient_type;
            let recipientTypeMatches = false;
            if (actualRole === "child") {
              recipientTypeMatches = callRecipientType === "child";
            } else if (actualRole === "family_member") {
              recipientTypeMatches = callRecipientType === "family_member";
            } else if (actualRole === "parent") {
              recipientTypeMatches = callRecipientType === "parent";
            }

            if (!recipientTypeMatches) {
              console.warn(
                "⚠️ [INCOMING SUBSCRIPTION] Call ignored (recipient_type mismatch):",
                {
                  callId: call.id,
                  callRecipientType,
                  actualRole,
                  expectedRecipientType:
                    actualRole === "child"
                      ? "child"
                      : actualRole === "family_member"
                      ? "family_member"
                      : "parent",
                }
              );
              return; // Early return if recipient_type doesn't match
            }

            // CRITICAL: Verify this call is actually for this user
            // Use actualRole (from adult_profiles) instead of role prop for accurate filtering
            let isForThisUser = false;
            if (actualRole === "child") {
              // Child receives calls from parent OR family member
              isForThisUser =
                call.child_id === localProfileId &&
                (call.caller_type === "parent" ||
                  call.caller_type === "family_member");
            } else if (actualRole === "family_member") {
              // Family member receives calls from child
              // CRITICAL: Only accept if family_member_id matches
              isForThisUser =
                call.family_member_id === localProfileId &&
                call.caller_type === "child";
            } else if (actualRole === "parent") {
              // Parent receives calls from child
              // CRITICAL: Verify parent_id matches
              isForThisUser =
                call.parent_id === localProfileId &&
                call.caller_type === "child";
            }

            // Only handle incoming calls (opposite caller_type) that are for this user
            if (
              call.status === "ringing" &&
              call.caller_type !== actualRole &&
              call.offer &&
              isForThisUser
            ) {
              // eslint-disable-next-line no-console
              console.log("📞 [INCOMING SUBSCRIPTION] Incoming call detected:", {
                callId: call.id,
                callerType: call.caller_type,
                actualRole,
                roleProp: role,
                hasOffer: !!call.offer,
                family_member_id: call.family_member_id,
                parent_id: call.parent_id,
                child_id: call.child_id,
              });
              setCallId(call.id);
              setStateWithLogging(
                "incoming",
                "Incoming call detected from database",
                {
                  callId: call.id,
                  callerType: call.caller_type,
                  hasOffer: !!call.offer,
                }
              );
            } else {
              // eslint-disable-next-line no-console
              console.log(
                "⚠️ [INCOMING SUBSCRIPTION] Call ignored (not for this user or invalid):",
                {
                  callId: call.id,
                  callerType: call.caller_type,
                  actualRole,
                  roleProp: role,
                  status: call.status,
                  hasOffer: !!call.offer,
                  isForThisUser,
                  call_family_member_id: call.family_member_id,
                  call_parent_id: call.parent_id,
                  call_child_id: call.child_id,
                  localProfileId,
                }
              );
            }
          }
        )
        .subscribe();

      callChannelRef.current = channel;
    };

    setupSubscription();

    return () => {
      if (callChannelRef.current) {
        supabase.removeChannel(callChannelRef.current);
        callChannelRef.current = null;
      }
    };
  }, [state, localProfileId, role, setStateWithLogging, setCallId]);
};


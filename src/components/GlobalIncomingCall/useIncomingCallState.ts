// src/components/GlobalIncomingCall/useIncomingCallState.ts
// Purpose: State management hook for incoming calls (subscriptions, polling, notifications)
// CRITICAL: This hook manages WebRTC-related subscriptions - do not modify subscription logic

import { useIncomingCallNotifications } from "@/features/calls/hooks/useIncomingCallNotifications";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { CallRecord, IncomingCall } from "./types";

export const useIncomingCallState = () => {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const incomingCallRef = useRef<IncomingCall | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const location = useLocation();
  const { handleIncomingCall, stopIncomingCall } = useIncomingCallNotifications(
    {
      enabled: true,
      volume: 0.7,
    }
  );
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
      if (typeof window === "undefined" || !window.localStorage) {
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { getChildSessionLegacy } = await import("@/lib/childSession");
      const childSession = getChildSessionLegacy();
      const isChild = !session && !!childSession;

      if (!session && !childSession) {
        return;
      }

      // Determine if user is family member
      let isFamilyMember = false;
      if (!isChild && session?.user?.id) {
        cachedUserId = session.user.id;
        // Check if user is a family member
        const { getUserRole } = await import("@/utils/userRole");
        const userRole = await getUserRole(session.user.id);
        isFamilyMember = userRole === "family_member";
      }

      const handleIncomingCallNotification = async (call: CallRecord) => {
        if (call.id === lastCheckedCallId) return;

        // CRITICAL: Don't show incoming call notification if user is already on the call page
        // Check for all call screen paths (child, parent, family member)
        if (
          location.pathname.startsWith("/call/") ||
          location.pathname.startsWith("/child/call/") ||
          location.pathname.startsWith("/parent/call/") ||
          location.pathname.startsWith("/family-member/call/")
        ) {
          return;
        }

        // CRITICAL: Only skip /child/dashboard which has its own incoming call handling via useDashboardData
        // Other child pages (/child, /child/parents) need to use GlobalIncomingCall
        if (isChild && location.pathname === "/child/dashboard") {
          return;
        }

        // CRITICAL: Don't process if there's already an incoming call being handled
        if (incomingCallRef.current?.id === call.id) {
          return;
        }

        lastCheckedCallId = call.id;

        if (import.meta.env.DEV) {
          console.warn(
            "🔍 [INCOMING CALL STATE] Processing incoming call notification:",
            {
              callId: call.id,
              caller_type: call.caller_type,
              child_id: call.child_id,
              parent_id: call.parent_id,
              family_member_id: call.family_member_id,
              status: call.status,
              isChild,
            }
          );
        }

        if (isChild) {
          // Child receiving call from parent or family member
          // CRITICAL: Check caller_type first to determine actual caller
          // parent_id may be set for RLS compatibility even when family member is calling
          const isCallerFamilyMember =
            call.caller_type === "family_member" ||
            (call.family_member_id && call.recipient_type === "child");
          const callerId = isCallerFamilyMember
            ? call.family_member_id
            : call.parent_id || call.family_member_id;

          console.warn(
            "🔍 [INCOMING CALL STATE] Child receiving call - caller detection:",
            {
              callId: call.id,
              caller_type: call.caller_type,
              recipient_type: call.recipient_type,
              hasParentId: !!call.parent_id,
              hasFamilyMemberId: !!call.family_member_id,
              isCallerFamilyMember,
              callerId,
            }
          );

          // CRITICAL: Check if caller is family member FIRST
          // parent_id is often set for RLS compatibility even when family member is calling
          if (isCallerFamilyMember && call.family_member_id) {
            console.warn(
              "✅ [INCOMING CALL STATE] Child receiving call from FAMILY MEMBER:",
              {
                callId: call.id,
                family_member_id: call.family_member_id,
                caller_type: call.caller_type,
              }
            );

            // Try adult_profiles first (newer system)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: adultProfile } = (await (supabase as any)
              .from("adult_profiles")
              .select("name")
              .eq("user_id", call.family_member_id)
              .eq("role", "family_member")
              .maybeSingle()) as { data: { name: string } | null };

            let familyMemberName = adultProfile?.name;

            // Fallback to family_members table
            if (!familyMemberName) {
              const { data: familyMemberData } = await supabase
                .from("family_members")
                .select("name")
                .eq("id", call.family_member_id)
                .maybeSingle();
              familyMemberName = familyMemberData?.name;
            }

            const displayName = familyMemberName || "Family Member";

            setIncomingCall({
              id: call.id,
              family_member_id: call.family_member_id,
              parent_name: displayName, // Use parent_name field for display
            });

            console.warn(
              "✅ [INCOMING CALL STATE] Routing child to family member call:",
              {
                callId: call.id,
                familyMemberId: call.family_member_id,
                familyMemberName: displayName,
                url: `/child/call/${call.family_member_id}?callId=${call.id}`,
              }
            );

            handleIncomingCallRef.current({
              callId: call.id,
              callerName: displayName,
              callerId: call.family_member_id,
              url: `/child/call/${call.family_member_id}?callId=${call.id}`,
            });
          } else if (call.parent_id) {
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
              url: `/child/call/${call.parent_id}?callId=${call.id}`,
            });
          } else {
            console.error(
              "❌ [INCOMING CALL STATE] Child call has neither parent_id nor family_member_id:",
              {
                callId: call.id,
                caller_type: call.caller_type,
                parent_id: call.parent_id,
                family_member_id: call.family_member_id,
              }
            );
          }
        } else {
          // Parent or family member receiving call from child
          console.warn(
            "🔍 [INCOMING CALL STATE] Adult receiving call from child:",
            {
              callId: call.id,
              child_id: call.child_id,
              caller_type: call.caller_type,
              isFamilyMember,
              call_family_member_id: call.family_member_id,
              call_parent_id: call.parent_id,
            }
          );

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

            // Use appropriate route based on user type
            // CRITICAL: Parents must use /parent/call/ route which uses useCallEngine with role="parent"
            // Using /call/ route would incorrectly detect them as child if childSession exists in localStorage
            const url = isFamilyMember
              ? `/family-member/call/${call.child_id}?callId=${call.id}`
              : `/parent/call/${call.child_id}?callId=${call.id}`;

            if (import.meta.env.DEV) {
              console.warn("✅ [INCOMING CALL STATE] Routing incoming call:", {
                callId: call.id,
                callerName: childData.name,
                callerId: call.child_id,
                url,
                isFamilyMember,
                routeFor: isFamilyMember ? "family_member" : "parent",
              });
            }

            handleIncomingCallRef.current({
              callId: call.id,
              callerName: childData.name,
              callerId: call.child_id,
              url,
            });
          } else {
            console.error(
              "❌ [INCOMING CALL STATE] Child data not found for call:",
              {
                callId: call.id,
                child_id: call.child_id,
              }
            );
          }
        }
      };

      const checkExistingCalls = async () => {
        // CRITICAL: Don't check for incoming calls if user is already on the call page
        // Check for all call screen paths (child, parent, family member)
        if (
          location.pathname.startsWith("/call/") ||
          location.pathname.startsWith("/child/call/") ||
          location.pathname.startsWith("/parent/call/") ||
          location.pathname.startsWith("/family-member/call/")
        ) {
          return;
        }

        // CRITICAL: Only skip /child/dashboard which has its own incoming call handling via useDashboardData
        // Other child pages (/child, /child/parents) need to use GlobalIncomingCall
        if (isChild && location.pathname === "/child/dashboard") {
          return;
        }

        const twoMinutesAgo = new Date(
          Date.now() - 2 * 60 * 1000
        ).toISOString();

        if (isChild) {
          const { getChildSessionLegacy } = await import("@/lib/childSession");
          const childData = getChildSessionLegacy();

          if (!childData?.id) {
            console.error("❌ [GLOBAL INCOMING CALL] Child session missing id");
            return;
          }

          // Check for calls from parent OR family member
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
            // CRITICAL: Don't process if already checked or already being handled
            if (
              call.id !== lastCheckedCallId &&
              incomingCallRef.current?.id !== call.id
            ) {
              await handleIncomingCallNotification(call);
            }
          }
        } else {
          if (!cachedUserId) {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (!session?.user?.id) return;
            cachedUserId = session.user.id;
          }

          // Check for calls from child - handle both parent and family member
          let existingCalls;
          if (isFamilyMember) {
            const { data: calls } = await supabase
              .from("calls")
              .select("*")
              .eq("family_member_id", cachedUserId)
              .eq("caller_type", "child")
              .eq("status", "ringing")
              .gte("created_at", twoMinutesAgo)
              .order("created_at", { ascending: false })
              .limit(1);
            existingCalls = calls;
          } else {
            // CRITICAL: Parent should NOT receive calls where family_member_id is set
            // When family_member_id is set, the call is for a family member, not the parent
            const { data: calls } = await supabase
              .from("calls")
              .select("*")
              .eq("parent_id", cachedUserId)
              .eq("caller_type", "child")
              .is("family_member_id", null) // Exclude calls for family members
              .eq("status", "ringing")
              .gte("created_at", twoMinutesAgo)
              .order("created_at", { ascending: false })
              .limit(1);
            existingCalls = calls;
          }

          if (existingCalls && existingCalls.length > 0) {
            const call = existingCalls[0];
            // CRITICAL: Don't process if already checked or already being handled
            if (
              call.id !== lastCheckedCallId &&
              incomingCallRef.current?.id !== call.id
            ) {
              await handleIncomingCallNotification(call);
            }
          }
        }
      };

      const pollForCalls = async () => {
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

        if (isChild) {
          // getChildSessionLegacy() already returns an object, not a string
          const childData = childSession;

          if (!childData?.id) {
            return;
          }

          // Check for calls from parent OR family member
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
        } else {
          if (!cachedUserId) {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (!session?.user?.id) return;
            cachedUserId = session.user.id;
          }

          // Check for calls from child - handle both parent and family member
          let newCalls;
          if (isFamilyMember) {
            const { data: calls } = await supabase
              .from("calls")
              .select("*")
              .eq("family_member_id", cachedUserId)
              .eq("caller_type", "child")
              .eq("status", "ringing")
              .gte("created_at", oneMinuteAgo)
              .order("created_at", { ascending: false })
              .limit(1);
            newCalls = calls;
          } else {
            // CRITICAL: Parent should NOT receive calls where family_member_id is set
            // When family_member_id is set, the call is for a family member, not the parent
            const { data: calls } = await supabase
              .from("calls")
              .select("*")
              .eq("parent_id", cachedUserId)
              .eq("caller_type", "child")
              .is("family_member_id", null) // Exclude calls for family members
              .eq("status", "ringing")
              .gte("created_at", oneMinuteAgo)
              .order("created_at", { ascending: false })
              .limit(1);
            newCalls = calls;
          }

          if (newCalls && newCalls.length > 0) {
            const call = newCalls[0];
            if (call.id !== lastCheckedCallId) {
              await handleIncomingCallNotification(call);
            }
          }
        }
      };

      await checkExistingCalls();
      pollInterval = setInterval(pollForCalls, 90000); // 90 seconds (fallback only)

      // Set up realtime subscription
      if (isChild) {
        const { getChildSessionLegacy } = await import("@/lib/childSession");
        const childData = getChildSessionLegacy();

        if (!childData?.id) {
          console.error(
            "❌ [GLOBAL INCOMING CALL] Child session missing id in subscription"
          );
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
              if (import.meta.env.DEV) {
                console.warn("📞 [GLOBAL INCOMING CALL] INSERT event received:", {
                  callId: call.id,
                  caller_type: call.caller_type,
                  child_id: call.child_id,
                  parent_id: call.parent_id,
                  status: call.status,
                  expectedChildId: childData.id,
                  matches:
                  (call.caller_type === "parent" ||
                    call.caller_type === "family_member") &&
                  call.child_id === childData.id &&
                  call.status === "ringing",
              });
              // Accept calls from parent OR family member
              if (
                (call.caller_type === "parent" ||
                  call.caller_type === "family_member") &&
                call.child_id === childData.id &&
                call.status === "ringing"
              ) {
                console.warn(
                  "✅ [GLOBAL INCOMING CALL] Processing incoming call notification"
                );
                await handleIncomingCallNotification(call);
              } else {
                console.warn(
                  "⚠️ [GLOBAL INCOMING CALL] Call does not match criteria:",
                  {
                    caller_type_match:
                      call.caller_type === "parent" ||
                      call.caller_type === "family_member",
                    child_id_match: call.child_id === childData.id,
                    status_match: call.status === "ringing",
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
              filter: `child_id=eq.${childData.id}`,
            },
            async (payload) => {
              const call = payload.new as CallRecord;
              const oldCall = payload.old as CallRecord;

              if (call.caller_type === "child") return;

              if (call.status === "active" || call.status === "ended") {
                // Stop ringtone immediately
                stopIncomingCall(call.id);
                
                if (
                  incomingCallRef.current &&
                  incomingCallRef.current.id === call.id
                ) {
                  // CRITICAL: If status is 'active', clear immediately (user is answering)
                  // If status is 'ended', add a brief delay to allow button handlers to complete
                  if (call.status === "active") {
                    setIncomingCall(null);
                    incomingCallRef.current = null;
                  } else {
                    // Small delay for 'ended' to let any pending button clicks complete
                    setTimeout(() => {
                      if (incomingCallRef.current?.id === call.id) {
                        setIncomingCall(null);
                        incomingCallRef.current = null;
                      }
                    }, 500);
                  }
                }
              }

              // Accept calls from parent OR family member
              if (
                (call.caller_type === "parent" ||
                  call.caller_type === "family_member") &&
                call.child_id === childData.id &&
                call.status === "ringing" &&
                oldCall.status !== "ringing"
              ) {
                await handleIncomingCallNotification(call);
              }
            }
          )
          .subscribe((status) => {
            console.warn(
              "🔍 [INCOMING CALL STATE] Child subscription status:",
              {
                status,
                channelName: "global-child-incoming-calls",
                userType: "child",
                childId: childData?.id,
              }
            );

            if (status === "SUBSCRIBED") {
              console.warn(
                "✅ [INCOMING CALL STATE] Child successfully subscribed to incoming calls"
              );
            } else if (status === "CHANNEL_ERROR") {
              console.error(
                "❌ [INCOMING CALL STATE] Child subscription error!"
              );
            }
          });
      } else {
        // CRITICAL: Ensure we clean up any existing subscription before creating a new one
        // This prevents multiple subscriptions from being active simultaneously
        if (channelRef.current) {
          console.warn(
            "🧹 [INCOMING CALL STATE] Cleaning up existing subscription before creating new one"
          );
          await supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }

        if (!cachedUserId) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session?.user?.id) return;
          cachedUserId = session.user.id;
        }

        // CRITICAL: Determine user role from adult_profiles.role (canonical source of truth)
        // Only use legacy tables as fallback if no adult_profiles record exists
        let currentIsFamilyMember = isFamilyMember;
        if (cachedUserId) {
          // PRIMARY: Check adult_profiles table (canonical source)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: adultProfiles } = (await (supabase as any)
            .from("adult_profiles")
            .select("role")
            .eq("user_id", cachedUserId)) as {
            data: Array<{ role: string }> | null;
          };

          if (adultProfiles && adultProfiles.length > 0) {
            // User has adult_profiles records - use role from there
            const hasParentRole = adultProfiles.some(
              (p) => p.role === "parent"
            );
            const hasFamilyMemberRole = adultProfiles.some(
              (p) => p.role === "family_member"
            );

            console.warn(
              "🔍 [INCOMING CALL STATE] User role from adult_profiles:",
              {
                cachedUserId,
                adultProfiles: adultProfiles.map((p) => p.role),
                hasParentRole,
                hasFamilyMemberRole,
              }
            );

            // CRITICAL: If user has BOTH roles in adult_profiles, prioritize family_member
            // This ensures family member calls are routed correctly
            // Parent calls (without family_member_id) will be filtered in callback
            if (hasFamilyMemberRole) {
              currentIsFamilyMember = true;
              console.warn(
                "✅ [INCOMING CALL STATE] Using family_member subscription (user has family_member role in adult_profiles)"
              );
            } else if (hasParentRole) {
              currentIsFamilyMember = false;
              console.warn(
                "✅ [INCOMING CALL STATE] Using parent subscription (user has parent role in adult_profiles)"
              );
            } else {
              console.warn(
                "⚠️ [INCOMING CALL STATE] User has adult_profiles but no parent/family_member role"
              );
            }
          } else {
            // FALLBACK: No adult_profiles record - check legacy tables
            console.warn(
              "🔍 [INCOMING CALL STATE] No adult_profiles found, checking legacy tables"
            );

            const { data: legacyFamilyMember } = await supabase
              .from("family_members")
              .select("id")
              .eq("id", cachedUserId)
              .eq("status", "active")
              .maybeSingle();

            if (legacyFamilyMember) {
              currentIsFamilyMember = true;
              console.warn(
                "✅ [INCOMING CALL STATE] Using family_member subscription (from legacy family_members table)"
              );
            } else {
              // Assume parent if no family_member record found
              currentIsFamilyMember = false;
              console.warn(
                "✅ [INCOMING CALL STATE] Using parent subscription (no family_member record found)"
              );
            }
          }
        }

        console.warn("🔍 [INCOMING CALL STATE] Setting up subscription:", {
          currentIsFamilyMember,
          cachedUserId,
          isChild,
        });

        // Use different channel and filter based on user type
        const channelName = currentIsFamilyMember
          ? `global-family-member-incoming-calls-${cachedUserId}`
          : `global-parent-incoming-calls-${cachedUserId}`;
        // CRITICAL: Use recipient_type filter to prevent cross-notifications
        // Parent subscription: Only match calls where recipient_type = 'parent'
        // Family member subscription: Only match calls where recipient_type = 'family_member'
        // This works around Supabase Realtime's limitation of single-column filters
        const insertFilter = currentIsFamilyMember
          ? `recipient_type=eq.family_member`
          : `recipient_type=eq.parent`;
        const updateFilter = currentIsFamilyMember
          ? `recipient_type=eq.family_member`
          : `recipient_type=eq.parent`;

        if (import.meta.env.DEV) {
          console.warn("🔍 [INCOMING CALL STATE] Subscription filters:", {
            channelName,
            insertFilter,
            updateFilter,
            currentIsFamilyMember,
            cachedUserId,
            note: "Using recipient_type filter to prevent cross-notifications",
          });
        }

        if (import.meta.env.DEV) {
          console.warn("🔍 [INCOMING CALL STATE] Subscribing to channel:", {
            channelName,
            insertFilter,
            updateFilter,
            currentIsFamilyMember,
            cachedUserId,
          });
        }

        // Store channelName in a const that's accessible in the callback
        const subscriptionChannelName = channelName;
        const subscriptionInsertFilter = insertFilter;
        const subscriptionUpdateFilter = updateFilter;
        const subscriptionIsFamilyMember = currentIsFamilyMember;
        const subscriptionCachedUserId = cachedUserId;

        channelRef.current = supabase
          .channel(subscriptionChannelName)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "calls",
              filter: subscriptionInsertFilter,
            },
            async (payload) => {
              const call = payload.new as CallRecord;

              // CRITICAL: Synchronous filtering using recipient_type BEFORE any UI rendering
              // The subscription filter already uses recipient_type, but this is a backup defense
              // Rule: recipient_type must match subscription type
              const callRecipientType = (call as { recipient_type?: string })
                .recipient_type;

              // REJECT IMMEDIATELY if recipient_type doesn't match subscription type
              if (
                subscriptionIsFamilyMember &&
                callRecipientType !== "family_member"
              ) {
                console.warn(
                  "❌ [INCOMING CALL STATE] REJECTING IMMEDIATELY: Family member subscription received call with wrong recipient_type",
                  {
                    callId: call.id,
                    recipient_type: callRecipientType,
                    expected: "family_member",
                    subscriptionType: "family_member",
                    reason:
                      "Call recipient_type does not match family member subscription",
                  }
                );
                return; // EARLY RETURN - prevent family member from receiving parent calls
              }

              if (
                !subscriptionIsFamilyMember &&
                callRecipientType !== "parent"
              ) {
                console.warn(
                  "❌ [INCOMING CALL STATE] REJECTING IMMEDIATELY: Parent subscription received call with wrong recipient_type",
                  {
                    callId: call.id,
                    recipient_type: callRecipientType,
                    expected: "parent",
                    subscriptionType: "parent",
                    reason:
                      "Call recipient_type does not match parent subscription",
                  }
                );
                return; // EARLY RETURN - prevent parent from receiving family member calls
              }

              // Now verify the ID matches (backup check)
              if (subscriptionIsFamilyMember) {
                // Verify family_member_id matches this user
                if (call.family_member_id !== subscriptionCachedUserId) {
                  console.warn(
                    "❌ [INCOMING CALL STATE] REJECTING: Family member ID mismatch",
                    {
                      callId: call.id,
                      call_family_member_id: call.family_member_id,
                      cachedUserId: subscriptionCachedUserId,
                    }
                  );
                  return;
                }
              } else {
                // Verify parent_id matches this user
                if (call.parent_id !== subscriptionCachedUserId) {
                  console.warn(
                    "❌ [INCOMING CALL STATE] REJECTING: Parent ID mismatch",
                    {
                      callId: call.id,
                      call_parent_id: call.parent_id,
                      cachedUserId: subscriptionCachedUserId,
                    }
                  );
                  return;
                }
              }

              console.warn(
                "✅ [INCOMING CALL STATE] INSERT event accepted (ADULT subscription):",
                {
                  callId: call.id,
                  caller_type: call.caller_type,
                  recipient_type: callRecipientType,
                  child_id: call.child_id,
                  parent_id: call.parent_id,
                  family_member_id: call.family_member_id,
                  status: call.status,
                  currentIsFamilyMember: subscriptionIsFamilyMember,
                  cachedUserId: subscriptionCachedUserId,
                  insertFilter: subscriptionInsertFilter,
                  channelName: subscriptionChannelName,
                  recipientTypeMatch: subscriptionIsFamilyMember
                    ? callRecipientType === "family_member"
                    : callRecipientType === "parent",
                }
              );

              // CRITICAL: Accept both "initiating" and "ringing" status
              // "initiating" means call just created, will auto-update to "ringing"
              // Ignore active/ended calls to prevent processing calls that were already accepted
              if (call.status === "active" || call.status === "ended") {
                console.warn(
                  "⚠️ [INCOMING CALL STATE] Call is active/ended - ignoring INSERT event",
                  {
                    callId: call.id,
                    status: call.status,
                    reason: "Only process initiating/ringing calls via INSERT events",
                  }
                );
                return;
              }

              // If status is "initiating", update to "ringing" to notify caller
              if (call.status === "initiating") {
                await supabase
                  .from("calls")
                  .update({ status: "ringing" })
                  .eq("id", call.id);
                // Update the call object for processing
                call.status = "ringing";
              }

              const matches = subscriptionIsFamilyMember
                ? call.caller_type === "child" &&
                  call.family_member_id === subscriptionCachedUserId &&
                  call.status === "ringing"
                : call.caller_type === "child" &&
                  call.parent_id === subscriptionCachedUserId &&
                  call.status === "ringing";

              console.warn(
                "🔍 [INCOMING CALL STATE] Call match check (ADULT):",
                {
                  callId: call.id,
                  matches,
                  currentIsFamilyMember: subscriptionIsFamilyMember,
                  caller_type_match: call.caller_type === "child",
                  family_member_id_match: subscriptionIsFamilyMember
                    ? call.family_member_id === subscriptionCachedUserId
                    : "N/A",
                  parent_id_match: !subscriptionIsFamilyMember
                    ? call.parent_id === subscriptionCachedUserId
                    : "N/A",
                  status_match: call.status === "ringing",
                  call_family_member_id: call.family_member_id,
                  call_parent_id: call.parent_id,
                  cachedUserId: subscriptionCachedUserId,
                  family_member_id_equals: subscriptionIsFamilyMember
                    ? call.family_member_id === subscriptionCachedUserId
                    : "N/A",
                  parent_id_equals: !subscriptionIsFamilyMember
                    ? call.parent_id === subscriptionCachedUserId
                    : "N/A",
                }
              );

              if (matches) {
                // CRITICAL: Don't process if already being handled
                if (incomingCallRef.current?.id === call.id) {
                  console.warn(
                    "⚠️ [INCOMING CALL STATE] Call already being handled - skipping duplicate",
                    {
                      callId: call.id,
                      currentIncomingCallId: incomingCallRef.current?.id,
                    }
                  );
                  return;
                }

                console.warn(
                  "✅ [INCOMING CALL STATE] Call matches - processing notification"
                );
                await handleIncomingCallNotification(call);
              } else {
                console.warn(
                  "⚠️ [INCOMING CALL STATE] Call does not match - ignoring",
                  {
                    reason: !matches ? "Match criteria failed" : "Unknown",
                    details: {
                      caller_type_is_child: call.caller_type === "child",
                      family_member_id_matches: subscriptionIsFamilyMember
                        ? call.family_member_id === subscriptionCachedUserId
                        : "N/A",
                      parent_id_matches: !subscriptionIsFamilyMember
                        ? call.parent_id === subscriptionCachedUserId
                        : "N/A",
                      status_is_ringing: call.status === "ringing",
                    },
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
              filter: subscriptionUpdateFilter,
            },
            async (payload) => {
              const call = payload.new as CallRecord;
              const oldCall = payload.old as CallRecord;

              if (
                call.caller_type === "parent" ||
                call.caller_type === "family_member"
              )
                return;

              // CRITICAL: Synchronous filtering using recipient_type BEFORE any processing
              const callRecipientType = (call as { recipient_type?: string })
                .recipient_type;

              // REJECT IMMEDIATELY if recipient_type doesn't match subscription type
              if (
                subscriptionIsFamilyMember &&
                callRecipientType !== "family_member"
              ) {
                console.warn(
                  "❌ [INCOMING CALL STATE] REJECTING UPDATE IMMEDIATELY: Family member subscription received call with wrong recipient_type",
                  {
                    callId: call.id,
                    recipient_type: callRecipientType,
                    expected: "family_member",
                    reason:
                      "Call recipient_type does not match family member subscription",
                  }
                );
                return;
              }

              if (
                !subscriptionIsFamilyMember &&
                callRecipientType !== "parent"
              ) {
                console.warn(
                  "❌ [INCOMING CALL STATE] REJECTING UPDATE IMMEDIATELY: Parent subscription received call with wrong recipient_type",
                  {
                    callId: call.id,
                    recipient_type: callRecipientType,
                    expected: "parent",
                    reason:
                      "Call recipient_type does not match parent subscription",
                  }
                );
                return;
              }

              // CRITICAL: Clear and stop notifications for active/ended calls, then return early
              // This prevents processing updates for calls that are already accepted
              if (call.status === "active" || call.status === "ended") {
                // Stop ringtone immediately
                stopIncomingCall(call.id);
                
                if (
                  incomingCallRef.current &&
                  incomingCallRef.current.id === call.id
                ) {
                  console.warn(
                    "🧹 [INCOMING CALL STATE] Clearing incoming call - status is active/ended",
                    {
                      callId: call.id,
                      status: call.status,
                    }
                  );
                  
                  // CRITICAL: If status is 'active', clear immediately (user is answering)
                  // If status is 'ended', add a brief delay to allow button handlers to complete
                  // This prevents race conditions where realtime updates clear state before handlers run
                  if (call.status === "active") {
                    setIncomingCall(null);
                    incomingCallRef.current = null;
                  } else {
                    // Small delay for 'ended' to let any pending button clicks complete
                    setTimeout(() => {
                      // Only clear if still the same call (hasn't been replaced by a new call)
                      if (incomingCallRef.current?.id === call.id) {
                        setIncomingCall(null);
                        incomingCallRef.current = null;
                      }
                    }, 500);
                  }
                }
                // CRITICAL: Return early - don't process active/ended calls
                return;
              }

              // Handle both parent and family member
              // CRITICAL: Only process if status changed TO ringing (not if it was already ringing)
              const matches = currentIsFamilyMember
                ? call.caller_type === "child" &&
                  call.family_member_id === cachedUserId &&
                  call.status === "ringing" &&
                  oldCall.status !== "ringing"
                : call.caller_type === "child" &&
                  call.parent_id === cachedUserId &&
                  call.status === "ringing" &&
                  oldCall.status !== "ringing";

              if (matches) {
                await handleIncomingCallNotification(call);
              } else if (
                call.status === "ringing" &&
                oldCall.status === "ringing"
              ) {
                // Call is already ringing and was already ringing - don't process again
                console.warn(
                  "⚠️ [INCOMING CALL STATE] Call already ringing - ignoring duplicate UPDATE",
                  {
                    callId: call.id,
                    status: call.status,
                    oldStatus: oldCall.status,
                  }
                );
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

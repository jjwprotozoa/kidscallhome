// src/features/messaging/hooks/useChatRealtime.ts
// Hook for managing realtime message subscriptions

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { safeLog, sanitizeError } from "@/utils/security";

interface Message {
  id: string;
  sender_type: "parent" | "child" | "family_member";
  sender_id?: string;
  family_member_id?: string;
  conversation_id?: string | null;
  child_id: string;
  content: string;
  created_at: string;
  read_at?: string | null;
}

interface UseChatRealtimeProps {
  targetChildId: string | null;
  conversationId: string | null;
  isChild: boolean;
  isFamilyMember: boolean;
  familyMemberId: string | null;
  onNewMessage: (message: Message) => void;
}

export const useChatRealtime = ({
  targetChildId,
  conversationId,
  isChild,
  isFamilyMember,
  familyMemberId,
  onNewMessage,
}: UseChatRealtimeProps) => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<
    "SUBSCRIBED" | "ERROR" | "TIMED_OUT" | "SUBSCRIBING" | null
  >(null);

  useEffect(() => {
    // Only set up subscription if we have a conversationId
    if (!targetChildId || !conversationId) {
      return;
    }

    safeLog.log("📡 [CHAT] Setting up realtime subscription for messages", {
      childId: targetChildId,
      conversationId: conversationId,
      isChild: isChild,
      timestamp: new Date().toISOString(),
    });

    const channelIdentifier = conversationId;
    const channelName = `messages-${channelIdentifier}`;
    const realtimeFilter = `conversation_id=eq.${conversationId}`;

    channelRef.current = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: realtimeFilter,
        },
        (payload) => {
          safeLog.log("📨 [CHAT] Received new message via realtime:", {
            messageId: payload.new.id,
            senderType: payload.new.sender_type,
            childId: payload.new.child_id,
            conversationId: payload.new.conversation_id,
            filterChildId: targetChildId,
            filterConversationId: conversationId,
            timestamp: new Date().toISOString(),
          });

          // Only show messages from the CURRENT conversation
          const messageConversationId = payload.new.conversation_id;
          const matchesCurrentConversation =
            messageConversationId === conversationId;

          if (!matchesCurrentConversation) {
            safeLog.log(
              "🚫 [CHAT] Message is from different conversation, ignoring:",
              {
                messageConversationId,
                currentConversationId: conversationId,
                messageId: payload.new.id,
              }
            );
            return;
          }

          const message = payload.new as Message;

          // WhatsApp-style isolation: Each adult only sees their own messages + child messages
          if (familyMemberId) {
            // Family member: filter out parent messages and other family member messages
            if (message.sender_type === "parent") {
              safeLog.log(
                "🚫 [CHAT] Filtering out parent message for family member:",
                message.id
              );
              return;
            }
            if (
              message.sender_type === "family_member" &&
              message.family_member_id !== familyMemberId
            ) {
              safeLog.log(
                "🚫 [CHAT] Filtering out other family member's message:",
                message.id
              );
              return;
            }
          } else if (!isChild) {
            // Parent: filter out family member messages
            if (message.sender_type === "family_member") {
              safeLog.log(
                "🚫 [CHAT] Filtering out family member message for parent:",
                message.id
              );
              return;
            }
          }

          onNewMessage(message);
        }
      )
      .subscribe((status, err) => {
        safeLog.log("📡 [CHAT] Realtime subscription status:", {
          status,
          channel: channelName,
          childId: targetChildId,
          isChild: isChild,
          error: err ? sanitizeError(err) : undefined,
          timestamp: new Date().toISOString(),
        });

        // Update subscription status for polling logic
        if (status === "SUBSCRIBED") {
          setSubscriptionStatus("SUBSCRIBED");
          safeLog.log("✅ [CHAT] Successfully subscribed to messages");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setSubscriptionStatus(status === "TIMED_OUT" ? "TIMED_OUT" : "ERROR");
          safeLog.error(
            "❌ [CHAT] Realtime subscription error:",
            err ? sanitizeError(err) : "Unknown error"
          );
        } else if (status === "SUBSCRIBING") {
          setSubscriptionStatus("SUBSCRIBING");
        }
      });

    return () => {
      if (channelRef.current) {
        safeLog.log("🧹 [CHAT] Cleaning up realtime subscription");
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setSubscriptionStatus(null);
      }
    };
  }, [targetChildId, conversationId, isChild, isFamilyMember, familyMemberId, onNewMessage]);

  return { subscriptionStatus };
};






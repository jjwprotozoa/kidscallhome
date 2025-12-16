// src/features/messaging/hooks/useMessages.ts
// Hook for fetching and managing messages

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { safeLog, sanitizeError } from "@/utils/security";
import { useCallback, useEffect, useState } from "react";

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

interface UseMessagesProps {
  targetChildId: string | null;
  conversationId: string | null;
  isChild: boolean;
  enabled: boolean;
  realtimeStatus?: "SUBSCRIBED" | "ERROR" | "TIMED_OUT" | "SUBSCRIBING" | null;
}

export const useMessages = ({
  targetChildId,
  conversationId,
  isChild,
  enabled,
  realtimeStatus,
}: UseMessagesProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const { toast } = useToast();

  const fetchMessages = useCallback(
    async (convId?: string | null) => {
      const convIdToUse = convId || conversationId;

      if (!convIdToUse) {
        if (!isChild) {
          toast({
            title: "Error loading messages",
            description:
              "Conversation ID is required. Please select a conversation.",
            variant: "destructive",
          });
        } else {
          safeLog.log(
            "Conversation ID not available yet. Will be created on first message."
          );
        }
        return;
      }

      // CRITICAL: Ensure children use anonymous access (not authenticated)
      if (isChild) {
        const { data: authCheck } = await supabase.auth.getSession();
        if (authCheck?.session) {
          safeLog.warn(
            "⚠️ [MESSAGES] Child has auth session, signing out for anonymous access"
          );
          await supabase.auth.signOut();
        }
      }

      try {
        safeLog.log("📥 [MESSAGES] Fetching messages", {
          conversationId: convIdToUse,
          isChild,
          timestamp: new Date().toISOString(),
        });

        // @ts-expect-error - Supabase type instantiation is excessively deep
        const result = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", convIdToUse)
          .order("created_at", { ascending: true });

        const data = result.data as Message[] | null;
        const error = result.error as { message: string; code?: string } | null;

        if (error) {
          safeLog.error("❌ [MESSAGES] Error fetching messages:", {
            error: sanitizeError(error),
            conversationId: convIdToUse,
            isChild,
            code: error.code || "unknown",
          });
          toast({
            title: "Error loading messages",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        safeLog.log("✅ [MESSAGES] Messages fetched successfully", {
          count: data?.length || 0,
          conversationId: convIdToUse,
          isChild,
          senderTypes: data?.map((m) => m.sender_type) || [],
        });

        setMessages((data as Message[]) || []);
      } catch (error) {
        safeLog.error("❌ [MESSAGES] Exception fetching messages:", {
          error: sanitizeError(error),
          conversationId: convIdToUse,
          isChild,
        });
      }
    },
    [conversationId, isChild, toast]
  );

  const addMessage = useCallback((message: Message) => {
    setMessages((current) => {
      const exists = current.some((m) => m.id === message.id);
      if (exists) {
        safeLog.warn(
          "⚠️ [CHAT] Duplicate message detected, ignoring:",
          message.id
        );
        return current;
      }
      return [...current, message];
    });
  }, []);

  // Fetch messages when conversationId changes
  useEffect(() => {
    if (enabled && targetChildId && conversationId) {
      fetchMessages(conversationId);
    }
  }, [enabled, targetChildId, conversationId, fetchMessages]);

  // Polling fallback - ONLY when realtime subscription is not working
  // If realtime is SUBSCRIBED, skip polling entirely to reduce database calls
  useEffect(() => {
    if (!enabled || !targetChildId || !conversationId) return;

    // Don't poll if realtime is successfully subscribed
    if (realtimeStatus === "SUBSCRIBED") {
      safeLog.log("✅ [CHAT] Realtime active, skipping polling");
      return;
    }

    // Only poll when realtime is not working (ERROR, TIMED_OUT, or null/SUBSCRIBING)
    // Use longer interval (120s) when polling is needed as fallback
    const pollInterval = setInterval(async () => {
      try {
        // CRITICAL: Ensure children use anonymous access (not authenticated)
        if (isChild) {
          const { data: authCheck } = await supabase.auth.getSession();
          if (authCheck?.session) {
            safeLog.warn(
              "⚠️ [MESSAGES POLL] Child has auth session, signing out for anonymous access"
            );
            await supabase.auth.signOut();
          }
        }

        const queryResult = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });

        const data = queryResult.data as Message[] | null;

        if (data) {
          setMessages((current) => {
            const currentIds = new Set(current.map((m) => m.id));
            const newMessages = data.filter((m) => !currentIds.has(m.id));

            if (newMessages.length > 0) {
              safeLog.log(
                "📨 [CHAT] Polling found new messages:",
                newMessages.length
              );
              return [...current, ...newMessages] as Message[];
            }
            return current;
          });
        }
      } catch (error) {
        safeLog.error("❌ [CHAT] Polling error:", sanitizeError(error));
      }
    }, 120000); // 120 seconds - longer interval when polling is needed

    return () => clearInterval(pollInterval);
  }, [enabled, targetChildId, conversationId, realtimeStatus, isChild]);

  return { messages, fetchMessages, addMessage };
};

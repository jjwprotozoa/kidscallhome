// src/features/messaging/hooks/useMessages.ts
// Hook for fetching and managing messages

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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

interface UseMessagesProps {
  targetChildId: string | null;
  conversationId: string | null;
  isChild: boolean;
  enabled: boolean;
}

export const useMessages = ({
  targetChildId,
  conversationId,
  isChild,
  enabled,
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

      try {
        // @ts-expect-error - Supabase type instantiation is excessively deep
        const queryResult = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", convIdToUse)
          .order("created_at", { ascending: true });

        const data = queryResult.data as Message[] | null;
        const error = queryResult.error as { message: string } | null;

        if (error) {
          toast({
            title: "Error loading messages",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        setMessages((data as Message[]) || []);
      } catch (error) {
        safeLog.error("Error fetching messages:", sanitizeError(error));
      }
    },
    [conversationId, isChild, toast]
  );

  const addMessage = useCallback((message: Message) => {
    setMessages((current) => {
      const exists = current.some((m) => m.id === message.id);
      if (exists) {
        safeLog.warn("⚠️ [CHAT] Duplicate message detected, ignoring:", message.id);
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

  // Polling fallback (every 60 seconds - reduced from 15s to minimize database traffic)
  // Realtime subscriptions should handle most cases, this is just a safety net
  useEffect(() => {
    if (!enabled || !targetChildId || !conversationId) return;

    const pollInterval = setInterval(async () => {
      try {
        // @ts-expect-error - Supabase type instantiation is excessively deep
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
    }, 60000);

    return () => clearInterval(pollInterval);
  }, [enabled, targetChildId, conversationId]);

  return { messages, fetchMessages, addMessage };
};




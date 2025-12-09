// src/features/messaging/hooks/useMessageSending.ts
// Hook for sending messages

import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  getChildProfileId,
  getCurrentAdultProfileId,
  getOrCreateConversation,
} from "@/utils/conversations";
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

interface UseMessageSendingProps {
  childData: { id: string; name: string; avatar_color: string } | null;
  isChild: boolean;
  isFamilyMember: boolean;
  familyMemberId: string | null;
  currentSenderType: "parent" | "child" | "family_member" | null;
  conversationId: string | null;
  setConversationId: (id: string) => void;
  onMessageSent: (message: Message) => void;
}

export const useMessageSending = ({
  childData,
  isChild,
  isFamilyMember,
  familyMemberId,
  currentSenderType,
  conversationId,
  setConversationId,
  onMessageSent,
}: UseMessageSendingProps) => {
  const { childId } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;
    if (currentSenderType === "child" && !childData) return;
    if (currentSenderType !== "child" && !childId) return;

    setLoading(true);
    try {
      const targetChildId =
        currentSenderType === "child" ? childData!.id : childId!;

      let senderId: string | undefined;
      let authUid: string | undefined;
      let currentConversationId = conversationId;

      if (currentSenderType === "child") {
        senderId = childData!.id;
        authUid = undefined;

        const urlParams = new URLSearchParams(window.location.search);
        const conversationIdParam = urlParams.get("conversation");
        const storedConversationId = localStorage.getItem(
          "selectedConversationId"
        );

        if (conversationIdParam) {
          currentConversationId = conversationIdParam;
          setConversationId(conversationIdParam);
        } else if (storedConversationId) {
          currentConversationId = storedConversationId;
          setConversationId(storedConversationId);
        } else {
          throw new Error(
            "No conversation selected. Please go back to Family & Parents and click 'Message' on the person you want to chat with."
          );
        }

        if (!currentConversationId) {
          throw new Error(
            "Conversation ID is required. Please select a person from the Family & Parents list and click 'Message'."
          );
        }
      } else {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
          throw new Error("Not authenticated. Please log in again.");
        }
        senderId = user.id;
        authUid = user.id;

        if (targetChildId) {
          const childProfileId = await getChildProfileId(targetChildId);
          const userType = isFamilyMember ? "family_member" : "parent";

          let familyId: string;
          if (isFamilyMember && familyMemberId) {
            const { data: fm } = await supabase
              .from("family_members")
              .select("parent_id")
              .eq("id", familyMemberId)
              .single();
            familyId = fm?.parent_id || user.id;
          } else {
            familyId = user.id;
          }

          const adultProfileId = await getCurrentAdultProfileId(
            user.id,
            familyId,
            userType
          );

          if (!childProfileId || !adultProfileId) {
            throw new Error("Could not resolve profile IDs");
          }

          const convId = await getOrCreateConversation(
            adultProfileId,
            userType,
            childProfileId
          );
          if (convId) {
            currentConversationId = convId;
            setConversationId(convId);
          } else {
            throw new Error("Could not create or find conversation");
          }
        }
      }

      if (!senderId || !targetChildId || !currentConversationId) {
        throw new Error("Missing required fields");
      }

      const payload: {
        child_id: string;
        conversation_id?: string;
        sender_id: string;
        family_member_id?: string | null;
        sender_type: "parent" | "child" | "family_member";
        content: string;
      } = {
        child_id: targetChildId,
        sender_id: senderId || "",
        sender_type:
          currentSenderType ||
          (isChild ? "child" : isFamilyMember ? "family_member" : "parent"),
        content: content.trim(),
        conversation_id: currentConversationId,
      };

      if (currentSenderType === "family_member" && familyMemberId) {
        payload.sender_id = familyMemberId;
        payload.family_member_id = familyMemberId;
      } else if (currentSenderType === "child") {
        payload.sender_id = senderId;
        payload.family_member_id = null;
      } else {
        payload.sender_id = senderId;
        payload.family_member_id = null;
      }

      safeLog.log("📤 [MESSAGE INSERT] Payload:", {
        child_id: payload.child_id,
        conversation_id: payload.conversation_id,
        sender_id: payload.sender_id,
        sender_type: payload.sender_type,
        content_length: payload.content.length,
      });

      const { data, error } = await supabase
        .from("messages")
        .insert(payload)
        .select()
        .single();

      if (error) {
        safeLog.error("❌ [MESSAGE INSERT] Error:", {
          message: error.message,
          code: error.code,
        });

        if (error.code === "42501" || error.message.includes("row-level security")) {
          throw new Error(
            "Unable to send message. Please check database RLS policies are correctly configured."
          );
        }

        throw error;
      }

      safeLog.log("✅ [MESSAGE INSERT] Success", { messageId: data?.id });

      if (data) {
        const newMessage: Message = {
          id: data.id,
          sender_type: data.sender_type as "parent" | "child" | "family_member",
          sender_id: data.sender_id,
          family_member_id: data.family_member_id,
          child_id: data.child_id,
          content: data.content,
          created_at: data.created_at,
          read_at: data.read_at || null,
        };

        onMessageSent(newMessage);
      }

      return true;
    } catch (error: unknown) {
      safeLog.error("❌ [MESSAGE INSERT] Exception:", sanitizeError(error));
      toast({
        title: "Error sending message",
        description:
          error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { sendMessage, loading };
};




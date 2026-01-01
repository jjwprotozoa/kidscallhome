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
  getChildConversations,
} from "@/utils/conversations";
import { safeLog, sanitizeError } from "@/utils/security";
import { checkBlockedWords } from "@/lib/wordFilter";
import { notifyParentsOfBlockedWords } from "@/lib/parentNotifications";

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
  customKeywords?: string[]; // Custom keywords from safety settings
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
  customKeywords = [],
}: UseMessageSendingProps) => {
  const { childId } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;
    
    // Guard: Ensure currentSenderType is set
    if (!currentSenderType) {
      safeLog.error("❌ [MESSAGE SEND] currentSenderType is null");
      toast({
        title: "Error",
        description: "Unable to determine sender type. Please refresh the page.",
        variant: "destructive",
      });
      return false;
    }
    
    if (currentSenderType === "child" && !childData) {
      safeLog.error("❌ [MESSAGE SEND] Child sender but no childData");
      return false;
    }
    if (currentSenderType !== "child" && !childId) {
      safeLog.error("❌ [MESSAGE SEND] Non-child sender but no childId");
      return false;
    }

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

        // Priority: URL param > localStorage > prop from state > try to resolve
        if (conversationIdParam) {
          currentConversationId = conversationIdParam;
          setConversationId(conversationIdParam);
        } else if (storedConversationId) {
          currentConversationId = storedConversationId;
          setConversationId(storedConversationId);
        } else if (currentConversationId) {
          // Use conversationId from state (set by useChatInitialization)
          // No need to set it again, it's already in state
        } else {
          // Last resort: try to resolve conversation automatically
          try {
            safeLog.log("🔄 [MESSAGE SEND] Auto-resolving conversation for child:", {
              childId: childData!.id,
            });
            
            const childProfileId = await getChildProfileId(childData!.id);
            safeLog.log("🔄 [MESSAGE SEND] Child profile ID resolved:", {
              childId: childData!.id,
              childProfileId,
            });
            
            if (childProfileId) {
              const conversations = await getChildConversations(childProfileId);
              safeLog.log("🔄 [MESSAGE SEND] Conversations found:", {
                count: conversations?.length || 0,
                conversations: conversations?.map(c => ({
                  id: c.conversation.id,
                  participantType: c.participant.type,
                })),
              });
              
              if (conversations && conversations.length > 0) {
                // Prefer parent conversation, otherwise use first available
                const parentConv = conversations.find(
                  (c) => c.participant.type === "parent"
                );
                const selectedConv = parentConv || conversations[0];
                currentConversationId = selectedConv.conversation.id;
                setConversationId(currentConversationId);
                localStorage.setItem("selectedConversationId", currentConversationId);
                
                safeLog.log("✅ [MESSAGE SEND] Auto-selected conversation:", {
                  conversationId: currentConversationId,
                  participantType: selectedConv.participant.type,
                });
              } else {
                safeLog.error("❌ [MESSAGE SEND] No conversations found for child profile:", {
                  childProfileId,
                  childId: childData!.id,
                });
                throw new Error(
                  "No conversation selected. Please go back to Family & Parents and click 'Message' on the person you want to chat with."
                );
              }
            } else {
              safeLog.error("❌ [MESSAGE SEND] Could not resolve child profile ID:", {
                childId: childData!.id,
              });
              throw new Error(
                "No conversation selected. Please go back to Family & Parents and click 'Message' on the person you want to chat with."
              );
            }
          } catch (resolveError) {
            safeLog.error("❌ [MESSAGE SEND] Auto-resolution failed:", sanitizeError(resolveError));
            // If auto-resolution fails, throw the original error
            throw new Error(
              "No conversation selected. Please go back to Family & Parents and click 'Message' on the person you want to chat with."
            );
          }
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
            // Try family_members first
            const { data: fm } = await supabase
              .from("family_members")
              .select("parent_id")
              .eq("id", familyMemberId)
              .maybeSingle();
            
            if (fm?.parent_id) {
              familyId = fm.parent_id;
            } else {
              // Fallback: Try adult_profiles
              const { data: adultProfile } = await supabase
                .from("adult_profiles" as never)
                .select("family_id")
                .eq("user_id", familyMemberId)
                .eq("role", "family_member")
                .maybeSingle();
              
              if (adultProfile) {
                const ap = adultProfile as { family_id: string };
                familyId = ap.family_id;
              } else {
                familyId = user.id;
              }
            }
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

      // Check for blocked words
      const { isBlocked, matchedWords } = checkBlockedWords(content.trim(), customKeywords);
      
      // For children: Block messages with inappropriate words
      if (isChild && isBlocked) {
        toast({
          title: "Message blocked",
          description: `Your message contains inappropriate words. Please remove: ${matchedWords.join(", ")}`,
          variant: "destructive",
        });
        return false;
      }

      // For family members: Notify parents but still allow message to be sent
      if (currentSenderType === "family_member" && isBlocked && targetChildId) {
        try {
          // Get child profile ID for notification
          const childProfileId = await getChildProfileId(targetChildId);
          
          if (childProfileId) {
            // Get family member name
            let familyMemberName = "A family member";
            if (familyMemberId) {
              // Try to get name from adult_profiles using user_id (familyMemberId is typically the user_id)
              // @ts-expect-error - adult_profiles table exists but not in types
              const { data: fmProfile } = await supabase
                .from("adult_profiles" as never)
                .select("name")
                .eq("user_id", familyMemberId)
                .eq("role", "family_member")
                .maybeSingle();
              
              if (fmProfile) {
                familyMemberName = (fmProfile as { name?: string })?.name || familyMemberName;
              } else {
                // Fallback: Try family_members table
                const { data: fmData } = await supabase
                  .from("family_members")
                  .select("name")
                  .eq("id", familyMemberId)
                  .maybeSingle();
                
                if (fmData) {
                  familyMemberName = (fmData as { name?: string })?.name || familyMemberName;
                }
              }
            }

            // Notify parents asynchronously (don't block message sending)
            notifyParentsOfBlockedWords(
              childProfileId,
              familyMemberName,
              matchedWords,
              content.trim()
            ).catch((error) => {
              console.error("Failed to notify parents:", error);
            });
          }
        } catch (error) {
          console.error("Error notifying parents of blocked words:", error);
          // Don't block message sending if notification fails
        }
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
        // Check if family member exists in family_members table before setting family_member_id
        // The family_member_id column has a foreign key constraint to family_members.id
        // If the family member was created via adult_profiles only (new system), 
        // they won't have a record in family_members table
        const { data: fmExists } = await supabase
          .from("family_members")
          .select("id")
          .eq("id", familyMemberId)
          .maybeSingle();
        
        if (fmExists) {
          payload.family_member_id = familyMemberId;
        } else {
          // Family member doesn't exist in family_members table (created via adult_profiles)
          // Set to null to avoid foreign key constraint violation
          payload.family_member_id = null;
          safeLog.log("📝 [MESSAGE INSERT] Family member not in family_members table, setting family_member_id to null");
        }
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
        family_member_id: payload.family_member_id,
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

        // Check for rate limit error (policy will return false if rate limit exceeded)
        if (
          error.message?.includes("rate_limit") ||
          error.message?.includes("rate limit") ||
          error.code === "42501" && error.message?.includes("check_child_message_rate_limit")
        ) {
          throw new Error(
            "You are sending messages too quickly. Please wait a moment and try again."
          );
        }

        if (error.code === "42501" || error.message.includes("row-level security")) {
          throw new Error(
            "Unable to send message. Please check database RLS policies are correctly configured."
          );
        }

        // Check for 409 Conflict (foreign key violation, unique constraint, etc.)
        if (error.code === "23503") {
          // Foreign key violation
          safeLog.error("❌ [MESSAGE INSERT] Foreign key violation:", {
            message: error.message,
            details: error.details,
          });
          throw new Error(
            "Unable to send message. There may be a data consistency issue. Please try refreshing the page."
          );
        }

        if (error.code === "23505") {
          // Unique constraint violation
          safeLog.error("❌ [MESSAGE INSERT] Unique constraint violation:", {
            message: error.message,
            details: error.details,
          });
          throw new Error(
            "This message may have already been sent. Please refresh and try again."
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




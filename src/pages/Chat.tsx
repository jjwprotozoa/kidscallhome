// src/pages/Chat.tsx
// Chat page component - refactored to use messaging feature components and hooks

import Navigation from "@/components/Navigation";
import { ChatHeader } from "@/features/messaging/components/ChatHeader";
import { MessageInput } from "@/features/messaging/components/MessageInput";
import { MessageList } from "@/features/messaging/components/MessageList";
import { useChatInitialization } from "@/features/messaging/hooks/useChatInitialization";
import { useChatRealtime } from "@/features/messaging/hooks/useChatRealtime";
import { useMarkMessagesRead } from "@/features/messaging/hooks/useMarkMessagesRead";
import { useMessages } from "@/features/messaging/hooks/useMessages";
import { useMessageSending } from "@/features/messaging/hooks/useMessageSending";
import { canCommunicate } from "@/lib/permissions";
import { getFamilySafetyKeywords } from "@/lib/wordFilter";
import { getChildProfileId } from "@/utils/conversations";
import { supabase } from "@/integrations/supabase/client";
import { useBadgeStore } from "@/stores/badgeStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const Chat = () => {
  const navigate = useNavigate();
  const [newMessage, setNewMessage] = useState("");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);

  // Initialize chat state
  const {
    isChild,
    isFamilyMember,
    familyMemberId,
    childData,
    parentData,
    parentName,
    conversationId,
    currentSenderType,
    currentSenderId,
    targetChildId,
    initialized,
  } = useChatInitialization();

  // Set conversation ID state updater
  const [conversationIdState, setConversationIdState] = useState<string | null>(
    conversationId
  );

  useEffect(() => {
    setConversationIdState(conversationId);
  }, [conversationId]);

  // Use a ref to store the latest addMessage callback
  type MessageType = {
    id: string;
    sender_type: "parent" | "child" | "family_member";
    sender_id?: string;
    family_member_id?: string;
    conversation_id?: string | null;
    child_id: string;
    content: string;
    created_at: string;
    read_at?: string | null;
  };
  const addMessageRef = useRef<((message: MessageType) => void) | null>(null);

  // Handle new messages from realtime - use ref to avoid stale closure
  const handleNewMessage = useCallback((message: MessageType) => {
    if (addMessageRef.current) {
      addMessageRef.current(message);
    }
  }, []);

  // Set up realtime subscription first (subscriptionStatus will be 'subscribing' initially)
  const { subscriptionStatus } = useChatRealtime({
    targetChildId,
    conversationId: conversationIdState,
    isChild,
    isFamilyMember,
    familyMemberId,
    onNewMessage: handleNewMessage,
  });

  // Manage messages (after subscriptionStatus is available)
  const { messages, addMessage } = useMessages({
    targetChildId,
    conversationId: conversationIdState,
    isChild,
    enabled: initialized && !!targetChildId,
    realtimeStatus: subscriptionStatus,
  });

  // Update the ref whenever addMessage changes
  useEffect(() => {
    addMessageRef.current = addMessage;
  }, [addMessage]);

  // Mark messages as read
  useMarkMessagesRead({
    targetChildId,
    conversationId: conversationIdState,
    isChild,
    isFamilyMember,
    familyMemberId,
    enabled: initialized && !!targetChildId && !!conversationIdState,
  });

  // Handle message sending
  const { sendMessage, loading } = useMessageSending({
    childData,
    isChild,
    isFamilyMember,
    familyMemberId,
    currentSenderType,
    conversationId: conversationIdState,
    setConversationId: setConversationIdState,
    onMessageSent: handleNewMessage,
    customKeywords,
  });

  // Check permissions when chat initializes or participants change
  useEffect(() => {
    const checkPermissions = async () => {
      if (!initialized || !currentSenderId || !currentSenderType) {
        return;
      }

      // Determine target user ID and role
      let targetUserId: string | null = null;
      let targetUserRole: "parent" | "family_member" | "child" = "parent";

      if (isChild) {
        // Child chatting with parent
        targetUserId = parentData?.id || null;
        targetUserRole = "parent";
      } else if (targetChildId) {
        // Parent/family member chatting with child
        targetUserId = targetChildId;
        targetUserRole = "child";
      }

      if (!targetUserId) {
        return;
      }

      // Check permission
      const userRole: "parent" | "family_member" | "child" = isChild
        ? "child"
        : isFamilyMember
        ? "family_member"
        : "parent";

      const permission = await canCommunicate(
        currentSenderId,
        userRole,
        targetUserId,
        targetUserRole
      );

      if (!permission.allowed) {
        setPermissionError(
          permission.reason ||
            "You don't have permission to communicate with this contact"
        );
        setHasPermission(false);
        setIsBlocked(permission.reason?.includes("blocked") || false);
      } else {
        setPermissionError(null);
        setHasPermission(true);
        setIsBlocked(false);
      }
    };

    checkPermissions();
  }, [
    initialized,
    currentSenderId,
    currentSenderType,
    isChild,
    isFamilyMember,
    targetChildId,
    parentData,
    childData,
  ]);

  // Fetch safety mode keywords if safety mode is enabled
  useEffect(() => {
    const fetchSafetyKeywords = async () => {
      try {
        let familyId: string | null = null;

        if (isChild && childData) {
          // For children, get family_id from child_family_memberships junction table
          try {
            const childProfileId = await getChildProfileId(childData.id);
            console.warn("[Chat] Child profile lookup:", {
              childId: childData.id,
              childProfileId,
            });
            
            if (childProfileId) {
              // Try child_family_memberships first (correct way for multi-family support)
              const { data: membership, error: membershipError } = await supabase
                .from("child_family_memberships" as never)
                .select("family_id")
                .eq("child_profile_id", childProfileId)
                .limit(1)
                .maybeSingle();
              
              if (!membershipError && membership) {
                familyId = (membership as { family_id?: string } | null)?.family_id || null;
                console.warn("[Chat] Family ID from child_family_memberships:", familyId);
              } else {
                // Fallback: Try child_profiles.family_id (for backward compatibility)
                const { data: childProfile, error: profileError } = await supabase
                  .from("child_profiles" as never)
                  .select("family_id")
                  .eq("id", childProfileId)
                  .maybeSingle();
                
                if (!profileError && childProfile) {
                  familyId = (childProfile as { family_id?: string } | null)?.family_id || null;
                  console.warn("[Chat] Fallback: Family ID from child_profiles:", familyId);
                }
              }
            } else {
              // Fallback: Try using childData.id directly
              const { data: membership, error: membershipError } = await supabase
                .from("child_family_memberships" as never)
                .select("family_id")
                .eq("child_profile_id", childData.id)
                .limit(1)
                .maybeSingle();
              
              if (!membershipError && membership) {
                familyId = (membership as { family_id?: string } | null)?.family_id || null;
                console.warn("[Chat] Fallback 2: Family ID from child_family_memberships:", familyId);
              }
            }
          } catch (error) {
            console.error("[Chat] Error fetching child family:", error);
          }
        } else {
          // For parents/family members, get their family_id
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: adultProfile } = await supabase
            .from("adult_profiles" as never)
            .select("family_id")
            .eq("user_id", user.id)
            .maybeSingle();
          familyId = (adultProfile as { family_id?: string } | null)?.family_id || null;
        }

        console.warn("[Chat] Family lookup:", {
          familyId,
          isChild,
          childData: childData?.id,
        });

        if (familyId) {
          // Check if safety mode is enabled and get keywords
          const { data: family, error: familyError } = await supabase
            .from("families")
            .select("safety_mode_enabled, safety_mode_settings")
            .eq("id", familyId)
            .maybeSingle();

          if (familyError) {
            console.error("[Chat] Error fetching family:", familyError);
            setCustomKeywords([]);
            return;
          }

          // Debug: Log raw family data
          console.warn("[Chat] Raw family data from DB:", {
            family,
            familyId,
            hasData: !!family,
          });

          // Handle both possible data structures:
          // 1. Keywords inside safety_mode_settings (correct structure)
          // 2. Keywords at root level (if data was saved incorrectly)
          const familyData = family as {
            safety_mode_enabled?: boolean;
            safety_mode_settings?: {
              keyword_alerts?: boolean;
              keywords?: string[] | null;
            } | null;
            keywords?: string[] | null; // Handle case where keywords might be at root
          } | null;

          if (familyData?.safety_mode_enabled) {
            let keywords: string[] = [];
            
            // First, try to get keywords from safety_mode_settings (correct location)
            if (familyData.safety_mode_settings) {
              const settings = familyData.safety_mode_settings;
              if (settings.keywords && Array.isArray(settings.keywords)) {
                keywords = settings.keywords;
              }
            }
            
            // Fallback: Check if keywords are at root level (incorrect but handle it)
            if (keywords.length === 0 && familyData.keywords && Array.isArray(familyData.keywords)) {
              keywords = familyData.keywords;
            }
            
            // Debug logging
            console.warn("[Chat] Safety keywords fetch:", {
              isChild,
              safety_mode_enabled: familyData.safety_mode_enabled,
              safety_mode_settings: familyData.safety_mode_settings,
              keywords_found: keywords,
              keywords_count: keywords.length,
            });
            
            // For children: Always filter blocked words if safety mode is enabled
            // Custom keywords are used in addition to default words
            if (isChild) {
              setCustomKeywords(keywords);
            } else {
              // Parents/Family members: Use custom keywords if keyword_alerts is enabled
              const settings = familyData.safety_mode_settings;
              if (settings?.keyword_alerts) {
                setCustomKeywords(keywords);
              } else {
                setCustomKeywords([]);
              }
            }
          } else {
            console.warn("[Chat] Safety mode not enabled or no family data");
            setCustomKeywords([]);
          }
        } else {
          setCustomKeywords([]);
        }
      } catch (error) {
        console.error("Error fetching safety keywords:", error);
        setCustomKeywords([]);
      }
    };

    if (initialized) {
      fetchSafetyKeywords();
    }
  }, [initialized, isChild, childData]);

  // Cleanup: Clear badge when navigating away
  useEffect(() => {
    return () => {
      const targetId = isChild ? childData?.id || null : targetChildId;
      if (targetId) {
        useBadgeStore.getState().clearUnreadForChild(targetId);
      }
    };
  }, [childData, targetChildId, isChild]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await sendMessage(newMessage);
    if (success) {
      setNewMessage("");
    }
  };

  const goBack = () => {
    if (isChild) {
      navigate("/child/dashboard");
    } else if (isFamilyMember) {
      navigate("/family-member");
    } else {
      navigate("/parent/children");
    }
  };

  // Determine recipient info for header
  const recipientName = isChild ? parentName : childData?.name || "Unknown";

  const recipientAvatar = isChild
    ? parentData
      ? {
          color: undefined,
          initial: parentData.name[0].toUpperCase(),
        }
      : undefined
    : childData
    ? {
        color: childData.avatar_color,
        initial: childData.name[0],
      }
    : undefined;

  if (!initialized) {
    return (
      <div className="min-h-[100dvh] flex flex-col relative" style={{ backgroundColor: "#f0f2f5" }}>
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  // Show helpful message if child has no conversation selected
  if (isChild && !conversationIdState) {
    return (
      <div className="min-h-[100dvh] flex flex-col relative" style={{ backgroundColor: "#f0f2f5" }}>
        <Navigation />
        <ChatHeader
          recipientName="Select a Contact"
          recipientAvatar={undefined}
          onBack={goBack}
        />
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
          <p className="text-lg font-medium mb-2">No conversation selected</p>
          <p className="text-muted-foreground text-center mb-4">
            Please go back to Family & Parents and click 'Message' on the person you want to chat with.
          </p>
          <button
            onClick={goBack}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Go to Family & Parents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col relative" style={{ backgroundColor: "#f0f2f5" }}>
      <Navigation />
      <ChatHeader
        recipientName={recipientName}
        recipientAvatar={recipientAvatar}
        onBack={goBack}
      />

      {/* Permission Error Banner */}
      {permissionError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded m-4">
          <p className="font-medium">{permissionError}</p>
        </div>
      )}

      <MessageList
        messages={messages}
        currentSenderType={currentSenderType}
        currentSenderId={currentSenderId}
      />

      <MessageInput
        value={newMessage}
        onChange={setNewMessage}
        onSubmit={handleSendMessage}
        loading={loading}
        disabled={!hasPermission || isBlocked || !conversationIdState}
        customKeywords={customKeywords}
        placeholder={
          !conversationIdState
            ? "No conversation selected"
            : isBlocked
            ? "This contact is blocked"
            : !hasPermission
            ? "You don't have permission to send messages"
            : "Type a message..."
        }
      />
    </div>
  );
};

export default Chat;

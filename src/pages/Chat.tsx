import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBadgeStore } from "@/stores/badgeStore";
import {
  getChildProfileId,
  getCurrentAdultProfileId,
  getOrCreateConversation,
} from "@/utils/conversations";
import { safeLog, sanitizeError, sanitizeObject } from "@/utils/security";
import { ArrowLeft, Send } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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

interface ChildSession {
  id: string;
  name: string;
  avatar_color: string;
}

const Chat = () => {
  const { childId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isChild, setIsChild] = useState(false);
  const [isFamilyMember, setIsFamilyMember] = useState(false);
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(null);
  const [childData, setChildData] = useState<ChildSession | null>(null);
  const [parentData, setParentData] = useState<{
    name: string;
    id?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [parentName, setParentName] = useState<string>("Mom/Dad");
  const [conversationId, setConversationId] = useState<string | null>(null);
  // Current user identity for message ownership detection
  const [currentSenderType, setCurrentSenderType] = useState<
    "parent" | "child" | "family_member" | null
  >(null);
  const [currentSenderId, setCurrentSenderId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const initializeChat = async () => {
      let targetChildId: string | null = null;
      let isChildUser = false; // Local variable to track user type
      let currentFamilyMemberId: string | null = null; // Local variable to track family member ID

      // Check if conversation ID is provided in URL params (from child conversations list)
      // Note: We'll only use this for children, not for family members/parents
      // Family members and parents should always get/create their own conversation
      const urlParams = new URLSearchParams(window.location.search);
      const conversationIdParam = urlParams.get("conversation");

      // CRITICAL: Check childSession FIRST if childId param matches childSession
      // This ensures children are correctly identified even if there's a stale parent session
      const childSession = localStorage.getItem("childSession");
      let childSessionData: ChildSession | null = null;

      if (childSession) {
        try {
          childSessionData = JSON.parse(childSession);
          // If childId param matches childSession ID, this is definitely a child
          if (childId && childId === childSessionData.id) {
            isChildUser = true;
            setIsChild(true);
            setChildData(childSessionData);
            setCurrentSenderType("child");
            setCurrentSenderId(childSessionData.id);
            targetChildId = childSessionData.id;

            // For children, use conversation_id if provided, otherwise resolve it
            const convId =
              conversationIdParam ||
              localStorage.getItem("selectedConversationId");

            if (convId) {
              setConversationId(convId);
              fetchMessages(childSessionData.id, undefined, convId);
            } else {
              // Resolve conversation_id for child
              // Children can have multiple conversations (one per adult)
              // Get the first conversation with the parent (or any conversation if parent not found)
              try {
                const { getChildProfileId, getChildConversations } =
                  await import("@/utils/conversations");
                const childProfileId = await getChildProfileId(
                  childSessionData.id
                );

                if (childProfileId) {
                  // Get all conversations for this child
                  const conversations = await getChildConversations(
                    childProfileId
                  );

                  if (conversations && conversations.length > 0) {
                    // Prefer conversation with parent, otherwise use first one
                    const parentConv = conversations.find(
                      (c) => c.participant.type === "parent"
                    );
                    const selectedConv = parentConv || conversations[0];
                    const resolvedConvId = selectedConv.conversation.id;

                    setConversationId(resolvedConvId);
                    fetchMessages(
                      childSessionData.id,
                      undefined,
                      resolvedConvId
                    );
                  } else {
                    // No conversations yet - will be created when first message is sent
                    safeLog.log(
                      "No conversations found for child. Will be created on first message."
                    );
                  }
                } else {
                  safeLog.error("Could not resolve child profile ID");
                }
              } catch (error) {
                safeLog.error(
                  "Error resolving conversation for child:",
                  sanitizeError(error)
                );
                // Don't show error toast here - conversation will be created on first message
              }
            }

            // Fetch parent data for child users
            Promise.resolve(
              supabase
                .from("children")
                .select("parent_id")
                .eq("id", childSessionData.id)
                .single()
            )
              .then(({ data: childRecord, error: childError }) => {
                if (childError || !childRecord) {
                  safeLog.error(
                    "Error fetching child record:",
                    sanitizeError(childError)
                  );
                  return;
                }
                return supabase
                  .from("parents")
                  .select("id, name")
                  .eq("id", childRecord.parent_id)
                  .maybeSingle();
              })
              .then((result) => {
                if (result?.data) {
                  setParentName(result.data.name);
                  setParentData({ name: result.data.name, id: result.data.id });
                } else if (result?.error) {
                  safeLog.error(
                    "Error fetching parent data:",
                    sanitizeError(result.error)
                  );
                }
              })
              .catch((error) => {
                safeLog.error(
                  "Error fetching parent data:",
                  sanitizeError(error)
                );
              });

            // Set up realtime subscription (will be done below)
            // Continue to subscription setup
          }
        } catch (error) {
          safeLog.error("Error parsing childSession:", sanitizeError(error));
        }
      }

      // If we didn't identify as child above, check auth session
      if (!isChildUser) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const user = session?.user;

          if (user) {
            // Has auth session - check if parent or family member
            // Check if user is a family member
            const { data: familyMember } = await supabase
              .from("family_members")
              .select("id, name, parent_id")
              .eq("id", user.id)
              .eq("status", "active")
              .maybeSingle();

            if (familyMember) {
              // User is a family member
              isChildUser = false;
              setIsChild(false);
              setIsFamilyMember(true);
              currentFamilyMemberId = familyMember.id; // Capture for realtime subscription
              setFamilyMemberId(familyMember.id);
              setCurrentSenderType("family_member");
              setCurrentSenderId(familyMember.id);

              // Family member accessing chat via /chat/:childId route
              if (childId) {
                targetChildId = childId;

                // Resolve profile IDs
                const childProfileId = await getChildProfileId(childId);
                const adultProfileId = await getCurrentAdultProfileId(
                  user.id,
                  familyMember.parent_id, // family_id
                  "family_member"
                );

                if (!childProfileId || !adultProfileId) {
                  toast({
                    title: "Error",
                    description:
                      "Could not resolve profile IDs. Please try again.",
                    variant: "destructive",
                  });
                  return;
                }

                // Get or create conversation using profile IDs
                // IMPORTANT: Always create/get family member's own conversation,
                // ignore any conversation ID from URL params (which might be parent's)
                const convId = await getOrCreateConversation(
                  adultProfileId,
                  "family_member",
                  childProfileId
                );

                if (convId) {
                  // Always use the family member's conversation, not the URL param
                  setConversationId(convId);
                  fetchMessages(childId, familyMember.id, convId);
                } else {
                  toast({
                    title: "Error",
                    description: "Could not create or find conversation.",
                    variant: "destructive",
                  });
                }
                fetchChildData(childId);
                setParentName(familyMember.name || "Family Member");
              } else {
                navigate("/family-member/dashboard");
                return;
              }
            } else {
              // Has auth session but not family member = parent
              isChildUser = false;
              setIsChild(false);
              setIsFamilyMember(false);
              setCurrentSenderType("parent");
              setCurrentSenderId(user.id);

              // Parent accessing chat via /chat/:childId route
              if (childId) {
                targetChildId = childId;

                // Resolve profile IDs
                const childProfileId = await getChildProfileId(childId);
                // For parents, family_id is their own user_id
                const adultProfileId = await getCurrentAdultProfileId(
                  user.id,
                  user.id, // parent's own ID is family_id
                  "parent"
                );

                if (!childProfileId || !adultProfileId) {
                  toast({
                    title: "Error",
                    description:
                      "Could not resolve profile IDs. Please try again.",
                    variant: "destructive",
                  });
                  return;
                }

                // Get or create conversation using profile IDs
                const convId = await getOrCreateConversation(
                  adultProfileId,
                  "parent",
                  childProfileId
                );

                if (convId) {
                  setConversationId(convId);
                  fetchMessages(childId, undefined, convId);
                } else {
                  toast({
                    title: "Error",
                    description: "Could not create or find conversation.",
                    variant: "destructive",
                  });
                }
                fetchChildData(childId);
              } else {
                navigate("/parent/children");
                return;
              }
            }
          } else if (childSessionData) {
            // No auth session but have childSession - child accessing their own chat
            isChildUser = true;
            setIsChild(true);
            setChildData(childSessionData);
            setCurrentSenderType("child");
            setCurrentSenderId(childSessionData.id);
            targetChildId = childSessionData.id;

            // Children must use conversation_id from URL params or localStorage
            const convId =
              conversationIdParam ||
              localStorage.getItem("selectedConversationId");
            if (convId) {
              setConversationId(convId);
              fetchMessages(childSessionData.id, undefined, convId);
            } else {
              toast({
                title: "Error",
                description:
                  "No conversation selected. Please select a conversation first.",
                variant: "destructive",
              });
            }

            // Fetch parent data for child users - get family_id from child_profiles
            // Note: Using children table since child_profiles types aren't generated yet
            Promise.resolve(
              supabase
                .from("children")
                .select("parent_id")
                .eq("id", childSessionData.id)
                .single()
            )
              .then(({ data: childRecord, error: childError }) => {
                if (childError || !childRecord) {
                  safeLog.error(
                    "Error fetching child record:",
                    sanitizeError(childError)
                  );
                  return;
                }
                // Now fetch parent data
                return supabase
                  .from("parents")
                  .select("id, name")
                  .eq("id", childRecord.parent_id)
                  .maybeSingle();
              })
              .then((result) => {
                if (result?.data) {
                  setParentName(result.data.name);
                  setParentData({ name: result.data.name, id: result.data.id });
                } else if (result?.error) {
                  safeLog.error(
                    "Error fetching parent data:",
                    sanitizeError(result.error)
                  );
                }
              })
              .catch((error) => {
                safeLog.error(
                  "Error fetching parent data:",
                  sanitizeError(error)
                );
              });
          } else if (childId) {
            // No childSession but has childId param - this shouldn't happen for children
            // But could be a parent accessing without auth? Redirect to home
            navigate("/");
            return;
          } else {
            navigate("/");
            return;
          }
        } catch (error) {
          safeLog.error("Error checking auth session:", sanitizeError(error));
          navigate("/");
          return;
        }
      }

      // Set up realtime subscription
      // CRITICAL: Only set up subscription if we have a conversationId
      // Without conversationId, we can't properly filter messages and might receive messages from wrong conversations
      if (targetChildId && conversationId) {
        // Use local isChildUser variable instead of state to avoid stale closure
        safeLog.log("📡 [CHAT] Setting up realtime subscription for messages", {
          childId: targetChildId,
          conversationId: conversationId,
          isChild: isChildUser,
          timestamp: new Date().toISOString(),
        });

        // CRITICAL: Always use conversation_id for filtering to ensure message isolation
        // Each conversation (parent-child, family_member-child) must be completely separate
        const channelIdentifier = conversationId;
        const channelName = `messages-${channelIdentifier}`;
        safeLog.log("📡 [CHAT] Creating realtime channel:", {
          channelName,
          targetChildId,
          conversationId,
          filter: `conversation_id=eq.${conversationId}`,
          isChild: isChildUser,
        });

        // CRITICAL: Always filter by conversation_id to ensure we only get messages for THIS conversation
        // This prevents messages from other conversations (e.g., family member's conversation)
        // from appearing in the current conversation view
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
              // SECURITY: Only log message metadata, never content
              safeLog.log("📨 [CHAT] Received new message via realtime:", {
                messageId: payload.new.id,
                senderType: payload.new.sender_type,
                childId: payload.new.child_id,
                conversationId: payload.new.conversation_id,
                filterChildId: targetChildId,
                filterConversationId: conversationId,
                currentConversationId: conversationId, // Current conversation being viewed
                timestamp: new Date().toISOString(),
              });

              // CRITICAL: Only show messages from the CURRENT conversation
              // If conversationId is set, the message MUST match it exactly
              // This prevents messages from other conversations (e.g., family member's conversation)
              // from appearing in the parent's conversation view
              const messageConversationId = payload.new.conversation_id;
              const matchesCurrentConversation = conversationId
                ? messageConversationId === conversationId
                : payload.new.child_id === targetChildId;

              if (!matchesCurrentConversation) {
                safeLog.log(
                  "🚫 [CHAT] Message is from different conversation, ignoring:",
                  {
                    messageConversationId,
                    currentConversationId: conversationId,
                    messageId: payload.new.id,
                  }
                );
                return; // Don't show messages from other conversations
              }

              if (matchesCurrentConversation) {
                const message = payload.new as Message;

                // WhatsApp-style isolation: Each adult only sees their own messages + child messages
                if (currentFamilyMemberId) {
                  // Family member: filter out parent messages and other family member messages
                  if (message.sender_type === "parent") {
                    safeLog.log(
                      "🚫 [CHAT] Filtering out parent message for family member:",
                      message.id
                    );
                    return; // Don't add parent messages to family member's chat
                  }
                  // For family member messages, verify it's from this family member
                  if (
                    message.sender_type === "family_member" &&
                    message.family_member_id !== currentFamilyMemberId
                  ) {
                    safeLog.log(
                      "🚫 [CHAT] Filtering out other family member's message:",
                      message.id
                    );
                    return; // Don't add other family members' messages
                  }
                } else if (!isChildUser) {
                  // Parent: filter out family member messages (only see own messages + child messages)
                  if (message.sender_type === "family_member") {
                    safeLog.log(
                      "🚫 [CHAT] Filtering out family member message for parent:",
                      message.id
                    );
                    return; // Don't add family member messages to parent's chat
                  }
                }

                setMessages((current) => {
                  // Check for duplicates (shouldn't happen, but safety check)
                  const exists = current.some((m) => m.id === payload.new.id);
                  if (exists) {
                    safeLog.warn(
                      "⚠️ [CHAT] Duplicate message detected, ignoring:",
                      payload.new.id
                    );
                    return current;
                  }
                  return [...current, payload.new as Message];
                });
              } else {
                safeLog.warn(
                  "⚠️ [CHAT] Received message for different child_id, ignoring:",
                  {
                    received: payload.new.child_id,
                    expected: targetChildId,
                  }
                );
              }
            }
          )
          .subscribe((status, err) => {
            safeLog.log("📡 [CHAT] Realtime subscription status:", {
              status,
              channel: channelName,
              childId: targetChildId,
              isChild: isChildUser, // Use local variable instead of state
              error: err ? sanitizeError(err) : undefined,
              timestamp: new Date().toISOString(),
            });

            if (status === "SUBSCRIBED") {
              safeLog.log("✅ [CHAT] Successfully subscribed to messages");
              safeLog.log(
                "✅ [CHAT] Will receive INSERT events for child_id:",
                targetChildId
              );
            } else if (status === "CHANNEL_ERROR") {
              safeLog.error(
                "❌ [CHAT] Realtime subscription error:",
                err ? sanitizeError(err) : "Unknown error"
              );
              safeLog.error("❌ [CHAT] This usually means:");
              safeLog.error("   1. RLS policies are blocking SELECT access");
              safeLog.error("   2. Realtime is not enabled for messages table");
              safeLog.error("   3. WebSocket connection failed");
              safeLog.error(
                "❌ [CHAT] Falling back to polling (checking every 3 seconds)"
              );
            } else if (status === "TIMED_OUT") {
              safeLog.warn(
                "⚠️ [CHAT] Realtime subscription timed out - using polling fallback"
              );
            } else if (status === "CLOSED") {
              safeLog.warn(
                "⚠️ [CHAT] Realtime subscription closed - using polling fallback"
              );
            } else {
              safeLog.log("ℹ️ [CHAT] Realtime subscription status:", status);
            }
          });
      }
    };

    initializeChat();

    return () => {
      if (channelRef.current) {
        safeLog.log("🧹 [CHAT] Cleaning up realtime subscription");
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, conversationId, navigate]); // Recreate subscription when conversationId changes

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mark messages as read when chat is viewed
  useEffect(() => {
    // Wait for initialization - need either childData (for child) or childId (for parent)
    if (isChild && !childData) return;
    if (!isChild && !childId) return;

    const markMessagesAsRead = async () => {
      try {
        // Use state value instead of re-checking localStorage
        const targetChildId = isChild ? childData?.id : childId;

        if (!targetChildId) {
          safeLog.log("⚠️ [CHAT READ] No targetChildId, skipping mark as read");
          return;
        }

        safeLog.log("📖 [CHAT READ] Starting mark as read process", {
          targetChildId,
          isChild,
          timestamp: new Date().toISOString(),
        });

        // Get ALL unread messages for this conversation (no limit)
        let query = supabase
          .from("messages")
          .select("id, sender_type, read_at")
          .is("read_at", null);

        // Use conversation_id if available, otherwise fall back to child_id
        if (conversationId) {
          query = query.eq("conversation_id", conversationId);
        } else {
          query = query.eq("child_id", targetChildId);
        }

        if (isChild) {
          // Child: mark parent and family member messages as read
          query = query.in("sender_type", ["parent", "family_member"]);
        } else if (isFamilyMember && familyMemberId) {
          // Family member: mark child messages as read (only their own conversation)
          query = query.eq("sender_type", "child");
        } else {
          // Parent: mark child messages as read
          query = query.eq("sender_type", "child");
        }

        const { data: unreadMessages, error: fetchError } = await query;

        if (fetchError) {
          safeLog.error(
            "❌ [CHAT READ] Error fetching unread messages:",
            sanitizeError(fetchError)
          );
          return;
        }

        if (!unreadMessages || unreadMessages.length === 0) {
          safeLog.log("✅ [CHAT READ] No unread messages found");
          // Clear badge anyway to ensure UI is in sync
          useBadgeStore.getState().clearUnreadForChild(targetChildId);
          return;
        }

        const unreadMessageIds = unreadMessages.map((msg) => msg.id);
        safeLog.log(
          `📖 [CHAT READ] Found ${unreadMessageIds.length} unread messages to mark as read`,
          {
            messageIds: unreadMessageIds.slice(0, 5), // Log first 5 IDs
            totalCount: unreadMessageIds.length,
          }
        );

        // Mark messages as read immediately in database
        const readAt = new Date().toISOString();
        const { error } = await supabase
          .from("messages")
          .update({ read_at: readAt })
          .in("id", unreadMessageIds);

        if (error) {
          safeLog.error(
            "❌ [CHAT READ] Error marking messages as read:",
            sanitizeError(error)
          );
          return;
        }

        safeLog.log(
          `✅ [CHAT READ] Successfully marked ${unreadMessageIds.length} messages as read`,
          {
            readAt,
          }
        );

        // Update local state to reflect read status immediately
        setMessages((prev) =>
          prev.map((msg) =>
            unreadMessageIds.includes(msg.id)
              ? { ...msg, read_at: readAt }
              : msg
          )
        );

        // IMMEDIATELY clear badge count optimistically (before realtime events)
        // This ensures instant UI feedback when user navigates away
        useBadgeStore.getState().clearUnreadForChild(targetChildId);
        safeLog.log(
          `✅ [CHAT READ] Badge cleared immediately for child ${targetChildId}`
        );

        // Note: Realtime subscription (useBadgeRealtime) will also handle decrements
        // This ensures all devices receive the update and badge counts stay in sync
        // The immediate clear above provides instant feedback, realtime syncs across devices
      } catch (error) {
        safeLog.error(
          "❌ [CHAT READ] Error in markMessagesAsRead:",
          sanitizeError(error)
        );
      }
    };

    // Mark messages as read immediately when chat page loads
    markMessagesAsRead();
  }, [
    childData,
    childId,
    isChild,
    conversationId,
    familyMemberId,
    isFamilyMember,
  ]); // Run when childData, childId, or isChild changes (page loads)

  // Cleanup: Ensure badge is cleared when navigating away from chat
  useEffect(() => {
    return () => {
      // This cleanup runs when component unmounts (user navigates away)
      const childSession = localStorage.getItem("childSession");
      const isChild = !!childSession;
      const targetChildId = isChild ? childData?.id || null : childId;

      if (targetChildId) {
        safeLog.log("🧹 [CHAT CLEANUP] Clearing badge on chat exit", {
          targetChildId,
        });
        // Force clear badge on exit to ensure UI reflects cleared state
        useBadgeStore.getState().clearUnreadForChild(targetChildId);
      }
    };
  }, [childData, childId]);

  // Fallback polling for messages (in case realtime fails)
  useEffect(() => {
    if (!childData && !childId) return;

    const targetChildId = isChild ? childData?.id : childId;
    if (!targetChildId) return;
    const currentConvId = conversationId;

    // Poll every 15 seconds as fallback if realtime isn't working (more frequent than global since user is actively viewing chat)
    const pollInterval = setInterval(async () => {
      try {
        // RLS policies handle isolation at the database level
        // No client-side filtering needed
        let query = supabase
          .from("messages")
          .select("*")
          .order("created_at", { ascending: true });

        // Use conversation_id if available, otherwise fall back to child_id
        if (currentConvId) {
          query = query.eq("conversation_id", currentConvId);
        } else {
          query = query.eq("child_id", targetChildId);
        }

        const { data, error } = (await query) as {
          data: Message[] | null;
          error: { message: string } | null;
        };

        if (!error && data) {
          setMessages((current) => {
            // Only update if we have new messages (check by comparing IDs)
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
    }, 15000); // Poll every 15 seconds (fallback for realtime)

    return () => clearInterval(pollInterval);
  }, [
    childData,
    childId,
    isChild,
    isFamilyMember,
    familyMemberId,
    conversationId,
  ]);

  const fetchChildData = async (id: string) => {
    // Fetch from children table (child_profiles types aren't generated yet)
    const { data } = await supabase
      .from("children")
      .select("id, name, avatar_color")
      .eq("id", id)
      .single();
    if (data) {
      setChildData({
        id: data.id,
        name: data.name,
        avatar_color: data.avatar_color || "#3B82F6",
      });
    }
  };

  const fetchMessages = async (
    id: string,
    currentFamilyMemberId?: string,
    convId?: string | null
  ) => {
    // STRICT: Always require conversation_id - no fallback to child_id
    if (!convId) {
      // For children, don't show error immediately - conversation might be created on first message
      // For adults, show error since they should have a conversation
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

    // Build query and execute with type assertion to avoid deep type instantiation
    // @ts-expect-error - Supabase type instantiation is excessively deep, using type assertion
    const queryResult = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
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
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    // For children, we need childData; for adults, we need childId
    if (!newMessage.trim()) return;
    if (currentSenderType === "child" && !childData) return;
    if (currentSenderType !== "child" && !childId) return;

    setLoading(true);
    try {
      const targetChildId =
        currentSenderType === "child" ? childData!.id : childId!;

      // Get sender_id - for parents, must be auth.uid()
      let senderId: string | undefined;
      let authUid: string | undefined;
      let currentConversationId = conversationId;

      if (currentSenderType === "child") {
        senderId = childData.id;
        authUid = undefined; // Children are anonymous

        // CRITICAL: Children must ALWAYS use the conversation ID from the URL parameter
        // This is set when they click "Message" on a specific person's card in the parents list
        // The URL parameter is the source of truth - it represents the conversation they selected
        const urlParams = new URLSearchParams(window.location.search);
        const conversationIdParam = urlParams.get("conversation");

        // The conversation ID MUST come from the URL parameter (set by clicking "Message" button)
        // This ensures messages go to the correct conversation (parent vs family member)
        if (!conversationIdParam) {
          // Fallback to localStorage (also set when clicking "Message" button)
          const storedConversationId = localStorage.getItem(
            "selectedConversationId"
          );
          if (storedConversationId) {
            currentConversationId = storedConversationId;
            setConversationId(storedConversationId);
          } else {
            throw new Error(
              "No conversation selected. Please go back to Family & Parents and click 'Message' on the person you want to chat with."
            );
          }
        } else {
          // Use the conversation ID from URL - this is the one from the "Message" button click
          currentConversationId = conversationIdParam;
          setConversationId(conversationIdParam);
        }

        // Final validation - ensure we have a conversation ID
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
        authUid = user.id; // For parents, sender_id must equal auth.uid()

        // Ensure we have a conversation_id - get or create if needed
        // IMPORTANT: For family members, always get/create their own conversation
        // to ensure we don't accidentally use the parent's conversation from URL params
        if (targetChildId) {
          // Resolve profile IDs
          const childProfileId = await getChildProfileId(targetChildId);
          const userType = isFamilyMember ? "family_member" : "parent";

          // Get family_id
          let familyId: string;
          if (isFamilyMember && familyMemberId) {
            const { data: fm } = await supabase
              .from("family_members")
              .select("parent_id")
              .eq("id", familyMemberId)
              .single();
            familyId = fm?.parent_id || user.id;
          } else {
            familyId = user.id; // For parents, family_id is their own ID
          }

          const adultProfileId = await getCurrentAdultProfileId(
            user.id,
            familyId,
            userType
          );

          if (!childProfileId || !adultProfileId) {
            throw new Error("Could not resolve profile IDs");
          }

          // CRITICAL: Always get/create the conversation for the current adult
          // This ensures each adult (parent vs family member) has their own separate conversation
          // Don't reuse existing conversationId as it might belong to a different adult
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

      // Validate all required fields
      if (!senderId) {
        throw new Error("Missing sender_id");
      }
      if (!targetChildId) {
        throw new Error("Missing child_id");
      }

      // Build payload matching RLS requirements
      // Use conversation_id if available, otherwise fall back to child_id (backward compatibility)
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
        content: newMessage.trim(),
      };

      // Add conversation_id - REQUIRED for all messages
      if (!currentConversationId) {
        throw new Error(
          "Conversation ID is required. Please select a conversation."
        );
      }
      payload.conversation_id = currentConversationId;

      // Set sender_id and family_member_id based on user type
      if (currentSenderType === "family_member" && familyMemberId) {
        // For family members, both sender_id and family_member_id should be set
        // sender_id is required by the database schema
        payload.sender_id = familyMemberId;
        payload.family_member_id = familyMemberId;
      } else if (currentSenderType === "child") {
        // For children, sender_id = child_id, family_member_id should be null
        payload.sender_id = senderId;
        payload.family_member_id = null;
      } else {
        // For parents, sender_id = auth.uid(), family_member_id should be null
        payload.sender_id = senderId;
        payload.family_member_id = null;
      }

      // Validate payload matches RLS policy requirements
      if (currentSenderType === "child") {
        // RLS policy requires: sender_type = 'child' AND sender_id = child_id
        if (payload.sender_type !== "child") {
          throw new Error("Invalid sender_type for child message");
        }
        if (payload.sender_id !== payload.child_id) {
          throw new Error(
            `RLS policy violation: sender_id (${payload.sender_id}) must equal child_id (${payload.child_id})`
          );
        }
      } else if (currentSenderType === "family_member") {
        // RLS policy requires: sender_type = 'family_member' AND family_member_id = auth.uid()
        if (payload.sender_type !== "family_member") {
          throw new Error("Invalid sender_type for family member message");
        }
        if (payload.family_member_id !== authUid) {
          throw new Error(
            `RLS policy violation: family_member_id (${payload.family_member_id}) must equal auth.uid() (${authUid})`
          );
        }
      } else if (currentSenderType === "parent") {
        // RLS policy requires: sender_type = 'parent' AND sender_id = auth.uid()
        if (payload.sender_type !== "parent") {
          throw new Error("Invalid sender_type for parent message");
        }
        if (payload.family_member_id !== null) {
          throw new Error("Parent messages must have family_member_id = null");
        }
      }

      // DEBUG: Log payload to console (sanitized)
      // SECURITY: Never log message content - only metadata
      safeLog.log("📤 [MESSAGE INSERT] Payload:", {
        child_id: payload.child_id,
        conversation_id: payload.conversation_id,
        sender_id: payload.sender_id,
        sender_type: payload.sender_type,
        family_member_id: payload.family_member_id,
        content_length: payload.content.length,
        currentSenderType,
        currentSenderId,
        auth_uid: authUid,
        sender_id_matches_auth_uid:
          currentSenderType === "child" ? "N/A (anon)" : senderId === authUid,
        sender_id_equals_child_id:
          currentSenderType === "child"
            ? payload.sender_id === payload.child_id
            : "N/A",
      });

      const { data, error } = await supabase
        .from("messages")
        .insert(payload)
        .select()
        .single();

      if (error) {
        // SECURITY: Sanitize error and payload before logging
        safeLog.error("❌ [MESSAGE INSERT] Error:", {
          message: error.message,
          code: error.code,
          details: error.details
            ? typeof error.details === "string"
              ? error.details
              : sanitizeObject(error.details as Record<string, unknown>)
            : undefined,
          hint: error.hint,
          // Never log full payload - only metadata
          payload_metadata: {
            child_id: payload.child_id,
            sender_id: payload.sender_id,
            sender_type: payload.sender_type,
            content_length: payload.content.length,
            sender_id_equals_child_id: isChild
              ? payload.sender_id === payload.child_id
              : "N/A",
          },
        });

        // Provide user-friendly error message for RLS violations
        if (
          error.code === "42501" ||
          error.message.includes("row-level security")
        ) {
          throw new Error(
            "Unable to send message. Please check database RLS policies are correctly configured."
          );
        }

        throw error;
      }

      safeLog.log("✅ [MESSAGE INSERT] Success", { messageId: data?.id });

      // Optimistic update: Add message to local state immediately
      // This ensures the message appears right away, even if realtime is slow
      // The realtime subscription will handle duplicates (we check for duplicates in the subscription handler)
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

        setMessages((current) => {
          // Check for duplicates (shouldn't happen, but safety check)
          const exists = current.some((m) => m.id === newMessage.id);
          if (exists) {
            safeLog.log(
              "ℹ️ [MESSAGE INSERT] Message already in state (realtime beat us), skipping optimistic update"
            );
            return current;
          }
          safeLog.log(
            "✅ [MESSAGE INSERT] Adding message to local state (optimistic update)"
          );
          return [...current, newMessage];
        });
      }

      setNewMessage("");
    } catch (error: unknown) {
      // SECURITY: Sanitize error before logging
      safeLog.error("❌ [MESSAGE INSERT] Exception:", sanitizeError(error));
      toast({
        title: "Error sending message",
        description:
          error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const goBack = () => {
    if (isChild) {
      navigate("/child/dashboard");
    } else if (isFamilyMember) {
      navigate("/family-member/dashboard");
    } else {
      navigate("/parent/children");
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative">
      <div className="bg-chat-accent p-4 flex items-center gap-4 fixed top-0 left-0 right-0 z-10">
        <Button
          onClick={goBack}
          variant="ghost"
          size="sm"
          className="text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          {isChild
            ? parentData && (
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-primary">
                  {parentData.name[0].toUpperCase()}
                </div>
              )
            : childData && (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: childData.avatar_color }}
                >
                  {childData.name[0]}
                </div>
              )}
          <h1 className="text-xl font-bold text-white">
            {isChild ? parentName : childData?.name}
          </h1>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ paddingTop: "80px", paddingBottom: "100px" }}
      >
        {messages.map((message) => {
          // Determine if this message is from the current user
          // Simple and reliable: check if sender_type and sender_id match current user
          const isMine =
            currentSenderType !== null &&
            currentSenderId !== null &&
            message.sender_type === currentSenderType &&
            message.sender_id === currentSenderId;

          return (
            <div
              key={message.id}
              className={`flex w-full mb-2 ${
                isMine ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`px-3 py-2 rounded-2xl max-w-[80%] text-sm shadow-sm ${
                  isMine
                    ? "bg-chat-accent text-chat-accent-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}
              >
                <div className="flex items-end gap-1.5">
                  <p className="whitespace-pre-wrap break-words flex-1">
                    {message.content}
                  </p>
                  <span
                    className={`text-[10px] opacity-70 flex-shrink-0 ${
                      isMine ? "text-white/70" : "text-muted-foreground"
                    }`}
                  >
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={sendMessage}
        className="p-4 bg-card border-t fixed bottom-0 left-0 right-0 z-10"
      >
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={loading || !newMessage.trim()}
            className="bg-chat-accent text-chat-accent-foreground hover:bg-chat-accent/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default Chat;

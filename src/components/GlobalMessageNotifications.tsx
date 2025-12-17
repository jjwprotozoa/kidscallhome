// src/components/GlobalMessageNotifications.tsx
// Global message notification handler - shows toast notifications for new messages on any page

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useChildren } from "@/hooks/useChildren";
import { useUserSession } from "@/hooks/useUserSession";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface Message {
  id: string;
  child_id: string;
  sender_id: string;
  sender_type: "parent" | "child";
  content: string;
  created_at: string;
  read_at?: string | null;
}

export const GlobalMessageNotifications = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  // Track the currently active chat childId using a ref that updates immediately
  const activeChatChildIdRef = useRef<string | null>(null);
  // Track realtime subscription status for smart polling
  const [realtimeStatus, setRealtimeStatus] = useState<
    "SUBSCRIBED" | "ERROR" | "TIMED_OUT" | "SUBSCRIBING" | null
  >(null);

  // Use cached hooks instead of direct queries
  const { data: children } = useChildren();
  const { data: session } = useUserSession();

  // Update active chat childId whenever location changes
  useEffect(() => {
    const chatMatch = location.pathname.match(/^\/chat\/(.+)$/);
    activeChatChildIdRef.current = chatMatch ? chatMatch[1] : null;
  }, [location.pathname]);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    let lastCheckedMessageId: string | null = null;

    const setupSubscription = async () => {
      // Check if localStorage is available
      if (typeof window === "undefined" || !window.localStorage) {
        return;
      }

      // Check if user is authenticated (parent) or has child session (child)
      const { getChildSessionLegacy } = await import("@/lib/childSession");
      const childSession = getChildSessionLegacy();

      // Use cached session from React Query hook
      if (!session && !childSession) {
        // No session - don't set up subscriptions
        return;
      }

      const isChild = !session && !!childSession;
      const childId = childSession?.id;
      const userId = session?.user?.id;

      const handleNewMessage = async (message: Message) => {
        // Skip if we already showed this message
        if (message.id === lastMessageIdRef.current) return;

        // IMPORTANT: Don't show notification if user is currently chatting with this child
        // Use ref to get the current active chat (updates immediately when location changes)
        if (activeChatChildIdRef.current === message.child_id) {
          // User is actively chatting with this child, not showing notification
          return;
        }

        // Don't show notification for messages sent by the current user
        if (isChild && message.sender_type === "child") {
          return; // Child sent this message, don't notify
        }
        if (!isChild && message.sender_type === "parent") {
          return; // Parent sent this message, don't notify
        }

        lastMessageIdRef.current = message.id;

        // Fetch sender name and colors
        let senderName = "Someone";
        let childColor: string | null = null;
        let parentColor: string | null = null;
        try {
          if (message.sender_type === "parent") {
            // Try to fetch from adult_profiles (new schema)
            // sender_id is the user_id (auth.uid())
            const { data: adultProfile } = await supabase
              .from("adult_profiles" as never)
              .select("name, avatar_color")
              .eq("user_id", message.sender_id)
              .maybeSingle();

            if (adultProfile?.name) {
              senderName = adultProfile.name;
            } else {
              // Fallback to old parents table if adult_profiles doesn't have the data
              const { data: parentData } = await supabase
                .from("parents")
                .select("name")
                .eq("id", message.sender_id)
                .maybeSingle();

              if (parentData?.name) {
                senderName = parentData.name;
              } else {
                senderName = "Parent";
              }
            }

            // For child users, use the parent's avatar color if available
            if (isChild) {
              parentColor = adultProfile?.avatar_color || "hsl(213, 94%, 68%)"; // Use avatar color or fallback to primary blue
            }
          } else {
            // Child sender - fetch child name and color
            const { data: childData } = await supabase
              .from("children")
              .select("name, avatar_color")
              .eq("id", message.sender_id)
              .maybeSingle();

            if (childData?.name) {
              senderName = childData.name;
            } else {
              senderName = "Child";
            }

            // For parent users, use the child's avatar color (sender is the child)
            if (!isChild && childData?.avatar_color) {
              childColor = childData.avatar_color;
            }
          }
        } catch (error) {
          console.error("Error fetching sender name:", error);
        }

        // Truncate message content for preview
        const messagePreview =
          message.content.length > 50
            ? `${message.content.substring(0, 50)}...`
            : message.content;

        // Determine toast styling based on user type
        const toastStyle = isChild
          ? parentColor
            ? {
                style: {
                  backgroundColor: parentColor,
                  borderColor: parentColor,
                  color: "#ffffff", // White text for contrast
                } as React.CSSProperties,
                className:
                  "border-2 shadow-lg ring-2 ring-opacity-30 custom-parent-color",
              }
            : undefined // Fallback to default if no color
          : childColor
          ? {
              style: {
                backgroundColor: childColor,
                borderColor: childColor,
                color: "#ffffff", // White text for contrast
              } as React.CSSProperties,
              className:
                "border-2 shadow-lg ring-2 ring-opacity-30 custom-child-color",
            }
          : undefined; // Fallback to default if no color

        // Show toast notification with noticeable styling
        toast({
          title: `New message from ${senderName}`,
          description: messagePreview,
          variant: undefined, // Don't use variant, use custom colors instead
          ...toastStyle,
          action: (
            <Button
              variant={isChild ? "default" : "secondary"}
              size="sm"
              onClick={() => {
                navigate(`/chat/${message.child_id}`);
              }}
              className={
                isChild
                  ? "ml-2 bg-primary hover:bg-primary/90"
                  : "ml-2 bg-white/20 hover:bg-white/30 text-white border-white/30"
              }
              style={
                !isChild && childColor
                  ? { borderColor: "rgba(255,255,255,0.3)" }
                  : undefined
              }
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              Open
            </Button>
          ),
        });
      };

      // Polling fallback function
      const pollForNewMessages = async () => {
        try {
          const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

          if (isChild) {
            const childData = childSession;
            if (!childData?.id) {
              return; // Invalid session
            }
            const { data: newMessages } = await supabase
              .from("messages")
              .select("*")
              .eq("child_id", childData.id)
              .eq("sender_type", "parent")
              .is("read_at", null)
              .gte("created_at", oneMinuteAgo)
              .order("created_at", { ascending: false })
              .limit(5);

            if (newMessages && newMessages.length > 0) {
              // Process messages in reverse order (oldest first) to avoid duplicates
              for (const message of newMessages.reverse()) {
                if (
                  message.id !== lastCheckedMessageId &&
                  message.id !== lastMessageIdRef.current
                ) {
                  await handleNewMessage(message as Message);
                  lastCheckedMessageId = message.id;
                  break; // Only process the oldest new message
                }
              }
            }
          } else {
            // Use cached user ID from React Query hook
            if (!userId) return;

            // Use cached children list from React Query hook
            if (!children || children.length === 0) return;

            const childIds = children.map((c) => c.id);

            // Get all conversation_ids for parent's children
            // Resolve parent's adult_profile_id first
            // @ts-expect-error - adult_profiles table exists but not in types, type instantiation is deep
            const { data: adultProfile } = await supabase
              // @ts-expect-error - adult_profiles table exists but not in types
              .from("adult_profiles")
              .select("id")
              .eq("user_id", userId)
              .eq("role", "parent")
              .limit(1);

            if (
              !adultProfile ||
              (adultProfile as Array<{ id: string }>).length === 0
            )
              return;

            const adultProfileId = (adultProfile as Array<{ id: string }>)[0]
              .id;

            // Get conversations for this adult
            // @ts-expect-error - conversations table exists but not in types, type instantiation is deep
            const { data: conversations } = await supabase
              // @ts-expect-error - conversations table exists but not in types
              .from("conversations")
              .select("id")
              .eq("adult_id", adultProfileId);

            if (!conversations || conversations.length === 0) return;

            const conversationIds = conversations.map((c) => c.id);

            // Fetch messages by conversation_id only (never by child_id alone)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await (supabase as any)
              .from("messages")
              .select("*")
              .in("conversation_id", conversationIds)
              .eq("sender_type", "child")
              .is("read_at", null)
              .gte("created_at", oneMinuteAgo)
              .order("created_at", { ascending: false })
              .limit(5);

            const newMessages = result.data as Message[] | null;

            if (newMessages && newMessages.length > 0) {
              // Process messages in reverse order (oldest first) to avoid duplicates
              for (const message of newMessages.reverse()) {
                if (
                  message.id !== lastCheckedMessageId &&
                  message.id !== lastMessageIdRef.current
                ) {
                  await handleNewMessage(message as Message);
                  lastCheckedMessageId = message.id;
                  break; // Only process the oldest new message
                }
              }
            }
          }
        } catch (error) {
          console.error("❌ [GLOBAL MESSAGE] Polling error:", error);
        }
      };

      // Set up realtime subscription
      if (isChild && childSession) {
        const childData = childSession;

        channelRef.current = supabase
          .channel("global-child-messages")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `child_id=eq.${childData.id}`,
            },
            async (payload) => {
              const message = payload.new as Message;
              // Only notify for messages from parent
              if (message.sender_type === "parent" && !message.read_at) {
                await handleNewMessage(message);
              }
            }
          )
          .subscribe((status, err) => {
            // Update subscription status for smart polling
            if (status === "SUBSCRIBED") {
              setRealtimeStatus("SUBSCRIBED");
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              setRealtimeStatus(status === "TIMED_OUT" ? "TIMED_OUT" : "ERROR");
            }

            if (err) {
              // Check if it's the "mismatch" error - this is often transient and can be ignored
              const errorMessage =
                err instanceof Error ? err.message : String(err);
              if (
                errorMessage.includes(
                  "mismatch between server and client bindings"
                )
              ) {
                // This is a known Supabase Realtime issue - often resolves on retry
                // Silent in production, only warn in dev
              } else {
                console.error(
                  "❌ [GLOBAL MESSAGE] Child subscription error:",
                  err
                );
              }
            } else if (status === "TIMED_OUT") {
              // TIMED_OUT is often transient - don't log as error
            } else if (status === "CHANNEL_ERROR") {
              // CHANNEL_ERROR is often transient - check if it's a binding mismatch
              const errorMessage =
                err instanceof Error ? err.message : String(err || "");
              if (
                !errorMessage.includes(
                  "mismatch between server and client bindings"
                )
              ) {
                // CHANNEL_ERROR often happens when connection closes - Supabase will auto-retry
                // Only log in dev mode for debugging
                if (import.meta.env.DEV) {
                  console.debug(
                    "⚠️ [GLOBAL MESSAGE] Child subscription channel error (will auto-retry):",
                    status
                  );
                }
              }
            } else if (status === "SUBSCRIBED") {
              // Successfully subscribed
              if (import.meta.env.DEV) {
                console.debug("✅ [GLOBAL MESSAGE] Child subscription active");
              }
            }
            // CLOSED is normal cleanup, don't log as error
          });
      } else {
        // Use cached user ID from React Query hook
        if (!userId) {
          return; // No user ID, can't subscribe
        }

        // Parent: Use cached children list from React Query hook
        if (!children || children.length === 0) {
          return; // No children, no need to subscribe
        }

        const childIds = children.map((c) => c.id);

        // Parent: listen for messages from all their children
        // We can't filter by multiple child_ids in one subscription, so we'll check in the handler
        channelRef.current = supabase
          .channel("global-parent-messages")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
            },
            async (payload) => {
              const message = payload.new as Message;
              // Only notify for messages from children that belong to this parent
              if (
                message.sender_type === "child" &&
                !message.read_at &&
                childIds.includes(message.child_id)
              ) {
                await handleNewMessage(message);
              }
            }
          )
          .subscribe((status, err) => {
            // Update subscription status for smart polling
            if (status === "SUBSCRIBED") {
              setRealtimeStatus("SUBSCRIBED");
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              setRealtimeStatus(status === "TIMED_OUT" ? "TIMED_OUT" : "ERROR");
            }

            if (err) {
              // Check if it's the "mismatch" error - this is often transient and can be ignored
              const errorMessage =
                err instanceof Error ? err.message : String(err);
              if (
                errorMessage.includes(
                  "mismatch between server and client bindings"
                )
              ) {
                // This is a known Supabase Realtime issue - often resolves on retry
                // Silent in production, only warn in dev
              } else {
                console.error(
                  "❌ [GLOBAL MESSAGE] Parent subscription error:",
                  err
                );
              }
            } else if (status === "TIMED_OUT") {
              // TIMED_OUT is often transient - don't log as error
            } else if (status === "CHANNEL_ERROR") {
              // CHANNEL_ERROR is often transient - check if it's a binding mismatch
              const errorMessage =
                err instanceof Error ? err.message : String(err || "");
              if (
                !errorMessage.includes(
                  "mismatch between server and client bindings"
                )
              ) {
                // Only log non-binding-mismatch CHANNEL_ERRORs
                console.error(
                  "❌ [GLOBAL MESSAGE] Parent subscription failed:",
                  status
                );
              }
            }
            // CLOSED is normal cleanup, don't log as error
          });
      }

      // Start polling as fallback - ONLY when realtime subscription is not working
      // If realtime is SUBSCRIBED, skip polling entirely to reduce database calls
      // Use longer interval (120s) when polling is needed as fallback
      const startPollingIfNeeded = () => {
        // Don't poll if realtime is successfully subscribed
        if (realtimeStatus === "SUBSCRIBED") {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          return;
        }

        // Only poll when realtime is not working (ERROR, TIMED_OUT, or null/SUBSCRIBING)
        if (!pollInterval) {
          pollInterval = setInterval(pollForNewMessages, 120000); // 120 seconds
          // Initial poll to catch any missed messages (after a short delay)
          setTimeout(pollForNewMessages, 2000);
        }
      };

      // Start polling check
      startPollingIfNeeded();

      // Re-check polling when realtime status changes (only needed if realtime reconnects)
      // Using longer interval since realtime status changes trigger immediate re-evaluation
      const statusCheckInterval = setInterval(() => {
        startPollingIfNeeded();
      }, 120000); // Check every 2 minutes (reduced overhead)

      return () => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
        }
        if (pollInterval) {
          clearInterval(pollInterval);
        }
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
        }
        setRealtimeStatus(null);
      };
    };

    setupSubscription();
  }, [navigate, toast, session, children, realtimeStatus]); // Include session, children, and realtimeStatus in dependencies

  return null; // This component doesn't render anything
};

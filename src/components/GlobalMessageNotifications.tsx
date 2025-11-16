// src/components/GlobalMessageNotifications.tsx
// Global message notification handler - shows toast notifications for new messages on any page

import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";

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

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    let lastCheckedMessageId: string | null = null;

    const setupSubscription = async () => {
      // Check if user is authenticated (parent) or has child session (child)
      const { data: { session } } = await supabase.auth.getSession();
      const childSession = localStorage.getItem("childSession");
      
      if (!session && !childSession) {
        // No session - don't set up subscriptions
        return;
      }

      const isChild = !session && !!childSession;

      const handleNewMessage = async (message: Message) => {
        // Skip if we already showed this message
        if (message.id === lastMessageIdRef.current) return;

        // IMPORTANT: Don't show notification if user is currently on the chat page for this child
        if (location.pathname === `/chat/${message.child_id}`) {
          console.log(
            "📨 [GLOBAL MESSAGE] User is on chat page, not showing notification"
          );
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
            
            // For child users, use primary blue color for parent messages
            // Parents don't have individual avatar colors, so we use a consistent color
            if (isChild) {
              parentColor = "hsl(213, 94%, 68%)"; // Primary blue color
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
        const messagePreview = message.content.length > 50
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
                className: "border-2 shadow-lg ring-2 ring-opacity-30 custom-parent-color",
              }
            : undefined // Fallback to default if no color
          : childColor
          ? {
              style: {
                backgroundColor: childColor,
                borderColor: childColor,
                color: "#ffffff", // White text for contrast
              } as React.CSSProperties,
              className: "border-2 shadow-lg ring-2 ring-opacity-30 custom-child-color",
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
              className={isChild ? "ml-2 bg-primary hover:bg-primary/90" : "ml-2 bg-white/20 hover:bg-white/30 text-white border-white/30"}
              style={!isChild && childColor ? { borderColor: "rgba(255,255,255,0.3)" } : undefined}
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
            const childData = JSON.parse(childSession!);
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
                if (message.id !== lastCheckedMessageId && message.id !== lastMessageIdRef.current) {
                  await handleNewMessage(message as Message);
                  lastCheckedMessageId = message.id;
                  break; // Only process the oldest new message
                }
              }
            }
          } else {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: children } = await supabase
              .from("children")
              .select("id")
              .eq("parent_id", user.id);

            if (!children || children.length === 0) return;

            const childIds = children.map((c) => c.id);
            const { data: newMessages } = await supabase
              .from("messages")
              .select("*")
              .in("child_id", childIds)
              .eq("sender_type", "child")
              .is("read_at", null)
              .gte("created_at", oneMinuteAgo)
              .order("created_at", { ascending: false })
              .limit(5);

            if (newMessages && newMessages.length > 0) {
              // Process messages in reverse order (oldest first) to avoid duplicates
              for (const message of newMessages.reverse()) {
                if (message.id !== lastCheckedMessageId && message.id !== lastMessageIdRef.current) {
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
      if (isChild) {
        const childData = JSON.parse(childSession!);
        
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
            if (err) {
              console.error("❌ [GLOBAL MESSAGE] Child subscription error:", err);
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              console.error("❌ [GLOBAL MESSAGE] Child subscription failed:", status);
            }
            // CLOSED is normal cleanup, don't log as error
          });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Parent: First get all their children, then listen for messages from those children
        const { data: children } = await supabase
          .from("children")
          .select("id")
          .eq("parent_id", user.id);

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
            if (err) {
              console.error("❌ [GLOBAL MESSAGE] Parent subscription error:", err);
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              console.error("❌ [GLOBAL MESSAGE] Parent subscription failed:", status);
            }
            // CLOSED is normal cleanup, don't log as error
          });
      }

      // Start polling as fallback (every 3 seconds)
      pollInterval = setInterval(pollForNewMessages, 3000);
      
      // Initial poll to catch any missed messages
      setTimeout(pollForNewMessages, 1000);

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
  }, [location.pathname, navigate, toast]);

  return null; // This component doesn't render anything
};


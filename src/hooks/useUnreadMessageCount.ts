// src/hooks/useUnreadMessageCount.ts
// Hook to fetch and track unread message counts for parent/child users

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseUnreadMessageCountOptions {
  childId?: string | null; // For parent: which child's messages to count. For child: their own ID
  enabled?: boolean;
}

export const useUnreadMessageCount = (options: UseUnreadMessageCountOptions = {}) => {
  const { childId, enabled = true } = options;
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !childId) {
      setCount(0);
      setLoading(false);
      return;
    }

    let mounted = true;
    const channelRef = { current: null as ReturnType<typeof supabase.channel> | null };

    const fetchUnreadCount = async () => {
      try {
        // Check if user is parent or child
        const childSession = localStorage.getItem("childSession");
        const isChild = !!childSession;

        let query = supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("child_id", childId)
          .is("read_at", null);

        if (isChild) {
          // Child: count messages where sender_type = 'parent' (messages from parent to child)
          query = query.eq("sender_type", "parent");
        } else {
          // Parent: count messages where sender_type = 'child' (messages from child to parent)
          query = query.eq("sender_type", "child");
        }

        const { count: unreadCount, error } = await query;

        if (error) throw error;

        if (mounted) {
          setCount(unreadCount || 0);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching unread message count:", error);
        if (mounted) {
          setCount(0);
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchUnreadCount();

    // Subscribe to message changes for real-time updates
    channelRef.current = supabase
      .channel(`unread-messages-${childId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `child_id=eq.${childId}`,
        },
        (payload) => {
          // Update local count when new unread message is added (no DB query)
          const newMessage = payload.new as { sender_type: string; read_at: string | null };
          const childSession = localStorage.getItem("childSession");
          const isChild = !!childSession;
          
          // Check if this message should be counted
          let shouldCount = false;
          if (isChild) {
            // Child: count messages from parent
            shouldCount = newMessage.sender_type === "parent" && !newMessage.read_at;
          } else {
            // Parent: count messages from child
            shouldCount = newMessage.sender_type === "child" && !newMessage.read_at;
          }
          
          if (shouldCount) {
            console.log("📨 [UNREAD COUNT] INSERT event - incrementing count");
            setCount((prev) => Math.max(0, prev + 1));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `child_id=eq.${childId}`,
        },
        (payload) => {
          // Update local count when message is marked as read (no DB query)
          const oldMessage = payload.old as { sender_type: string; read_at: string | null };
          const newMessage = payload.new as { sender_type: string; read_at: string | null };
          const childSession = localStorage.getItem("childSession");
          const isChild = !!childSession;
          
          // Check if read_at changed from null to a value (message was marked as read)
          const wasUnread = !oldMessage.read_at;
          const isNowRead = !!newMessage.read_at;
          
          if (wasUnread && isNowRead) {
            // Check if this message should be counted
            let shouldCount = false;
            if (isChild) {
              shouldCount = oldMessage.sender_type === "parent";
            } else {
              shouldCount = oldMessage.sender_type === "child";
            }
            
            if (shouldCount) {
              console.log("📨 [UNREAD COUNT] UPDATE event - decrementing count");
              setCount((prev) => Math.max(0, prev - 1));
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 [UNREAD COUNT] Subscription status for child ${childId}:`, status);
      });

    // Listen for custom event when messages are marked as read
    const handleMessagesMarkedRead = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.childId === childId) {
        const { count: markedCount } = customEvent.detail || {};
        console.log(`📢 [UNREAD COUNT] Custom event received for child ${childId}: messages marked as read`, customEvent.detail);
        // Update local count directly (no DB query)
        if (markedCount && markedCount > 0) {
          setCount((prev) => Math.max(0, prev - markedCount));
        }
      }
    };
    window.addEventListener('messages-marked-read', handleMessagesMarkedRead);

    return () => {
      mounted = false;
      window.removeEventListener('messages-marked-read', handleMessagesMarkedRead);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [childId, enabled]);

  return { count, loading };
};


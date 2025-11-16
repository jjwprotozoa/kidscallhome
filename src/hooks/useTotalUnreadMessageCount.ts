// src/hooks/useTotalUnreadMessageCount.ts
// Hook to fetch total unread message count across all children (for parents) or for a single child

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseTotalUnreadMessageCountOptions {
  enabled?: boolean;
}

export const useTotalUnreadMessageCount = (options: UseTotalUnreadMessageCountOptions = {}) => {
  const { enabled = true } = options;
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      setLoading(false);
      return;
    }

    let mounted = true;
    const channelRef = { current: null as ReturnType<typeof supabase.channel> | null };
    const childIdsRef: { current: string[] | null } = { current: null }; // Store child IDs for parents
    const currentChildIdRef: { current: string | null } = { current: null }; // Store current child ID for children

    const fetchTotalUnreadCount = async () => {
      try {
        // Check if user is parent or child
        const childSession = localStorage.getItem("childSession");
        const isChild = !!childSession;

        if (isChild) {
          // Child: count unread messages from parent
          const childData = JSON.parse(childSession);
          currentChildIdRef.current = childData.id; // Store for event handlers
          const { count: unreadCount, error } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("child_id", childData.id)
            .eq("sender_type", "parent")
            .is("read_at", null);

          if (error) throw error;

          if (mounted) {
            setCount(unreadCount || 0);
            setLoading(false);
          }
        } else {
          // Parent: count unread messages from all children
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            if (mounted) {
              setCount(0);
              setLoading(false);
            }
            return;
          }

          // Get all children for this parent
          const { data: children, error: childrenError } = await supabase
            .from("children")
            .select("id")
            .eq("parent_id", user.id);

          if (childrenError) throw childrenError;

          if (!children || children.length === 0) {
            if (mounted) {
              setCount(0);
              setLoading(false);
            }
            return;
          }

          const childIds = children.map((c) => c.id);
          childIdsRef.current = childIds; // Store for event handlers

          // Count unread messages from children
          const { count: unreadCount, error } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .in("child_id", childIds)
            .eq("sender_type", "child")
            .is("read_at", null);

          if (error) throw error;

          if (mounted) {
            setCount(unreadCount || 0);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("Error fetching total unread message count:", error);
        if (mounted) {
          setCount(0);
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchTotalUnreadCount();

    // Subscribe to message changes for real-time updates
    channelRef.current = supabase
      .channel("total-unread-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          // Update local count when new unread message is added (no DB query)
          const newMessage = payload.new as { child_id: string; sender_type: string; read_at: string | null };
          const childSession = localStorage.getItem("childSession");
          const isChild = !!childSession;
          
          // Check if this message should be counted
          let shouldCount = false;
          if (isChild) {
            // Child: count messages from parent
            shouldCount = newMessage.child_id === currentChildIdRef.current && 
                         newMessage.sender_type === "parent" && 
                         !newMessage.read_at;
          } else {
            // Parent: count messages from children (check if child_id belongs to parent's children)
            shouldCount = childIdsRef.current?.includes(newMessage.child_id) && 
                         newMessage.sender_type === "child" && 
                         !newMessage.read_at;
          }
          
          if (shouldCount) {
            console.log("📨 [TOTAL UNREAD] INSERT event - incrementing count");
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
        },
        (payload) => {
          // Update local count when message is marked as read (no DB query)
          const oldMessage = payload.old as { child_id: string; sender_type: string; read_at: string | null };
          const newMessage = payload.new as { child_id: string; sender_type: string; read_at: string | null };
          const childSession = localStorage.getItem("childSession");
          const isChild = !!childSession;
          
          // Check if read_at changed from null to a value (message was marked as read)
          const wasUnread = !oldMessage.read_at;
          const isNowRead = !!newMessage.read_at;
          
          if (wasUnread && isNowRead) {
            // Check if this message should be counted
            let shouldCount = false;
            if (isChild) {
              shouldCount = oldMessage.child_id === currentChildIdRef.current && oldMessage.sender_type === "parent";
            } else {
              // Parent: check if child_id belongs to parent's children
              shouldCount = childIdsRef.current?.includes(oldMessage.child_id) && oldMessage.sender_type === "child";
            }
            
            if (shouldCount) {
              console.log("📨 [TOTAL UNREAD] UPDATE event - decrementing count");
              setCount((prev) => Math.max(0, prev - 1));
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("📡 [TOTAL UNREAD] Subscription status:", status);
      });

    // Listen for custom event when messages are marked as read
    const handleMessagesMarkedRead = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { count: markedCount } = customEvent.detail || {};
      console.log("📢 [TOTAL UNREAD] Custom event received: messages marked as read", customEvent.detail);
      // Update local count directly (no DB query)
      if (markedCount && markedCount > 0) {
        setCount((prev) => Math.max(0, prev - markedCount));
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
  }, [enabled]);

  return { count, loading };
};


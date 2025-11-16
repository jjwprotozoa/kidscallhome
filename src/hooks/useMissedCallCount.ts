// src/hooks/useMissedCallCount.ts
// Hook to fetch and track missed call counts for parent/child users

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseMissedCallCountOptions {
  childId?: string | null; // For parent: which child's missed calls to count. For child: their own ID
  enabled?: boolean;
}

export const useMissedCallCount = (options: UseMissedCallCountOptions = {}) => {
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

    const fetchMissedCallCount = async () => {
      try {
        // Check if user is parent or child
        const childSession = localStorage.getItem("childSession");
        const isChild = !!childSession;

        let query = supabase
          .from("calls")
          .select("id", { count: "exact", head: true })
          .eq("child_id", childId)
          .eq("missed_call", true)
          .is("missed_call_read_at", null);

        if (isChild) {
          // Child: count missed calls where caller_type = 'parent' (missed calls from parent)
          query = query.eq("caller_type", "parent");
        } else {
          // Parent: count missed calls where caller_type = 'child' (missed calls from child)
          query = query.eq("caller_type", "child");
        }

        const { count: missedCount, error } = await query;

        if (error) throw error;

        if (mounted) {
          setCount(missedCount || 0);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching missed call count:", error);
        if (mounted) {
          setCount(0);
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchMissedCallCount();

    // Subscribe to call updates for real-time updates
    channelRef.current = supabase
      .channel(`missed-calls-${childId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `child_id=eq.${childId}`,
        },
        () => {
          // Refetch count when call status changes (might become missed or be marked as read)
          fetchMissedCallCount();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [childId, enabled]);

  return { count, loading };
};


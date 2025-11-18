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
        // Note: missed_call fields don't exist in schema yet
        // Return 0 until schema is updated
        if (mounted) {
          setCount(0);
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


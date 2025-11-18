// src/hooks/useTotalMissedCallCount.ts
// Hook to fetch total missed call count across all children (for parents) or for a single child

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseTotalMissedCallCountOptions {
  enabled?: boolean;
}

export const useTotalMissedCallCount = (options: UseTotalMissedCallCountOptions = {}) => {
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

    const fetchTotalMissedCallCount = async () => {
      try {
        // Note: missed_call fields don't exist in schema yet
        // Return 0 until schema is updated
        if (mounted) {
          setCount(0);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching total missed call count:", error);
        if (mounted) {
          setCount(0);
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchTotalMissedCallCount();

    // Subscribe to call changes for real-time updates
    channelRef.current = supabase
      .channel("total-missed-calls")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calls",
        },
        () => {
          // Refetch count when calls change
          fetchTotalMissedCallCount();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [enabled]);

  return { count, loading };
};


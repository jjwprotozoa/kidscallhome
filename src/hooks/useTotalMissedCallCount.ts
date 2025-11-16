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
        // Check if user is parent or child
        const childSession = localStorage.getItem("childSession");
        const isChild = !!childSession;

        if (isChild) {
          // Child: count missed calls from parent
          const childData = JSON.parse(childSession);
          const { count: missedCount, error } = await supabase
            .from("calls")
            .select("id", { count: "exact", head: true })
            .eq("child_id", childData.id)
            .eq("caller_type", "parent")
            .eq("missed_call", true)
            .is("missed_call_read_at", null);

          if (error) throw error;

          if (mounted) {
            setCount(missedCount || 0);
            setLoading(false);
          }
        } else {
          // Parent: count missed calls from all children
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

          // Count missed calls from children
          const { count: missedCount, error } = await supabase
            .from("calls")
            .select("id", { count: "exact", head: true })
            .in("child_id", childIds)
            .eq("caller_type", "child")
            .eq("missed_call", true)
            .is("missed_call_read_at", null);

          if (error) throw error;

          if (mounted) {
            setCount(missedCount || 0);
            setLoading(false);
          }
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


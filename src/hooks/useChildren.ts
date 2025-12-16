// src/hooks/useChildren.ts
// Purpose: Cached query hook for fetching children list (shared across all components)

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Child {
  id: string;
  name: string;
  parent_id: string;
  login_code: string;
  avatar_color: string;
  created_at: string;
}

/**
 * Cached hook for fetching children list
 * - Shared cache across all components
 * - 5 minute stale time (refetch after 5 min)
 * - 10 minute garbage collection time
 * - Automatically deduplicates requests
 */
export const useChildren = () => {
  return useQuery({
    queryKey: ["children"],
    queryFn: async (): Promise<Child[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase
        .from("children")
        .select("*")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Child[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for 5 min
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for 10 min
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Refetch when connection restored
  });
};


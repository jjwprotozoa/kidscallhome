// src/hooks/useProfileCache.ts
// Centralized profile caching to reduce database calls
// Uses React Query with long staleTime since profiles rarely change

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AdultProfile {
  id: string;
  user_id: string;
  name: string;
  role: "parent" | "family_member";
  avatar_color?: string;
  relationship_type?: string;
}

interface ChildProfile {
  id: string;
  name: string;
  avatar_color?: string;
  parent_id: string;
}

// Cache configuration - profiles rarely change, so use long staleTime
const PROFILE_CACHE_CONFIG = {
  staleTime: 30 * 60 * 1000, // 30 minutes - profiles rarely change
  gcTime: 60 * 60 * 1000, // 1 hour - keep in memory
  refetchOnWindowFocus: false, // Don't refetch on tab focus
  refetchOnReconnect: false, // Don't refetch on reconnect
};

/**
 * Fetch adult profile by user_id with caching
 * Use this instead of direct Supabase queries for adult profiles
 */
export function useAdultProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["adult-profile", userId],
    queryFn: async (): Promise<AdultProfile | null> => {
      if (!userId) return null;

      const { data, error } = (await supabase
        .from("adult_profiles" as never)
        .select("id, user_id, name, role, avatar_color, relationship_type")
        .eq("user_id", userId)
        .maybeSingle()) as { data: AdultProfile | null; error: unknown };

      if (error) {
        console.warn("[PROFILE CACHE] Error fetching adult profile:", error);
        return null;
      }

      return data;
    },
    enabled: !!userId,
    ...PROFILE_CACHE_CONFIG,
  });
}

/**
 * Fetch adult profile by adult_profiles.id (not user_id) with caching
 */
export function useAdultProfileById(profileId: string | null | undefined) {
  return useQuery({
    queryKey: ["adult-profile-by-id", profileId],
    queryFn: async (): Promise<AdultProfile | null> => {
      if (!profileId) return null;

      const { data, error } = (await supabase
        .from("adult_profiles" as never)
        .select("id, user_id, name, role, avatar_color, relationship_type")
        .eq("id", profileId)
        .maybeSingle()) as { data: AdultProfile | null; error: unknown };

      if (error) {
        console.warn("[PROFILE CACHE] Error fetching adult profile by id:", error);
        return null;
      }

      return data;
    },
    enabled: !!profileId,
    ...PROFILE_CACHE_CONFIG,
  });
}

/**
 * Fetch child profile by id with caching
 */
export function useChildProfile(childId: string | null | undefined) {
  return useQuery({
    queryKey: ["child-profile", childId],
    queryFn: async (): Promise<ChildProfile | null> => {
      if (!childId) return null;

      const { data, error } = (await supabase
        .from("child_profiles" as never)
        .select("id, name, avatar_color, parent_id")
        .eq("id", childId)
        .maybeSingle()) as { data: ChildProfile | null; error: unknown };

      if (error) {
        console.warn("[PROFILE CACHE] Error fetching child profile:", error);
        return null;
      }

      return data;
    },
    enabled: !!childId,
    ...PROFILE_CACHE_CONFIG,
  });
}

/**
 * Prefetch a profile to warm the cache (useful for anticipated lookups)
 */
export function usePrefetchProfile() {
  const queryClient = useQueryClient();

  const prefetchAdultProfile = async (userId: string) => {
    await queryClient.prefetchQuery({
      queryKey: ["adult-profile", userId],
      queryFn: async () => {
        const { data } = (await supabase
          .from("adult_profiles" as never)
          .select("id, user_id, name, role, avatar_color, relationship_type")
          .eq("user_id", userId)
          .maybeSingle()) as { data: AdultProfile | null };
        return data;
      },
      ...PROFILE_CACHE_CONFIG,
    });
  };

  const prefetchChildProfile = async (childId: string) => {
    await queryClient.prefetchQuery({
      queryKey: ["child-profile", childId],
      queryFn: async () => {
        const { data } = (await supabase
          .from("child_profiles" as never)
          .select("id, name, avatar_color, parent_id")
          .eq("id", childId)
          .maybeSingle()) as { data: ChildProfile | null };
        return data;
      },
      ...PROFILE_CACHE_CONFIG,
    });
  };

  return { prefetchAdultProfile, prefetchChildProfile };
}

/**
 * Invalidate profile cache (use after profile updates)
 */
export function useInvalidateProfile() {
  const queryClient = useQueryClient();

  const invalidateAdultProfile = (userId: string) => {
    queryClient.invalidateQueries({ queryKey: ["adult-profile", userId] });
  };

  const invalidateChildProfile = (childId: string) => {
    queryClient.invalidateQueries({ queryKey: ["child-profile", childId] });
  };

  const invalidateAllProfiles = () => {
    queryClient.invalidateQueries({ queryKey: ["adult-profile"] });
    queryClient.invalidateQueries({ queryKey: ["child-profile"] });
  };

  return { invalidateAdultProfile, invalidateChildProfile, invalidateAllProfiles };
}


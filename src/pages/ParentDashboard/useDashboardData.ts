// src/pages/ParentDashboard/useDashboardData.ts
// Purpose: Data fetching hooks for dashboard (children, family members)

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";
import { Child, FamilyMember } from "./types";

export const useDashboardData = (
  refreshCanAddMoreChildren: () => Promise<void>
) => {
  const { toast } = useToast();

  const fetchChildren = useCallback(async (): Promise<Child[]> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase
        .from("children")
        .select("*")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      refreshCanAddMoreChildren().catch((err) => {
        console.warn("Failed to refresh subscription check:", err);
      });

      return data || [];
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Error loading children",
        description: errorMessage,
        variant: "destructive",
      });
      return [];
    }
  }, [toast, refreshCanAddMoreChildren]);

  const fetchFamilyMembers = useCallback(async (): Promise<FamilyMember[]> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      // First check if user is a family member - if so, they shouldn't be using this hook
      const { data: familyMember } = await supabase
        .from("family_members")
        .select("id")
        .eq("id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (familyMember) {
        // User is a family member, not a parent - return empty array
        // Family members should use their own dashboard, not parent dashboard
        console.warn(
          "fetchFamilyMembers called for family member user - this hook is for parents only"
        );
        return [];
      }

      const { data: adultProfile, error: adultProfileError } = await supabase
        .from("adult_profiles" as never)
        .select("family_id")
        .eq("user_id", user.id)
        .eq("role", "parent")
        .maybeSingle();

      if (adultProfileError) {
        console.error("Error fetching adult profile:", adultProfileError);
        // If it's a 406 or RLS error, log it for debugging
        if (
          adultProfileError.code === "PGRST116" ||
          adultProfileError.message?.includes("406")
        ) {
          console.error(
            "RLS policy may be blocking the query. Check adult_profiles policies."
          );
        }
        throw adultProfileError;
      }

      if (!adultProfile) {
        console.warn("No adult profile found for user:", user.id);
        return [];
      }

      const { data: familyMembersData, error } = await supabase
        .from("family_members")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: childMemberships } = await supabase
        .from("child_family_memberships")
        .select("child_profile_id")
        .eq("family_id", adultProfile.family_id);

      if (!childMemberships || childMemberships.length === 0) {
        return (familyMembersData || []).map((fm) => ({
          ...fm,
          blockedByChildren: [],
          reportCount: 0,
        }));
      }

      const childProfileIds = childMemberships.map((cm) => cm.child_profile_id);
      const familyMemberUserIds = (familyMembersData || [])
        .filter((fm) => fm.id)
        .map((fm) => fm.id!);

      const { data: adultProfiles } = await supabase
        .from("adult_profiles")
        .select("id, user_id")
        .in("user_id", familyMemberUserIds);

      const userToAdultProfileMap = new Map(
        adultProfiles?.map((ap) => [ap.user_id, ap.id]) || []
      );
      const adultProfileIds = Array.from(userToAdultProfileMap.values());

      const { data: blockedContacts } = await supabase
        .from("blocked_contacts")
        .select("blocked_adult_profile_id, blocker_child_id")
        .in("blocker_child_id", childProfileIds)
        .in("blocked_adult_profile_id", adultProfileIds)
        .is("unblocked_at", null);

      const blockedChildIds = new Set(
        blockedContacts?.map((bc) => bc.blocker_child_id) || []
      );
      const { data: childProfiles } = await supabase
        .from("child_profiles")
        .select("id, name")
        .in("id", Array.from(blockedChildIds));

      const childNameMap = new Map(
        childProfiles?.map((cp) => [cp.id, cp.name]) || []
      );

      const { data: reports } = await supabase
        .from("reports")
        .select("reported_adult_profile_id, status")
        .in("reporter_child_id", childProfileIds)
        .in("reported_adult_profile_id", adultProfileIds)
        .eq("status", "pending");

      const enrichedFamilyMembers = (familyMembersData || []).map((fm) => {
        const adultProfileId = userToAdultProfileMap.get(fm.id || "");
        if (!adultProfileId) {
          return { ...fm, blockedByChildren: [], reportCount: 0 };
        }

        const blockedForThisMember = (blockedContacts || []).filter(
          (bc) => bc.blocked_adult_profile_id === adultProfileId
        );

        const blockedByChildren = blockedForThisMember
          .map((bc) => childNameMap.get(bc.blocker_child_id))
          .filter(Boolean) as string[];

        const reportCount = (reports || []).filter(
          (r) => r.reported_adult_profile_id === adultProfileId
        ).length;

        return {
          ...fm,
          blockedByChildren,
          reportCount,
        };
      });

      return enrichedFamilyMembers;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Error loading family members",
        description: errorMessage,
        variant: "destructive",
      });
      return [];
    }
  }, [toast]);

  return {
    fetchChildren,
    fetchFamilyMembers,
  };
};

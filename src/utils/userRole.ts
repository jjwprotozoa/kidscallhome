// src/utils/userRole.ts
// Purpose: Utility functions to determine user role from adult_profiles table
// This is the canonical source of truth for user roles (parent vs family_member)

import { supabase } from "@/integrations/supabase/client";
import { safeLog, sanitizeError } from "@/utils/security";

export type UserRole = "parent" | "family_member" | "child" | null;

export interface AdultProfileRole {
  role: "parent" | "family_member";
  relationship_type: string | null;
  family_id: string;
  name: string;
}

/**
 * Get user role from adult_profiles table (canonical source of truth)
 * Checks adult_profiles first, then falls back to legacy tables if needed
 */
export async function getUserRole(userId: string): Promise<UserRole> {
  try {
    // Primary check: adult_profiles table (canonical source)
    const { data: adultProfile, error: adultError } = await supabase
      .from("adult_profiles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (adultProfile) {
      return adultProfile.role as "parent" | "family_member";
    }

    if (adultError) {
      safeLog.warn("Error checking adult_profiles, trying fallback:", sanitizeError(adultError));
    }

    // Fallback: Check legacy family_members table
    const { data: familyMember } = await supabase
      .from("family_members")
      .select("id, status")
      .eq("id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (familyMember) {
      return "family_member";
    }

    // Fallback: Check legacy parents table
    const { data: parent } = await supabase
      .from("parents")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (parent) {
      return "parent";
    }

    return null;
  } catch (error) {
    safeLog.error("Error in getUserRole:", sanitizeError(error));
    return null;
  }
}

/**
 * Get full adult profile with role information
 */
export async function getAdultProfile(
  userId: string,
  familyId?: string
): Promise<AdultProfileRole | null> {
  try {
    let query = supabase
      .from("adult_profiles")
      .select("role, relationship_type, family_id, name")
      .eq("user_id", userId);

    if (familyId) {
      query = query.eq("family_id", familyId);
    }

    const { data: profile, error } = await query.maybeSingle();

    if (error) {
      safeLog.error("Error getting adult profile:", sanitizeError(error));
      return null;
    }

    if (!profile) {
      return null;
    }

    return {
      role: profile.role as "parent" | "family_member",
      relationship_type: profile.relationship_type,
      family_id: profile.family_id,
      name: profile.name,
    };
  } catch (error) {
    safeLog.error("Error in getAdultProfile:", sanitizeError(error));
    return null;
  }
}

/**
 * Check if user is a family member (not a parent)
 */
export async function isFamilyMember(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === "family_member";
}

/**
 * Check if user is a parent
 */
export async function isParent(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === "parent";
}


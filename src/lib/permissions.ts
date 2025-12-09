// src/lib/permissions.ts
// Permission checking utilities for communication features
// Provides simplified interface for checking if users can communicate

import { checkCommunicationPermission, isContactBlocked } from "@/utils/family-communication";
import type { CommunicationPermission } from "@/types/family-communication";

export const ERROR_MESSAGES = {
  BLOCKED: "This contact is blocked",
  ADULT_TO_ADULT: "Adults cannot communicate with other adults in this app",
  CHILD_NEEDS_APPROVAL: "Child-to-child communication requires approval from both parents",
  NOT_APPROVED: "This contact is not approved to communicate with your child",
  PENDING_APPROVAL: "Connection request is pending approval",
  NO_PERMISSION: "You don't have permission to perform this action",
};

/**
 * Check if a user can communicate with another user
 * This is the main permission check function used throughout the app
 */
export const canCommunicate = async (
  userId: string,
  userRole: "parent" | "family_member" | "child",
  targetUserId: string,
  targetUserRole: "parent" | "family_member" | "child",
  userFamilyId?: string,
  targetUserFamilyId?: string
): Promise<{
  allowed: boolean;
  reason?: string;
}> => {
  try {
    // Check communication permission
    const permission = await checkCommunicationPermission(
      userId,
      userRole,
      targetUserId,
      targetUserRole,
      userFamilyId,
      targetUserFamilyId
    );

    if (!permission.can_communicate) {
      return {
        allowed: false,
        reason: permission.reason || ERROR_MESSAGES.NO_PERMISSION,
      };
    }

    // Additional check: if child is checking, verify not blocked
    if (userRole === "child") {
      const blocked = await isContactBlocked(
        userId,
        targetUserRole !== "child" ? targetUserId : undefined,
        targetUserRole === "child" ? targetUserId : undefined
      );

      if (blocked) {
        return {
          allowed: false,
          reason: ERROR_MESSAGES.BLOCKED,
        };
      }
    }

    return {
      allowed: true,
    };
  } catch (error) {
    console.error("Error checking communication permission:", error);
    return {
      allowed: false,
      reason: ERROR_MESSAGES.NO_PERMISSION,
    };
  }
};


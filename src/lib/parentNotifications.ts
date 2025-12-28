// src/lib/parentNotifications.ts
// Utility functions for creating parent notifications

import { supabase } from "@/integrations/supabase/client";

/**
 * Notify parents when a family member sends a message with blocked words
 * @param childProfileId - The child profile ID receiving the message
 * @param familyMemberName - Name of the family member who sent the message
 * @param matchedWords - Array of blocked words/phrases that were detected
 * @param messageContent - The message content (may be filtered)
 */
export async function notifyParentsOfBlockedWords(
  childProfileId: string,
  familyMemberName: string,
  matchedWords: string[],
  messageContent: string
): Promise<void> {
  try {
    // Get all parents for this child's family
    // @ts-expect-error - child_profiles table exists but not in types
    const { data: childProfile } = await supabase
      .from("child_profiles" as never)
      .select("family_id")
      .eq("id", childProfileId)
      .maybeSingle();

    if (!childProfile) {
      console.error("Could not find child profile:", childProfileId);
      return;
    }

    const familyId = (childProfile as { family_id?: string })?.family_id;
    if (!familyId) {
      console.error("Child profile has no family_id:", childProfileId);
      return;
    }

    // Get all parent profiles for this family
    // @ts-expect-error - adult_profiles table exists but not in types
    const { data: parentProfiles } = await supabase
      .from("adult_profiles" as never)
      .select("id")
      .eq("family_id", familyId)
      .eq("role", "parent");

    if (!parentProfiles || parentProfiles.length === 0) {
      console.log("No parents found for family:", familyId);
      return;
    }

    // Create notification message
    const notificationMessage = `${familyMemberName} sent a message to your child containing inappropriate words: ${matchedWords.join(", ")}`;

    // Create notifications for all parents (insert one at a time to handle errors gracefully)
    const parentIds = (parentProfiles as { id: string }[]).map((p) => p.id);
    
    for (const parentId of parentIds) {
      // @ts-expect-error - parent_notifications table exists but not in types
      const { error } = await supabase
        .from("parent_notifications" as never)
        .insert({
          parent_id: parentId,
          child_id: childProfileId,
          notification_type: "report", // Using 'report' type for inappropriate messages
          message: notificationMessage,
        });

      if (error) {
        console.error(`Error creating notification for parent ${parentId}:`, error);
      }
    }

    if (error) {
      console.error("Error creating parent notifications:", error);
    } else {
      console.log(`Created ${notifications.length} notification(s) for parents about blocked words`);
    }
  } catch (error) {
    console.error("Error in notifyParentsOfBlockedWords:", error);
  }
}


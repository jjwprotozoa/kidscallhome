// src/utils/conversations.ts
// Helper functions for managing conversations using profile-based IDs

import { supabase } from "@/integrations/supabase/client";

export interface Conversation {
  id: string;
  adult_id: string; // References adult_profiles.id
  child_id: string; // References child_profiles.id
  adult_role: "parent" | "family_member";
  created_at: string;
  updated_at: string;
}

/**
 * Get current adult's profile ID from auth context
 * Resolves auth.uid() to adult_profiles.id
 */
export async function getCurrentAdultProfileId(
  userId: string,
  familyId: string,
  role: "parent" | "family_member"
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("adult_profiles")
      .select("id")
      .eq("user_id", userId)
      .eq("family_id", familyId)
      .eq("role", role)
      .maybeSingle();

    if (error) {
      console.error("Error getting adult profile ID:", error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error("Error in getCurrentAdultProfileId:", error);
    return null;
  }
}

/**
 * Get child's profile ID
 * child_profiles.id should match the original children.id
 */
export async function getChildProfileId(
  childId: string
): Promise<string | null> {
  try {
    // child_profiles.id should match children.id, so we can use it directly
    // But verify it exists
    const { data, error } = await supabase
      .from("child_profiles")
      .select("id")
      .eq("id", childId)
      .maybeSingle();

    if (error) {
      console.error("Error getting child profile ID:", error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error("Error in getChildProfileId:", error);
    return null;
  }
}

/**
 * Get or create a conversation between an adult and a child
 * This ensures each adult-child pair has exactly one conversation
 * Uses profile IDs (adult_profiles.id and child_profiles.id)
 */
export async function getOrCreateConversation(
  adultProfileId: string, // adult_profiles.id
  adultRole: "parent" | "family_member",
  childProfileId: string // child_profiles.id
): Promise<string | null> {
  try {
    // Call the database function to get or create conversation
    const { data, error } = await supabase.rpc("get_or_create_conversation", {
      p_adult_id: adultProfileId,
      p_adult_role: adultRole,
      p_child_id: childProfileId,
    });

    if (error) {
      console.error("Error getting/creating conversation:", error);
      return null;
    }

    return data as string;
  } catch (error) {
    console.error("Error in getOrCreateConversation:", error);
    return null;
  }
}

/**
 * Get conversation ID for an adult profile and child profile
 * Returns null if conversation doesn't exist
 */
export async function getConversationId(
  adultProfileId: string, // adult_profiles.id
  childProfileId: string // child_profiles.id
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("id")
      .eq("adult_id", adultProfileId)
      .eq("child_id", childProfileId)
      .maybeSingle();

    if (error) {
      console.error("Error getting conversation:", error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error("Error in getConversationId:", error);
    return null;
  }
}

/**
 * Get all conversations for an adult profile
 * Returns conversations where adult_id matches the profile ID
 */
export async function getUserConversations(
  adultProfileId: string // adult_profiles.id
): Promise<Conversation[]> {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("adult_id", adultProfileId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error getting user conversations:", error);
      return [];
    }

    return (data || []) as Conversation[];
  } catch (error) {
    console.error("Error in getUserConversations:", error);
    return [];
  }
}

/**
 * Get conversation with child details for display
 */
export async function getConversationWithChild(
  conversationId: string
): Promise<{
  conversation: Conversation;
  child: { id: string; name: string; avatar_color: string };
} | null> {
  try {
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      console.error("Error getting conversation:", convError);
      return null;
    }

    const { data: child, error: childError } = await supabase
      .from("child_profiles")
      .select("id, name, avatar_color")
      .eq("id", conversation.child_id)
      .single();

    if (childError || !child) {
      console.error("Error getting child:", childError);
      return null;
    }

    return {
      conversation: conversation as Conversation,
      child,
    };
  } catch (error) {
    console.error("Error in getConversationWithChild:", error);
    return null;
  }
}

/**
 * Get all conversations for a child (where child_id matches)
 * Returns conversations with parent and family members
 */
export async function getChildConversations(
  childProfileId: string // child_profiles.id
): Promise<
  Array<{
    conversation: Conversation;
    participant: { id: string; name: string; type: "parent" | "family_member"; avatar_color?: string; relationship_type?: string | null };
  }>
> {
  try {
    const { data: conversations, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("child_id", childProfileId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error getting child conversations:", error);
      return [];
    }

    if (!conversations || conversations.length === 0) {
      return [];
    }

    // Fetch participant details from adult_profiles
    // Note: Children (anonymous auth) can't query adult_profiles directly due to RLS
    // So we'll try to fetch, but if it fails, return conversations without participant details
    const conversationsWithParticipants = await Promise.all(
      conversations.map(async (conv) => {
        try {
          // Use maybeSingle() instead of single() to avoid 406 errors when RLS blocks the query
          // This is expected for anonymous (child) users
          const { data: adultProfile, error: profileError } = await supabase
            .from("adult_profiles")
            .select("id, name, role, user_id, avatar_color, relationship_type")
            .eq("id", conv.adult_id)
            .maybeSingle();

          // Check for RLS/access errors (406, 403, etc.) or missing data
          if (profileError || !adultProfile) {
            // If we can't fetch adult profile (e.g., anonymous user), return conversation with default participant info
            // This is expected behavior for children, so we don't log it as an error
            if (profileError?.code !== "PGRST116") {
              // PGRST116 is "no rows returned" which is expected, only log other errors
              console.warn(
                "Could not fetch adult profile (may be anonymous user):",
                profileError?.message || "No profile found"
              );
            }
            return {
              conversation: conv as Conversation,
              participant: {
                id: conv.adult_id, // Use adult_id as fallback
                name: conv.adult_role === "parent" ? "Parent" : "Family Member",
                type: (conv.adult_role || "parent") as
                  | "parent"
                  | "family_member",
                avatar_color: "#3B82F6", // Default color if we can't fetch profile
              },
            };
          }

          return {
            conversation: conv as Conversation,
            participant: {
              id: adultProfile.user_id, // Return user_id for compatibility
              name:
                adultProfile.name ||
                (adultProfile.role === "parent" ? "Parent" : "Family Member"),
              type: adultProfile.role as "parent" | "family_member",
              avatar_color: adultProfile.avatar_color || "#3B82F6",
              relationship_type: adultProfile.relationship_type || null,
            },
          };
        } catch (error) {
          // If query fails (e.g., RLS policy blocks anonymous users), return conversation with default info
          console.warn("Error fetching adult profile, using fallback:", error);
          return {
            conversation: conv as Conversation,
            participant: {
              id: conv.adult_id, // Use adult_id as fallback
              name: conv.adult_role === "parent" ? "Parent" : "Family Member",
              type: (conv.adult_role || "parent") as "parent" | "family_member",
              avatar_color: "#3B82F6", // Default color if query fails
            },
          };
        }
      })
    );

    return conversationsWithParticipants.filter(
      (item): item is NonNullable<typeof item> => item !== null
    );
  } catch (error) {
    console.error("Error in getChildConversations:", error);
    return [];
  }
}

/**
 * Get conversation ID for a child profile and adult profile
 * Returns null if conversation doesn't exist
 */
export async function getChildConversationId(
  childProfileId: string, // child_profiles.id
  adultProfileId: string // adult_profiles.id
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("id")
      .eq("adult_id", adultProfileId)
      .eq("child_id", childProfileId)
      .maybeSingle();

    if (error) {
      console.error("Error getting child conversation:", error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error("Error in getChildConversationId:", error);
    return null;
  }
}

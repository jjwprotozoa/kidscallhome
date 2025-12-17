// src/pages/ChildParentsList.tsx
// Child: Conversations List (Parents & Family Members)
// Shows all conversations the child has with parents and family members

import Navigation from "@/components/Navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { StatusIndicator } from "@/features/presence/StatusIndicator";
import { useParentPresence } from "@/features/presence/useParentPresence";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getChildSessionLegacy } from "@/lib/childSession";
import { getChildConversations } from "@/utils/conversations";
import { MessageSquare, Phone } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BlockAndReportButton } from "@/features/safety/components/BlockAndReportButton";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface ChildSession {
  id: string;
  name: string;
  avatar_color: string;
  parent_id: string;
}

interface ConversationParticipant {
  conversation: {
    id: string;
    adult_id: string; // References adult_profiles.id
    child_id: string; // References child_profiles.id
    adult_role: "parent" | "family_member";
    created_at: string;
    updated_at: string;
  };
  participant: {
    id: string;
    name: string;
    type: "parent" | "family_member";
    avatar_color?: string;
    relationship_type?: string | null;
  };
}

// Component for family member card with presence tracking
const FamilyMemberCard = ({
  conv,
  isBlocked,
  child,
  onCall,
  onChat,
  onBlocked,
}: {
  conv: ConversationParticipant;
  isBlocked: boolean;
  child: ChildSession | null;
  onCall: (participantId: string, participantType: "parent" | "family_member") => void;
  onChat: (conversationId: string, participantId: string) => void;
  onBlocked: () => void;
}) => {
  const { isOnline: isFamilyMemberOnline } = useParentPresence({
    parentId: conv.participant.id,
    enabled: !!conv.participant.id,
  });

  return (
    <Card
      key={conv.conversation.id}
      className={`p-4 sm:p-6 hover:shadow-lg transition-all relative ${isBlocked ? "opacity-50" : ""}`}
    >
      {/* Blocked indicator in top right */}
      {isBlocked && (
        <div className="absolute top-4 right-4 text-2xl">🚫</div>
      )}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
          <div 
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white font-bold text-xl sm:text-2xl flex-shrink-0"
            style={{ backgroundColor: conv.participant.avatar_color || "#8B5CF6" }}
          >
            {conv.participant.name?.charAt(0).toUpperCase() ||
              "F"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl sm:text-2xl font-semibold truncate">
                {conv.participant.name}
              </h3>
              <StatusIndicator
                isOnline={isFamilyMemberOnline}
                size="md"
                showPulse={isFamilyMemberOnline}
              />
              <Badge variant="secondary">
                {conv.participant.relationship_type
                  ? conv.participant.relationship_type.charAt(0).toUpperCase() +
                    conv.participant.relationship_type.slice(1)
                  : "Family"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isFamilyMemberOnline
                ? `${conv.participant.name} is online`
                : `${conv.participant.name} is offline`}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              onClick={() =>
                onCall(
                  conv.participant.id,
                  conv.participant.type
                )
              }
              variant="outline"
              className="flex-1 sm:flex-initial"
              disabled={isBlocked}
            >
              <Phone className="mr-2 h-4 w-4" />
              Call
            </Button>
            <Button
              onClick={() =>
                onChat(
                  conv.conversation.id,
                  conv.participant.id
                )
              }
              className="flex-1 sm:flex-initial"
              disabled={isBlocked}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Message
            </Button>
          </div>
          {child && (
            <div className="w-full sm:w-auto">
              <BlockAndReportButton
                childId={child.id}
                blockedAdultProfileId={conv.conversation.adult_id}
                contactName={conv.participant.name}
                onBlocked={onBlocked}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

const ChildParentsList = () => {
  const [child, setChild] = useState<ChildSession | null>(null);
  const [conversations, setConversations] = useState<ConversationParticipant[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [blockedContactIds, setBlockedContactIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Separate parents and family members
  const parents = useMemo(
    () => conversations.filter((conv) => conv.participant.type === "parent"),
    [conversations]
  );
  const familyMembers = useMemo(
    () => conversations.filter((conv) => conv.participant.type === "family_member"),
    [conversations]
  );

  // Track presence for parent (if exists)
  const parentConversation = parents[0];
  const { isOnline: isParentOnline } = useParentPresence({
    parentId: parentConversation?.participant.id || "",
    enabled: !!parentConversation?.participant.id,
  });

  const loadBlockedContacts = async (childId: string) => {
    try {
      // Get child profile ID from child_profiles table
      const { data: childProfile } = await supabase
        .from("child_profiles")
        .select("id")
        .eq("id", childId)
        .single();

      if (!childProfile) return;

      // Query blocked_contacts where blocker_id equals child profile id and unblocked_at is null
      const { data: blockedContacts, error } = await supabase
        .from("blocked_contacts")
        .select("blocked_adult_profile_id, blocked_child_profile_id")
        .eq("blocker_child_id", childProfile.id)
        .is("unblocked_at", null);

      if (error) {
        console.error("Error loading blocked contacts:", error);
        return;
      }

      // Extract blocked IDs (both adult and child profile IDs)
      const blockedIds: string[] = [];
      blockedContacts?.forEach((blocked) => {
        if (blocked.blocked_adult_profile_id) {
          blockedIds.push(blocked.blocked_adult_profile_id);
        }
        if (blocked.blocked_child_profile_id) {
          blockedIds.push(blocked.blocked_child_profile_id);
        }
      });

      setBlockedContactIds(blockedIds);
    } catch (error) {
      console.error("Error in loadBlockedContacts:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      // CRITICAL: Ensure we're using anonymous access (not authenticated)
      // Children should use anonymous role, not authenticated
      const { data: authCheck } = await supabase.auth.getSession();
      if (authCheck?.session) {
        await supabase.auth.signOut();
      }

      const childData = getChildSessionLegacy();

      if (!childData) {
        navigate("/child/login");
        return;
      }

      setChild(childData);

      // Fetch all conversations (with parent and family members)
      if (childData.id) {
        await fetchConversations(childData.id);
        await loadBlockedContacts(childData.id);
      } else {
        toast({
          title: "Error",
          description: "Could not find child information",
          variant: "destructive",
        });
        setLoading(false);
      }
    };

    loadData();
  }, [navigate, toast]);

  // Reload blocked contacts when child changes
  useEffect(() => {
    if (child?.id) {
      loadBlockedContacts(child.id);
    }
  }, [child?.id]);

  // Set up real-time subscription for blocked_contacts updates
  useEffect(() => {
    if (!child?.id) return;

    const currentChildId = child.id;

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Subscribe to updates for this child's blocked contacts
    channelRef.current = supabase
      .channel(`blocked-contacts-child-${currentChildId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "blocked_contacts",
          filter: `blocker_child_id=eq.${currentChildId}`,
        },
        (payload) => {
          // When a contact is unblocked (unblocked_at is set), refresh the blocked list
          if (payload.new.unblocked_at && !payload.old.unblocked_at) {
            loadBlockedContacts(currentChildId);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "blocked_contacts",
          filter: `blocker_child_id=eq.${currentChildId}`,
        },
        () => {
          // When a new contact is blocked, refresh the blocked list
          loadBlockedContacts(currentChildId);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [child?.id]);

  const fetchConversations = async (childId: string) => {
    try {
      const conversationsData = await getChildConversations(childId);
      setConversations(conversationsData);
      setLoading(false);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error(
        "❌ [ChildParentsList] Error fetching conversations:",
        errorMessage
      );
      toast({
        title: "Error loading conversations",
        description: errorMessage,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleChat = (conversationId: string, participantId: string) => {
    // Store conversation info for the chat page
    localStorage.setItem("selectedConversationId", conversationId);
    localStorage.setItem("selectedParticipantId", participantId);
    // Navigate to chat with conversation context
    navigate(`/chat/${child?.id}?conversation=${conversationId}`);
  };

  const handleCall = (
    participantId: string,
    participantType: "parent" | "family_member"
  ) => {
    // Store participant info for the call screen BEFORE navigation
    localStorage.setItem("selectedParentId", participantId);
    localStorage.setItem("selectedParticipantType", participantType);
    
    console.log("📞 [CHILD PARENTS LIST] handleCall:", {
      participantId,
      participantType,
      storedParentId: localStorage.getItem("selectedParentId"),
      storedType: localStorage.getItem("selectedParticipantType"),
    });
    
    // Navigate to call screen - it will handle both parents and family members
    navigate(`/child/call/${participantId}`);
  };

  // CLS: Reserve space for loading state to match final layout structure
  if (loading || !child) {
    return (
      <div className="min-h-[100dvh] bg-background w-full overflow-x-hidden">
        <Navigation />
        <div
          className="p-4 sm:p-6"
          style={{
            paddingTop: "calc(1rem + 64px + var(--safe-area-inset-top) * 0.15)",
          }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 sm:mb-8 mt-4 sm:mt-6">
              <div className="h-9 w-48 bg-muted rounded animate-pulse mb-2" />
              <div className="h-6 w-64 bg-muted rounded animate-pulse" />
            </div>
            <Card className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-muted animate-pulse flex-shrink-0" />
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="h-7 w-32 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-10 w-full sm:w-24 bg-muted rounded animate-pulse" />
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background w-full overflow-x-hidden">
      <Navigation />
      <OnboardingTour role="child" pageKey="child_parents_list" />
      <HelpBubble role="child" pageKey="child_parents_list" />
      <div
        className="p-4 sm:p-6"
        style={{
          paddingTop: "calc(1rem + 64px + var(--safe-area-inset-top) * 0.15)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 sm:mb-8 mt-4 sm:mt-6">
            <h1 className="text-2xl sm:text-3xl font-bold">Call or Message</h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Choose someone to call or message
            </p>
          </div>

          {conversations.length > 0 ? (
            <div className="space-y-6">
              {/* Parents Section */}
              {parents.length > 0 && (
                <div className="space-y-4">
                  <div className="mb-2">
                    <h2 className="text-xl sm:text-2xl font-semibold">Parents</h2>
                    <p className="text-sm text-muted-foreground">
                      Your parents - you can call or message them anytime
                    </p>
                  </div>
                  {parents.map((conv) => {
                      const isOnline = isParentOnline;
                      const isBlocked = blockedContactIds.includes(conv.conversation.adult_id);

                      return (
                        <Card
                          key={conv.conversation.id}
                          data-tour="child-parents-list-card"
                          className={`p-4 sm:p-6 hover:shadow-lg transition-all relative border-2 border-primary/20 ${isBlocked ? "opacity-50" : ""}`}
                        >
                          {/* Blocked indicator in top right */}
                          {isBlocked && (
                            <div className="absolute top-4 right-4 text-2xl">🚫</div>
                          )}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                              <div 
                                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white font-bold text-xl sm:text-2xl flex-shrink-0 ring-2 ring-primary/30"
                                style={{ backgroundColor: conv.participant.avatar_color || "#3B82F6" }}
                              >
                                {conv.participant.name?.charAt(0).toUpperCase() ||
                                  "P"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-xl sm:text-2xl font-semibold truncate">
                                    {conv.participant.name}
                                  </h3>
                                  <StatusIndicator
                                    isOnline={isOnline}
                                    size="md"
                                    showPulse={isOnline}
                                  />
                                  <Badge variant="default" className="bg-primary">Parent</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {isOnline
                                    ? `${conv.participant.name} is online`
                                    : `${conv.participant.name} is offline`}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 w-full sm:w-auto">
                              <div className="flex gap-2 w-full sm:w-auto">
                                <Button
                                  onClick={() =>
                                    handleCall(
                                      conv.participant.id,
                                      conv.participant.type
                                    )
                                  }
                                  variant="outline"
                                  className="flex-1 sm:flex-initial"
                                  disabled={isBlocked}
                                >
                                  <Phone className="mr-2 h-4 w-4" />
                                  Call
                                </Button>
                                <Button
                                  onClick={() =>
                                    handleChat(
                                      conv.conversation.id,
                                      conv.participant.id
                                    )
                                  }
                                  className="flex-1 sm:flex-initial"
                                  disabled={isBlocked}
                                >
                                  <MessageSquare className="mr-2 h-4 w-4" />
                                  Message
                                </Button>
                              </div>
                              {/* Hide block button for parents - child cannot block their own parent (safety feature) */}
                              {/* Block button is only shown for family members in the Family Members section below */}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                </div>
              )}

              {/* Family Members Section */}
              {familyMembers.length > 0 && (
                <div className="space-y-4">
                  <div className="mb-2">
                    <h2 className="text-xl sm:text-2xl font-semibold">Family Members</h2>
                    <p className="text-sm text-muted-foreground">
                      Other family members you can contact
                    </p>
                  </div>
                  {familyMembers.map((conv) => {
                      const isBlocked = blockedContactIds.includes(conv.conversation.adult_id);
                      return (
                        <FamilyMemberCard
                          key={conv.conversation.id}
                          conv={conv}
                          isBlocked={isBlocked}
                          child={child}
                          onCall={handleCall}
                          onChat={handleChat}
                          onBlocked={() => {
                            if (child?.id) {
                              loadBlockedContacts(child.id);
                            }
                          }}
                        />
                      );
                    })}
                </div>
              )}
            </div>
          ) : (
            <Card className="p-6">
              <p className="text-muted-foreground">
                No conversations found. Start a conversation by sending a
                message!
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChildParentsList;

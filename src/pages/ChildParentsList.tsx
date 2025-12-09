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
import { getChildConversations } from "@/utils/conversations";
import { MessageSquare, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BlockAndReportButton } from "@/features/safety/components/BlockAndReportButton";

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
  };
}

const ChildParentsList = () => {
  const [child, setChild] = useState<ChildSession | null>(null);
  const [conversations, setConversations] = useState<ConversationParticipant[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [blockedContactIds, setBlockedContactIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Track presence for parent (if exists)
  const parentConversation = conversations.find(
    (c) => c.participant.type === "parent"
  );
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

      const sessionData = localStorage.getItem("childSession");

      if (!sessionData) {
        navigate("/child/login");
        return;
      }

      let childData;
      try {
        childData = JSON.parse(sessionData);
      } catch (error) {
        console.error(
          "❌ [ChildParentsList] Error parsing session data:",
          error
        );
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
    if (participantType === "parent") {
      navigate(`/child/call/${participantId}`);
    } else {
      // For family members, we might need a different call route
      // For now, navigate to dashboard
      localStorage.setItem("selectedParentId", participantId);
      navigate("/child/dashboard");
    }
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
            <h1 className="text-2xl sm:text-3xl font-bold">Family & Parents</h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Choose someone to call or message
            </p>
          </div>

          {conversations.length > 0 ? (
            <div className="space-y-4">
              {conversations.map((conv) => {
                const isParent = conv.participant.type === "parent";
                const isOnline = isParent ? isParentOnline : false; // For now, only track parent presence
                // Check if this contact is blocked (using adult_profile_id from conversation)
                const isBlocked = blockedContactIds.includes(conv.conversation.adult_id);

                return (
                  <Card
                    key={conv.conversation.id}
                    data-tour={isParent ? "child-parents-list-card" : undefined}
                    className={`p-4 sm:p-6 hover:shadow-lg transition-all relative ${isBlocked ? "opacity-50" : ""}`}
                  >
                    {/* Blocked indicator in top right */}
                    {isBlocked && (
                      <div className="absolute top-4 right-4 text-2xl">🚫</div>
                    )}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xl sm:text-2xl flex-shrink-0">
                          {conv.participant.name?.charAt(0).toUpperCase() ||
                            "F"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xl sm:text-2xl font-semibold truncate">
                              {conv.participant.name}
                            </h3>
                            {isParent && (
                              <StatusIndicator
                                isOnline={isOnline}
                                size="md"
                                showPulse={isOnline}
                              />
                            )}
                            {isParent && (
                              <Badge variant="secondary">Parent</Badge>
                            )}
                            {!isParent && (
                              <Badge variant="secondary">Family</Badge>
                            )}
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
                        {child && (
                          <div className="w-full sm:w-auto">
                            <BlockAndReportButton
                              childId={child.id}
                              blockedAdultProfileId={conv.conversation.adult_id}
                              contactName={conv.participant.name}
                              onBlocked={() => {
                                if (child?.id) {
                                  loadBlockedContacts(child.id);
                                }
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
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

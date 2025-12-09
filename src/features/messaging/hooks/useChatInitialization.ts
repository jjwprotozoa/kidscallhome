// src/features/messaging/hooks/useChatInitialization.ts
// Hook for initializing chat state and determining user type

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  getChildProfileId,
  getCurrentAdultProfileId,
  getOrCreateConversation,
  getChildConversations,
} from "@/utils/conversations";
import { safeLog, sanitizeError } from "@/utils/security";

interface ChildSession {
  id: string;
  name: string;
  avatar_color: string;
}

interface ChatInitializationState {
  isChild: boolean;
  isFamilyMember: boolean;
  familyMemberId: string | null;
  childData: ChildSession | null;
  parentData: { name: string; id?: string } | null;
  parentName: string;
  conversationId: string | null;
  currentSenderType: "parent" | "child" | "family_member" | null;
  currentSenderId: string | null;
  targetChildId: string | null;
  initialized: boolean;
}

export const useChatInitialization = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [state, setState] = useState<ChatInitializationState>({
    isChild: false,
    isFamilyMember: false,
    familyMemberId: null,
    childData: null,
    parentData: null,
    parentName: "Mom/Dad",
    conversationId: null,
    currentSenderType: null,
    currentSenderId: null,
    targetChildId: null,
    initialized: false,
  });

  useEffect(() => {
    const initializeChat = async () => {
      let targetChildId: string | null = null;
      let isChildUser = false;
      let currentFamilyMemberId: string | null = null;

      const urlParams = new URLSearchParams(window.location.search);
      const conversationIdParam = urlParams.get("conversation");

      // Check childSession FIRST
      const childSession = localStorage.getItem("childSession");
      let childSessionData: ChildSession | null = null;

      if (childSession) {
        try {
          childSessionData = JSON.parse(childSession);
          if (childId && childId === childSessionData.id) {
            isChildUser = true;
            targetChildId = childSessionData.id;

            const convId =
              conversationIdParam ||
              localStorage.getItem("selectedConversationId");

            if (convId) {
              setState((prev) => ({
                ...prev,
                isChild: true,
                childData: childSessionData,
                currentSenderType: "child",
                currentSenderId: childSessionData.id,
                conversationId: convId,
                targetChildId: childSessionData.id,
              }));
            } else {
              // Resolve conversation for child
              try {
                const childProfileId = await getChildProfileId(
                  childSessionData.id
                );

                if (childProfileId) {
                  const conversations = await getChildConversations(
                    childProfileId
                  );

                  if (conversations && conversations.length > 0) {
                    const parentConv = conversations.find(
                      (c) => c.participant.type === "parent"
                    );
                    const selectedConv = parentConv || conversations[0];
                    const resolvedConvId = selectedConv.conversation.id;

                    setState((prev) => ({
                      ...prev,
                      isChild: true,
                      childData: childSessionData,
                      currentSenderType: "child",
                      currentSenderId: childSessionData.id,
                      conversationId: resolvedConvId,
                      targetChildId: childSessionData.id,
                    }));
                  }
                }
              } catch (error) {
                safeLog.error(
                  "Error resolving conversation for child:",
                  sanitizeError(error)
                );
              }
            }

            // Fetch parent data
            Promise.resolve(
              supabase
                .from("children")
                .select("parent_id")
                .eq("id", childSessionData.id)
                .single()
            )
              .then(({ data: childRecord, error: childError }) => {
                if (childError || !childRecord) return;
                return supabase
                  .from("parents")
                  .select("id, name")
                  .eq("id", childRecord.parent_id)
                  .maybeSingle();
              })
              .then((result) => {
                if (result?.data) {
                  setState((prev) => ({
                    ...prev,
                    parentName: result.data.name,
                    parentData: {
                      name: result.data.name,
                      id: result.data.id,
                    },
                  }));
                }
              })
              .catch((error) => {
                safeLog.error(
                  "Error fetching parent data:",
                  sanitizeError(error)
                );
              });
          }
        } catch (error) {
          safeLog.error("Error parsing childSession:", sanitizeError(error));
        }
      }

      // If not child, check auth session
      if (!isChildUser) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const user = session?.user;

          if (user) {
            // Check if family member
            const { data: familyMember } = await supabase
              .from("family_members")
              .select("id, name, parent_id")
              .eq("id", user.id)
              .eq("status", "active")
              .maybeSingle();

            if (familyMember) {
              isChildUser = false;
              currentFamilyMemberId = familyMember.id;

              if (childId) {
                targetChildId = childId;

                const childProfileId = await getChildProfileId(childId);
                const adultProfileId = await getCurrentAdultProfileId(
                  user.id,
                  familyMember.parent_id,
                  "family_member"
                );

                if (childProfileId && adultProfileId) {
                  const convId = await getOrCreateConversation(
                    adultProfileId,
                    "family_member",
                    childProfileId
                  );

                  if (convId) {
                    // Fetch child data
                    const { data: childData } = await supabase
                      .from("children")
                      .select("id, name, avatar_color")
                      .eq("id", childId)
                      .single();

                    setState((prev) => ({
                      ...prev,
                      isFamilyMember: true,
                      familyMemberId: familyMember.id,
                      currentSenderType: "family_member",
                      currentSenderId: familyMember.id,
                      conversationId: convId,
                      targetChildId: childId,
                      parentName: familyMember.name || "Family Member",
                      childData: childData
                        ? {
                            id: childData.id,
                            name: childData.name,
                            avatar_color: childData.avatar_color || "#3B82F6",
                          }
                        : null,
                    }));
                  } else {
                    toast({
                      title: "Error",
                      description: "Could not create or find conversation.",
                      variant: "destructive",
                    });
                    return;
                  }
                } else {
                  toast({
                    title: "Error",
                    description:
                      "Could not resolve profile IDs. Please try again.",
                    variant: "destructive",
                  });
                  return;
                }
              } else {
                navigate("/family-member/dashboard");
                return;
              }
            } else {
              // Parent
              if (childId) {
                targetChildId = childId;

                const childProfileId = await getChildProfileId(childId);
                const adultProfileId = await getCurrentAdultProfileId(
                  user.id,
                  user.id,
                  "parent"
                );

                if (childProfileId && adultProfileId) {
                  const convId = await getOrCreateConversation(
                    adultProfileId,
                    "parent",
                    childProfileId
                  );

                  if (convId) {
                    // Fetch child data
                    const { data: childData } = await supabase
                      .from("children")
                      .select("id, name, avatar_color")
                      .eq("id", childId)
                      .single();

                    setState((prev) => ({
                      ...prev,
                      isChild: false,
                      isFamilyMember: false,
                      currentSenderType: "parent",
                      currentSenderId: user.id,
                      conversationId: convId,
                      targetChildId: childId,
                      childData: childData
                        ? {
                            id: childData.id,
                            name: childData.name,
                            avatar_color: childData.avatar_color || "#3B82F6",
                          }
                        : null,
                    }));
                  } else {
                    toast({
                      title: "Error",
                      description: "Could not create or find conversation.",
                      variant: "destructive",
                    });
                    return;
                  }
                } else {
                  toast({
                    title: "Error",
                    description:
                      "Could not resolve profile IDs. Please try again.",
                    variant: "destructive",
                  });
                  return;
                }
              } else {
                navigate("/parent/children");
                return;
              }
            }
          } else if (childSessionData) {
            // No auth session but have childSession
            isChildUser = true;
            targetChildId = childSessionData.id;

            const convId =
              conversationIdParam ||
              localStorage.getItem("selectedConversationId");
            if (convId) {
              // Fetch parent data
              Promise.resolve(
                supabase
                  .from("children")
                  .select("parent_id")
                  .eq("id", childSessionData.id)
                  .single()
              )
                .then(({ data: childRecord }) => {
                  if (!childRecord) return;
                  return supabase
                    .from("parents")
                    .select("id, name")
                    .eq("id", childRecord.parent_id)
                    .maybeSingle();
                })
                .then((result) => {
                  setState((prev) => ({
                    ...prev,
                    isChild: true,
                    childData: childSessionData,
                    currentSenderType: "child",
                    currentSenderId: childSessionData.id,
                    conversationId: convId,
                    targetChildId: childSessionData.id,
                    parentName: result?.data?.name || "Mom/Dad",
                    parentData: result?.data
                      ? { name: result.data.name, id: result.data.id }
                      : null,
                  }));
                });
            } else {
              toast({
                title: "Error",
                description:
                  "No conversation selected. Please select a conversation first.",
                variant: "destructive",
              });
            }
          } else {
            navigate("/");
            return;
          }
        } catch (error) {
          safeLog.error("Error checking auth session:", sanitizeError(error));
          navigate("/");
          return;
        }
      }

      setState((prev) => ({ ...prev, initialized: true }));
    };

    initializeChat();
  }, [childId, navigate, toast]);

  return state;
};

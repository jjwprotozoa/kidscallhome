// src/features/messaging/hooks/useChatInitialization.ts
// Hook for initializing chat state and determining user type

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getChildSessionLegacy } from "@/lib/childSession";
import {
  getChildConversations,
  getChildProfileId,
  getCurrentAdultProfileId,
  getOrCreateConversation,
} from "@/utils/conversations";
import { safeLog, sanitizeError } from "@/utils/security";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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

      // Helper function to fetch adult name from conversation
      // This works for children due to RLS policy allowing view of adult names from conversations
      const fetchAdultNameFromConversation = async (conversationId: string) => {
        try {
          // Get conversation to find adult_id
          const { data: conversation, error: convError } = await supabase
            // @ts-expect-error - conversations table exists but not in types
            .from("conversations")
            .select("adult_id, adult_role")
            .eq("id", conversationId)
            .maybeSingle();

          if (convError || !conversation) {
            safeLog.error(
              "Error fetching conversation:",
              convError || "No conversation found"
            );
            return null;
          }

          const conv = conversation as unknown as {
            adult_id: string;
            adult_role: string;
          };

          // Fetch adult profile name using adult_id
          // This should work for children due to RLS policy allowing view of adult names from conversations
          const { data: adultProfile, error: profileError } = await supabase
            // @ts-expect-error - adult_profiles table exists but not in types
            .from("adult_profiles")
            .select("id, name, role, user_id")
            .eq("id", conv.adult_id)
            .maybeSingle();

          if (profileError || !adultProfile) {
            safeLog.warn(
              "Could not fetch adult profile:",
              profileError?.message || "No profile found"
            );
            return null;
          }

          const profile = adultProfile as unknown as {
            id: string;
            name: string;
            role: string;
            user_id?: string;
          };

          return {
            id: profile.user_id || profile.id,
            name: profile.name,
            role: profile.role,
          };
        } catch (error) {
          safeLog.error(
            "Error fetching adult name from conversation:",
            sanitizeError(error)
          );
          return null;
        }
      };

      // Check childSession FIRST
      let childSessionData: ChildSession | null = null;

      const childSession = getChildSessionLegacy();
      if (childSession) {
        // CRITICAL: Ensure children use anonymous access (not authenticated)
        // If a child has a stale auth session, sign them out
        const { data: authCheck } = await supabase.auth.getSession();
        if (authCheck?.session) {
          safeLog.warn(
            "⚠️ [CHAT INIT] Child has auth session, signing out for anonymous access"
          );
          await supabase.auth.signOut();
        }
        try {
          childSessionData = childSession;
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

              // Fetch adult name from conversation
              fetchAdultNameFromConversation(convId).then((adultData) => {
                if (adultData) {
                  setState((prev) => ({
                    ...prev,
                    parentName: adultData.name,
                    parentData: {
                      name: adultData.name,
                      id: adultData.id,
                    },
                  }));
                } else {
                  setState((prev) => ({
                    ...prev,
                    parentName: prev.parentName || "Mom/Dad",
                  }));
                }
              });
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

                    // Fetch adult name from conversation
                    fetchAdultNameFromConversation(resolvedConvId).then(
                      (adultData) => {
                        if (adultData) {
                          setState((prev) => ({
                            ...prev,
                            parentName: adultData.name,
                            parentData: {
                              name: adultData.name,
                              id: adultData.id,
                            },
                          }));
                        } else {
                          // Fallback to participant name from getChildConversations if available
                          const fallbackName =
                            selectedConv.participant.name !== "Parent" &&
                            selectedConv.participant.name !== "Family Member"
                              ? selectedConv.participant.name
                              : "Mom/Dad";
                          setState((prev) => ({
                            ...prev,
                            parentName: fallbackName,
                          }));
                        }
                      }
                    );
                  } else {
                    // No conversations found - auto-create one with the parent
                    safeLog.log(
                      "No conversations found for child, auto-creating conversation with parent"
                    );

                    try {
                      // Get the child's family_id to find the parent
                      const { data: childProfile } = await supabase
                        // @ts-expect-error - child_profiles table exists but not in types
                        .from("child_profiles")
                        .select("family_id")
                        .eq("id", childProfileId)
                        .maybeSingle();

                      const childProf = childProfile as unknown as {
                        family_id: string;
                      } | null;

                      if (childProf?.family_id) {
                        // Find the parent's adult profile
                        // @ts-expect-error - adult_profiles table exists but not in types
                        const { data: parentProfile } = await supabase
                          // @ts-expect-error - adult_profiles table exists but not in types
                          .from("adult_profiles")
                          .select("id")
                          .eq("family_id", childProf.family_id)
                          .eq("role", "parent")
                          .order("created_at", { ascending: true })
                          .limit(1)
                          .maybeSingle();

                        if (parentProfile?.id) {
                          // Create conversation with parent
                          const convId = await getOrCreateConversation(
                            parentProfile.id,
                            "parent",
                            childProfileId
                          );

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

                            // Fetch adult name from conversation
                            fetchAdultNameFromConversation(convId).then(
                              (adultData) => {
                                if (adultData) {
                                  setState((prev) => ({
                                    ...prev,
                                    parentName: adultData.name,
                                    parentData: {
                                      name: adultData.name,
                                      id: adultData.id,
                                    },
                                  }));
                                } else {
                                  setState((prev) => ({
                                    ...prev,
                                    parentName: prev.parentName || "Mom/Dad",
                                  }));
                                }
                              }
                            );

                            safeLog.log(
                              "✅ Auto-created conversation for child with parent:",
                              convId
                            );
                          } else {
                            safeLog.error(
                              "Failed to create conversation for child"
                            );
                            setState((prev) => ({
                              ...prev,
                              isChild: true,
                              childData: childSessionData,
                              currentSenderType: "child",
                              currentSenderId: childSessionData.id,
                              targetChildId: childSessionData.id,
                              conversationId: null,
                            }));
                          }
                        } else {
                          safeLog.error("No parent found for child's family");
                          setState((prev) => ({
                            ...prev,
                            isChild: true,
                            childData: childSessionData,
                            currentSenderType: "child",
                            currentSenderId: childSessionData.id,
                            targetChildId: childSessionData.id,
                            conversationId: null,
                          }));
                        }
                      } else {
                        safeLog.error("Child profile has no family_id");
                        setState((prev) => ({
                          ...prev,
                          isChild: true,
                          childData: childSessionData,
                          currentSenderType: "child",
                          currentSenderId: childSessionData.id,
                          targetChildId: childSessionData.id,
                          conversationId: null,
                        }));
                      }
                    } catch (createError) {
                      safeLog.error(
                        "Error auto-creating conversation:",
                        sanitizeError(createError)
                      );
                      setState((prev) => ({
                        ...prev,
                        isChild: true,
                        childData: childSessionData,
                        currentSenderType: "child",
                        currentSenderId: childSessionData.id,
                        targetChildId: childSessionData.id,
                        conversationId: null,
                      }));
                    }
                  }
                }
              } catch (error) {
                safeLog.error(
                  "Error resolving conversation for child:",
                  sanitizeError(error)
                );
              }
            }
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
            // Check if family member - try family_members first, then fallback to adult_profiles
            let familyMember: {
              id: string;
              name?: string;
              parent_id: string;
            } | null = null;
            let parentId: string | null = null;

            const { data: fmData } = await supabase
              .from("family_members")
              .select("id, name, parent_id")
              .eq("id", user.id)
              .eq("status", "active")
              .maybeSingle();

            if (fmData) {
              familyMember = fmData;
              parentId = fmData.parent_id;
            } else {
              // Fallback: Try adult_profiles
              const { data: adultProfile } = await supabase
                .from("adult_profiles" as never)
                .select("user_id, family_id, name")
                .eq("user_id", user.id)
                .eq("role", "family_member")
                .maybeSingle();

              if (adultProfile) {
                const ap = adultProfile as {
                  user_id: string;
                  family_id: string;
                  name?: string;
                };
                familyMember = {
                  id: ap.user_id,
                  name: ap.name,
                  parent_id: ap.family_id,
                };
                parentId = ap.family_id;
              }
            }

            if (familyMember && parentId) {
              isChildUser = false;
              currentFamilyMemberId = familyMember.id;

              if (childId) {
                targetChildId = childId;

                const childProfileId = await getChildProfileId(childId);
                const adultProfileId = await getCurrentAdultProfileId(
                  user.id,
                  parentId,
                  "family_member"
                );

                if (childProfileId && adultProfileId) {
                  const convId = await getOrCreateConversation(
                    adultProfileId,
                    "family_member",
                    childProfileId
                  );

                  if (convId) {
                    // Fetch child data from child_profiles
                    const { data: childData } = await supabase
                      .from("child_profiles" as never)
                      .select("id, name, avatar_color")
                      .eq("id", childId)
                      .maybeSingle();

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
                            id: (
                              childData as {
                                id: string;
                                name: string;
                                avatar_color?: string;
                              }
                            ).id,
                            name: (
                              childData as {
                                id: string;
                                name: string;
                                avatar_color?: string;
                              }
                            ).name,
                            avatar_color:
                              (
                                childData as {
                                  id: string;
                                  name: string;
                                  avatar_color?: string;
                                }
                              ).avatar_color || "#3B82F6",
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
                navigate("/family-member");
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
              setState((prev) => ({
                ...prev,
                isChild: true,
                childData: childSessionData,
                currentSenderType: "child",
                currentSenderId: childSessionData.id,
                conversationId: convId,
                targetChildId: childSessionData.id,
              }));

              // Fetch adult name from conversation
              fetchAdultNameFromConversation(convId).then((adultData) => {
                if (adultData) {
                  setState((prev) => ({
                    ...prev,
                    parentName: adultData.name,
                    parentData: {
                      name: adultData.name,
                      id: adultData.id,
                    },
                  }));
                } else {
                  setState((prev) => ({
                    ...prev,
                    parentName: prev.parentName || "Mom/Dad",
                  }));
                }
              });
            } else {
              // Try to resolve conversation automatically
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

                    // Fetch adult name from conversation
                    fetchAdultNameFromConversation(resolvedConvId).then(
                      (adultData) => {
                        if (adultData) {
                          setState((prev) => ({
                            ...prev,
                            parentName: adultData.name,
                            parentData: {
                              name: adultData.name,
                              id: adultData.id,
                            },
                          }));
                        } else {
                          const fallbackName =
                            selectedConv.participant.name !== "Parent" &&
                            selectedConv.participant.name !== "Family Member"
                              ? selectedConv.participant.name
                              : "Mom/Dad";
                          setState((prev) => ({
                            ...prev,
                            parentName: fallbackName,
                          }));
                        }
                      }
                    );
                  } else {
                    // No conversations found - auto-create one with the parent
                    safeLog.log(
                      "No conversations found for child, auto-creating conversation with parent"
                    );

                    try {
                      // Get the child's family_id to find the parent
                      const { data: childProfile } = await supabase
                        // @ts-expect-error - child_profiles table exists but not in types
                        .from("child_profiles")
                        .select("family_id")
                        .eq("id", childProfileId)
                        .maybeSingle();

                      const childProf = childProfile as unknown as {
                        family_id: string;
                      } | null;

                      if (childProf?.family_id) {
                        // Find the parent's adult profile
                        const { data: parentProfile } = await supabase
                          // @ts-expect-error - adult_profiles table exists but not in types
                          .from("adult_profiles")
                          .select("id")
                          .eq("family_id", childProf.family_id)
                          .eq("role", "parent")
                          .order("created_at", { ascending: true })
                          .limit(1)
                          .maybeSingle();

                        if (parentProfile?.id) {
                          // Create conversation with parent
                          const convId = await getOrCreateConversation(
                            parentProfile.id,
                            "parent",
                            childProfileId
                          );

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

                            // Fetch adult name from conversation
                            fetchAdultNameFromConversation(convId).then(
                              (adultData) => {
                                if (adultData) {
                                  setState((prev) => ({
                                    ...prev,
                                    parentName: adultData.name,
                                    parentData: {
                                      name: adultData.name,
                                      id: adultData.id,
                                    },
                                  }));
                                } else {
                                  setState((prev) => ({
                                    ...prev,
                                    parentName: prev.parentName || "Mom/Dad",
                                  }));
                                }
                              }
                            );

                            safeLog.log(
                              "✅ Auto-created conversation for child with parent:",
                              convId
                            );
                          } else {
                            safeLog.error(
                              "Failed to create conversation for child"
                            );
                            setState((prev) => ({
                              ...prev,
                              isChild: true,
                              childData: childSessionData,
                              currentSenderType: "child",
                              currentSenderId: childSessionData.id,
                              targetChildId: childSessionData.id,
                              conversationId: null,
                            }));

                            toast({
                              title: "Error",
                              description:
                                "Could not create conversation. Please try again.",
                              variant: "destructive",
                            });
                          }
                        } else {
                          safeLog.error("No parent found for child's family");
                          setState((prev) => ({
                            ...prev,
                            isChild: true,
                            childData: childSessionData,
                            currentSenderType: "child",
                            currentSenderId: childSessionData.id,
                            targetChildId: childSessionData.id,
                            conversationId: null,
                          }));

                          toast({
                            title: "Error",
                            description:
                              "No parent found. Please contact support.",
                            variant: "destructive",
                          });
                        }
                      } else {
                        safeLog.error("Child profile has no family_id");
                        setState((prev) => ({
                          ...prev,
                          isChild: true,
                          childData: childSessionData,
                          currentSenderType: "child",
                          currentSenderId: childSessionData.id,
                          targetChildId: childSessionData.id,
                          conversationId: null,
                        }));

                        toast({
                          title: "Error",
                          description:
                            "Could not find family information. Please try again.",
                          variant: "destructive",
                        });
                      }
                    } catch (createError) {
                      safeLog.error(
                        "Error auto-creating conversation:",
                        sanitizeError(createError)
                      );
                      setState((prev) => ({
                        ...prev,
                        isChild: true,
                        childData: childSessionData,
                        currentSenderType: "child",
                        currentSenderId: childSessionData.id,
                        targetChildId: childSessionData.id,
                        conversationId: null,
                      }));

                      toast({
                        title: "Error",
                        description:
                          "Error loading conversations. Please try again.",
                        variant: "destructive",
                      });
                    }
                  }
                } else {
                  // Could not resolve child profile, but still set basic state
                  setState((prev) => ({
                    ...prev,
                    isChild: true,
                    childData: childSessionData,
                    currentSenderType: "child",
                    currentSenderId: childSessionData.id,
                    targetChildId: childSessionData.id,
                    conversationId: null,
                  }));

                  toast({
                    title: "Error",
                    description:
                      "Could not resolve child profile. Please try again.",
                    variant: "destructive",
                  });
                }
              } catch (error) {
                safeLog.error(
                  "Error resolving conversation for child:",
                  sanitizeError(error)
                );
                // Still set child state even if conversation resolution fails
                setState((prev) => ({
                  ...prev,
                  isChild: true,
                  childData: childSessionData,
                  currentSenderType: "child",
                  currentSenderId: childSessionData.id,
                  targetChildId: childSessionData.id,
                  conversationId: null,
                }));

                toast({
                  title: "Error",
                  description: "Error loading conversations. Please try again.",
                  variant: "destructive",
                });
              }
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

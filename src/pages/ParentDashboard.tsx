import AddChildDialog from "@/components/AddChildDialog";
import AddFamilyMemberDialog from "@/components/AddFamilyMemberDialog";
import { CodeManagementDialogs } from "@/components/CodeManagementDialogs";
import { IncomingCallDialog } from "@/components/IncomingCallDialog";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FamilyCodeCard } from "@/features/family/components/FamilyCodeCard";
import { ChildrenTab } from "@/features/family/components/ChildrenTab";
import { FamilyTab } from "@/features/family/components/FamilyTab";
import { ChildConnectionsTab } from "@/features/family/components/ChildConnectionsTab";
import { SafetyReportsTab } from "@/features/safety/components/SafetyReportsTab";
import { FamilySetupTab } from "@/features/family/components/FamilySetupTab";
import { useIncomingCallNotifications } from "@/features/calls/hooks/useIncomingCallNotifications";
import { endCall as endCallUtil } from "@/features/calls/utils/callEnding";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { useChildrenPresence } from "@/features/presence/useChildrenPresence";
import { useToast } from "@/hooks/use-toast";
import { useParentData } from "@/hooks/useParentData";
import { useParentIncomingCallSubscription } from "@/hooks/useParentIncomingCallSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useTotalMissedBadge, useTotalUnreadBadge } from "@/stores/badgeStore";
import { clearAllNotifications } from "@/utils/clearAllNotifications";
import { isPWA } from "@/utils/platformDetection";
import { BellOff, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Child {
  id: string;
  name: string;
  login_code: string;
  avatar_color: string;
}

interface IncomingCall {
  id: string;
  child_id: string;
  child_name: string;
  child_avatar_color: string;
}

interface FamilyMember {
  id: string | null;
  name: string;
  email: string;
  relationship: string;
  status: "pending" | "active" | "suspended";
  invitation_token?: string | null;
  invitation_sent_at: string | null;
  invitation_accepted_at: string | null;
  created_at: string;
  blockedByChildren?: string[];
  reportCount?: number;
}

const ParentDashboard = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [familyMembersLoading, setFamilyMembersLoading] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [showAddFamilyMember, setShowAddFamilyMember] = useState(false);
  const [activeTab, setActiveTab] = useState("children");
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [showCodeDialog, setShowCodeDialog] = useState<{ child: Child } | null>(
    null
  );
  const [childToDelete, setChildToDelete] = useState<Child | null>(null);
  const [childToEditCode, setChildToEditCode] = useState<Child | null>(null);
  const [isUpdatingCode, setIsUpdatingCode] = useState(false);
  const [printViewChild, setPrintViewChild] = useState<Child | null>(null);
  const incomingCallRef = useRef<IncomingCall | null>(null); // Ref to track latest incomingCall for subscription callbacks
  const isAnsweringRef = useRef(false); // Track if user is answering to prevent auto-decline
  const navigate = useNavigate();
  const { toast } = useToast();
  const { stopIncomingCall } = useIncomingCallNotifications({
    enabled: true,
    volume: 0.7,
  });

  // Use parent data hook
  const {
    parentName,
    familyCode,
    allowedChildren,
    canAddMoreChildren,
    checkAuth,
    refreshCanAddMoreChildren,
  } = useParentData();

  // Track children's online presence
  // Memoize childIds to prevent unnecessary re-subscriptions
  const childIds = useMemo(() => children.map((child) => child.id), [children]);
  const { isChildOnline } = useChildrenPresence({
    childIds,
    enabled: children.length > 0,
    // Optional: Uncomment to enable status change notifications
    // onStatusChange: (childId, isOnline) => {
    //   const child = children.find((c) => c.id === childId);
    //   if (child) {
    //     toast({
    //       title: isOnline ? `${child.name} is online` : `${child.name} went offline`,
    //       description: isOnline
    //         ? "They're available for calls"
    //         : "They're no longer available",
    //     });
    //   }
    // },
  });

  // Get total badge counts
  const totalUnreadMessages = useTotalUnreadBadge();
  const totalMissedCalls = useTotalMissedBadge();
  const hasNotifications = totalUnreadMessages > 0 || totalMissedCalls > 0;

  const fetchChildren = useCallback(async () => {
    try {
      // Get authenticated user ID to filter children (defense in depth - RLS should also enforce this)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase
        .from("children")
        .select("*")
        .eq("parent_id", user.id) // Explicitly filter by parent_id (RLS should also enforce this)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChildren(data || []);

      // Refresh subscription check after fetching children (non-blocking)
      refreshCanAddMoreChildren().catch((err) => {
        console.warn("Failed to refresh subscription check:", err);
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Error loading children",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, refreshCanAddMoreChildren]);

  const fetchFamilyMembers = useCallback(async () => {
    try {
      setFamilyMembersLoading(true);
      
      // Get current user's family
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adultProfile } = await supabase
        .from("adult_profiles")
        .select("family_id")
        .eq("user_id", user.id)
        .eq("role", "parent")
        .single();

      if (!adultProfile) return;

      // Fetch family members
      const { data: familyMembersData, error } = await supabase
        .from("family_members")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get children in this family
      const { data: childMemberships } = await supabase
        .from("child_family_memberships")
        .select("child_profile_id")
        .eq("family_id", adultProfile.family_id);

      if (!childMemberships || childMemberships.length === 0) {
        setFamilyMembers((familyMembersData || []).map(fm => ({ ...fm, blockedByChildren: [], reportCount: 0 })));
        return;
      }

      const childProfileIds = childMemberships.map(cm => cm.child_profile_id);

      // Get adult profile IDs for family members (user_id -> adult_profile_id mapping)
      const familyMemberUserIds = (familyMembersData || [])
        .filter(fm => fm.id)
        .map(fm => fm.id!);

      const { data: adultProfiles } = await supabase
        .from("adult_profiles")
        .select("id, user_id")
        .in("user_id", familyMemberUserIds);

      const userToAdultProfileMap = new Map(
        adultProfiles?.map(ap => [ap.user_id, ap.id]) || []
      );
      const adultProfileIds = Array.from(userToAdultProfileMap.values());

      // Fetch blocked contacts for these children where blocked adult is a family member
      const { data: blockedContacts } = await supabase
        .from("blocked_contacts")
        .select("blocked_adult_profile_id, blocker_child_id")
        .in("blocker_child_id", childProfileIds)
        .in("blocked_adult_profile_id", adultProfileIds)
        .is("unblocked_at", null);

      // Fetch child names for blocked contacts
      const blockedChildIds = new Set(
        blockedContacts?.map(bc => bc.blocker_child_id) || []
      );
      const { data: childProfiles } = await supabase
        .from("child_profiles")
        .select("id, name")
        .in("id", Array.from(blockedChildIds));

      const childNameMap = new Map(
        childProfiles?.map(cp => [cp.id, cp.name]) || []
      );

      // Fetch reports for these children where reported adult is a family member
      const { data: reports } = await supabase
        .from("reports")
        .select("reported_adult_profile_id, status")
        .in("reporter_child_id", childProfileIds)
        .in("reported_adult_profile_id", adultProfileIds)
        .eq("status", "pending");

      // Process data to add blockedByChildren and reportCount
      const enrichedFamilyMembers = (familyMembersData || []).map(fm => {
        const adultProfileId = userToAdultProfileMap.get(fm.id || "");
        if (!adultProfileId) {
          return { ...fm, blockedByChildren: [], reportCount: 0 };
        }
        
        // Find blocked contacts for this family member
        const blockedForThisMember = (blockedContacts || []).filter(
          bc => bc.blocked_adult_profile_id === adultProfileId
        );
        
        // Get child names who blocked this member
        const blockedByChildren = blockedForThisMember
          .map(bc => childNameMap.get(bc.blocker_child_id))
          .filter(Boolean) as string[];

        // Count pending reports for this family member
        const reportCount = (reports || []).filter(
          r => r.reported_adult_profile_id === adultProfileId
        ).length;

        return {
          ...fm,
          blockedByChildren,
          reportCount,
        };
      });

      setFamilyMembers(enrichedFamilyMembers);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Error loading family members",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setFamilyMembersLoading(false);
    }
  }, [toast]);

  const handleSuspendFamilyMember = async (familyMemberId: string) => {
    try {
      const { error } = await supabase
        .from("family_members")
        .update({ status: "suspended" })
        .eq("id", familyMemberId);

      if (error) throw error;
      toast({
        title: "Family member suspended",
        description:
          "The family member has been suspended and can no longer access the app.",
      });
      fetchFamilyMembers();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to suspend family member",
        variant: "destructive",
      });
    }
  };

  const handleActivateFamilyMember = async (familyMemberId: string) => {
    try {
      const { error } = await supabase
        .from("family_members")
        .update({ status: "active" })
        .eq("id", familyMemberId);

      if (error) throw error;
      toast({
        title: "Family member activated",
        description: "The family member can now access the app.",
      });
      fetchFamilyMembers();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to activate family member",
        variant: "destructive",
      });
    }
  };

  const handleResendInvitation = async (
    familyMemberId: string,
    email: string
  ) => {
    try {
      // Get current user for parent_id check
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get current member data - handle both id and email cases
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        familyMemberId
      );

      let member;
      let fetchError;

      if (isUUID && familyMemberId) {
        // Registered member - query by id
        const result = await supabase
          .from("family_members")
          .select("invitation_token, name, relationship")
          .eq("id", familyMemberId)
          .single();
        member = result.data;
        fetchError = result.error;
      } else {
        // Pending member - query by email and parent_id
        const result = await supabase
          .from("family_members")
          .select("invitation_token, name, relationship")
          .eq("email", email.toLowerCase().trim())
          .eq("parent_id", user.id)
          .single();
        member = result.data;
        fetchError = result.error;
      }

      if (fetchError || !member)
        throw fetchError || new Error("Family member not found");

      // Generate a new invitation token for security and to handle expired links
      const newInvitationToken = crypto.randomUUID();

      // Update invitation with new token and timestamp
      let updateError;
      if (isUUID && familyMemberId) {
        // Update by id
        const result = await supabase
          .from("family_members")
          .update({
            invitation_token: newInvitationToken,
            invitation_sent_at: new Date().toISOString(),
          })
          .eq("id", familyMemberId);
        updateError = result.error;
      } else {
        // Update by email and parent_id
        const result = await supabase
          .from("family_members")
          .update({
            invitation_token: newInvitationToken,
            invitation_sent_at: new Date().toISOString(),
          })
          .eq("email", email.toLowerCase().trim())
          .eq("parent_id", user.id);
        updateError = result.error;
      }

      if (updateError) throw updateError;

      // Send email with new token
      const { error: emailError } = await supabase.functions.invoke(
        "send-family-member-invitation",
        {
          body: {
            invitationToken: newInvitationToken,
            email: email,
            name: member.name,
            relationship: member.relationship,
            parentName: user?.user_metadata?.name || "a family member",
          },
        }
      );

      if (emailError) {
        toast({
          title: "New invitation generated",
          description:
            "A new invitation link has been generated, but email sending failed. You can copy and share the link manually from the card.",
          variant: "default",
          duration: 8000,
        });
      } else {
        toast({
          title: "Invitation resent",
          description: `A new invitation email with a fresh link has been sent to ${email}.`,
        });
      }

      fetchFamilyMembers();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to resend invitation",
        variant: "destructive",
      });
    }
  };

  const handleRemoveFamilyMember = async (familyMemberIdOrEmail: string) => {
    try {
      // Check if it's a UUID (id) or email
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        familyMemberIdOrEmail
      );

      let error;
      if (isUUID) {
        // Delete by id (for registered members)
        const { error: deleteError } = await supabase
          .from("family_members")
          .delete()
          .eq("id", familyMemberIdOrEmail);
        error = deleteError;
      } else {
        // Delete by email (for pending members who haven't registered yet)
        // Also need to ensure we're only deleting from current parent's family
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("Not authenticated");
        }

        const { error: deleteError } = await supabase
          .from("family_members")
          .delete()
          .eq("email", familyMemberIdOrEmail.toLowerCase().trim())
          .eq("parent_id", user.id);
        error = deleteError;
      }

      if (error) throw error;
      toast({
        title: "Family member removed",
        description: "The family member has been removed from your family.",
      });
      fetchFamilyMembers();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to remove family member",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchChildren();
    fetchFamilyMembers();
  }, [fetchChildren, fetchFamilyMembers]);

  useEffect(() => {
    // Clear childSession if it exists - parents should not have childSession
    // This prevents routing issues where parent might be treated as child
    const childSession = localStorage.getItem("childSession");
    if (childSession) {
      console.log(
        "🧹 [PARENT DASHBOARD] Clearing childSession for parent user"
      );
      localStorage.removeItem("childSession");
    }

    // Run auth check and fetch children in parallel (non-blocking)
    // UI renders immediately, only children list shows loading state
    checkAuth().catch((error) => {
      console.error("Error checking auth:", error);
    });

    fetchChildren().catch((error) => {
      console.error("Error fetching children:", error);
    });
  }, [checkAuth, fetchChildren]);

  // Stable callbacks for incoming call subscription
  const handleIncomingCall = useCallback((call: IncomingCall) => {
    setIncomingCall(call);
    incomingCallRef.current = call;
  }, []);

  const handleCallCleared = useCallback(() => {
    setIncomingCall(null);
    incomingCallRef.current = null;
  }, []);

  // Use incoming call subscription hook
  useParentIncomingCallSubscription({
    onIncomingCall: handleIncomingCall,
    onCallCleared: handleCallCleared,
    currentIncomingCall: incomingCall,
    enabled: true,
  });

  // Keep ref in sync with state so we can check it in handlers
  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  // Stop notifications when incoming call is cleared
  useEffect(() => {
    if (!incomingCall && incomingCallRef.current) {
      stopIncomingCall(incomingCallRef.current.id);
    }
  }, [incomingCall, stopIncomingCall]);

  const handleChat = (childId: string) => {
    navigate(`/chat/${childId}`);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: "Login code copied to clipboard",
    });
  };

  // Helper function to get full login code (combine family_code + login_code)
  // login_code now stores only the child-specific part (e.g., "dog-42")
  // family_code is stored in parents table (e.g., "EGW6RZ")
  const getFullLoginCode = (child: Child): string => {
    if (familyCode) {
      // Always prepend family code since login_code is now child-specific only
      return `${familyCode}-${child.login_code}`;
    }
    // Fallback: return child code only if family code not available
    return child.login_code;
  };

  const handleCopyMagicLink = (child: Child) => {
    // Magic link includes full login code: familyCode-color/animal-number
    // For existing children, prepend family code if missing
    const fullCode = getFullLoginCode(child);
    const encodedCode = encodeURIComponent(fullCode);
    const magicLink = `${window.location.origin}/child/login?code=${encodedCode}`;
    navigator.clipboard.writeText(magicLink);
    toast({
      title: "Copied!",
      description: "Magic link copied to clipboard",
    });
  };

  const handlePrintCode = (child: Child) => {
    // Always show print view in a modal (works on all devices)
    setPrintViewChild(child);
  };

  const handlePrintFromModal = () => {
    if (!printViewChild) return;
    window.print();
  };

  const handleCall = async (childId: string) => {
    // Acknowledge missed calls from this child when clicking call button
    // This clears the badge immediately and syncs to all devices
    try {
      const { acknowledgeMissedCalls } = await import(
        "@/utils/acknowledgeMissedCalls"
      );
      await acknowledgeMissedCalls(childId, "child");
    } catch (error) {
      // Log error but don't block navigation
      console.error("Error acknowledging missed calls:", error);
    }
    navigate(`/call/${childId}`);
  };

  const handleClearAllNotifications = useCallback(async () => {
    if (!hasNotifications) return;

    try {
      const result = await clearAllNotifications(childIds);

      const messageText =
        result.clearedMessageCount > 0
          ? `${result.clearedMessageCount} unread message${
              result.clearedMessageCount !== 1 ? "s" : ""
            }`
          : "";
      const callText =
        result.clearedCallCount > 0
          ? `${result.clearedCallCount} missed call${
              result.clearedCallCount !== 1 ? "s" : ""
            }`
          : "";
      const description = [messageText, callText].filter(Boolean).join(" and ");

      toast({
        title: "Notifications cleared",
        description: description || "All notifications cleared.",
      });
    } catch (error) {
      console.error("Error clearing notifications:", error);
      toast({
        title: "Error",
        description: "Failed to clear some notifications. Please try again.",
        variant: "destructive",
      });
    }
  }, [hasNotifications, childIds, toast]);

  const handleDeleteChild = async () => {
    if (!childToDelete) return;

    try {
      const { error } = await supabase
        .from("children")
        .delete()
        .eq("id", childToDelete.id);

      if (error) throw error;

      toast({
        title: "Child removed",
        description: `${childToDelete.name} has been removed.`,
      });

      setChildToDelete(null);
      fetchChildren();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Error removing child",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleUpdateLoginCode = async () => {
    if (!childToEditCode) return;

    setIsUpdatingCode(true);
    try {
      // Generate a new unique login code using the database function
      const { data: newCode, error: rpcError } = await supabase.rpc(
        "generate_unique_login_code"
      );

      if (rpcError) throw rpcError;
      if (!newCode) throw new Error("Failed to generate new code");

      // Update the child's login code
      const { error: updateError } = await supabase
        .from("children")
        .update({ login_code: newCode })
        .eq("id", childToEditCode.id);

      if (updateError) throw updateError;

      toast({
        title: "Login code updated",
        description: `${childToEditCode.name}'s new login code is: ${newCode}`,
      });

      setChildToEditCode(null);
      fetchChildren();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Error updating login code",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingCode(false);
    }
  };

  const handleAnswerCall = () => {
    if (incomingCall) {
      // Stop incoming call notifications
      stopIncomingCall(incomingCall.id);
      // Mark that we're answering to prevent onOpenChange from declining
      isAnsweringRef.current = true;
      const childId = incomingCall.child_id;
      const callId = incomingCall.id;
      setIncomingCall(null);
      // CRITICAL: Include callId in URL so useVideoCall can detect it's an incoming call immediately
      navigate(`/call/${childId}?callId=${callId}`);
      // Reset the flag after navigation completes (longer delay to ensure navigation happened)
      setTimeout(() => {
        isAnsweringRef.current = false;
      }, 2000); // Increased from 500ms to 2000ms to ensure navigation completed
    }
  };

  const handleDeclineCall = async () => {
    if (incomingCall) {
      // Don't decline if we're in the process of answering
      if (isAnsweringRef.current) {
        return;
      }

      // Use shared endCall function for idempotent ending
      try {
        await endCallUtil({
          callId: incomingCall.id,
          by: "parent",
          reason: "declined",
        });
      } catch (error: unknown) {
        console.error("❌ [USER ACTION] Error declining call:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        toast({
          title: "Error",
          description: "Failed to decline call: " + errorMessage,
          variant: "destructive",
        });
      }
      // Stop incoming call notifications when declining
      stopIncomingCall(incomingCall.id);
      setIncomingCall(null);
    }
  };

  // No longer blocking render - show UI immediately with loading states for specific sections

  return (
    <div className="min-h-[100dvh] bg-background w-full overflow-x-hidden">
      <Navigation />
      <OnboardingTour role="parent" pageKey="parent_dashboard" />
      <HelpBubble role="parent" pageKey="parent_dashboard" />
      <div
        className="px-4 pb-4"
        style={{
          paddingTop: "calc(0.5rem + 64px + var(--safe-area-inset-top) * 0.15)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          <p className="text-sm text-muted-foreground mb-4">
            Welcome back{parentName ? `, ${parentName}` : ""}!
          </p>
        </div>
      </div>
      <div className="p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="mt-2 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                Manage your children and family members
              </p>
            </div>
            {isPWA() && (
              <Button
                variant="outline"
                onClick={() => navigate("/parent/upgrade")}
                className="flex-shrink-0"
                data-tour="parent-upgrade-plan"
              >
                Upgrade Plan
              </Button>
            )}
          </div>

          <FamilyCodeCard familyCode={familyCode} />

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="children">Children</TabsTrigger>
              <TabsTrigger value="family">Family</TabsTrigger>
              <TabsTrigger value="connections">Connections</TabsTrigger>
              <TabsTrigger value="safety">Safety</TabsTrigger>
              <TabsTrigger value="setup">Setup</TabsTrigger>
            </TabsList>

            <ChildrenTab
              children={children}
              loading={loading}
              canAddMoreChildren={canAddMoreChildren}
              allowedChildren={allowedChildren}
              hasNotifications={hasNotifications}
              totalUnreadMessages={totalUnreadMessages}
              totalMissedCalls={totalMissedCalls}
              isChildOnline={isChildOnline}
              getFullLoginCode={getFullLoginCode}
              onAddChild={() => setShowAddChild(true)}
              onClearAllNotifications={handleClearAllNotifications}
              onEditCode={setChildToEditCode}
              onCopyCode={handleCopyCode}
              onCopyMagicLink={handleCopyMagicLink}
              onPrintCode={handlePrintCode}
              onViewQR={(child) => setShowCodeDialog({ child })}
              onCall={handleCall}
              onChat={handleChat}
              onDelete={setChildToDelete}
            />

            <FamilyTab
              familyMembers={familyMembers}
              loading={familyMembersLoading}
              onAddFamilyMember={() => setShowAddFamilyMember(true)}
              onSuspend={handleSuspendFamilyMember}
              onActivate={handleActivateFamilyMember}
              onResendInvitation={handleResendInvitation}
              onRemove={handleRemoveFamilyMember}
            />

            <ChildConnectionsTab children={children} />

            <SafetyReportsTab />

            <FamilySetupTab />
          </Tabs>
        </div>

        <AddChildDialog
          open={showAddChild}
          onOpenChange={setShowAddChild}
          onChildAdded={fetchChildren}
        />

        <AddFamilyMemberDialog
          open={showAddFamilyMember}
          onOpenChange={setShowAddFamilyMember}
          onFamilyMemberAdded={fetchFamilyMembers}
        />

        {/* Code Management Dialogs */}
        <CodeManagementDialogs
          showCodeDialog={showCodeDialog}
          onCloseCodeDialog={() => setShowCodeDialog(null)}
          getFullLoginCode={getFullLoginCode}
          onCopyCode={handleCopyCode}
          onCopyMagicLink={handleCopyMagicLink}
          onPrintCode={handlePrintCode}
          childToEditCode={childToEditCode}
          onCloseEditCode={() => setChildToEditCode(null)}
          onUpdateLoginCode={handleUpdateLoginCode}
          isUpdatingCode={isUpdatingCode}
          childToDelete={childToDelete}
          onCloseDelete={() => setChildToDelete(null)}
          onDeleteChild={handleDeleteChild}
          printViewChild={printViewChild}
          onClosePrintView={() => setPrintViewChild(null)}
          onPrintFromModal={handlePrintFromModal}
        />

        {/* Incoming Call Dialog */}
        <IncomingCallDialog
          incomingCall={incomingCall}
          isAnsweringRef={isAnsweringRef}
          onAnswer={handleAnswerCall}
          onDecline={handleDeclineCall}
          onOpenChange={() => {}}
        />
      </div>
    </div>
  );
};

export default ParentDashboard;

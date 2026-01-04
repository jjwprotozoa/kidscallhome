// src/pages/FamilyMemberDashboard.tsx
// Family member dashboard - simplified version showing children they can call

import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { StatusIndicator } from "@/features/presence/StatusIndicator";
import { useChildrenPresence } from "@/features/presence/useChildrenPresence";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUnreadBadgeForChild } from "@/stores/badgeStore";
import { setUserStartedCall } from "@/utils/userInteraction";
import { MessageSquare, Phone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Child {
  id: string;
  name: string;
  avatar_color: string;
}

interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  parent_id: string;
  status: string;
}

// Component for child card with call and message buttons
const FamilyMemberChildCard = ({
  child,
  onCall,
  onChat,
  isOnline,
}: {
  child: Child;
  onCall: (childId: string) => void;
  onChat: (childId: string) => void;
  isOnline: boolean;
}) => {
  const unreadMessageCount = useUnreadBadgeForChild(child.id);

  return (
    <Card
      className={`p-4 sm:p-6 hover:shadow-lg transition-all ${
        isOnline
          ? "shadow-[0_0_12px_-3px_rgba(34,197,94,0.35)] border-green-500/20"
          : ""
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: Avatar + Name + Status */}
        <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white font-bold text-xl sm:text-2xl flex-shrink-0"
            style={{ backgroundColor: child.avatar_color || "#6366f1" }}
          >
            {child.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl sm:text-2xl font-semibold">
                {child.name}
              </h3>
              <StatusIndicator
                isOnline={isOnline}
                size="md"
                showPulse={isOnline}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isOnline
                ? `${child.name} is online`
                : `${child.name} is offline`}
            </p>
          </div>
        </div>
        {/* Right: Call + Message buttons */}
        <div className="flex gap-2 w-full sm:w-auto" data-tour="family-member-actions">
          <Button
            onClick={() => onCall(child.id)}
            variant="outline"
            className="flex-1 sm:flex-initial"
            data-tour="family-member-call"
          >
            <Phone className="mr-2 h-4 w-4" />
            Call
          </Button>
          <Button
            onClick={() => onChat(child.id)}
            className="flex-1 sm:flex-initial relative"
            data-tour="family-member-message"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Message
            {/* CLS: Reserve space for badge to prevent layout shift */}
            <span
              className={`absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
                unreadMessageCount === 0 ? "invisible" : ""
              }`}
            >
              {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
            </span>
          </Button>
        </div>
      </div>
    </Card>
  );
};

const FamilyMemberDashboard = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [familyMember, setFamilyMember] = useState<FamilyMember | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Memoize childIds to prevent infinite re-renders in useChildrenPresence
  const childIds = useMemo(() => children.map((child) => child.id), [children]);
  const { isChildOnline } = useChildrenPresence({
    childIds,
    enabled: childIds.length > 0,
  });

  useEffect(() => {
    checkAuthAndLoadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      // First check session to ensure authentication is established
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        navigate("/family-member/auth");
        return;
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        navigate("/family-member/auth");
        return;
      }

      // Get family member record
      // Note: Using maybeSingle instead of single to handle cases where RLS might block
      console.warn("🔍 [FAMILY MEMBER DASHBOARD] Querying family_members", {
        userId: user.id,
        email: user.email,
      });

      let memberData: FamilyMember | null = null;

      const { data: fmData, error: memberError } = await supabase
        .from("family_members")
        .select("id, name, relationship, parent_id, status")
        .eq("id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (memberError) {
        console.error(
          "❌ [FAMILY MEMBER DASHBOARD] Error fetching family member:",
          {
            error: memberError,
            code: memberError.code,
            message: memberError.message,
            userId: user.id,
          }
        );

        // Handle 406 errors specifically (RLS or format issues)
        if (
          memberError.code === "PGRST116" ||
          memberError.message?.includes("406")
        ) {
          toast({
            title: "Access denied",
            description:
              "Unable to access your account. Please contact support if this persists.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Account not found",
            description: "Your family member account could not be found.",
            variant: "destructive",
          });
        }
        navigate("/family-member/auth");
        return;
      }

      if (fmData) {
        console.warn(
          "✅ [FAMILY MEMBER DASHBOARD] Found family_members record",
          {
            memberData: fmData,
          }
        );
        memberData = fmData;
      } else {
        console.warn(
          "⚠️ [FAMILY MEMBER DASHBOARD] No family_members record found, trying adult_profiles fallback",
          {
            userId: user.id,
            email: user.email,
          }
        );

        // Fallback: Try to get data from adult_profiles
        const { data: adultProfile, error: apError } = await supabase
          .from("adult_profiles" as never)
          .select("user_id, family_id, role, name, email, relationship_type")
          .eq("user_id", user.id)
          .eq("role", "family_member")
          .maybeSingle();

        if (adultProfile && !apError) {
          console.warn(
            "✅ [FAMILY MEMBER DASHBOARD] Found adult_profiles, using as fallback",
            {
              adultProfile,
            }
          );

          // Create a familyMember object from adult_profiles
          // We need to get parent_id from family_id
          const ap = adultProfile as {
            user_id: string;
            family_id: string;
            role: string;
            name?: string;
            email?: string;
            relationship_type?: string;
          };
          const parentId = ap.family_id;

          memberData = {
            id: user.id,
            name: ap.name || "Family Member",
            relationship: ap.relationship_type || "family_member",
            parent_id: parentId,
            status: "active",
          };
        } else {
          console.error(
            "❌ [FAMILY MEMBER DASHBOARD] No adult_profiles found either",
            {
              apError,
              userId: user.id,
            }
          );

          toast({
            title: "Account not found",
            description: "Your family member account could not be found.",
            variant: "destructive",
          });
          navigate("/family-member/auth");
          return;
        }
      }

      // If we still don't have memberData, something went wrong
      if (!memberData) {
        console.error(
          "❌ [FAMILY MEMBER DASHBOARD] memberData is still null after all checks"
        );
        toast({
          title: "Account not found",
          description: "Your family member account could not be found.",
          variant: "destructive",
        });
        navigate("/family-member/auth");
        return;
      }

      // Set the family member state
      setFamilyMember(memberData);

      if (memberData.status !== "active") {
        toast({
          title: "Account not active",
          description:
            "Your account has been suspended. Please contact the family parent.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/family-member/auth");
        return;
      }

      setFamilyMember(memberData);

      // Get children in the same family
      // Use child_profiles table with family_id (matches family_members.parent_id)
      // Type assertion needed because child_profiles may not be in generated types yet
      const { data: childrenData, error: childrenError } = await supabase
        .from("child_profiles" as never)
        .select("id, name, avatar_color")
        .eq("family_id", memberData.parent_id)
        .order("name");

      if (childrenError) {
        throw childrenError;
      }

      // Type assertion for the result since child_profiles is not in generated types
      setChildren((childrenData as Child[]) || []);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCall = (childId: string) => {
    // CRITICAL: User clicked Call - enable audio for the call
    setUserStartedCall();
    navigate(`/family-member/call/${childId}`);
  };

  const handleChat = async (childId: string) => {
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "Not authenticated. Please log in again.",
          variant: "destructive",
        });
        return;
      }

      // Use familyMember state if available, otherwise fetch with fallback
      const memberData = familyMember;
      let parentId: string | null = null;

      if (memberData) {
        parentId = memberData.parent_id;
      } else {
        // Fallback: Try to get from family_members first
        const { data: fmData } = await supabase
          .from("family_members")
          .select("parent_id")
          .eq("id", user.id)
          .eq("status", "active")
          .maybeSingle();

        if (fmData) {
          parentId = fmData.parent_id;
        } else {
          // Fallback: Try to get from adult_profiles
          const { data: adultProfile } = await supabase
            .from("adult_profiles" as never)
            .select("family_id")
            .eq("user_id", user.id)
            .eq("role", "family_member")
            .maybeSingle();

          if (adultProfile) {
            const ap = adultProfile as { family_id: string };
            parentId = ap.family_id;
          }
        }
      }

      if (!parentId) {
        toast({
          title: "Error",
          description: "Could not find family member profile.",
          variant: "destructive",
        });
        return;
      }

      // Resolve profile IDs
      const { getCurrentAdultProfileId, getChildProfileId } = await import(
        "@/utils/conversations"
      );
      const childProfileId = await getChildProfileId(childId);
      const adultProfileId = await getCurrentAdultProfileId(
        user.id,
        parentId,
        "family_member"
      );

      if (!childProfileId || !adultProfileId) {
        toast({
          title: "Error",
          description: "Could not resolve profile IDs.",
          variant: "destructive",
        });
        return;
      }

      // Get or create conversation
      const { getOrCreateConversation } = await import("@/utils/conversations");
      const conversationId = await getOrCreateConversation(
        adultProfileId,
        "family_member",
        childProfileId
      );

      if (conversationId) {
        navigate(`/chat/${childId}?conversation=${conversationId}`);
      } else {
        toast({
          title: "Error",
          description: "Could not create conversation.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error in handleChat:", error);
      toast({
        title: "Error",
        description: "Failed to open chat.",
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Card className="p-8">
          <p>Loading...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 w-full overflow-x-hidden">
      <Navigation />
      <OnboardingTour role="family_member" pageKey="family_member_dashboard" />
      <HelpBubble role="family_member" pageKey="family_member_dashboard" />
      <div
        className="px-4 pb-4"
        style={{
          paddingTop: "calc(0.5rem + 64px + var(--safe-area-inset-top) * 0.15)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          <p className="text-sm text-muted-foreground mb-4">
            Welcome{familyMember ? `, ${familyMember.name}` : ""}!
          </p>
        </div>
      </div>
      <div className="p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="mt-2" data-tour="family-member-welcome">
            <h1 className="text-3xl font-bold">Family Children</h1>
            <p className="text-muted-foreground mt-2">
              Connect with the children in your family
            </p>
          </div>

          {children.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">
                No children found in this family.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {children.map((child, index) => (
                <div
                  key={child.id}
                  data-tour={index === 0 ? "family-member-child-card" : undefined}
                >
                  <FamilyMemberChildCard
                    child={child}
                    onCall={handleCall}
                    onChat={handleChat}
                    isOnline={isChildOnline(child.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FamilyMemberDashboard;

// src/pages/ParentChildrenList.tsx
// Parent: Child List / Profile Screen
// CLS: Loading skeleton matches final layout structure. Badges reserve space with invisible class when count is 0.

import AddChildDialog from "@/components/AddChildDialog";
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
import { MessageCircle, Phone, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Child {
  id: string;
  name: string;
  login_code: string;
  avatar_color: string;
}

// Component for child card with call and message buttons
const ChildCard = ({
  child,
  onCall,
  onChat,
  isOnline,
  "data-tour": dataTour,
}: {
  child: Child;
  onCall: (childId: string) => void;
  onChat: (childId: string) => void;
  isOnline: boolean;
  "data-tour"?: string;
}) => {
  const unreadMessageCount = useUnreadBadgeForChild(child.id);

  return (
    <Card className="p-6" data-tour={dataTour}>
      <div className="flex items-start justify-between flex-col sm:flex-row gap-4">
        <div className="flex items-start space-x-4 flex-1">
          {/* CLS: Use aspect-square to ensure consistent avatar sizing */}
          <div
            className="aspect-square w-12 rounded-full flex items-center justify-center text-white font-bold text-lg leading-none select-none flex-shrink-0"
            style={{ backgroundColor: child.avatar_color || "#6366f1" }}
          >
            <span className="leading-none">
              {child.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold">{child.name}</h3>
              <StatusIndicator
                isOnline={isOnline}
                size="md"
                showPulse={isOnline}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Code: {child.login_code}
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            onClick={() => onCall(child.id)}
            variant="secondary"
            className="flex-1 sm:flex-none relative"
            data-tour={dataTour ? "parent-children-list-call" : undefined}
          >
            <Phone className="mr-2 h-4 w-4" />
            Call
          </Button>
          <Button
            onClick={() => onChat(child.id)}
            className="flex-1 sm:flex-none relative bg-chat-accent text-chat-accent-foreground hover:bg-chat-accent/90"
            data-tour={dataTour ? "parent-children-list-message" : undefined}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Message
            {/* CLS: Reserve space for badge to prevent layout shift */}
            <span
              className={`ml-2 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
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

const ParentChildrenList = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Track children's online presence (real-time via Supabase Realtime)
  const childIds = useMemo(() => children.map((child) => child.id), [children]);
  const { isChildOnline } = useChildrenPresence({
    childIds,
    enabled: children.length > 0,
  });

  const fetchChildren = useCallback(async () => {
    try {
      // Get authenticated user ID to filter children (defense in depth - RLS should also enforce this)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      // Debug logging in development
      if (import.meta.env.DEV) {
        console.warn("🔍 [PARENT CHILDREN] Fetching children for parent:", {
          userId: user.id,
          email: user.email,
        });
      }

      const { data, error } = await supabase
        .from("children")
        .select("*")
        .eq("parent_id", user.id) // Explicitly filter by parent_id (RLS should also enforce this)
        .order("created_at", { ascending: false });

      if (error) {
        // Enhanced error logging
        if (import.meta.env.DEV) {
          console.error("❌ [PARENT CHILDREN] Query error:", {
            error,
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            userId: user.id,
          });
        }
        throw error;
      }

      // Debug logging in development
      if (import.meta.env.DEV) {
        console.warn("✅ [PARENT CHILDREN] Children fetched:", {
          count: data?.length || 0,
          children: data?.map((c) => ({ id: c.id, name: c.name })),
        });
      }

      setChildren(data || []);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      // Enhanced error details for RLS issues
      if (error instanceof Error && error.message.includes("PGRST116")) {
        toast({
          title: "Access Denied",
          description:
            "RLS policy blocked access. Please check your authentication.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error loading children",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/parent/auth");
        return;
      }

      // Check if user is a family member and redirect them
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { getUserRole } = await import("@/utils/userRole");
        const userRole = await getUserRole(user.id);
        if (userRole === "family_member") {
          navigate("/family-member", { replace: true });
          return;
        }
      }

      fetchChildren();
    };
    checkAuth();
  }, [navigate, fetchChildren]);

  const handleCall = (childId: string) => {
    navigate(`/parent/call/${childId}`);
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

      // Resolve profile IDs
      const { getCurrentAdultProfileId, getChildProfileId } = await import(
        "@/utils/conversations"
      );
      const childProfileId = await getChildProfileId(childId);
      const adultProfileId = await getCurrentAdultProfileId(
        user.id,
        user.id,
        "parent"
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
        "parent",
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

  // CLS: Reserve space for loading state to match final layout structure
  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navigation />
        <div
          className="p-4"
          style={{
            paddingTop: "calc(1rem + 64px + var(--safe-area-inset-top) * 0.15)",
          }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 mt-8">
              <div className="h-9 w-48 bg-muted rounded animate-pulse mb-2" />
              <div className="h-6 w-64 bg-muted rounded animate-pulse" />
            </div>
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-6">
                  <div className="flex items-start justify-between flex-col sm:flex-row gap-4">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="w-12 h-12 rounded-full bg-muted animate-pulse flex-shrink-0" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
                        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <div className="h-10 w-20 bg-muted rounded animate-pulse flex-1 sm:flex-none" />
                      <div className="h-10 w-24 bg-muted rounded animate-pulse flex-1 sm:flex-none" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <Navigation />
      <OnboardingTour role="parent" pageKey="parent_children_list" />
      <HelpBubble role="parent" pageKey="parent_children_list" />
      <div
        className="p-4"
        style={{
          paddingTop: "calc(1rem + 64px + var(--safe-area-inset-top) * 0.15)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 mt-8 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold">Your Children</h1>
              <p className="text-muted-foreground mt-2">
                View and call your children
              </p>
            </div>
            <Button
              onClick={() => setShowAddChild(true)}
              className="flex-shrink-0"
              size="lg"
              data-tour="parent-children-list-add-child"
            >
              <Plus className="mr-2 h-5 w-5" />
              Add Child
            </Button>
          </div>

          {children.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground mb-4 text-lg">
                No children added yet.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Click "Add Child" above to create a profile and login code for
                your child.
              </p>
              <Button
                onClick={() => setShowAddChild(true)}
                size="lg"
                className="mx-auto"
              >
                <Plus className="mr-2 h-5 w-5" />
                Add Your First Child
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {children.map((child, index) => (
                <ChildCard
                  key={child.id}
                  child={child}
                  onCall={handleCall}
                  onChat={handleChat}
                  isOnline={isChildOnline(child.id)}
                  data-tour={
                    index === 0 ? "parent-children-list-card" : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <AddChildDialog
        open={showAddChild}
        onOpenChange={setShowAddChild}
        onChildAdded={fetchChildren}
      />
    </div>
  );
};

export default ParentChildrenList;

// src/pages/ParentChildrenList.tsx
// Parent: Child List / Profile Screen
// CLS: Loading skeleton matches final layout structure. Badges reserve space with invisible class when count is 0.

import AddChildDialog from "@/components/AddChildDialog";
import { ChildActionsSheet } from "@/components/ChildActionsSheet";
import { ParentLayout } from "@/components/layout/ParentLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CodeManagementDialogs } from "@/components/CodeManagementDialogs";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { StatusIndicator } from "@/features/presence/StatusIndicator";
import { useChildrenPresence } from "@/features/presence/useChildrenPresence";
import { useParentData } from "@/hooks/useParentData";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUnreadBadgeForChild } from "@/stores/badgeStore";
import { MessageCircle, MoreVertical, Phone, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCodeHandlers } from "@/pages/ParentDashboard/useCodeHandlers";
import { useChildHandlers } from "@/pages/ParentDashboard/useChildHandlers";
import { Child } from "@/pages/ParentDashboard/types";
import { getPlatform } from "@/utils/platformDetection";

// Compact child card component - 1-row contact-list style
const ChildCard = ({
  child,
  onCall,
  onChat,
  onMore,
  isOnline,
  fullLoginCode,
  "data-tour": dataTour,
}: {
  child: Child;
  onCall: (childId: string) => void;
  onChat: (childId: string) => void;
  onMore: () => void;
  isOnline: boolean;
  fullLoginCode: string;
  "data-tour"?: string;
}) => {
  const unreadMessageCount = useUnreadBadgeForChild(child.id);

  return (
    <Card 
      className={`p-4 transition-shadow duration-300 ${
        isOnline 
          ? "shadow-[0_0_12px_-3px_rgba(34,197,94,0.35)] border-green-500/20" 
          : ""
      }`}
      data-tour={dataTour}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Avatar + Name + Status */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="aspect-square w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base leading-none select-none flex-shrink-0"
            style={{ backgroundColor: child.avatar_color || "#6366f1" }}
          >
            <span className="leading-none">
              {child.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h3 className="text-lg font-semibold truncate">{child.name}</h3>
            <StatusIndicator
              isOnline={isOnline}
              size="sm"
              showPulse={isOnline}
            />
          </div>
        </div>
        {/* Right: Call, Message, More buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            onClick={() => onCall(child.id)}
            variant="secondary"
            size="sm"
            className="relative"
            data-tour={dataTour ? "parent-children-list-call" : undefined}
          >
            <Phone className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => onChat(child.id)}
            size="sm"
            className="relative bg-chat-accent text-chat-accent-foreground hover:bg-chat-accent/90"
            data-tour={dataTour ? "parent-children-list-message" : undefined}
          >
            <MessageCircle className="h-4 w-4" />
            {/* CLS: Reserve space for badge to prevent layout shift */}
            <span
              className={`absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
                unreadMessageCount === 0 ? "invisible" : ""
              }`}
            >
              {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
            </span>
          </Button>
          <Button
            onClick={onMore}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
          >
            <MoreVertical className="h-4 w-4" />
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
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [showActionsSheet, setShowActionsSheet] = useState(false);
  const [showCodeDialog, setShowCodeDialog] = useState<{ child: Child } | null>(null);
  const [printViewChild, setPrintViewChild] = useState<Child | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { familyCode } = useParentData();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Track children's online presence (real-time via Supabase Realtime)
  const childIds = useMemo(() => children.map((child) => child.id), [children]);
  const { isChildOnline } = useChildrenPresence({
    childIds,
    enabled: children.length > 0,
  });

  const fetchChildren = useCallback(async (retryCount = 0) => {
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
          retryCount,
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

  // Enhanced fetchChildren with retry for mobile platforms
  // On mobile (iOS/Android), database replication might have a slight delay
  const fetchChildrenWithRetry = useCallback(async () => {
    const platform = getPlatform();
    const isMobile = platform === "ios" || platform === "android";
    
    // On mobile, add a small delay and retry once to handle replication lag
    if (isMobile) {
      // First attempt with a small delay
      await new Promise(resolve => setTimeout(resolve, 300));
      await fetchChildren(0);
      
      // Retry once after a short delay if we still don't see the new child
      // This is handled by the real-time subscription, but this ensures immediate visibility
      setTimeout(async () => {
        await fetchChildren(1);
      }, 1000);
    } else {
      await fetchChildren(0);
    }
  }, [fetchChildren]);

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

        // Set up real-time subscription for children table changes
        // This ensures the list updates automatically when children are added/updated/deleted
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
        }

        channelRef.current = supabase
          .channel(`parent-children-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "children",
              filter: `parent_id=eq.${user.id}`,
            },
            (payload) => {
              if (import.meta.env.DEV) {
                console.warn("✅ [PARENT CHILDREN] New child added via realtime:", {
                  childId: payload.new.id,
                  childName: payload.new.name,
                });
              }
              // Refresh the list when a new child is added
              fetchChildren(0);
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "children",
              filter: `parent_id=eq.${user.id}`,
            },
            () => {
              // Refresh the list when a child is updated
              fetchChildren(0);
            }
          )
          .on(
            "postgres_changes",
            {
              event: "DELETE",
              schema: "public",
              table: "children",
              filter: `parent_id=eq.${user.id}`,
            },
            () => {
              // Refresh the list when a child is deleted
              fetchChildren(0);
            }
          )
          .subscribe((status, err) => {
            if (import.meta.env.DEV) {
              if (status === "SUBSCRIBED") {
                console.warn("✅ [PARENT CHILDREN] Realtime subscription active");
              } else if (err) {
                console.error("❌ [PARENT CHILDREN] Realtime subscription error:", err);
              }
            }
          });
      }

      fetchChildren();
    };
    checkAuth();

    // Cleanup subscription on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [navigate, fetchChildren]);

  // Optimistic update function for child login code
  const updateChildLoginCode = useCallback((childId: string, newCode: string) => {
    setChildren(prevChildren => 
      prevChildren.map(child => 
        child.id === childId 
          ? { ...child, login_code: newCode }
          : child
      )
    );
  }, []);

  // Code handlers (reused from ParentDashboard)
  const {
    getFullLoginCode,
    handleCopyCode,
    handleCopyMagicLink,
  } = useCodeHandlers(familyCode, updateChildLoginCode);

  // Child handlers (reused from ParentDashboard)
  const { handleDelete: handleDeleteChild, handleCall } = useChildHandlers(fetchChildren);

  const handleMore = (child: Child) => {
    setSelectedChild(child);
    setShowActionsSheet(true);
  };

  const handleViewQR = (child: Child) => {
    setShowCodeDialog({ child });
  };

  const handlePrintCode = (child: Child) => {
    setPrintViewChild(child);
  };

  const handleDelete = async (child: Child) => {
    await handleDeleteChild(child);
    setSelectedChild(null);
    setShowActionsSheet(false);
  };

  const handleCallWrapper = (childId: string) => {
    handleCall(childId);
  };

  // Keep original handleChat logic for conversation resolution
  const handleChatWrapper = async (childId: string) => {
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
      <ParentLayout>
        <div className="p-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 mt-8">
              <div className="h-9 w-48 bg-muted rounded animate-pulse mb-2" />
              <div className="h-6 w-64 bg-muted rounded animate-pulse" />
            </div>
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
                      <div className="h-5 w-32 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <div className="h-9 w-9 bg-muted rounded animate-pulse" />
                      <div className="h-9 w-9 bg-muted rounded animate-pulse" />
                      <div className="h-9 w-9 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <OnboardingTour role="parent" pageKey="parent_children_list" />
      <HelpBubble role="parent" pageKey="parent_children_list" />
        <div className="p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="mt-2 flex items-center justify-between flex-wrap gap-4">
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
            <div className="grid gap-3">
              {children.map((child, index) => (
                <ChildCard
                  key={child.id}
                  child={child}
                  onCall={handleCallWrapper}
                  onChat={handleChatWrapper}
                  onMore={() => handleMore(child)}
                  isOnline={isChildOnline(child.id)}
                  fullLoginCode={getFullLoginCode(child)}
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
        onChildAdded={fetchChildrenWithRetry}
      />

      {selectedChild && (
        <ChildActionsSheet
          child={selectedChild}
          open={showActionsSheet}
          onOpenChange={setShowActionsSheet}
          fullLoginCode={getFullLoginCode(selectedChild)}
          onCopyCode={handleCopyCode}
          onCopyMagicLink={handleCopyMagicLink}
          onViewQR={handleViewQR}
          onPrintCode={handlePrintCode}
          onDelete={handleDelete}
        />
      )}

      <CodeManagementDialogs
        showCodeDialog={showCodeDialog}
        onCloseCodeDialog={() => setShowCodeDialog(null)}
        getFullLoginCode={getFullLoginCode}
        onCopyCode={handleCopyCode}
        onCopyMagicLink={handleCopyMagicLink}
        onPrintCode={handlePrintCode}
        childToEditCode={null}
        onCloseEditCode={() => {}}
        onUpdateLoginCode={() => {}}
        isUpdatingCode={false}
        childToDelete={null}
        onCloseDelete={() => {}}
        onDeleteChild={() => {}}
        printViewChild={printViewChild}
        onClosePrintView={() => setPrintViewChild(null)}
        onPrintFromModal={() => window.print()}
      />
    </ParentLayout>
  );
};

export default ParentChildrenList;

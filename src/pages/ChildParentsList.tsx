// src/pages/ChildParentsList.tsx
// Child: Parent List / Profile Screen
// CLS: Loading skeleton matches final layout structure to prevent height changes on data load.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Phone } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useParentPresence } from "@/features/presence/useParentPresence";
import { StatusIndicator } from "@/features/presence/StatusIndicator";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { HelpBubble } from "@/features/onboarding/HelpBubble";

interface ChildSession {
  id: string;
  name: string;
  avatar_color: string;
  parent_id: string;
}

interface Parent {
  id: string;
  name: string;
}

const ChildParentsList = () => {
  const [child, setChild] = useState<ChildSession | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Track parent's online presence
  const { isOnline: isParentOnline } = useParentPresence({
    parentId: parent?.id || "",
    enabled: !!parent?.id,
  });

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
        console.error("❌ [ChildParentsList] Error parsing session data:", error);
        navigate("/child/login");
        return;
      }
      
      setChild(childData);

      // If parent_id is not in session, fetch it from database
      let parentId = childData.parent_id;
      
      if (!parentId && childData.id) {
        try {
          const { data: childRecord, error: childError } = await supabase
            .from("children")
            .select("parent_id")
            .eq("id", childData.id)
            .single();

          if (childError) {
            console.error("❌ [ChildParentsList] Error fetching child record:", childError);
            throw childError;
          }
          
          if (childRecord?.parent_id) {
            parentId = childRecord.parent_id;
          }
        } catch (error) {
          console.error("❌ [ChildParentsList] Error fetching child's parent_id:", error);
        }
      }

      if (parentId) {
        await fetchParent(parentId);
      } else {
        toast({
          title: "Error",
          description: "Could not find parent information",
          variant: "destructive",
        });
        setLoading(false);
      }
    };

    loadData();
  }, [navigate, toast]);

  const fetchParent = async (parentId: string) => {
    try {
      if (!parentId || parentId === "undefined" || parentId === "null") {
        throw new Error("Invalid parent ID");
      }

      // Try using the function first (if it exists) - this bypasses RLS
      try {
        const { data: functionData, error: functionError } = await supabase
          .rpc('get_parent_name_for_child', { parent_uuid: parentId });
        
        if (functionData && (Array.isArray(functionData) ? functionData.length > 0 : true)) {
          const parentData = Array.isArray(functionData) ? functionData[0] : functionData;
          setParent(parentData);
          setLoading(false);
          return;
        }
        
        if (functionError && import.meta.env.DEV) {
          console.error("❌ [ChildParentsList] Function error:", functionError);
        }
      } catch (functionErr) {
        if (import.meta.env.DEV) {
          console.error("❌ [ChildParentsList] Function call exception:", functionErr);
        }
      }

      const { data, error } = await supabase
        .from("parents")
        .select("id, name")
        .eq("id", parentId)
        .maybeSingle();

      if (error) {
        console.error("❌ [ChildParentsList] Supabase error:", error);
        throw error;
      }
      
      if (!data) {
        throw new Error("Parent not found. The RLS policy may be blocking access.");
      }
      
      setParent(data);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("❌ [ChildParentsList] Error in fetchParent:", errorMessage);
      toast({
        title: "Error loading parent",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectParent = (parentId: string) => {
    // Store selected parent in localStorage for the dashboard to use
    localStorage.setItem("selectedParentId", parentId);
    // Navigate to dashboard which will show call/message buttons for this parent
    navigate("/child/dashboard");
  };

  // CLS: Reserve space for loading state to match final layout structure
  if (loading || !child) {
    return (
      <div className="min-h-[100dvh] bg-background w-full overflow-x-hidden">
        <Navigation />
        <div className="p-4 sm:p-6" style={{ paddingTop: 'calc(1rem + 64px + var(--safe-area-inset-top) * 0.15)' }}>
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
      <div className="p-4 sm:p-6" style={{ paddingTop: 'calc(1rem + 64px + var(--safe-area-inset-top) * 0.15)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 sm:mb-8 mt-4 sm:mt-6">
            <h1 className="text-2xl sm:text-3xl font-bold">Select Parent</h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Choose a parent to contact
            </p>
          </div>

          {parent ? (
            <Card
              data-tour="child-parents-list-card" 
              className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-all"
              onClick={() => handleSelectParent(parent.id)}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xl sm:text-2xl flex-shrink-0">
                    {parent.name?.charAt(0).toUpperCase() || "P"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl sm:text-2xl font-semibold truncate">
                        {parent.name || "Parent"}
                      </h3>
                      <StatusIndicator
                        isOnline={isParentOnline}
                        size="md"
                        showPulse={isParentOnline}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isParentOnline ? "Online - Tap to call or message" : "Offline - Tap to call or message"}
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectParent(parent.id);
                  }}
                  className="w-full sm:w-auto flex-shrink-0"
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Contact
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-6">
              <p className="text-muted-foreground">No parent found.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChildParentsList;


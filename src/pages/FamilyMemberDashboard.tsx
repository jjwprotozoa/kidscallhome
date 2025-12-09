// src/pages/FamilyMemberDashboard.tsx
// Family member dashboard - simplified version showing children they can call

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import { StatusIndicator } from "@/features/presence/StatusIndicator";
import { useChildrenPresence } from "@/features/presence/useChildrenPresence";

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
}

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
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        navigate("/family-member/auth");
        return;
      }

      // Get family member record
      const { data: memberData, error: memberError } = await supabase
        .from("family_members")
        .select("id, name, relationship, parent_id, status")
        .eq("id", user.id)
        .single();

      if (memberError || !memberData) {
        toast({
          title: "Account not found",
          description: "Your family member account could not be found.",
          variant: "destructive",
        });
        navigate("/family-member/auth");
        return;
      }

      if (memberData.status !== "active") {
        toast({
          title: "Account not active",
          description: "Your account has been suspended. Please contact the family parent.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/family-member/auth");
        return;
      }

      setFamilyMember(memberData);

      // Get children in the same family
      const { data: childrenData, error: childrenError } = await supabase
        .from("children")
        .select("id, name, avatar_color")
        .eq("parent_id", memberData.parent_id)
        .order("name");

      if (childrenError) {
        throw childrenError;
      }

      setChildren(childrenData || []);
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
    navigate(`/family-member/call/${childId}`);
  };

  const handleChat = async (childId: string) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "Not authenticated. Please log in again.",
          variant: "destructive",
        });
        return;
      }
      
      // Get family member data to get parent_id (family_id)
      const { data: familyMember } = await supabase
        .from("family_members")
        .select("parent_id")
        .eq("id", user.id)
        .eq("status", "active")
        .single();
      
      if (!familyMember) {
        toast({
          title: "Error",
          description: "Could not find family member profile.",
          variant: "destructive",
        });
        return;
      }
      
      // Resolve profile IDs
      const { getCurrentAdultProfileId, getChildProfileId } = await import("@/utils/conversations");
      const childProfileId = await getChildProfileId(childId);
      const adultProfileId = await getCurrentAdultProfileId(user.id, familyMember.parent_id, "family_member");
      
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
      const conversationId = await getOrCreateConversation(adultProfileId, "family_member", childProfileId);
      
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
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Card className="p-8">
          <p>Loading...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background w-full overflow-x-hidden">
      <Navigation />
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
          <div className="mt-2">
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
            <div className="grid gap-4 md:grid-cols-2">
              {children.map((child) => (
                <Card key={child.id} className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar
                      className="h-16 w-16"
                      style={{ backgroundColor: child.avatar_color }}
                    >
                      <AvatarFallback className="text-white text-xl font-bold">
                        {getInitials(child.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold">{child.name}</h3>
                        <StatusIndicator
                          isOnline={isChildOnline(child.id)}
                          size="sm"
                          showPulse={isChildOnline(child.id)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleCall(child.id)}
                      className="flex-1"
                      variant="default"
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      Call
                    </Button>
                    <Button
                      onClick={() => handleChat(child.id)}
                      className="flex-1"
                      variant="outline"
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Message
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FamilyMemberDashboard;


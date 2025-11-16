// src/pages/ParentChildrenList.tsx
// Parent: Child List / Profile Screen
// CLS: Loading skeleton matches final layout structure. Badges reserve space with invisible class when count is 0.

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Phone, MessageCircle } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useUnreadBadgeForChild } from "@/stores/badgeStore";
import { StatusIndicator } from "@/features/presence/StatusIndicator";
import { useChildrenPresence } from "@/features/presence/useChildrenPresence";

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
  isOnline
}: { 
  child: Child; 
  onCall: (childId: string) => void; 
  onChat: (childId: string) => void;
  isOnline: boolean;
}) => {
  const unreadMessageCount = useUnreadBadgeForChild(child.id);
  
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between flex-col sm:flex-row gap-4">
        <div className="flex items-start space-x-4 flex-1">
          {/* CLS: Use aspect-square to ensure consistent avatar sizing */}
          <div
            className="aspect-square w-12 rounded-full flex items-center justify-center text-white font-bold text-lg leading-none select-none flex-shrink-0"
            style={{ backgroundColor: child.avatar_color || "#6366f1" }}
          >
            <span className="leading-none">{child.name.charAt(0).toUpperCase()}</span>
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
          >
            <Phone className="mr-2 h-4 w-4" />
            Call
          </Button>
          <Button 
            onClick={() => onChat(child.id)}
            className="flex-1 sm:flex-none relative"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Message
            {/* CLS: Reserve space for badge to prevent layout shift */}
            <span className={`ml-2 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${unreadMessageCount === 0 ? 'invisible' : ''}`}>
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
  const navigate = useNavigate();
  const { toast } = useToast();

  // Track children's online presence (real-time via Supabase Realtime)
  const childIds = useMemo(() => children.map((child) => child.id), [children]);
  const { isChildOnline } = useChildrenPresence({
    childIds,
    enabled: children.length > 0,
  });

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/parent/auth");
        return;
      }
      fetchChildren();
    };
    checkAuth();
  }, [navigate]);

  const fetchChildren = async () => {
    try {
      const { data, error } = await supabase
        .from("children")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChildren(data || []);
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
  };

  const handleCall = (childId: string) => {
    navigate(`/call/${childId}`);
  };

  const handleChat = (childId: string) => {
    navigate(`/chat/${childId}`);
  };

  // CLS: Reserve space for loading state to match final layout structure
  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navigation />
        <div className="p-4">
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
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 mt-8">
            <h1 className="text-3xl font-bold">Your Children</h1>
            <p className="text-muted-foreground mt-2">
              View and call your children
            </p>
          </div>

          {children.length === 0 ? (
            <Card className="p-6">
              <p className="text-muted-foreground">No children added yet.</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {children.map((child) => (
                <ChildCard
                  key={child.id}
                  child={child}
                  onCall={handleCall}
                  onChat={handleChat}
                  isOnline={isChildOnline(child.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParentChildrenList;


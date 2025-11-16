// src/pages/ParentChildrenList.tsx
// Parent: Child List / Profile Screen

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Phone } from "lucide-react";
import Navigation from "@/components/Navigation";

interface Child {
  id: string;
  name: string;
  login_code: string;
  avatar_color: string;
}

const ParentChildrenList = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

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
    navigate(`/parent/call/${childId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
                <Card key={child.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: child.avatar_color || "#6366f1" }}
                      >
                        {child.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold">{child.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Code: {child.login_code}
                        </p>
                      </div>
                    </div>
                    <Button onClick={() => handleCall(child.id)}>
                      <Phone className="mr-2 h-4 w-4" />
                      Call
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

export default ParentChildrenList;


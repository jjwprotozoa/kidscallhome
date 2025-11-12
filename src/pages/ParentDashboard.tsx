import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Plus, Video, MessageCircle } from "lucide-react";
import AddChildDialog from "@/components/AddChildDialog";

interface Child {
  id: string;
  name: string;
  login_code: string;
  avatar_color: string;
}

const ParentDashboard = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    fetchChildren();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/parent/auth");
    }
  };

  const fetchChildren = async () => {
    try {
      const { data, error } = await supabase
        .from("children")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChildren(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading children",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/parent/auth");
  };

  const handleChat = (childId: string) => {
    navigate(`/parent/chat/${childId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">My Children</h1>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        <Button
          onClick={() => setShowAddChild(true)}
          className="w-full"
          size="lg"
        >
          <Plus className="mr-2 h-5 w-5" />
          Add Child
        </Button>

        {children.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">
              You haven't added any children yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Click "Add Child" above to create a profile and login code.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {children.map((child) => (
              <Card
                key={child.id}
                className="p-6 space-y-4"
                style={{
                  borderLeft: `4px solid ${child.avatar_color}`,
                }}
              >
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">{child.name}</h3>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">
                      Login Code
                    </p>
                    <p className="text-2xl font-mono font-bold tracking-wider">
                      {child.login_code}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleChat(child.id)}
                    className="flex-1"
                    variant="default"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Chat
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AddChildDialog
        open={showAddChild}
        onOpenChange={setShowAddChild}
        onChildAdded={fetchChildren}
      />
    </div>
  );
};

export default ParentDashboard;

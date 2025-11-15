import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Video, MessageCircle, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChildSession {
  id: string;
  name: string;
  avatar_color: string;
  parent_id: string;
}

const ChildDashboard = () => {
  const [child, setChild] = useState<ChildSession | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const sessionData = localStorage.getItem("childSession");
    if (!sessionData) {
      navigate("/child/login");
      return;
    }
    setChild(JSON.parse(sessionData));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("childSession");
    navigate("/child/login");
  };

  const handleCall = async () => {
    if (!child) return;
    
    try {
      const { data, error } = await supabase
        .from("calls")
        .insert({
          child_id: child.id,
          parent_id: child.parent_id,
          caller_type: "child",
          status: "ringing",
        })
        .select()
        .single();

      if (error) throw error;

      navigate(`/call/${child.id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to start call",
        variant: "destructive",
      });
    }
  };

  const handleChat = () => {
    navigate("/child/chat");
  };

  if (!child) return null;

  return (
    <div className="min-h-screen bg-primary/5 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold text-white"
              style={{ backgroundColor: child.avatar_color }}
            >
              {child.name[0]}
            </div>
            <div>
              <h1 className="text-3xl font-bold">Hi {child.name}!</h1>
              <p className="text-muted-foreground">Ready to connect?</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" size="sm">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-4">
          <Card
            className="p-8 cursor-pointer hover:shadow-lg transition-all border-4"
            style={{ borderColor: child.avatar_color }}
            onClick={handleCall}
          >
            <div className="flex items-center gap-6">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: child.avatar_color }}
              >
                <Video className="h-10 w-10 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-2">Call Mom/Dad</h2>
                <p className="text-muted-foreground">Start a video call</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-8 cursor-pointer hover:shadow-lg transition-all border-4"
            style={{ borderColor: child.avatar_color }}
            onClick={handleChat}
          >
            <div className="flex items-center gap-6">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: child.avatar_color }}
              >
                <MessageCircle className="h-10 w-10 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-2">Send Message</h2>
                <p className="text-muted-foreground">Chat with Mom/Dad</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ChildDashboard;

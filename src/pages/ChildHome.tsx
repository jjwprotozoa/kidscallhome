// src/pages/ChildHome.tsx
// Child Home / Dashboard page

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChildSession {
  id: string;
  name: string;
  avatar_color: string;
  parent_id: string;
}

const ChildHome = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [child, setChild] = useState<ChildSession | null>(null);

  useEffect(() => {
    const sessionData = localStorage.getItem("childSession");
    if (!sessionData) {
      navigate("/child/login");
      return;
    }
    const childData = JSON.parse(sessionData);
    setChild(childData);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("childSession");
    toast({ title: "Logged out" });
    navigate("/child/login");
  };

  if (!child) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Hi, {child.name}!</h1>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Quick Actions</h2>
            <Button
              className="w-full"
              size="lg"
              onClick={() => navigate("/child/parents")}
            >
              <Users className="mr-2 h-5 w-5" />
              Call Parent
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ChildHome;


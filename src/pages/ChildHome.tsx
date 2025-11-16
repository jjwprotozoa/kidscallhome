// src/pages/ChildHome.tsx
// Child Home / Dashboard page

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";

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


  if (!child) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
            <h1 className="text-3xl font-bold">Hi, {child.name}!</h1>
            <p className="text-muted-foreground mt-2">
              Quick access to call your parent
            </p>
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
                Select Parent
              </Button>
              <Button
                className="w-full"
                size="lg"
                variant="outline"
                onClick={() => navigate("/child/dashboard")}
              >
                Go to Dashboard
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ChildHome;


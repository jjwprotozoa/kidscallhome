// src/pages/ParentHome.tsx
// Parent Home / Dashboard page

import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/utils/userRole";
import { Users } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const ParentHome = () => {
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

      // Check if user is a family member and redirect them
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const userRole = await getUserRole(user.id);
        if (userRole === "family_member") {
          navigate("/family-member", { replace: true });
          return;
        }
      }
    };
    checkAuth();
  }, [navigate]);

  return (
    <div className="min-h-[100dvh] bg-background">
      <Navigation />
      <OnboardingTour role="parent" pageKey="parent_home" />
      <HelpBubble role="parent" pageKey="parent_home" />
      <div
        className="p-4"
        style={{
          paddingTop: "calc(1rem + 64px + var(--safe-area-inset-top) * 0.15)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 mt-8">
            <h1 className="text-3xl font-bold">Parent Home</h1>
            <p className="text-muted-foreground mt-2">
              Quick access to your children and calls
            </p>
          </div>

          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Quick Actions</h2>
              <Button
                className="w-full"
                size="lg"
                onClick={() => navigate("/parent/children")}
                data-tour="parent-home-view-children"
              >
                <Users className="mr-2 h-5 w-5" />
                View Children
              </Button>
              <Button
                className="w-full"
                size="lg"
                variant="outline"
                onClick={() => navigate("/parent/dashboard")}
                data-tour="parent-home-dashboard"
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

export default ParentHome;

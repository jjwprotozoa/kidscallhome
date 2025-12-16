// src/pages/ChildHome.tsx
// Child Home / Dashboard page

import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { usePresence } from "@/features/presence/usePresence";
import { useToast } from "@/hooks/use-toast";
import { getChildSessionLegacy } from "@/lib/childSession";
import { Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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
    const childData = getChildSessionLegacy();
    if (!childData) {
      navigate("/child/login");
      return;
    }
    setChild(childData);
  }, [navigate]);

  // Track child's online presence
  usePresence({
    userId: child?.id || "",
    userType: "child",
    name: child?.name,
    enabled: !!child,
  });

  // CLS: Reserve space for loading state to match final layout structure
  if (!child) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navigation />
        <div
          className="p-4"
          style={{
            paddingTop: "calc(1rem + 64px + var(--safe-area-inset-top) * 0.15)",
          }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 mt-8">
              <div className="h-9 w-48 bg-muted rounded animate-pulse mb-2" />
              <div className="h-6 w-64 bg-muted rounded animate-pulse" />
            </div>
            <Card className="p-6 min-h-[176px]">
              <div className="space-y-4">
                <div className="h-6 w-32 bg-muted rounded animate-pulse" />
                <div className="h-10 w-full bg-muted rounded animate-pulse" />
                <div className="h-10 w-full bg-muted rounded animate-pulse" />
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <Navigation />
      <OnboardingTour role="child" pageKey="child_home" />
      <HelpBubble role="child" pageKey="child_home" />
      <div
        className="p-4"
        style={{
          paddingTop: "calc(1rem + 64px + var(--safe-area-inset-top) * 0.15)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 mt-8">
            <h1 className="text-3xl font-bold">Hi, {child.name}!</h1>
            <p className="text-muted-foreground mt-2">
              Quick access to call your parent
            </p>
          </div>

          <Card className="p-6 min-h-[176px]">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Quick Actions</h2>
              <Button
                className="w-full"
                size="lg"
                onClick={() => navigate("/child/parents")}
                data-tour="child-home-parents"
              >
                <Users className="mr-2 h-5 w-5" />
                Family & Parents
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

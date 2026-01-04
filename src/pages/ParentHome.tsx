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
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const ParentHome = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const hasCheckedAuth = useRef(false);

  useEffect(() => {
    // Only check auth once on mount, not on every navigation/back button
    // This prevents redirecting to login when using back button
    if (hasCheckedAuth.current) {
      return;
    }

    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        hasCheckedAuth.current = true;
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
          hasCheckedAuth.current = true;
          navigate("/family-member", { replace: true });
          return;
        }
      }
      hasCheckedAuth.current = true;
      // Redirect to children list as the default landing page
      navigate("/parent/children", { replace: true });
    };
    checkAuth();
  }, [navigate]);

  // Show minimal loader only - redirect happens immediately, no UI flash
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
      </div>
    </div>
  );
};

export default ParentHome;

// src/hooks/useFamilyMemberRedirect.ts
// Purpose: Hook to check if user is a family member and redirect them if needed

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/utils/userRole";
import { safeLog } from "@/utils/security";

/**
 * Hook to check if authenticated user is a family member and redirect them
 * Use this in parent routes to prevent family members from accessing them
 */
export const useFamilyMemberRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAndRedirect = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      if (!session) {
        return; // Not authenticated, let parent route handle auth
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      
      if (!user) {
        return;
      }

      // Check user role from adult_profiles (canonical source)
      const userRole = await getUserRole(user.id);

      if (userRole === "family_member") {
        safeLog.log("✅ [FAMILY MEMBER REDIRECT] Family member detected, redirecting", {
          userId: user.id,
          email: user.email,
        });
        // User is a family member - redirect to family member home
        navigate("/family-member", { replace: true });
      }
    };

    checkAndRedirect();
  }, [navigate]);
};


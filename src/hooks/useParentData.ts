// src/hooks/useParentData.ts
// Purpose: Hook to fetch and manage parent data (name, family code, subscription info)
// Extracted from ParentDashboard.tsx to reduce complexity

import { supabase } from "@/integrations/supabase/client";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

interface ParentData {
  name: string | null;
  familyCode: string | null;
  allowedChildren: number;
  canAddMoreChildren: boolean;
}

export const useParentData = () => {
  const navigate = useNavigate();
  const [parentName, setParentName] = useState<string | null>(null);
  const [familyCode, setFamilyCode] = useState<string | null>(null);
  const [allowedChildren, setAllowedChildren] = useState<number | null>(null);
  const [canAddMoreChildren, setCanAddMoreChildren] = useState<boolean>(true);

  const checkAuth = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/parent/auth");
      return;
    }
    // Fetch parent name, family code, and subscription info from database
    const { data: parentData, error: parentError } = await supabase
      .from("parents")
      .select("name, family_code, allowed_children")
      .eq("id", session.user.id)
      .maybeSingle();

    if (parentError) {
      // Check if it's a column doesn't exist error
      if (
        parentError.code === "42703" ||
        parentError.message?.includes("does not exist")
      ) {
        console.error(
          "❌ [PARENT DASHBOARD] Migration not run. Family code column doesn't exist."
        );
        console.error(
          "Please run: supabase/migrations/20250121000000_add_family_code.sql"
        );
      } else {
        console.error("Error fetching parent data:", parentError);
      }
    }

    if (parentData) {
      setParentName((parentData as { name?: string })?.name || null);
      setFamilyCode(
        (parentData as { family_code?: string })?.family_code || null
      );
      setAllowedChildren(
        (parentData as { allowed_children?: number })?.allowed_children || 1
      );
    }

    // Check if parent can add more children (if function exists)
    try {
      // Type assertion needed because custom RPC function not in generated types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: canAdd } = await (supabase.rpc as any)("can_add_child", {
        p_parent_id: session.user.id,
      });
      setCanAddMoreChildren(canAdd === true);
    } catch (error) {
      // Function might not exist if migration hasn't been run
      console.warn("Subscription check function not available:", error);
      setCanAddMoreChildren(true); // Default to allowing if check fails
    }
  }, [navigate]);

  const refreshCanAddMoreChildren = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      try {
        // Type assertion needed because custom RPC function not in generated types
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: canAdd } = await (supabase.rpc as any)(
          "can_add_child",
          {
            p_parent_id: user.id,
          }
        );
        setCanAddMoreChildren(canAdd === true);
      } catch (error) {
        // Function might not exist if migration hasn't been run
        console.warn("Subscription check function not available:", error);
      }
    }
  }, []);

  return {
    parentName,
    familyCode,
    allowedChildren,
    canAddMoreChildren,
    checkAuth,
    refreshCanAddMoreChildren,
  };
};


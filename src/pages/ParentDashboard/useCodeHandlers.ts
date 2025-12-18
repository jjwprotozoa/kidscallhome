// src/pages/ParentDashboard/useCodeHandlers.ts
// Purpose: Code management handlers

import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Child } from "./types";

export const useCodeHandlers = (
  familyCode: string | null,
  updateChildLoginCode: (childId: string, newCode: string) => void
) => {
  const { toast } = useToast();

  const getFullLoginCode = useCallback((child: Child): string => {
    if (familyCode) {
      return `${familyCode}-${child.login_code}`;
    }
    return child.login_code;
  }, [familyCode]);

  const handleCopyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: "Login code copied to clipboard",
    });
  }, [toast]);

  const handleCopyMagicLink = useCallback((child: Child) => {
    const fullCode = getFullLoginCode(child);
    const encodedCode = encodeURIComponent(fullCode);
    const magicLink = `${window.location.origin}/child/login?code=${encodedCode}`;
    navigator.clipboard.writeText(magicLink);
    toast({
      title: "Copied!",
      description: "Magic link copied to clipboard",
    });
  }, [getFullLoginCode, toast]);

  const handleUpdateLoginCode = useCallback(async (child: Child, setIsUpdating: (value: boolean) => void) => {
    setIsUpdating(true);
    try {
      console.warn("[LOGIN CODE] Starting update for child:", child.id, child.name);
      
      // Generate a new unique login code
      const { data: newCode, error: rpcError } = await supabase.rpc("generate_unique_login_code");
      if (rpcError) {
        console.error("[LOGIN CODE] Generate code error:", rpcError);
        throw rpcError;
      }
      if (!newCode) throw new Error("Failed to generate new code");
      
      console.warn("[LOGIN CODE] Generated new code:", newCode);

      // Use RPC function to update the login code (bypasses RLS issues)
      const { data: updateResult, error: updateError } = await supabase.rpc("update_child_login_code", {
        p_child_id: child.id,
        p_new_code: newCode
      });

      console.warn("[LOGIN CODE] Update result:", { data: updateResult, error: updateError });
      
      if (updateError) {
        console.error("[LOGIN CODE] Update RPC error:", updateError);
        throw updateError;
      }

      // Check the result from the RPC function
      const result = updateResult?.[0];
      if (!result?.success) {
        const errorMsg = result?.error_message || "Unknown error from update function";
        console.error("[LOGIN CODE] Update failed:", errorMsg);
        throw new Error(errorMsg);
      }

      console.warn("[LOGIN CODE] Update successful, new code:", result.login_code);
      
      // Update local state with the confirmed new code
      updateChildLoginCode(child.id, result.login_code);

      toast({
        title: "Login code updated",
        description: `${child.name}'s new login code is: ${result.login_code}`,
      });
    } catch (error: unknown) {
      console.error("[LOGIN CODE] Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Error updating login code",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  }, [toast, updateChildLoginCode]);

  return {
    getFullLoginCode,
    handleCopyCode,
    handleCopyMagicLink,
    handleUpdateLoginCode,
  };
};










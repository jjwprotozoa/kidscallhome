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
    // Fallback: return child code only if family code not available
    // Note: This will result in an incomplete code that won't work for login
    // Components using this should validate familyCode exists before generating QR codes or links
    return child.login_code;
  }, [familyCode]);

  // Validated version that ensures family code is present
  const getValidatedFullLoginCode = useCallback((child: Child): string | null => {
    if (!familyCode) {
      return null; // Indicates family code is missing
    }
    const fullCode = `${familyCode}-${child.login_code}`;
    // Validate format: should have 3 parts (familyCode-color/animal-number)
    const parts = fullCode.split("-");
    if (parts.length !== 3 || parts[0].length !== 6) {
      return null; // Invalid format
    }
    return fullCode;
  }, [familyCode]);

  const handleCopyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: "Login code copied to clipboard",
    });
  }, [toast]);

  const handleCopyMagicLink = useCallback(async (child: Child) => {
    // Magic links MUST include the family code for proper authentication
    let codeToUse = familyCode;
    
    // If family code is not available, try to fetch it
    if (!codeToUse || codeToUse.trim().length === 0) {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: parentData } = await supabase
            .from("parents")
            .select("family_code")
            .eq("id", session.user.id)
            .maybeSingle();
          
          if (parentData?.family_code) {
            codeToUse = parentData.family_code;
          }
        }
      } catch (error) {
        console.error("Error fetching family code:", error);
      }
    }
    
    // Final check - if still no family code, show error
    if (!codeToUse || codeToUse.trim().length === 0) {
      toast({
        title: "Cannot generate magic link",
        description: "Family code is required to generate a magic link. Please wait a moment and try again, or refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    // Construct the full code directly to ensure family code is always included
    // Format: FAMILYCODE-color/animal-number (e.g., EGW6RZ-fish-34)
    const fullCode = `${codeToUse.trim().toUpperCase()}-${child.login_code}`;
    
    // Validate the format before generating the link
    const parts = fullCode.split("-");
    if (parts.length !== 3 || parts[0].length !== 6) {
      toast({
        title: "Invalid login code format",
        description: `The login code format is incorrect. Expected format: FAMILYCODE-color/animal-number. Got: ${fullCode}`,
        variant: "destructive",
      });
      return;
    }
    
    // Validate child login code format (should be color/animal-number)
    const childCodeParts = child.login_code.split("-");
    if (childCodeParts.length !== 2) {
      toast({
        title: "Invalid child login code",
        description: "The child's login code format is incorrect. Please contact support.",
        variant: "destructive",
      });
      return;
    }
    
    const encodedCode = encodeURIComponent(fullCode);
    const magicLink = `${window.location.origin}/child/login?code=${encodedCode}`;
    navigator.clipboard.writeText(magicLink);
    toast({
      title: "Copied!",
      description: "Magic link copied to clipboard",
    });
  }, [familyCode, toast]);

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
    getValidatedFullLoginCode,
    handleCopyCode,
    handleCopyMagicLink,
    handleUpdateLoginCode,
  };
};










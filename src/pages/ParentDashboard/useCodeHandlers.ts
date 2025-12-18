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
      const { data: newCode, error: rpcError } = await supabase.rpc("generate_unique_login_code");
      if (rpcError) throw rpcError;
      if (!newCode) throw new Error("Failed to generate new code");

      const { error: updateError } = await supabase
        .from("children")
        .update({ login_code: newCode })
        .eq("id", child.id);

      if (updateError) throw updateError;

      // Optimistically update the local state immediately
      updateChildLoginCode(child.id, newCode);

      toast({
        title: "Login code updated",
        description: `${child.name}'s new login code is: ${newCode}`,
      });
    } catch (error: unknown) {
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










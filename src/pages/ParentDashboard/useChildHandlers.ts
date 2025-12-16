// src/pages/ParentDashboard/useChildHandlers.ts
// Purpose: Child action handlers

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Child } from "./types";

export const useChildHandlers = (
  onChildrenUpdated: () => void
) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleDelete = useCallback(async (child: Child) => {
    try {
      const { error } = await supabase
        .from("children")
        .delete()
        .eq("id", child.id);

      if (error) throw error;

      toast({
        title: "Child removed",
        description: `${child.name} has been removed.`,
      });

      onChildrenUpdated();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Error removing child",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [toast, onChildrenUpdated]);

  const handleCall = useCallback(async (childId: string) => {
    try {
      const { acknowledgeMissedCalls } = await import("@/utils/acknowledgeMissedCalls");
      await acknowledgeMissedCalls(childId, "child");
    } catch (error) {
      console.error("Error acknowledging missed calls:", error);
    }
    navigate(`/call/${childId}`);
  }, [navigate]);

  const handleChat = useCallback((childId: string) => {
    navigate(`/chat/${childId}`);
  }, [navigate]);

  return {
    handleDelete,
    handleCall,
    handleChat,
  };
};








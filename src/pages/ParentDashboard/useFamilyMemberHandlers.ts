// src/pages/ParentDashboard/useFamilyMemberHandlers.ts
// Purpose: Family member action handlers

import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FamilyMember } from "./types";

export const useFamilyMemberHandlers = (
  onFamilyMembersUpdated: () => void
) => {
  const { toast } = useToast();

  const handleSuspend = useCallback(async (familyMemberId: string) => {
    try {
      const { error } = await supabase
        .from("family_members")
        .update({ status: "suspended" })
        .eq("id", familyMemberId);

      if (error) throw error;
      toast({
        title: "Family member suspended",
        description: "The family member has been suspended and can no longer access the app.",
      });
      onFamilyMembersUpdated();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to suspend family member",
        variant: "destructive",
      });
    }
  }, [toast, onFamilyMembersUpdated]);

  const handleActivate = useCallback(async (familyMemberId: string) => {
    try {
      const { error } = await supabase
        .from("family_members")
        .update({ status: "active" })
        .eq("id", familyMemberId);

      if (error) throw error;
      toast({
        title: "Family member activated",
        description: "The family member can now access the app.",
      });
      onFamilyMembersUpdated();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to activate family member",
        variant: "destructive",
      });
    }
  }, [toast, onFamilyMembersUpdated]);

  const handleResendInvitation = useCallback(async (familyMemberId: string, email: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(familyMemberId);

      let member;
      let fetchError;

      if (isUUID && familyMemberId) {
        const result = await supabase
          .from("family_members")
          .select("invitation_token, name, relationship")
          .eq("id", familyMemberId)
          .single();
        member = result.data;
        fetchError = result.error;
      } else {
        const result = await supabase
          .from("family_members")
          .select("invitation_token, name, relationship")
          .eq("email", email.toLowerCase().trim())
          .eq("parent_id", user.id)
          .single();
        member = result.data;
        fetchError = result.error;
      }

      if (fetchError || !member) throw fetchError || new Error("Family member not found");

      const newInvitationToken = crypto.randomUUID();

      let updateError;
      if (isUUID && familyMemberId) {
        const result = await supabase
          .from("family_members")
          .update({
            invitation_token: newInvitationToken,
            invitation_sent_at: new Date().toISOString(),
          })
          .eq("id", familyMemberId);
        updateError = result.error;
      } else {
        const result = await supabase
          .from("family_members")
          .update({
            invitation_token: newInvitationToken,
            invitation_sent_at: new Date().toISOString(),
          })
          .eq("email", email.toLowerCase().trim())
          .eq("parent_id", user.id);
        updateError = result.error;
      }

      if (updateError) throw updateError;

      const { error: emailError } = await supabase.functions.invoke("send-family-member-invitation", {
        body: {
          invitationToken: newInvitationToken,
          email: email,
          name: member.name,
          relationship: member.relationship,
          parentName: user?.user_metadata?.name || "a family member",
        },
      });

      if (emailError) {
        toast({
          title: "New invitation generated",
          description: "A new invitation link has been generated, but email sending failed. You can copy and share the link manually from the card.",
          variant: "default",
          duration: 8000,
        });
      } else {
        toast({
          title: "Invitation resent",
          description: `A new invitation email with a fresh link has been sent to ${email}.`,
        });
      }

      onFamilyMembersUpdated();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resend invitation",
        variant: "destructive",
      });
    }
  }, [toast, onFamilyMembersUpdated]);

  const handleRemove = useCallback(async (familyMemberIdOrEmail: string) => {
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(familyMemberIdOrEmail);

      let error;
      if (isUUID) {
        const { error: deleteError } = await supabase
          .from("family_members")
          .delete()
          .eq("id", familyMemberIdOrEmail);
        error = deleteError;
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error: deleteError } = await supabase
          .from("family_members")
          .delete()
          .eq("email", familyMemberIdOrEmail.toLowerCase().trim())
          .eq("parent_id", user.id);
        error = deleteError;
      }

      if (error) throw error;
      toast({
        title: "Family member removed",
        description: "The family member has been removed from your family.",
      });
      onFamilyMembersUpdated();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove family member",
        variant: "destructive",
      });
    }
  }, [toast, onFamilyMembersUpdated]);

  return {
    handleSuspend,
    handleActivate,
    handleResendInvitation,
    handleRemove,
  };
};








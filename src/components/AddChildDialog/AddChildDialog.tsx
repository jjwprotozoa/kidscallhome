// src/components/AddChildDialog/AddChildDialog.tsx
// Purpose: Main orchestrator component for adding children (max 200 lines)

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { safeLog, sanitizeError } from "@/utils/security";
import { trackChildAdded } from "@/utils/analytics";
import { useCallback, useEffect, useState } from "react";
import { ChildForm } from "./ChildForm";
import {
  formatLoginCode,
  validateLoginCode,
  validateName,
} from "./ChildFormValidation";
import { AVATAR_COLORS, COLORS } from "./constants";
import { AddChildDialogProps } from "./types";

const AddChildDialog = ({
  open,
  onOpenChange,
  onChildAdded,
}: AddChildDialogProps) => {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [codeType, setCodeType] = useState<"color" | "animal">("color");
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [selectedNumber, setSelectedNumber] = useState<string>("");
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [familyCode, setFamilyCode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [checkingCode, setCheckingCode] = useState(false);
  const { toast } = useToast();

  const fetchFamilyCode = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      let { data, error } = await supabase
        .from("parents")
        .select("family_code")
        .eq("id", user.id)
        .single();

      // If parent record doesn't exist (PGRST116 = no rows found), create it
      if (error && error.code === "PGRST116") {
        safeLog.log("📝 [FAMILY CODE] Parent record not found, creating it...");

        const { error: upsertError } = await supabase.from("parents").upsert(
          {
            id: user.id,
            email: user.email || "",
            name: user.user_metadata?.name || "",
          },
          {
            onConflict: "id",
          }
        );

        if (upsertError) {
          safeLog.error(
            "❌ [FAMILY CODE] Failed to create parent record:",
            sanitizeError(upsertError)
          );
          throw upsertError;
        }

        const { data: newData, error: newError } = await supabase
          .from("parents")
          .select("family_code")
          .eq("id", user.id)
          .single();

        if (newError) throw newError;
        data = newData;
      } else if (error) {
        if (
          error.code === "42703" ||
          error.message?.includes("does not exist")
        ) {
          toast({
            title: "Database Migration Required",
            description:
              "The family_code column doesn't exist yet. Please run the migration in Supabase: supabase/migrations/20250121000000_add_family_code.sql",
            variant: "destructive",
            duration: 10000,
          });
          safeLog.error(
            "❌ [FAMILY CODE] Migration not run. Error:",
            sanitizeError(error)
          );
          return;
        }
        throw error;
      }

      if (data?.family_code) {
        setFamilyCode(data.family_code);
      } else {
        safeLog.warn(
          "⚠️ [FAMILY CODE] Parent exists but family_code is null, attempting to generate..."
        );

        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc(
            "generate_unique_family_code"
          );

          if (!rpcError && rpcData) {
            const { error: updateError } = await supabase
              .from("parents")
              .update({ family_code: rpcData })
              .eq("id", user.id);

            if (!updateError) {
              setFamilyCode(rpcData);
              safeLog.log(
                "✅ [FAMILY CODE] Generated and set family code (code redacted)"
              );
              return;
            }
          }
        } catch (rpcErr) {
          safeLog.error(
            "❌ [FAMILY CODE] Exception calling RPC:",
            sanitizeError(rpcErr)
          );
        }

        toast({
          title: "Family Code Missing",
          description:
            "Your account doesn't have a family code yet. The system will attempt to generate one. Please refresh the page in a moment.",
          variant: "destructive",
          duration: 8000,
        });
      }
    } catch (error: unknown) {
      safeLog.error("Failed to fetch family code:", sanitizeError(error));
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Please refresh and try again. If the problem persists, ensure the database migration has been run.";
      toast({
        title: "Error Loading Family Code",
        description: errorMessage,
        variant: "destructive",
        duration: 8000,
      });
    }
  }, [toast]);

  const generateRandomCode = useCallback(async () => {
    setCheckingCode(true);
    try {
      const { data, error } = await supabase.rpc(
        "generate_kid_friendly_login_code"
      );
      if (error) throw error;
      setGeneratedCode(data);
      const [option, number] = data.split("-");
      setSelectedOption(option);
      setSelectedNumber(number);
      const isColor = COLORS.some((c) => c.name === option);
      setCodeType(isColor ? "color" : "animal");
    } catch (error: unknown) {
      safeLog.error("Failed to generate code:", sanitizeError(error));
      toast({
        title: "Error",
        description: "Failed to generate code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCheckingCode(false);
    }
  }, [toast]);

  // Fetch family code and generate a random code when dialog opens
  useEffect(() => {
    if (open) {
      fetchFamilyCode();
      generateRandomCode();
    }
  }, [open, fetchFamilyCode, generateRandomCode]);

  const handleOptionSelect = (option: string, type: "color" | "animal") => {
    setSelectedOption(option);
    setCodeType(type);
    updateCode(option, selectedNumber);
  };

  const handleNumberChange = (num: string) => {
    const numValue = parseInt(num);
    if (num === "" || (numValue >= 1 && numValue <= 99)) {
      setSelectedNumber(num);
      if (selectedOption) {
        updateCode(selectedOption, num);
      }
    }
  };

  const updateCode = (option: string, number: string) => {
    const code = formatLoginCode(familyCode, option, number);
    setGeneratedCode(code);
  };

  const checkCodeUnique = async (childCode: string): Promise<boolean> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from("children")
        .select("id")
        .eq("parent_id", user.id)
        .eq("login_code", childCode)
        .maybeSingle();

      if (error) throw error;
      return !data;
    } catch {
      return false;
    }
  };

  // Update code whenever family code, option, or number changes
  useEffect(() => {
    if (familyCode && selectedOption && selectedNumber) {
      setGeneratedCode(
        formatLoginCode(familyCode, selectedOption, selectedNumber)
      );
    } else if (selectedOption && selectedNumber) {
      setGeneratedCode(formatLoginCode("", selectedOption, selectedNumber));
    }
  }, [familyCode, selectedOption, selectedNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameValidation = validateName(name);
    if (!nameValidation.valid) {
      toast({
        title: "Error",
        description: nameValidation.errors[0],
        variant: "destructive",
      });
      return;
    }

    const codeValidation = validateLoginCode(
      familyCode,
      selectedOption,
      selectedNumber
    );
    if (!codeValidation.valid) {
      toast({
        title: codeValidation.errors[0].includes("Family code")
          ? "Family Code Required"
          : "Error",
        description: codeValidation.errors[0],
        variant: "destructive",
        duration: 8000,
      });
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: canAdd, error: canAddError } = await supabase.rpc(
        "can_add_child",
        { p_parent_id: user.id }
      );

      if (canAddError) {
        safeLog.error(
          "Error checking subscription limit:",
          sanitizeError(canAddError)
        );
      } else if (canAdd === false) {
        const { data: parentData } = await supabase
          .from("parents")
          .select(
            "allowed_children, subscription_status, subscription_expires_at"
          )
          .eq("id", user.id)
          .single();

        const { count: currentCount } = await supabase
          .from("children")
          .select("*", { count: "exact", head: true })
          .eq("parent_id", user.id);

        const allowed = parentData?.allowed_children || 1;
        const status = parentData?.subscription_status || "unknown";
        const expiresAt = parentData?.subscription_expires_at;
        const isExpired = expiresAt ? new Date(expiresAt) <= new Date() : false;

        let errorMessage = "You've reached your subscription limit. ";
        if (status !== "active" || isExpired) {
          errorMessage += `Your subscription status is "${status}"${
            isExpired ? " and has expired" : ""
          }. `;
        }
        errorMessage += `You have ${currentCount || 0} / ${
          allowed === 999 ? "unlimited" : allowed
        } children. `;
        errorMessage +=
          "Please upgrade your plan or manage your subscription to add more children.";

        toast({
          title: "Subscription Limit Reached",
          description: errorMessage,
          variant: "destructive",
          duration: 10000,
        });
        setLoading(false);
        return;
      }

      const childCode = `${selectedOption}-${selectedNumber}`;
      const isUnique = await checkCodeUnique(childCode);
      if (!isUnique) {
        toast({
          title: "Code already taken",
          description: "Please generate a new code or choose different options",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.from("children").insert({
        parent_id: user.id,
        name: name.trim(),
        login_code: childCode,
        avatar_color: selectedColor,
      });

      if (error) throw error;

      // Get child count for analytics
      const { count: childCount } = await supabase
        .from("children")
        .select("*", { count: "exact", head: true })
        .eq("parent_id", user.id);
      
      // Track analytics: child added
      trackChildAdded(childCount || 1);

      toast({
        title: "Child added successfully!",
        description: `Full login code: ${generatedCode} (${familyCode}-${childCode})`,
      });
      setName("");
      setSelectedColor(AVATAR_COLORS[0]);
      setSelectedOption("");
      setSelectedNumber("");
      setGeneratedCode("");
      onOpenChange(false);
      onChildAdded();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to add child. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a Child</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ChildForm
            name={name}
            onNameChange={setName}
            selectedColor={selectedColor}
            onColorChange={setSelectedColor}
            codeType={codeType}
            onCodeTypeChange={setCodeType}
            selectedOption={selectedOption}
            onOptionSelect={handleOptionSelect}
            selectedNumber={selectedNumber}
            onNumberChange={handleNumberChange}
            generatedCode={generatedCode}
            familyCode={familyCode}
            checkingCode={checkingCode}
            onGenerateCode={generateRandomCode}
          />

          <Button
            type="submit"
            className="w-full mt-6"
            disabled={loading || !generatedCode || !familyCode}
          >
            {loading ? "Creating..." : "Add Child"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddChildDialog;

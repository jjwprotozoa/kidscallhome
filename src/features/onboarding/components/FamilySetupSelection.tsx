// src/features/onboarding/components/FamilySetupSelection.tsx
// Onboarding component for selecting family setup (Single Household vs Two Households)
// Mobile-optimized with clear visual choices

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Home, Users, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { HouseholdType } from "@/types/family-communication";
import { useToast } from "@/hooks/use-toast";

interface FamilySetupSelectionProps {
  userId: string;
  onComplete: (householdType: HouseholdType) => void;
}

export function FamilySetupSelection({ userId, onComplete }: FamilySetupSelectionProps) {
  const [selectedType, setSelectedType] = useState<HouseholdType | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleContinue = async () => {
    if (!selectedType) {
      return;
    }

    setLoading(true);

    try {
      // Get or create family for this user
      const { data: parentProfile, error: profileError } = await supabase
        .from("adult_profiles")
        .select("family_id")
        .eq("user_id", userId)
        .eq("role", "parent")
        .single();

      if (profileError || !parentProfile) {
        console.error("Profile query error:", profileError);
        // Try fallback: use userId as family_id (which is the pattern we use)
        const { error: updateError } = await supabase
          .from("families")
          .update({ household_type: selectedType })
          .eq("id", userId);

        if (updateError) {
          throw new Error("Could not find or update family record. Please try again.");
        }
        
        onComplete(selectedType);
        return;
      }

      // Update family with household type
      const { error: updateError } = await supabase
        .from("families")
        .update({
          household_type: selectedType,
        })
        .eq("id", parentProfile.family_id);

      if (updateError) {
        throw updateError;
      }

      // Call completion callback
      onComplete(selectedType);
    } catch (error) {
      console.error("Error saving family setup:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save family setup. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[85vh] overflow-y-auto">
      {/* Header - compact for mobile */}
      <div className="text-center pb-4 sm:pb-6 px-2">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">
          Family setup
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          This helps us configure the right communication settings for your family
        </p>
      </div>

      {/* Options - stacked vertically, touch-friendly */}
      <div className="flex-1 space-y-3 sm:space-y-4 px-1">
        {/* Single Household Option */}
        <button
          type="button"
          onClick={() => setSelectedType("single")}
          className={`
            w-full text-left p-4 sm:p-5 rounded-xl border-2 transition-all duration-200
            ${selectedType === "single"
              ? "border-primary bg-primary/5 shadow-md"
              : "border-border bg-card hover:border-primary/50 hover:bg-accent/50"
            }
          `}
        >
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Icon container */}
            <div className={`
              shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center
              ${selectedType === "single"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
              }
            `}>
              <Home className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-base sm:text-lg text-foreground">
                  We live together as one household
                </h3>
                {/* Selection indicator */}
                <div className={`
                  shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                  ${selectedType === "single"
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/30"
                  }
                `}>
                  {selectedType === "single" && (
                    <Check className="w-4 h-4 text-primary-foreground" />
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Both parents share the same family account and can manage all settings together.
                Perfect for married or cohabiting parents.
              </p>
            </div>
          </div>
        </button>

        {/* Two Household Option */}
        <button
          type="button"
          onClick={() => setSelectedType("two_household")}
          className={`
            w-full text-left p-4 sm:p-5 rounded-xl border-2 transition-all duration-200
            ${selectedType === "two_household"
              ? "border-primary bg-primary/5 shadow-md"
              : "border-border bg-card hover:border-primary/50 hover:bg-accent/50"
            }
          `}
        >
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Icon container */}
            <div className={`
              shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center
              ${selectedType === "two_household"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
              }
            `}>
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-base sm:text-lg text-foreground">
                  We live in separate households
                </h3>
                {/* Selection indicator */}
                <div className={`
                  shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                  ${selectedType === "two_household"
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/30"
                  }
                `}>
                  {selectedType === "two_household" && (
                    <Check className="w-4 h-4 text-primary-foreground" />
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Each parent has their own family account. Children can belong to both families.
                You can optionally link families later for cooperative co-parenting.
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Footer - sticky at bottom */}
      <div className="pt-4 sm:pt-6 space-y-3 px-1">
        <Button
          onClick={handleContinue}
          disabled={!selectedType || loading}
          className="w-full h-12 text-base font-semibold"
          size="lg"
        >
          {loading ? "Saving..." : "Continue"}
        </Button>

        <p className="text-xs text-muted-foreground text-center pb-2">
          You can change this setting later in your family settings
        </p>
      </div>
    </div>
  );
}

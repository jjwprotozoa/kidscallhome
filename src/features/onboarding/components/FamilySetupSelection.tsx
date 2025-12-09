// src/features/onboarding/components/FamilySetupSelection.tsx
// Onboarding component for selecting family setup (Single Household vs Two Households)

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Home, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { HouseholdType } from "@/types/family-communication";

interface FamilySetupSelectionProps {
  userId: string;
  onComplete: (householdType: HouseholdType) => void;
}

export function FamilySetupSelection({ userId, onComplete }: FamilySetupSelectionProps) {
  const [selectedType, setSelectedType] = useState<HouseholdType | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleContinue = async () => {
    if (!selectedType) {
      return;
    }

    setLoading(true);

    try {
      // Get or create family for this user
      const { data: parentProfile } = await supabase
        .from("adult_profiles")
        .select("family_id")
        .eq("user_id", userId)
        .eq("role", "parent")
        .single();

      if (!parentProfile) {
        throw new Error("Parent profile not found");
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
      alert("Failed to save family setup. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold mb-2">
            Tell us about your family setup
          </CardTitle>
          <CardDescription className="text-lg">
            This helps us configure the right communication settings for your family
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={selectedType || undefined}
            onValueChange={(value) => setSelectedType(value as HouseholdType)}
            className="space-y-4"
          >
            {/* Single Household Option */}
            <div className="relative">
              <RadioGroupItem
                value="single"
                id="single"
                className="peer sr-only"
              />
              <Label
                htmlFor="single"
                className="flex flex-col items-start p-6 border-2 rounded-lg cursor-pointer transition-all hover:bg-blue-50 peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Home className="h-6 w-6 text-blue-600" />
                  <span className="text-xl font-semibold">
                    We live together as one household
                  </span>
                </div>
                <p className="text-sm text-gray-600 ml-9">
                  Both parents share the same family account and can manage all settings together.
                  Perfect for married or cohabiting parents.
                </p>
              </Label>
            </div>

            {/* Two Household Option */}
            <div className="relative">
              <RadioGroupItem
                value="two_household"
                id="two_household"
                className="peer sr-only"
              />
              <Label
                htmlFor="two_household"
                className="flex flex-col items-start p-6 border-2 rounded-lg cursor-pointer transition-all hover:bg-blue-50 peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Users className="h-6 w-6 text-indigo-600" />
                  <span className="text-xl font-semibold">
                    We live in separate households
                  </span>
                </div>
                <p className="text-sm text-gray-600 ml-9">
                  Each parent has their own family account. Children can belong to both families.
                  You can optionally link families later for cooperative co-parenting.
                </p>
              </Label>
            </div>
          </RadioGroup>

          <div className="flex gap-4 pt-4">
            <Button
              onClick={handleContinue}
              disabled={!selectedType || loading}
              className="flex-1"
              size="lg"
            >
              {loading ? "Saving..." : "Continue"}
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            You can change this setting later in your family settings
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


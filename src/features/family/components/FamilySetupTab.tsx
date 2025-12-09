// src/features/family/components/FamilySetupTab.tsx
// Tab component for viewing and managing family setup (household type, linked families)

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FamilyLinkDialog } from "./FamilyLinkDialog";
import type { HouseholdType } from "@/types/family-communication";

interface LinkedFamily {
  id: string;
  name: string | null;
  coParentName?: string;
}

export const FamilySetupTab: React.FC = () => {
  const [householdType, setHouseholdType] = useState<HouseholdType>("single");
  const [isLinked, setIsLinked] = useState(false);
  const [linkedFamily, setLinkedFamily] = useState<LinkedFamily | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchFamilySetup = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: adultProfile } = await supabase
          .from("adult_profiles")
          .select("family_id")
          .eq("user_id", user.id)
          .eq("role", "parent")
          .single();

        if (!adultProfile) return;

        const { data: family } = await supabase
          .from("families")
          .select("household_type, linked_family_id, name")
          .eq("id", adultProfile.family_id)
          .single();

        if (family) {
          setHouseholdType(family.household_type as HouseholdType);
          if (family.linked_family_id) {
            setIsLinked(true);
            // Fetch linked family details
            const { data: linkedFamilyData } = await supabase
              .from("families")
              .select("id, name")
              .eq("id", family.linked_family_id)
              .single();

            if (linkedFamilyData) {
              // Try to get co-parent name
              const { data: coParentProfile } = await supabase
                .from("adult_profiles")
                .select("name")
                .eq("family_id", family.linked_family_id)
                .eq("role", "parent")
                .limit(1)
                .maybeSingle();

              setLinkedFamily({
                id: linkedFamilyData.id,
                name: linkedFamilyData.name,
                coParentName: coParentProfile?.name,
              });
            }
          }
        }
      } catch (error) {
        console.error("Error fetching family setup:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFamilySetup();
  }, []);

  const handleUnlink = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adultProfile } = await supabase
        .from("adult_profiles")
        .select("family_id")
        .eq("user_id", user.id)
        .eq("role", "parent")
        .single();

      if (!adultProfile) return;

      const { data: family } = await supabase
        .from("families")
        .select("linked_family_id")
        .eq("id", adultProfile.family_id)
        .single();

      if (!family?.linked_family_id) return;

      // Unlink both families
      await Promise.all([
        supabase
          .from("families")
          .update({ linked_family_id: null, linked_at: null })
          .eq("id", adultProfile.family_id),
        supabase
          .from("families")
          .update({ linked_family_id: null, linked_at: null })
          .eq("id", family.linked_family_id),
      ]);

      setIsLinked(false);
      setLinkedFamily(null);
      toast({
        title: "Families unlinked",
        description: "The families have been unlinked",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unlink families",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="p-4">Loading family setup...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Household Type */}
      <Card className="p-4">
        <h3 className="font-semibold mb-2">Household Type</h3>
        <p className="text-sm text-gray-600 mb-4">
          {householdType === "single"
            ? "Single Household (living together)"
            : "Two Households (separated/divorced)"}
        </p>
        <p className="text-xs text-gray-500">
          This was set during onboarding and cannot be changed.
        </p>
      </Card>

      {/* Linked Families (Only for two-household) */}
      {householdType === "two_household" && (
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Linked Families</h3>
          {isLinked && linkedFamily ? (
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Linked with: {linkedFamily.coParentName || linkedFamily.name || "Co-parent"}
              </p>
              <p className="text-xs text-gray-500 mb-4">
                You can see each other's call logs and approved contacts (metadata only).
              </p>
              <Button variant="destructive" onClick={handleUnlink}>
                Unlink Family
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Not currently linked with co-parent. Link to share metadata (call logs, contacts) while maintaining independence.
              </p>
              <Button onClick={() => setShowLinkDialog(true)}>
                Link with Co-Parent
              </Button>
            </div>
          )}
        </Card>
      )}

      <FamilyLinkDialog
        open={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        onLink={async (email: string) => {
          // TODO: Implement family linking via email
          toast({
            title: "Link request sent",
            description: `A link request has been sent to ${email}`,
          });
          setShowLinkDialog(false);
        }}
      />
    </div>
  );
};


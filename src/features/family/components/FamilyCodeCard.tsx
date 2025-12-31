// src/features/family/components/FamilyCodeCard.tsx
// Family code display card component

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FamilyCodeCardProps {
  familyCode: string | null;
}

export const FamilyCodeCard = ({ familyCode: propFamilyCode }: FamilyCodeCardProps) => {
  const { toast } = useToast();
  const [familyCode, setFamilyCode] = useState<string | null>(propFamilyCode);
  const [isLoading, setIsLoading] = useState(!propFamilyCode);
  const [isCodeVisible, setIsCodeVisible] = useState(false);

  // Fetch family code if not provided
  useEffect(() => {
    if (propFamilyCode) {
      setFamilyCode(propFamilyCode);
      setIsLoading(false);
      return;
    }

    // Fetch family code from database
    const fetchFamilyCode = async () => {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsLoading(false);
          return;
        }

        const { data: parentData, error } = await supabase
          .from("parents")
          .select("family_code")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) {
          console.error("[FamilyCodeCard] Error fetching family code:", error);
          setIsLoading(false);
          return;
        }

        if (parentData?.family_code) {
          setFamilyCode(parentData.family_code);
        }
      } catch (error) {
        console.error("[FamilyCodeCard] Exception fetching family code:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFamilyCode();
  }, [propFamilyCode]);

  // Update when prop changes
  useEffect(() => {
    if (propFamilyCode) {
      setFamilyCode(propFamilyCode);
    }
  }, [propFamilyCode]);

  if (isLoading) {
    return (
      <Card className="bg-primary text-primary-foreground border-primary/20 p-4">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p className="text-sm">Loading family code...</p>
        </div>
      </Card>
    );
  }

  if (!familyCode) {
    return (
      <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 p-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
            Family Code Not Available
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            Please refresh the page or contact support if this issue persists.
          </p>
        </div>
      </Card>
    );
  }

  const maskedCode = "••••••";

  return (
    <Card className="bg-primary text-primary-foreground border-primary/20 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium mb-1 opacity-90">
            Your Family Code
          </p>
          <p className="text-2xl font-mono font-bold">
            {isCodeVisible ? familyCode : maskedCode}
          </p>
          <p className="text-xs mt-1 opacity-80">
            Share this code with your children for login
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            onClick={() => setIsCodeVisible(!isCodeVisible)}
            variant="secondary"
            size="sm"
          >
            {isCodeVisible ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Hide
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                View
              </>
            )}
          </Button>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(familyCode);
              toast({
                title: "Copied!",
                description: "Family code copied to clipboard",
              });
            }}
            variant="secondary"
            size="sm"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
        </div>
      </div>
    </Card>
  );
};















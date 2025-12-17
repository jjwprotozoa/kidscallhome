// src/features/family/components/FamilyCodeCard.tsx
// Family code display card component

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy } from "lucide-react";

interface FamilyCodeCardProps {
  familyCode: string | null;
}

export const FamilyCodeCard = ({ familyCode }: FamilyCodeCardProps) => {
  const { toast } = useToast();

  if (!familyCode) return null;

  return (
    <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
            Your Family Code
          </p>
          <p className="text-2xl font-mono font-bold text-blue-700 dark:text-blue-300">
            {familyCode}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            Share this code with your children for login
          </p>
        </div>
        <Button
          onClick={() => {
            navigator.clipboard.writeText(familyCode);
            toast({
              title: "Copied!",
              description: "Family code copied to clipboard",
            });
          }}
          variant="outline"
          size="sm"
          className="flex-shrink-0"
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy
        </Button>
      </div>
    </Card>
  );
};












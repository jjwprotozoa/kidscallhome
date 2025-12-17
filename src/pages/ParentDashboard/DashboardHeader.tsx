// src/pages/ParentDashboard/DashboardHeader.tsx
// Purpose: Dashboard header section

import { Button } from "@/components/ui/button";
import { FamilyCodeCard } from "@/features/family/components/FamilyCodeCard";
import { isPWA } from "@/utils/platformDetection";

interface DashboardHeaderProps {
  parentName: string | null;
  familyCode: string | null;
  onUpgradeClick: () => void;
}

export const DashboardHeader = ({
  parentName,
  familyCode,
  onUpgradeClick,
}: DashboardHeaderProps) => {
  return (
    <>
      <div className="px-4 pb-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm text-muted-foreground mb-4">
            Welcome back{parentName ? `, ${parentName}` : ""}!
          </p>
        </div>
      </div>
      <div className="p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="mt-2 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                Manage your children and family members
              </p>
            </div>
            {isPWA() && (
              <Button
                variant="outline"
                onClick={onUpgradeClick}
                className="flex-shrink-0"
                data-tour="parent-upgrade-plan"
              >
                Upgrade Plan
              </Button>
            )}
          </div>

          <FamilyCodeCard familyCode={familyCode} />
        </div>
      </div>
    </>
  );
};










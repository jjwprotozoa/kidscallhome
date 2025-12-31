// src/pages/ParentDashboard/DashboardHeader.tsx
// Purpose: Dashboard header section

import { FamilyCodeCard } from "@/features/family/components/FamilyCodeCard";

interface DashboardHeaderProps {
  parentName: string | null;
  familyCode: string | null;
}

export const DashboardHeader = ({
  parentName,
  familyCode,
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
              <h1 className="text-3xl font-bold">Family</h1>
              <p className="text-muted-foreground mt-2">
                Manage your family account
              </p>
            </div>
          </div>

          <FamilyCodeCard familyCode={familyCode} />
        </div>
      </div>
    </>
  );
};













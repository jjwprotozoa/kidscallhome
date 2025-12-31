// src/pages/ParentConnections.tsx
// Connections page for parents - manages child-to-child connection requests

import { ParentLayout } from "@/components/layout/ParentLayout";
import { ChildConnectionsTab } from "@/features/family/components/ChildConnectionsTab";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { useParentData } from "@/hooks/useParentData";
import { useFamilyMemberRedirect } from "@/hooks/useFamilyMemberRedirect";
import { useDashboardData } from "@/pages/ParentDashboard/useDashboardData";
import { useEffect, useState } from "react";

const ParentConnections = () => {
  // Redirect family members away from parent routes
  useFamilyMemberRedirect();
  const [children, setChildren] = useState<Array<{ id: string; name: string }>>([]);
  const { refreshCanAddMoreChildren } = useParentData();
  const { fetchChildren } = useDashboardData(refreshCanAddMoreChildren);

  useEffect(() => {
    const loadChildren = async () => {
      const data = await fetchChildren();
      setChildren(data);
    };
    loadChildren();
  }, [fetchChildren]);

  return (
    <ParentLayout>
      <OnboardingTour role="parent" pageKey="parent_connections" />
      <HelpBubble role="parent" pageKey="parent_connections" />
      
      <div className="p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="mt-2">
            <h1 className="text-3xl font-bold">Connections</h1>
            <p className="text-muted-foreground mt-2">
              Manage child-to-child connection requests and approvals
            </p>
          </div>

          <ChildConnectionsTab children={children} />
        </div>
      </div>
    </ParentLayout>
  );
};

export default ParentConnections;


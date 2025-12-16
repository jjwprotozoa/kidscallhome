// src/pages/ChildDashboard/DashboardHeader.tsx
// Purpose: Dashboard header section with child name and parent status

import { StatusIndicator } from "@/features/presence/StatusIndicator";
import { ChildSession } from "./types";

interface DashboardHeaderProps {
  child: ChildSession;
  parentName: string;
  selectedParentId: string | null;
  isParentOnline: boolean;
}

export const DashboardHeader = ({
  child,
  parentName,
  selectedParentId,
  isParentOnline,
}: DashboardHeaderProps) => {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold text-white"
          style={{ backgroundColor: child.avatar_color }}
        >
          {child.name?.[0]?.toUpperCase() || "?"}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Hi {child.name}!</h1>
          </div>
          <div className="text-muted-foreground">
            {selectedParentId ? (
              <span className="flex items-center gap-2">
                Ready to connect with {parentName}?
                {selectedParentId && (
                  <StatusIndicator
                    isOnline={isParentOnline}
                    size="sm"
                    showPulse={isParentOnline}
                  />
                )}
              </span>
            ) : (
              "Select a parent to contact"
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

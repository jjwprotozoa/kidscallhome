// src/features/family/components/ChildrenTab.tsx
// Children tab component for ParentDashboard - lightweight redirect to /parent/children

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Plus, Users } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";

interface Child {
  id: string;
  name: string;
  login_code: string;
  avatar_color: string;
}

interface ChildrenTabProps {
  children: Child[];
  loading: boolean;
  canAddMoreChildren: boolean;
  allowedChildren: number;
  hasNotifications: boolean;
  totalUnreadMessages: number;
  totalMissedCalls: number;
  isChildOnline: (childId: string) => boolean;
  getFullLoginCode: (child: Child) => string;
  onAddChild: () => void;
  onClearAllNotifications: () => void;
  onEditCode: (child: Child) => void;
  onCopyCode: (code: string) => void;
  onCopyMagicLink: (child: Child) => void;
  onPrintCode: (child: Child) => void;
  onViewQR: (child: Child) => void;
  onCall: (childId: string) => void;
  onChat: (childId: string) => void;
  onDelete: (child: Child) => void;
}

export const ChildrenTab = React.memo(
  ({
    children,
    onAddChild,
  }: ChildrenTabProps) => {
    const navigate = useNavigate();

    return (
      <div className="space-y-6 min-h-[400px]">
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Children</h2>
              <p className="text-muted-foreground">
                View and manage your children from the main Children page.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => navigate("/parent/children")}
                size="lg"
                className="flex-1"
              >
                <Users className="mr-2 h-5 w-5" />
                View Children
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                onClick={onAddChild}
                variant="outline"
                size="lg"
                className="flex-shrink-0"
              >
                <Plus className="mr-2 h-5 w-5" />
                Add Child
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }
);

ChildrenTab.displayName = "ChildrenTab";

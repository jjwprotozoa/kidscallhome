// src/features/family/components/ChildrenTab.tsx
// Children tab component for ParentDashboard

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { ChildCard } from "@/components/ChildCard";
import { BellOff, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isPWA } from "@/utils/platformDetection";

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

export const ChildrenTab = ({
  children,
  loading,
  canAddMoreChildren,
  allowedChildren,
  hasNotifications,
  totalUnreadMessages,
  totalMissedCalls,
  isChildOnline,
  getFullLoginCode,
  onAddChild,
  onClearAllNotifications,
  onEditCode,
  onCopyCode,
  onCopyMagicLink,
  onPrintCode,
  onViewQR,
  onCall,
  onChat,
  onDelete,
}: ChildrenTabProps) => {
  const navigate = useNavigate();

  return (
    <TabsContent value="children" className="space-y-6 mt-6">
      {!canAddMoreChildren && (
        <Card className="p-4 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <div className="space-y-3">
            <p className="text-sm text-yellow-900 dark:text-yellow-100">
              <strong>Subscription Limit Reached:</strong> You have{" "}
              {children.length} / {allowedChildren === 999 ? "∞" : allowedChildren || 1}{" "}
              children.
            </p>
            {isPWA() ? (
              <Button
                onClick={() => navigate("/parent/upgrade")}
                variant="default"
                size="sm"
                className="w-full sm:w-auto"
                data-tour="parent-upgrade-limit"
              >
                Upgrade Your Plan
              </Button>
            ) : (
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Please upgrade through your app store to add more children.
              </p>
            )}
          </div>
        </Card>
      )}
      <div className="flex gap-2">
        <Button onClick={onAddChild} className="flex-1" size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Add Child
        </Button>
        {hasNotifications && (
          <Button
            onClick={onClearAllNotifications}
            variant="outline"
            size="lg"
            className="flex-shrink-0"
            title={`Clear all notifications (${totalUnreadMessages} messages, ${totalMissedCalls} missed calls)`}
          >
            <BellOff className="mr-2 h-5 w-5" />
            Clear All
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i} className="p-6 space-y-4 min-h-[220px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-6 w-32 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-10 flex-1 bg-muted rounded animate-pulse" />
                <div className="h-10 flex-1 bg-muted rounded animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      ) : children.length === 0 ? (
        <Card className="p-12 text-center min-h-[220px]">
          <p className="text-muted-foreground mb-4">
            You haven't added any children yet.
          </p>
          <p className="text-sm text-muted-foreground">
            Click "Add Child" above to create a profile and login code.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((child, index) => (
            <ChildCard
              key={child.id}
              child={child}
              index={index}
              isOnline={isChildOnline(child.id)}
              fullLoginCode={getFullLoginCode(child)}
              onEditCode={() => onEditCode(child)}
              onCopyCode={() => onCopyCode(getFullLoginCode(child))}
              onCopyMagicLink={() => onCopyMagicLink(child)}
              onPrintCode={() => onPrintCode(child)}
              onViewQR={() => onViewQR(child)}
              onCall={() => onCall(child.id)}
              onChat={() => onChat(child.id)}
              onDelete={() => onDelete(child)}
            />
          ))}
        </div>
      )}
    </TabsContent>
  );
};




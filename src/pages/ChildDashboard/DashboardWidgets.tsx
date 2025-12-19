// src/pages/ChildDashboard/DashboardWidgets.tsx
// Purpose: Widget container for call and chat actions

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, MessageCircle } from "lucide-react";
import { StatusIndicator } from "@/features/presence/StatusIndicator";
import { ChildSession } from "./types";

interface DashboardWidgetsProps {
  child: ChildSession;
  parentName: string;
  selectedParentId: string | null;
  isParentOnline: boolean;
  missedCallCount: number;
  unreadMessageCount: number;
  onCall: () => void;
  onChat: () => void;
  onSelectParent: () => void;
}

export const DashboardWidgets = ({
  child,
  parentName,
  selectedParentId,
  isParentOnline,
  missedCallCount,
  unreadMessageCount,
  onCall,
  onChat,
  onSelectParent,
}: DashboardWidgetsProps) => {
  if (!selectedParentId) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground mb-4">
          Please select a parent first
        </p>
        <Button onClick={onSelectParent} size="lg">
          Select Parent
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card
        className="p-8 cursor-pointer hover:shadow-lg transition-all border-4 relative"
        style={{ borderColor: child.avatar_color }}
        onClick={onCall}
        data-tour="child-answer-button"
      >
        {missedCallCount > 0 && (
          <span className="absolute top-4 right-4 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-[24px] h-6 flex items-center justify-center px-2 border-2 border-background">
            {missedCallCount > 99 ? "99+" : missedCallCount}
          </span>
        )}
        <div className="flex items-center gap-6">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ backgroundColor: child.avatar_color }}
          >
            <Video className="h-10 w-10 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-bold mb-2">Call {parentName}</h2>
              <StatusIndicator
                isOnline={isParentOnline}
                size="md"
                showPulse={isParentOnline}
              />
            </div>
            <p className="text-muted-foreground">
              {isParentOnline ? "Parent is online" : "Parent is offline"}
            </p>
          </div>
        </div>
      </Card>

      <Card
        className="p-8 cursor-pointer hover:shadow-lg transition-all border-4 relative"
        style={{ borderColor: child.avatar_color }}
        onClick={onChat}
        data-tour="child-messages"
      >
        {unreadMessageCount > 0 && (
          <span className="absolute top-4 right-4 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-[24px] h-6 flex items-center justify-center px-2 border-2 border-background">
            {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
          </span>
        )}
        <div className="flex items-center gap-6">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ backgroundColor: child.avatar_color }}
          >
            <MessageCircle className="h-10 w-10 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-bold mb-2">Send Message</h2>
              <StatusIndicator
                isOnline={isParentOnline}
                size="md"
                showPulse={isParentOnline}
              />
            </div>
            <p className="text-muted-foreground">
              Chat with {parentName} {isParentOnline ? "(online)" : "(offline)"}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};













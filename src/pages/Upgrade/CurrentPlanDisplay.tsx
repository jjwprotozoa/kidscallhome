// src/pages/Upgrade/CurrentPlanDisplay.tsx
// Purpose: Display current subscription status

import { Card } from "@/components/ui/card";
import { SubscriptionTier } from "./types";
import { PLANS } from "./constants";

interface CurrentPlanDisplayProps {
  hasActiveSubscription: boolean;
  subscriptionType: SubscriptionTier;
  currentChildrenCount: number;
  allowedChildren: number;
}

export const CurrentPlanDisplay = ({
  hasActiveSubscription,
  subscriptionType,
  currentChildrenCount,
  allowedChildren,
}: CurrentPlanDisplayProps) => {
  if (hasActiveSubscription) {
    return (
      <Card className="p-6 mb-8 bg-primary/10 border-primary/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="font-semibold text-primary mb-1">
              Your Current Plan
            </h3>
            <p className="text-sm text-muted-foreground">
              {PLANS.find(p => p.id === subscriptionType)?.name || subscriptionType}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-primary">
              Active Subscription
            </p>
            <p className="text-xs text-muted-foreground">
              {currentChildrenCount} /{" "}
              {allowedChildren === 999 ? "∞" : allowedChildren} children
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 mb-8 bg-muted/50">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            Current Plan
          </p>
          <p className="text-lg font-semibold capitalize">
            Free Tier
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            Children Added
          </p>
          <p className="text-lg font-semibold">
            {currentChildrenCount} / 1
          </p>
        </div>
      </div>
    </Card>
  );
};













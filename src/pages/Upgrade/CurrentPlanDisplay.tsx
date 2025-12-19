// src/pages/Upgrade/CurrentPlanDisplay.tsx
// Purpose: Display current subscription status

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ExternalLink } from "lucide-react";
import { SubscriptionTier } from "./types";
import { PLANS } from "./constants";

interface CurrentPlanDisplayProps {
  hasActiveSubscription: boolean;
  subscriptionType: SubscriptionTier;
  currentChildrenCount: number;
  allowedChildren: number;
  isManagingSubscription: boolean;
  onManageSubscription: () => void;
}

export const CurrentPlanDisplay = ({
  hasActiveSubscription,
  subscriptionType,
  currentChildrenCount,
  allowedChildren,
  isManagingSubscription,
  onManageSubscription,
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
              {subscriptionType === "annual-family-plan" && " - Unlimited children"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-primary">
                Active Subscription
              </p>
              <p className="text-xs text-muted-foreground">
                {currentChildrenCount} /{" "}
                {allowedChildren === 999 ? "∞" : allowedChildren} children
              </p>
            </div>
            <Button
              variant="default"
              onClick={onManageSubscription}
              disabled={isManagingSubscription}
              size="sm"
            >
              {isManagingSubscription ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Manage
                </>
              )}
            </Button>
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













// src/pages/Upgrade/CurrentPlanDisplay.tsx
// Purpose: Display current subscription status

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import { SubscriptionTier } from "./types";
import { PLANS } from "./constants";

interface CurrentPlanDisplayProps {
  hasActiveSubscription: boolean;
  subscriptionType: SubscriptionTier;
  currentChildrenCount: number;
  allowedChildren: number;
  onManageSubscription?: () => void;
  isManagingSubscription?: boolean;
  hasStripeCustomer?: boolean;
}

export const CurrentPlanDisplay = ({
  hasActiveSubscription,
  subscriptionType,
  currentChildrenCount,
  allowedChildren,
  onManageSubscription,
  isManagingSubscription = false,
  hasStripeCustomer = false,
}: CurrentPlanDisplayProps) => {
  if (hasActiveSubscription) {
    return (
      <Card className="p-6 mb-8 bg-primary/10 border-primary/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-primary mb-1">
              Your Current Plan
            </h3>
            <p className="text-sm text-muted-foreground">
              {PLANS.find(p => p.id === subscriptionType)?.name || subscriptionType}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {currentChildrenCount} /{" "}
              {allowedChildren === 999 ? "∞" : allowedChildren} children
            </p>
            {subscriptionType === "family-bundle-monthly" && (
              <p className="text-xs text-muted-foreground mt-1">
                Billing: Monthly
              </p>
            )}
            {subscriptionType === "family-bundle-annual" && (
              <p className="text-xs text-muted-foreground mt-1">
                Billing: Annual
              </p>
            )}
          </div>
          {onManageSubscription && hasStripeCustomer && (
            <div className="flex flex-col items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onManageSubscription}
                disabled={isManagingSubscription}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {isManagingSubscription ? "Opening..." : "Manage Subscription"}
              </Button>
              <p className="text-xs text-muted-foreground text-right">
                Opens Stripe Customer Portal to update payment, view invoices, or change plan
              </p>
            </div>
          )}
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













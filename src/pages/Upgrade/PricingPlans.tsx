// src/pages/Upgrade/PricingPlans.tsx
// Purpose: Pricing plan cards component

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Crown, Loader2 } from "lucide-react";
import { SubscriptionPlan, SubscriptionTier } from "./types";
import { PLANS } from "./constants";

interface PricingPlansProps {
  subscriptionType: SubscriptionTier;
  hasActiveSubscription: boolean;
  isProcessing: boolean;
  onPlanSelect: (plan: SubscriptionPlan) => void;
}

export const PricingPlans = ({
  subscriptionType,
  hasActiveSubscription,
  isProcessing,
  onPlanSelect,
}: PricingPlansProps) => {
  const getButtonText = (plan: SubscriptionPlan) => {
    const isCurrentPlan = subscriptionType === plan.id;
    if (isCurrentPlan) return "Current Plan";
    
    if (hasActiveSubscription) {
      const isUpgrade = 
        plan.id === "annual-family-plan" || 
        (plan.id === "family-bundle-monthly" && subscriptionType !== "annual-family-plan" && subscriptionType !== "family-bundle-monthly" && subscriptionType !== "family-bundle-annual") ||
        (plan.id === "family-bundle-annual" && subscriptionType !== "annual-family-plan" && subscriptionType !== "family-bundle-annual" && subscriptionType !== "family-bundle-monthly") ||
        (plan.id.includes("additional") && !subscriptionType.includes("additional"));
      
      const isDowngrade = 
        subscriptionType === "annual-family-plan" && plan.id !== "annual-family-plan";
      
      if (isUpgrade) return "Upgrade";
      if (isDowngrade) return "Downgrade";
    }
    
    return "Select Plan";
  };

  const isCurrentPlan = (plan: SubscriptionPlan) => subscriptionType === plan.id;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8" data-tour="parent-upgrade-plans">
      {PLANS.map((plan) => {
        const isCurrent = isCurrentPlan(plan);
        const isUpgrade = hasActiveSubscription && 
          (plan.id === "annual-family-plan" || 
           (plan.id === "family-bundle-monthly" && subscriptionType !== "annual-family-plan" && subscriptionType !== "family-bundle-monthly" && subscriptionType !== "family-bundle-annual") ||
           (plan.id === "family-bundle-annual" && subscriptionType !== "annual-family-plan" && subscriptionType !== "family-bundle-annual" && subscriptionType !== "family-bundle-monthly") ||
           (plan.id.includes("additional") && !subscriptionType.includes("additional")));
        const isDowngrade = hasActiveSubscription && 
          subscriptionType === "annual-family-plan" && 
          plan.id !== "annual-family-plan";
        
        return (
          <Card
            key={plan.id}
            className={`p-6 relative ${
              isCurrent
                ? "border-2 border-primary shadow-lg bg-primary/5"
                : plan.recommended
                ? "border-2 border-primary/50 shadow-md"
                : "border"
            }`}
          >
            {plan.recommended && !isCurrent && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  Best Value
                </span>
              </div>
            )}
            {isCurrent && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold">
                  ✓ Current Plan
                </span>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {plan.description}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">
                    /{plan.interval === "month" ? "mo" : "yr"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  <span>
                    {typeof plan.kidsSupported === "number"
                      ? `Up to ${plan.kidsSupported} ${
                          plan.kidsSupported === 1 ? "child" : "children"
                        }`
                      : "Unlimited children"}
                  </span>
                </div>
              </div>
              <Button
                className="w-full"
                variant={
                  isCurrent 
                    ? "secondary" 
                    : plan.recommended 
                    ? "default" 
                    : "outline"
                }
                onClick={() => onPlanSelect(plan)}
                disabled={isProcessing || isCurrent}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  getButtonText(plan)
                )}
              </Button>
              {isDowngrade && (
                <p className="text-xs text-muted-foreground text-center">
                  Note: Downgrading will reduce your child limit
                </p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};









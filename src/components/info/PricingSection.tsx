// src/components/info/PricingSection.tsx
// Purpose: Pricing and subscription section for Info page

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Crown, DollarSign, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PricingSectionProps {
  isParent: boolean;
}

export const PricingSection = ({ isParent }: PricingSectionProps) => {
  const navigate = useNavigate();

  return (
    <section id="pricing" className="mb-8 scroll-mt-20">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Pricing & Subscription Terms
        </h2>
        <div className="space-y-4">
          <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
            <p className="font-semibold text-primary mb-2">
              Free Tier Available
            </p>
            <p className="text-muted-foreground">
              The app allows 1 parent and 1 child account for free.
              Charges apply for each additional child account.
            </p>
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-3">Subscription Plans</h3>
            <div className="space-y-3">
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Additional Kid Monthly</h4>
                  <span className="text-lg font-bold">$2.99/month</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Add one more child to your account
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Additional Kid Annual</h4>
                  <span className="text-lg font-bold">$29.99/year</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Add one more child (save 17% vs monthly)
                </p>
              </div>
              <div className="border rounded-lg p-4 border-primary/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">Family Bundle Monthly</h4>
                    <Crown className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-lg font-bold">$14.99/month</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Perfect for families with up to 5 kids
                </p>
              </div>
              <div className="border-2 border-primary rounded-lg p-4 bg-primary/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">Annual Family Plan</h4>
                    <Crown className="h-4 w-4 text-primary" />
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                      Best Value
                    </span>
                  </div>
                  <span className="text-lg font-bold">$99/year</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Best value - unlimited kids for the whole family
                </p>
              </div>
            </div>
          </div>
          {isParent && (
            <div className="pt-4">
              <Button
                onClick={() => navigate("/parent/upgrade")}
                className="w-full sm:w-auto"
              >
                View Full Pricing Details
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
};


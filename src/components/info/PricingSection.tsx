// src/components/info/PricingSection.tsx
// Purpose: Pricing and subscription section for Info page

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Check,
  Crown,
  DollarSign,
  ExternalLink,
  Gift,
  Heart,
  Mail,
  Sparkles,
  Users,
} from "lucide-react";
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
        <div className="space-y-6">
          {/* Free Plan */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-green-600" />
              Free Plan
            </h3>
            <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-muted-foreground mb-2">
                <strong className="text-foreground">
                  Kids Call Home is free for 1 parent and 1 child.
                </strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Perfect for trying out Kids Call Home with your first child
                before upgrading. Experience safe video calls and messaging with
                no commitment.
              </p>
            </div>
          </div>

          <Separator />

          {/* Family Plan */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Family Plan
            </h3>
            <div className="space-y-3">
              <div className="border-2 border-primary/50 rounded-lg p-4 bg-primary/5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Heart className="h-4 w-4 text-primary" />
                    Monthly
                  </h4>
                  <span className="text-xl font-bold text-primary">
                    US$14.99/month
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Heart className="h-4 w-4 text-primary" />
                    Annual
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                      Save 17%
                    </span>
                  </h4>
                  <span className="text-xl font-bold text-primary">
                    US$149/year
                  </span>
                </div>
              </div>

              <p className="text-muted-foreground">
                Upgrade once and connect the whole family. The Family Plan
                includes:
              </p>

              <ul className="space-y-2 ml-1">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Up to 5 kids</strong> – all your children under one
                    subscription
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Unlimited invited family members</strong> –
                    grandparents, aunts, uncles, cousins, and more
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>
                    Safe, parent-approved video calls and messaging for everyone
                  </span>
                </li>
              </ul>

              <p className="text-sm text-muted-foreground italic">
                Local currency equivalents may vary.
              </p>
            </div>
          </div>

          <Separator />

          {/* Larger Families & Organizations */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Larger Families & Organizations
            </h3>
            <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-muted-foreground mb-3">
                If you have more than 5 children, or you would like to use Kids
                Call Home in an organization (for example a school, clinic, or
                NGO), please contact us for custom pricing.
              </p>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                <a
                  href="mailto:support@kidscallhome.com?subject=Custom Pricing Inquiry"
                  className="text-primary hover:underline font-medium"
                >
                  support@kidscallhome.com
                </a>
              </div>
            </div>
          </div>

          <Separator />

          {/* Referral Rewards */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-600" />
              Referral Rewards
            </h3>
            <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-muted-foreground">
                    <strong className="text-foreground">
                      Share Kids Call Home with friends and family.
                    </strong>{" "}
                    When someone subscribes to the Family Plan using your
                    referral link, you both receive{" "}
                    <strong className="text-primary">1 week free</strong> on
                    your subscriptions.
                  </p>
                  {isParent && (
                    <Button
                      variant="link"
                      className="p-0 h-auto mt-2 text-purple-600 hover:text-purple-700"
                      onClick={() => navigate("/parent/dashboard?tab=referrals")}
                    >
                      Get your referral link →
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {isParent && (
            <div className="pt-4">
              <Button
                onClick={() => navigate("/parent/upgrade")}
                className="w-full sm:w-auto"
              >
                View Subscription Options
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
};

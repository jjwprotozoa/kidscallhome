// src/components/info/ReferralsSection.tsx
// Purpose: Referrals and rewards section for Info page

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Gift, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ReferralsSectionProps {
  isParent: boolean;
}

export const ReferralsSection = ({ isParent }: ReferralsSectionProps) => {
  const navigate = useNavigate();

  return (
    <section id="referrals" className="mb-8 scroll-mt-20">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Referral Rewards
        </h2>
        <div className="space-y-4">
          <div className="bg-purple-100 dark:bg-purple-950/50 p-4 rounded-lg border-2 border-purple-300 dark:border-purple-700">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-purple-700 dark:text-purple-300 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-purple-900 dark:text-purple-100 mb-3">
                  <strong className="text-purple-950 dark:text-purple-50">
                    Share Kids Call Home with friends and family.
                  </strong>{" "}
                  When someone subscribes to the Family Plan using your referral
                  link, you both receive{" "}
                  <strong className="text-purple-950 dark:text-purple-50">1 week free</strong> on your
                  subscriptions.
                </p>
                {isParent ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => navigate("/parent/dashboard?tab=referrals")}
                  >
                    <Gift className="h-4 w-4 mr-2" />
                    Get Your Referral Link & Share
                  </Button>
                ) : (
                  <p className="text-sm text-purple-800 dark:text-purple-200 font-medium">
                    Parents can access their referral link from the Dashboard →
                    Referrals tab.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">How it works</h3>
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Share your referral code or link with friends and family</li>
              <li>They sign up for Kids Call Home using your code</li>
              <li>
                When they subscribe to the{" "}
                <span className="font-medium text-foreground">Family Plan</span>,
                you both get{" "}
                <span className="font-medium text-primary">1 week free!</span>
              </li>
            </ol>
          </div>
        </div>
      </Card>
    </section>
  );
};


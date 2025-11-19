// src/components/info/CancellationSection.tsx
// Purpose: Cancellation policy section for Info page

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CancellationSectionProps {
  isParent: boolean;
}

export const CancellationSection = ({ isParent }: CancellationSectionProps) => {
  const navigate = useNavigate();

  return (
    <section id="cancel" className="mb-8 scroll-mt-20">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <XCircle className="h-5 w-5" />
          Cancellation Policy
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">
              How to Cancel Subscription
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              You can cancel your subscription at any time through your
              Account Settings:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
              <li>
                Navigate to Account Settings (accessible from the main
                menu)
              </li>
              <li>Find the Subscription section</li>
              <li>Click "Cancel Subscription"</li>
              <li>Confirm the cancellation</li>
            </ol>
            {isParent && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate("/parent/settings")}
                  className="w-full sm:w-auto"
                >
                  Go to Account Settings
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2">
              Access After Cancellation
            </h3>
            <p className="text-sm text-muted-foreground">
              When you cancel your subscription, you will continue to have
              access to all premium features until the end of your current
              billing period. After expiration, your account will
              automatically revert to the free tier (1 child limit).
              Existing children can still use the app, but you won't be
              able to add more children until you resubscribe.
            </p>
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2">Refund Policy</h3>
            <p className="text-sm text-muted-foreground">
              Subscriptions are billed in advance. Refunds are not
              available for partial billing periods. If you cancel during
              a billing period, you retain access until the period ends
              without additional charges.
            </p>
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2">Account Deletion</h3>
            <p className="text-sm text-muted-foreground">
              To delete your account completely, please contact support at{" "}
              <a
                href="mailto:support@kidscallhome.com"
                className="text-primary hover:underline"
              >
                support@kidscallhome.com
              </a>
              . Account deletion will permanently remove all your data,
              including children's accounts, messages, and call history.
            </p>
          </div>
        </div>
      </Card>
    </section>
  );
};


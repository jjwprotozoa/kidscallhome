// src/pages/Pricing.tsx
// Pricing page for Kids Call Home - matches Info page pricing section

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Check,
  Crown,
  DollarSign,
  ExternalLink,
  Heart,
  Mail,
  Sparkles,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const Pricing = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-[100dvh] bg-background">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Pricing & Subscription Terms
          </h1>
          <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Start free and upgrade when you're ready. No hidden charges, no surprise fees.
          </p>

          <Card className="p-6 md:p-8">
            <div className="space-y-6">
              {/* Free Plan */}
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-green-600" />
                  Free Plan
                </h2>
                <div className="bg-green-100 dark:bg-green-950/50 p-4 rounded-lg border-2 border-green-300 dark:border-green-700">
                  <p className="text-green-900 dark:text-green-100 mb-2">
                    <strong className="text-green-950 dark:text-green-50">
                      Kids Call Home is free for 1 parent and 1 child.
                    </strong>
                  </p>
                  <p className="text-sm text-green-900 dark:text-green-100">
                    Perfect for trying out Kids Call Home with your first child
                    before upgrading. Experience safe video calls and messaging with
                    no commitment.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Family Plan */}
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  Family Plan
                </h2>
                <div className="space-y-3">
                  <div className="border-2 border-primary/50 rounded-lg p-4 bg-primary/5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                      <h3 className="font-medium flex items-center gap-2">
                        <Heart className="h-4 w-4 text-primary" />
                        Monthly
                      </h3>
                      <span className="text-xl font-bold text-primary">
                        US$14.99/month
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                      <h3 className="font-medium flex items-center gap-2">
                        <Heart className="h-4 w-4 text-primary" />
                        Annual
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                          Save 17%
                        </span>
                      </h3>
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
                  <p className="text-xs text-muted-foreground mt-2">
                    <strong>Note:</strong> Payments are processed by Fluid Investment Group LLC, 
                    the holding and development company operating Kids Call Home. 
                    You will see "Fluid Investment Group LLC" on your payment receipts and billing statements.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Larger Families & Organizations */}
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Larger Families & Organizations
                </h2>
                <div className="bg-blue-100 dark:bg-blue-950/50 p-4 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                  <p className="text-blue-900 dark:text-blue-100 mb-3">
                    If you have more than 5 children, or you would like to use Kids
                    Call Home in an organization (for example a school, clinic, or
                    NGO), please contact us for custom pricing.
                  </p>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                    <Link
                      to="/beta"
                      className="text-blue-700 dark:text-blue-300 hover:underline font-semibold"
                    >
                      Contact us through Beta Program
                    </Link>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={() => navigate("/parent/upgrade")}
                  className="w-full sm:w-auto"
                >
                  View Subscription Options
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>

          <div className="text-center space-y-4 mt-8">
            <p className="text-sm text-muted-foreground">
              All plans include: Family-only contacts, encrypted communication, no ads
            </p>
            <Link
              to="/"
              className="inline-block text-sm text-primary hover:underline"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Pricing;


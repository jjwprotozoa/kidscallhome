// src/pages/Upgrade.tsx
// Upgrade page for Stripe subscription plans

import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Check, Crown, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isPWA } from "@/utils/platformDetection";
import { getStripe } from "@/utils/stripe";

interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  priceValue: number;
  interval: "month" | "year";
  kidsSupported: number | "unlimited";
  stripeLink: string;
  description: string;
  recommended?: boolean;
  allowQuantity?: boolean;
}

const PLANS: SubscriptionPlan[] = [
  {
    id: "additional-kid-monthly",
    name: "Additional Kid Monthly",
    price: "$2.99",
    priceValue: 2.99,
    interval: "month",
    kidsSupported: 1,
    stripeLink: "https://buy.stripe.com/7sYaEX4tHdms9b9fpqfQI05",
    description: "Add one more child to your account",
    allowQuantity: true,
  },
  {
    id: "additional-kid-annual",
    name: "Additional Kid Annual",
    price: "$29.99",
    priceValue: 29.99,
    interval: "year",
    kidsSupported: 1,
    stripeLink: "https://buy.stripe.com/14AdR94tH0zGdrpcdefQI06",
    description: "Add one more child (save 17% vs monthly)",
    allowQuantity: true,
  },
  {
    id: "family-bundle-monthly",
    name: "Family Bundle Monthly",
    price: "$14.99",
    priceValue: 14.99,
    interval: "month",
    kidsSupported: 5,
    stripeLink: "https://buy.stripe.com/aFa00j8JXciogDB3GIfQI07",
    description: "Perfect for families with up to 5 kids",
  },
  {
    id: "annual-family-plan",
    name: "Annual Family Plan",
    price: "$99",
    priceValue: 99,
    interval: "year",
    kidsSupported: "unlimited",
    stripeLink: "https://buy.stripe.com/8x24gz7FT3LS5YXgtufQI08",
    description: "Best value - unlimited kids for the whole family",
    recommended: true,
  },
];

const Upgrade = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [currentChildrenCount, setCurrentChildrenCount] = useState(0);
  const [allowedChildren, setAllowedChildren] = useState(1);
  const [subscriptionType, setSubscriptionType] = useState<string>("free");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("active");
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [email, setEmail] = useState("");
  const [emailLocked, setEmailLocked] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    checkAuth();
    // Only load subscription info if PWA (native apps use in-app purchases)
    if (isPWA()) {
      loadSubscriptionInfo();
    } else {
      setLoading(false);
    }
    
    // Check for Stripe Checkout return
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("session_id");
    const canceled = urlParams.get("canceled");
    
    if (sessionId) {
      // Payment successful - webhook will handle subscription update
      // But we can show success message and refresh
      toast({
        title: "Payment Successful!",
        description: "Your subscription is being activated. Please wait a moment...",
        variant: "default",
      });
      
      // Refresh subscription info after a delay (webhook needs time)
      setTimeout(async () => {
        if (isPWA()) {
          await loadSubscriptionInfo();
        }
        setShowSuccessDialog(true);
        setSuccessMessage("Your subscription has been activated successfully!");
      }, 2000);
      
      // Clean URL
      window.history.replaceState({}, "", "/parent/upgrade");
    } else if (canceled) {
      toast({
        title: "Payment Cancelled",
        description: "Your payment was cancelled. You can try again anytime.",
        variant: "default",
      });
      
      // Clean URL
      window.history.replaceState({}, "", "/parent/upgrade");
    }
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/parent/auth");
      return;
    }
  };

  const loadSubscriptionInfo = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get current subscription info
      const { data: parentData, error: parentError } = await supabase
        .from("parents")
        .select("email, allowed_children, subscription_type, subscription_status, subscription_expires_at")
        .eq("id", user.id)
        .single();

      if (parentError) {
        // Check if it's a column doesn't exist error (migration not run)
        if (
          parentError.code === "42703" ||
          parentError.message?.includes("does not exist")
        ) {
          console.warn(
            "Subscription columns don't exist yet. Migration not run:",
            parentError
          );
          toast({
            title: "Database Migration Required",
            description:
              "Please run the subscription migration: supabase/migrations/20250122000007_add_subscription_system.sql",
            variant: "destructive",
            duration: 10000,
          });
          // Set defaults if migration hasn't been run
          setAllowedChildren(1);
          setSubscriptionType("free");
          setEmail((parentData as any)?.email || "");
          setLoading(false);
          return;
        }
        console.error("Error loading subscription:", parentError);
        toast({
          title: "Error",
          description: "Failed to load subscription information",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const allowed = (parentData as any)?.allowed_children || 1;
      const subType = (parentData as any)?.subscription_type || "free";
      const subStatus = (parentData as any)?.subscription_status || "active";
      const expiresAt = (parentData as any)?.subscription_expires_at;

      setAllowedChildren(allowed);
      setSubscriptionType(subType);
      const userEmail = (parentData as any)?.email || user.email || "";
      setEmail(userEmail);
      setSubscriptionStatus(subStatus);

      // Check if user has an active subscription
      const isActive = subStatus === "active" && 
        (expiresAt === null || new Date(expiresAt) > new Date()) &&
        subType !== "free";
      setHasActiveSubscription(isActive);

      // Get current children count
      const { data: childrenData, error: childrenError } = await supabase
        .from("children")
        .select("id", { count: "exact" })
        .eq("parent_id", user.id);

      if (!childrenError && childrenData) {
        setCurrentChildrenCount(childrenData.length || 0);
      }
    } catch (error) {
      console.error("Error loading subscription info:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = (plan: SubscriptionPlan) => {
    // Prevent selecting the same plan they already have
    if (hasActiveSubscription && subscriptionType === plan.id) {
      toast({
        title: "Current Plan",
        description: "You are already subscribed to this plan.",
        variant: "default",
      });
      return;
    }

    setSelectedPlan(plan);
    setShowEmailDialog(true);
  };

  const handlePayment = async () => {
    if (!selectedPlan || !email.trim()) {
      toast({
        title: "Error",
        description: "Please enter your family account email",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Create Stripe Checkout Session via Edge Function
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
        "create-stripe-subscription",
        {
          body: {
            subscriptionType: selectedPlan.id,
            quantity: 1, // For now, quantity is 1. Can be made configurable later
          },
        }
      );

      if (checkoutError || !checkoutData?.success) {
        throw new Error(
          checkoutError?.message ||
          checkoutData?.error ||
          "Failed to create checkout session"
        );
      }

      const { url: checkoutUrl } = checkoutData;

      if (!checkoutUrl) {
        throw new Error("No checkout URL returned from subscription creation");
      }

      // Step 2: Redirect to Stripe Checkout
      // Stripe Checkout handles payment collection, 3DS, and subscription creation
      // After payment, user will be redirected back to success_url
      window.location.href = checkoutUrl;
    } catch (error: any) {
      console.error("Error processing payment:", error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to process payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processUpgrade = async () => {
    if (!selectedPlan) return;

    try {
      setIsProcessing(true);

      // Calculate allowed children based on plan
      let newAllowedChildren = allowedChildren;

      if (selectedPlan.id === "annual-family-plan") {
        newAllowedChildren = 999; // Unlimited
      } else if (selectedPlan.id === "family-bundle-monthly") {
        newAllowedChildren = 5;
      } else if (
        selectedPlan.id === "additional-kid-monthly" ||
        selectedPlan.id === "additional-kid-annual"
      ) {
        newAllowedChildren = allowedChildren + 1;
      }

      // SECURITY: Verify email matches authenticated user (prevents account sharing)
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      
      if (!authUser || authUser.email !== email.trim()) {
        toast({
          title: "Security Error",
          description: "Email must match your authenticated account. You can only upgrade your own account.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Call backend function to upgrade subscription
      // Backend will also verify email matches authenticated user (double security)
      const { data, error } = await (supabase.rpc as any)(
        "upgrade_family_subscription",
        {
          p_family_email: email.trim(),
          p_subscription_type: selectedPlan.id,
          p_allowed_children: newAllowedChildren,
          // Note: In production, pass actual Stripe checkout session ID from webhook
          p_stripe_checkout_session_id: null,
        }
      );

      if (error) {
        // Check if function doesn't exist (migration not run)
        if (
          error.code === "PGRST202" ||
          error.message?.includes("Could not find the function")
        ) {
          throw new Error(
            "Database migration not run. Please run: supabase/migrations/20250122000007_add_subscription_system.sql"
          );
        }
        throw error;
      }

      if (data?.success) {
        setSuccessMessage(
          `Successfully upgraded! You can now add up to ${
            newAllowedChildren === 999 ? "unlimited" : newAllowedChildren
          } children.`
        );
        setShowEmailDialog(false);
        setShowSuccessDialog(true);
        await loadSubscriptionInfo(); // Refresh subscription info
      } else {
        throw new Error(data?.error || "Failed to upgrade subscription");
      }
    } catch (error: any) {
      console.error("Error upgrading subscription:", error);
      toast({
        title: "Upgrade Failed",
        description:
          error.message ||
          "Failed to upgrade subscription. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualUpgrade = async () => {
    await processUpgrade();
  };

  // Hide upgrade page for native apps (they use in-app purchases)
  if (!isPWA()) {
    return (
      <div className="min-h-[100dvh] bg-background w-full overflow-x-hidden">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <Card className="p-8 max-w-md text-center">
            <h2 className="text-2xl font-bold mb-4">In-App Purchases</h2>
            <p className="text-muted-foreground mb-4">
              This app uses in-app purchases through the App Store or Play Store.
              Please upgrade your subscription through your device's app store.
            </p>
            <Button onClick={() => navigate("/parent/dashboard")}>
              Go to Dashboard
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background w-full overflow-x-hidden">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background w-full overflow-x-hidden">
      <Navigation />
      <div
        className="px-4 pb-4"
        style={{
          paddingTop: "calc(0.5rem + 64px + var(--safe-area-inset-top) * 0.15)",
        }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="mt-4 mb-8">
            <h1 className="text-3xl font-bold mb-2">Upgrade Your Plan</h1>
            <p className="text-muted-foreground">
              Choose a plan that fits your family's needs
            </p>
          </div>

          {/* Current Plan Display */}
          {hasActiveSubscription && (
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
          )}

          {/* Current Status (for free tier) */}
          {!hasActiveSubscription && (
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
          )}

          {/* Plans Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {PLANS.map((plan) => {
              // Check if this is the same plan they already have
              const isCurrentPlan = subscriptionType === plan.id;
              const isUpgrade = hasActiveSubscription && 
                (plan.id === "annual-family-plan" || 
                 (plan.id === "family-bundle-monthly" && subscriptionType !== "annual-family-plan" && subscriptionType !== "family-bundle-monthly") ||
                 (plan.id.includes("additional") && !subscriptionType.includes("additional")));
              const isDowngrade = hasActiveSubscription && 
                subscriptionType === "annual-family-plan" && 
                plan.id !== "annual-family-plan";
              
              return (
                <Card
                  key={plan.id}
                  className={`p-6 relative ${
                    isCurrentPlan
                      ? "border-2 border-primary shadow-lg bg-primary/5"
                      : plan.recommended
                      ? "border-2 border-primary/50 shadow-md"
                      : "border"
                  }`}
                >
                  {plan.recommended && !isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                        <Crown className="h-3 w-3" />
                        Best Value
                      </span>
                    </div>
                  )}
                  {isCurrentPlan && (
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
                          {plan.kidsSupported === "unlimited"
                            ? "Unlimited children"
                            : `Up to ${plan.kidsSupported} ${
                                plan.kidsSupported === 1 ? "child" : "children"
                              }`}
                        </span>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      variant={
                        isCurrentPlan 
                          ? "secondary" 
                          : plan.recommended 
                          ? "default" 
                          : "outline"
                      }
                      onClick={() => handlePlanSelect(plan)}
                      disabled={isProcessing || isCurrentPlan}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : isCurrentPlan ? (
                        "Current Plan"
                      ) : isUpgrade ? (
                        "Upgrade"
                      ) : isDowngrade ? (
                        "Downgrade"
                      ) : (
                        "Select Plan"
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

          {/* Info Section */}
          <Card className="p-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                  How It Works
                </h3>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                  <li>Select a plan and complete payment through Stripe</li>
                  <li>Enter your family account email to link the subscription</li>
                  <li>Your account will be upgraded automatically</li>
                  <li>Start adding more children right away!</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Email Entry Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Your Upgrade</DialogTitle>
            <DialogDescription>
              Enter your family account email to link this subscription to your
              account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Family Account Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your-email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isProcessing || emailLocked}
                readOnly={emailLocked}
                className={emailLocked ? "bg-muted cursor-not-allowed" : ""}
              />
              {emailLocked && (
                <p className="text-xs text-muted-foreground">
                  Email is locked to your authenticated account for security
                </p>
              )}
            </div>
            {selectedPlan && (
              <Card className="p-4 bg-muted">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{selectedPlan.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedPlan.price}/{selectedPlan.interval === "month" ? "month" : "year"}
                  </p>
                </div>
              </Card>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowEmailDialog(false);
                setIsProcessing(false);
              }}
              disabled={isProcessing}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayment}
              disabled={isProcessing || !email.trim()}
              className="w-full sm:w-auto"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Proceed to Payment"
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={handleManualUpgrade}
              disabled={isProcessing || !email.trim()}
              className="w-full sm:w-auto"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "I Already Paid"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade Successful!</DialogTitle>
            <DialogDescription>{successMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowSuccessDialog(false);
                navigate("/parent/dashboard");
              }}
            >
              Go to Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Upgrade;


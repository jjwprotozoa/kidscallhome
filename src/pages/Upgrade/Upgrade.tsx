// src/pages/Upgrade/Upgrade.tsx
// Purpose: Main orchestrator for Upgrade page

import { ParentLayout } from "@/components/layout/ParentLayout";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyMemberRedirect } from "@/hooks/useFamilyMemberRedirect";
import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { isPWA, getPlatform } from "@/utils/platformDetection";
import { useSubscriptionData } from "./useSubscriptionData";
import { usePaymentHandlers } from "./usePaymentHandlers";
import { PricingPlans } from "./PricingPlans";
import { CurrentPlanDisplay } from "./CurrentPlanDisplay";
import { PaymentDialog } from "./PaymentDialog";
import { SuccessDialog } from "./SuccessDialog";
import { SubscriptionPlan } from "./types";

const Upgrade = () => {
  // Redirect family members away from parent routes
  useFamilyMemberRedirect();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { loading, subscriptionData, refreshSubscriptionInfo } = useSubscriptionData();
  
  // Check if we're waiting for subscription activation (just returned from checkout)
  const isWaitingForActivation = useMemo(() => {
    return searchParams.has("session_id") || searchParams.get("success") === "1";
  }, [searchParams]);
  const {
    isProcessing,
    isManagingSubscription,
    handlePayment,
    processUpgrade,
    handleManageSubscription,
    handleSwitchSubscription,
  } = usePaymentHandlers(
    subscriptionData?.allowedChildren || 1,
    refreshSubscriptionInfo,
    subscriptionData?.stripeCustomerId || null
  );

  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [email, setEmail] = useState("");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const checkAuth = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/parent/auth");
    }
  }, [navigate]);

  useEffect(() => {
    checkAuth();
    
    // Check for Stripe Checkout return
    const sessionId = searchParams.get("session_id");
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    const upgraded = searchParams.get("upgraded");
    
    if (sessionId || success === "1") {
      toast({
        title: "Payment Successful!",
        description: "Your subscription is being activated. Please wait a moment...",
        variant: "default",
      });
      
      // Refresh multiple times to ensure webhook has processed
      // Webhooks can take a few seconds to process
      const refreshWithRetries = async (retries = 5) => {
        for (let i = 0; i < retries; i++) {
          await refreshSubscriptionInfo();
          
          // Check if subscription is now active
          // We'll check this after a few refreshes
          if (i >= 2) {
            // Force a re-render by checking subscription data
            // The component will re-render when subscriptionData changes
          }
          
          // Wait before next refresh (except on last iteration)
          if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      };
      
      refreshWithRetries().then(() => {
        setShowSuccessDialog(true);
        setSuccessMessage("Your subscription has been activated successfully!");
      });
      
      window.history.replaceState({}, "", "/parent/upgrade");
    } else if (upgraded) {
      toast({
        title: "Subscription Updated!",
        description: "Your subscription plan has been successfully updated.",
        variant: "default",
      });
      
      // Refresh subscription info immediately and again after a short delay
      // to ensure database has been updated
      refreshSubscriptionInfo().then(() => {
        setTimeout(async () => {
          await refreshSubscriptionInfo(); // Refresh again to catch any webhook updates
          setShowSuccessDialog(true);
          setSuccessMessage("Your subscription has been updated successfully!");
        }, 2000);
      });
      
      window.history.replaceState({}, "", "/parent/upgrade");
    } else if (canceled) {
      toast({
        title: "Payment Cancelled",
        description: "Your payment was cancelled. You can try again anytime.",
        variant: "default",
      });
      
      // Clear URL params after processing
      navigate("/parent/upgrade", { replace: true });
    }
  }, [toast, refreshSubscriptionInfo, checkAuth, navigate, searchParams]);

  useEffect(() => {
    if (subscriptionData?.email) {
      setEmail(subscriptionData.email);
    }
  }, [subscriptionData]);

  const handlePlanSelect = async (plan: SubscriptionPlan) => {
    if (
      subscriptionData?.hasActiveSubscription &&
      subscriptionData.subscriptionType === plan.id
    ) {
      toast({
        title: "Current Plan",
        description: "You are already subscribed to this plan.",
        variant: "default",
      });
      return;
    }

    // If user has active subscription, try to switch using the change-subscription endpoint
    if (subscriptionData?.hasActiveSubscription && subscriptionData?.stripeCustomerId) {
      const priceIdMap: Record<string, string> = {
        "family-bundle-monthly": "price_1SUVdqIIyqCwTeH2zggZpPAK",
        "family-bundle-annual": "price_1SkPL7IIyqCwTeH2tI9TxHRB",
      };
      
      const newPriceId = priceIdMap[plan.id];
      if (newPriceId) {
        // Determine proration mode: Monthly -> Annual: immediate, Annual -> Monthly: next_cycle
        const prorationMode =
          subscriptionData.subscriptionType === "family-bundle-monthly" &&
          plan.id === "family-bundle-annual"
            ? "immediate"
            : subscriptionData.subscriptionType === "family-bundle-annual" &&
              plan.id === "family-bundle-monthly"
            ? "next_cycle"
            : "immediate";

        const result = await handleSwitchSubscription(newPriceId, prorationMode);
        if (result?.success) {
          return;
        }
        // If switch fails, fall back to checkout flow
      }
    }

    // For new subscriptions or if switch fails, use checkout flow
    setSelectedPlan(plan);
    setShowEmailDialog(true);
  };

  const handlePaymentClick = async () => {
    if (!selectedPlan || !email.trim()) return;
    await handlePayment(selectedPlan, email);
  };

  const handleManualUpgradeClick = async () => {
    if (!selectedPlan || !email.trim()) return;
    const result = await processUpgrade(selectedPlan, email);
    if (result?.success) {
      setSuccessMessage(result.message || "Upgrade successful!");
      setShowEmailDialog(false);
      setShowSuccessDialog(true);
    }
  };

  // Show app store subscription management message for native apps
  if (!isPWA()) {
    const platform = getPlatform();
    const isIOS = platform === "ios";
    const isAndroid = platform === "android";
    
    return (
      <ParentLayout>
        <OnboardingTour role="parent" pageKey="parent_upgrade" />
        <HelpBubble role="parent" pageKey="parent_upgrade" />
        <div className="p-4">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="mt-2">
              <h1 className="text-3xl font-bold">Manage Subscription</h1>
              <p className="text-muted-foreground mt-2">
                Manage your subscription through your device's app store
              </p>
            </div>

            <CurrentPlanDisplay
              hasActiveSubscription={subscriptionData?.hasActiveSubscription || false}
              subscriptionType={subscriptionData?.subscriptionType || "free"}
              currentChildrenCount={subscriptionData?.currentChildrenCount || 0}
              allowedChildren={subscriptionData?.allowedChildren || 1}
            />

            {/* App Store Subscription Management Info */}
            <Card className="p-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-3">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    {isIOS && "Manage Subscription in App Store"}
                    {isAndroid && "Manage Subscription in Google Play"}
                    {!isIOS && !isAndroid && "Manage Subscription in App Store"}
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Subscriptions for this app are managed through your device's app store. 
                    To upgrade, change, or cancel your subscription:
                  </p>
                  {isIOS && (
                    <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2 list-decimal list-inside ml-2">
                      <li>Open the <strong>App Store</strong> app on your device</li>
                      <li>Tap your profile icon in the top right</li>
                      <li>Tap <strong>Subscriptions</strong></li>
                      <li>Find <strong>KidsCallHome</strong> and tap to manage</li>
                    </ol>
                  )}
                  {isAndroid && (
                    <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2 list-decimal list-inside ml-2">
                      <li>Open <strong>Google Play Store</strong> app on your device</li>
                      <li>Tap your profile icon in the top right</li>
                      <li>Tap <strong>Payments & subscriptions</strong> → <strong>Subscriptions</strong></li>
                      <li>Find <strong>KidsCallHome</strong> and tap to manage</li>
                    </ol>
                  )}
                  {!isIOS && !isAndroid && (
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Please access your device's app store settings to manage your subscription.
                    </p>
                  )}
                  <div className="pt-2 mt-3 border-t border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>Note:</strong> Your subscription will sync across all devices when you sign in with the same account.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </ParentLayout>
    );
  }

  // Show loading state while fetching subscription data
  if (loading || !subscriptionData) {
    return (
      <ParentLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <OnboardingTour role="parent" pageKey="parent_upgrade" />
      <HelpBubble role="parent" pageKey="parent_upgrade" />
      <div className="p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="mt-2">
            <h1 className="text-3xl font-bold">Upgrade Your Plan</h1>
            <p className="text-muted-foreground mt-2">
              Choose a plan that fits your family's needs
            </p>
          </div>

          <CurrentPlanDisplay
            hasActiveSubscription={subscriptionData.hasActiveSubscription}
            subscriptionType={subscriptionData.subscriptionType}
            currentChildrenCount={subscriptionData.currentChildrenCount}
            allowedChildren={subscriptionData.allowedChildren}
            onManageSubscription={handleManageSubscription}
            isManagingSubscription={isManagingSubscription}
            hasStripeCustomer={!!subscriptionData.stripeCustomerId}
          />
          
          {isWaitingForActivation && !subscriptionData.hasActiveSubscription && (
            <Card className="p-4 mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Activating your subscription...
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Please wait while we process your payment. This may take a few seconds.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <PricingPlans
            subscriptionType={subscriptionData.subscriptionType}
            hasActiveSubscription={subscriptionData.hasActiveSubscription}
            isProcessing={isProcessing}
            onPlanSelect={handlePlanSelect}
          />

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
                  <li>
                    Your subscription works across all devices
                    <span className="text-xs text-blue-700 dark:text-blue-300 block mt-0.5 ml-4">
                      (Sign in with the same account on any device to access your subscription)
                    </span>
                  </li>
                  <li>Start adding more children right away!</li>
                </ul>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                  <strong>Note:</strong> Payments are processed by Fluid Investment Group LLC. 
                  You will see "Fluid Investment Group LLC" on your payment receipts and billing statements.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <PaymentDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        selectedPlan={selectedPlan}
        email={email}
        onEmailChange={setEmail}
        emailLocked={true}
        isProcessing={isProcessing}
        onPayment={handlePaymentClick}
        onManualUpgrade={handleManualUpgradeClick}
      />

      <SuccessDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        message={successMessage}
        onNavigateToDashboard={() => navigate("/parent/family")}
      />
    </ParentLayout>
  );
};

export default Upgrade;


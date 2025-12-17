// src/pages/Upgrade/Upgrade.tsx
// Purpose: Main orchestrator for Upgrade page

import Navigation from "@/components/Navigation";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyMemberRedirect } from "@/hooks/useFamilyMemberRedirect";
import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { isPWA } from "@/utils/platformDetection";
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
  const { toast } = useToast();
  const { loading, subscriptionData, refreshSubscriptionInfo } = useSubscriptionData();
  const {
    isProcessing,
    isManagingSubscription,
    handlePayment,
    processUpgrade,
    handleManageSubscription,
  } = usePaymentHandlers(
    subscriptionData?.allowedChildren || 1,
    refreshSubscriptionInfo
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
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("session_id");
    const canceled = urlParams.get("canceled");
    
    if (sessionId) {
      toast({
        title: "Payment Successful!",
        description: "Your subscription is being activated. Please wait a moment...",
        variant: "default",
      });
      
      setTimeout(async () => {
        if (isPWA()) {
          await refreshSubscriptionInfo();
        }
        setShowSuccessDialog(true);
        setSuccessMessage("Your subscription has been activated successfully!");
      }, 2000);
      
      window.history.replaceState({}, "", "/parent/upgrade");
    } else if (canceled) {
      toast({
        title: "Payment Cancelled",
        description: "Your payment was cancelled. You can try again anytime.",
        variant: "default",
      });
      
      window.history.replaceState({}, "", "/parent/upgrade");
    }
  }, [toast, refreshSubscriptionInfo, checkAuth]);

  useEffect(() => {
    if (subscriptionData?.email) {
      setEmail(subscriptionData.email);
    }
  }, [subscriptionData]);

  const handlePlanSelect = (plan: SubscriptionPlan) => {
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

  // Show native purchase UI for native apps
  if (!isPWA()) {
    return (
      <div className="min-h-[100dvh] bg-background w-full overflow-x-hidden">
        <Navigation />
        <OnboardingTour role="parent" pageKey="parent_upgrade" />
        <HelpBubble role="parent" pageKey="parent_upgrade" />
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

            <CurrentPlanDisplay
              hasActiveSubscription={subscriptionData?.hasActiveSubscription || false}
              subscriptionType={subscriptionData?.subscriptionType || "free"}
              currentChildrenCount={subscriptionData?.currentChildrenCount || 0}
              allowedChildren={subscriptionData?.allowedChildren || 1}
              isManagingSubscription={isManagingSubscription}
              onManageSubscription={handleManageSubscription}
            />

            <PricingPlans
              subscriptionType={subscriptionData?.subscriptionType || "free"}
              hasActiveSubscription={subscriptionData?.hasActiveSubscription || false}
              isProcessing={isProcessing}
              onPlanSelect={handlePlanSelect}
            />

            {/* Info Section */}
            <Card className="p-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    In-App Purchases
                  </h3>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                    <li>Purchases are processed through your device's app store</li>
                    <li>Subscriptions are managed through your app store account</li>
                    <li>Your subscription syncs across all your devices</li>
                    <li>Start adding more children right away!</li>
                  </ul>
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
          onNavigateToDashboard={() => navigate("/parent/dashboard")}
        />
      </div>
    );
  }

  if (loading || !subscriptionData) {
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
      <OnboardingTour role="parent" pageKey="parent_upgrade" />
      <HelpBubble role="parent" pageKey="parent_upgrade" />
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

          <CurrentPlanDisplay
            hasActiveSubscription={subscriptionData.hasActiveSubscription}
            subscriptionType={subscriptionData.subscriptionType}
            currentChildrenCount={subscriptionData.currentChildrenCount}
            allowedChildren={subscriptionData.allowedChildren}
            isManagingSubscription={isManagingSubscription}
            onManageSubscription={handleManageSubscription}
          />

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
                  <li>Start adding more children right away!</li>
                </ul>
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
        onNavigateToDashboard={() => navigate("/parent/dashboard")}
      />
    </div>
  );
};

export default Upgrade;


// src/pages/Upgrade/usePaymentHandlers.ts
// Purpose: Hook for handling payment operations

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SubscriptionPlan } from "./types";
import { UNLIMITED_CHILDREN } from "./constants";
import { purchaseNativeSubscription } from "@/utils/nativePurchases";
import { isPWA } from "@/utils/platformDetection";

export const usePaymentHandlers = (
  currentAllowedChildren: number,
  refreshSubscriptionInfo: () => Promise<void>
) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);

  const handlePayment = async (selectedPlan: SubscriptionPlan, email: string) => {
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
      // Check if running on native app (use native purchases) or PWA (use Stripe)
      if (!isPWA()) {
        // Native app: Use app store purchases
        const result = await purchaseNativeSubscription(selectedPlan);
        
        if (result.success) {
          toast({
            title: "Purchase Successful!",
            description: result.message || "Your subscription has been activated.",
            variant: "default",
          });
          await refreshSubscriptionInfo();
          return { success: true, message: result.message };
        } else {
          throw new Error(result.message || "Native purchase failed");
        }
      }

      // PWA: Use Stripe Checkout
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
      window.location.href = checkoutUrl;
    } catch (error: unknown) {
      console.error("Error processing payment:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to process payment. Please try again.";
      toast({
        title: "Payment Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsProcessing(false);
    }
  };

  const processUpgrade = async (selectedPlan: SubscriptionPlan, email: string) => {
    if (!selectedPlan) return;

    try {
      setIsProcessing(true);

      // Calculate allowed children based on plan
      let newAllowedChildren = currentAllowedChildren;

      if (selectedPlan.id === "annual-family-plan") {
        newAllowedChildren = UNLIMITED_CHILDREN;
      } else if (selectedPlan.id === "family-bundle-monthly") {
        newAllowedChildren = 5;
      } else if (
        selectedPlan.id === "additional-kid-monthly" ||
        selectedPlan.id === "additional-kid-annual"
      ) {
        newAllowedChildren = currentAllowedChildren + 1;
      }

      // SECURITY: Verify email matches authenticated user
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
      const { data, error } = await supabase.rpc(
        "upgrade_family_subscription",
        {
          p_family_email: email.trim(),
          p_subscription_type: selectedPlan.id,
          p_allowed_children: newAllowedChildren,
          p_stripe_checkout_session_id: null,
        }
      );

      if (error) {
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
        await refreshSubscriptionInfo();
        return {
          success: true,
          message: `Successfully upgraded! You can now add up to ${
            newAllowedChildren === UNLIMITED_CHILDREN ? "unlimited" : newAllowedChildren
          } children.`,
        };
      } else {
        throw new Error(data?.error || "Failed to upgrade subscription");
      }
    } catch (error: unknown) {
      console.error("Error upgrading subscription:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upgrade subscription. Please contact support.";
      toast({
        title: "Upgrade Failed",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsManagingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-customer-portal-session",
        {
          body: {
            returnUrl: `${window.location.origin}/parent/upgrade`,
          },
        }
      );

      if (error) {
        throw error;
      }

      if (data?.success && data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || "Failed to create portal session");
      }
    } catch (error: unknown) {
      console.error("Error opening subscription management:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to open subscription management. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsManagingSubscription(false);
    }
  };

  return {
    isProcessing,
    isManagingSubscription,
    handlePayment,
    processUpgrade,
    handleManageSubscription,
  };
};


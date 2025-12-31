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
  refreshSubscriptionInfo: () => Promise<void>,
  stripeCustomerId: string | null = null
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
      try {
        const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
          "create-stripe-subscription",
          {
            body: {
              subscriptionType: selectedPlan.id,
              quantity: 1,
            },
          }
        );

        if (checkoutError) {
          console.error("Edge Function error:", checkoutError);
          console.error("Full error object:", JSON.stringify(checkoutError, null, 2));
          
          // Try to extract error details from the error object
          let errorMessage = checkoutError.message || "Unknown error";
          let errorDetails = "";
          
          // Supabase functions.invoke() error structure can vary
          // Try multiple ways to extract the actual error message
          const errorObj = checkoutError as { context?: unknown; response?: unknown };
          if (errorObj.context) {
            try {
              const context = errorObj.context as Record<string, unknown>;
              if (typeof context.error === 'string') {
                errorMessage = context.error;
              } else if (typeof context.message === 'string') {
                errorMessage = context.message;
              } else if (typeof context === 'string') {
                errorMessage = context;
              } else if (context.body) {
                // Sometimes error is in context.body
                const body = typeof context.body === 'string' ? JSON.parse(context.body) : context.body;
                if (typeof body === 'object' && body !== null) {
                  const bodyObj = body as Record<string, unknown>;
                  errorMessage = (typeof bodyObj.error === 'string' ? bodyObj.error : typeof bodyObj.message === 'string' ? bodyObj.message : errorMessage);
                  errorDetails = typeof bodyObj.details === 'string' ? bodyObj.details : "";
                }
              }
            } catch (e) {
              console.error("Error parsing context:", e);
            }
          }
          
          // Also check if error has a response body
          if (errorObj.response) {
            try {
              const response = errorObj.response as { body?: unknown };
              if (response.body) {
                const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
                if (typeof body === 'object' && body !== null) {
                  const bodyObj = body as Record<string, unknown>;
                  if (typeof bodyObj.error === 'string') errorMessage = bodyObj.error;
                  if (typeof bodyObj.details === 'string') errorDetails = bodyObj.details;
                }
              }
            } catch (e) {
              console.error("Error parsing response:", e);
            }
          }
          
          // If we still don't have details, try to fetch the error response directly
          if (!errorDetails && errorMessage === "Edge Function returned a non-2xx status code") {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
                
                if (supabaseUrl && supabaseKey) {
                  const response = await fetch(
                    `${supabaseUrl}/functions/v1/create-stripe-subscription`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                        apikey: supabaseKey,
                      },
                      body: JSON.stringify({
                        subscriptionType: selectedPlan.id,
                        quantity: 1,
                      }),
                    }
                  );
                  
                  if (!response.ok) {
                    const errorBody = await response.json().catch(() => ({}));
                    console.error("Fetched error from Edge Function:", errorBody);
                    if (errorBody.error) {
                      errorMessage = errorBody.error;
                      // Combine details, stripeErrorCode, and stripeErrorMessage for full context
                      const detailsParts = [];
                      if (errorBody.details) detailsParts.push(errorBody.details);
                      if (errorBody.stripeErrorCode) detailsParts.push(`Code: ${errorBody.stripeErrorCode}`);
                      if (errorBody.stripeErrorMessage) detailsParts.push(`Message: ${errorBody.stripeErrorMessage}`);
                      errorDetails = detailsParts.join(" | ");
                    }
                  }
                }
              }
            } catch (fetchError) {
              console.error("Failed to fetch error details:", fetchError);
            }
          }
          
          // Log the full error for debugging
          console.error("Extracted error message:", errorMessage);
          if (errorDetails) {
            console.error("Error details:", errorDetails);
          }
          
          const fullErrorMessage = errorDetails 
            ? `Payment setup failed: ${errorMessage} (${errorDetails})`
            : `Payment setup failed: ${errorMessage}`;
          
          throw new Error(fullErrorMessage);
        }

        if (!checkoutData?.success) {
          console.error("Edge Function returned error:", checkoutData);
          
          // If user has existing subscription, redirect to Customer Portal
          if (checkoutData?.hasExistingSubscription && checkoutData?.redirectToPortal) {
            toast({
              title: "Active Subscription Found",
              description: "You already have an active subscription. Opening Customer Portal to manage your plan...",
              variant: "default",
            });
            // Open Customer Portal
            await handleManageSubscription();
            return;
          }
          
          const errorMessage = checkoutData?.error || checkoutData?.details || "Unknown error from payment service";
          throw new Error(`Payment setup failed: ${errorMessage}`);
        }

        // New subscription - redirect to Stripe Checkout
        const checkoutUrl = checkoutData?.url || checkoutData?.checkoutUrl;

        if (!checkoutUrl) {
          throw new Error("No checkout URL returned from subscription creation");
        }

        // Step 2: Redirect to Stripe Checkout
        window.location.href = checkoutUrl;
      } catch (error: unknown) {
        // Re-throw if it's already our formatted error
        if (error instanceof Error && error.message.startsWith("Payment setup failed:")) {
          throw error;
        }
        
        // Otherwise, wrap it
        console.error("Unexpected error in payment flow:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to process payment. Please try again.";
        throw new Error(`Payment setup failed: ${errorMessage}`);
      }
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

      if (selectedPlan.id === "family-bundle-monthly" || selectedPlan.id === "family-bundle-annual") {
        newAllowedChildren = 5;
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

      const result = data as { success?: boolean; error?: string } | null;
      if (result?.success) {
        await refreshSubscriptionInfo();
        return {
          success: true,
          message: `Successfully upgraded! You can now add up to ${
            newAllowedChildren === UNLIMITED_CHILDREN ? "unlimited" : newAllowedChildren
          } children.`,
        };
      } else {
        throw new Error(result?.error || "Failed to upgrade subscription");
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
    // Check if user has a Stripe customer ID before attempting to manage subscription
    if (!stripeCustomerId) {
      toast({
        title: "Subscription Required",
        description:
          "You need to subscribe first before you can manage your subscription. Please select a plan below to get started.",
        variant: "default",
      });
      return;
    }

    setIsManagingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-customer-portal-session",
        {
          body: {},
        }
      );

      if (error) {
        // Try to extract the actual error message from the response
        let errorMessage = error.message || "Failed to open subscription management.";
        
        // Try to get error details from error context (Response object)
        if (error.context) {
          try {
            if (error.context instanceof Response) {
              const responseText = await error.context.clone().text();
              const responseData = responseText ? JSON.parse(responseText) : null;
              if (responseData?.error) {
                errorMessage = responseData.error;
              }
            }
          } catch (e) {
            // Ignore parsing errors, use default message
          }
        }
        
        // Check for specific error cases
        const status = error.status || (error.context instanceof Response ? error.context.status : undefined);
        
        if (status === 400) {
          // 400 means business logic error (like no Stripe customer)
          if (errorMessage.includes("No Stripe customer") || errorMessage.includes("subscribe first")) {
            errorMessage = "No active subscription found. Please subscribe to a plan first to manage your subscription.";
          }
        } else if (status === 404) {
          errorMessage = "Subscription management service is not available. Please verify the function is deployed.";
        } else if (status === 401) {
          errorMessage = "You need to be logged in to manage your subscription.";
        }
        
        throw new Error(errorMessage);
      }

      if (data?.success && data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || "Failed to create portal session");
      }
    } catch (error: unknown) {
      console.error("Error opening subscription management:", error);
      
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to open subscription management. Please try again.";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsManagingSubscription(false);
    }
  };

  const handleSwitchSubscription = async (
    newPriceId: string,
    prorationMode?: "immediate" | "next_cycle"
  ) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "stripe-change-subscription",
        {
          body: {
            newPriceId,
            prorationMode,
          },
        }
      );

      if (error) {
        throw new Error(error.message || "Failed to change subscription");
      }

      if (data?.success) {
        toast({
          title: "Subscription Updated",
          description:
            prorationMode === "next_cycle"
              ? "Your subscription will change at the end of your current billing period."
              : "Your subscription has been updated successfully.",
          variant: "default",
        });
        // Refresh subscription info to update UI
        await refreshSubscriptionInfo();
        // Refresh again after a short delay to ensure webhook has processed
        setTimeout(async () => {
          await refreshSubscriptionInfo();
        }, 2000);
        return { success: true, data };
      } else {
        throw new Error(data?.error || "Failed to change subscription");
      }
    } catch (error: unknown) {
      console.error("Error switching subscription:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to change subscription. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    isManagingSubscription,
    handlePayment,
    processUpgrade,
    handleManageSubscription,
    handleSwitchSubscription,
  };
};


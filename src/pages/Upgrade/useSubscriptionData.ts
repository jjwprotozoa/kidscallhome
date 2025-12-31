// src/pages/Upgrade/useSubscriptionData.ts
// Purpose: Hook for fetching subscription data and status

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionData, SubscriptionTier } from "./types";
import { DEFAULT_ALLOWED_CHILDREN } from "./constants";
import type { Database } from "@/integrations/supabase/types";

type ParentRow = Database["public"]["Tables"]["parents"]["Row"];

// Type for billing_subscriptions table (not yet in generated types)
type BillingSubscription = {
  status: string;
  stripe_price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
};

export const useSubscriptionData = () => {
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);

  const loadSubscriptionInfo = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get parent email
      const { data: parentData } = await supabase
        .from("parents")
        .select("email")
        .eq("id", user.id)
        .single();
      
      const userEmail = parentData?.email || user.email || "";

      // Get billing subscription info from billing_subscriptions table
      // Use maybeSingle() instead of single() because user might not have a subscription yet
      // maybeSingle() returns null for zero rows (no error), or a single object for one row
      // Type assertion needed because billing_subscriptions is not yet in generated types
      const { data: billingSubData, error: billingError } = await supabase
        .from("billing_subscriptions" as never)
        .select("status, stripe_price_id, current_period_end, cancel_at_period_end, stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      const billingSub = billingSubData as BillingSubscription | null;

      // If there's an actual error (not just no rows), log it
      if (billingError) {
        console.error("Error loading billing subscription:", billingError);
      }
      
      // If billingSub is null, user is on free plan (no subscription record exists)

      // Determine subscription type from price ID
      // Handle both production and test mode price IDs
      let subType: SubscriptionTier = "free";
      let allowed = DEFAULT_ALLOWED_CHILDREN;
      
      if (billingSub?.stripe_price_id) {
        const priceId = billingSub.stripe_price_id;
        
        // Production price IDs
        const isMonthlyProd = priceId === "price_1SUVdqIIyqCwTeH2zggZpPAK";
        const isAnnualProd = priceId === "price_1SkPL7IIyqCwTeH2tI9TxHRB";
        
        // Test price IDs
        const isMonthlyTest = priceId === "price_1SjULhIIyqCwTeH2GmBL1jVk";
        const isAnnualTest = priceId === "price_1SkQUaIIyqCwTeH2QowSbcfb";
        
        // Map price IDs to subscription types
        if (isMonthlyProd || isMonthlyTest) {
          subType = "family-bundle-monthly";
          allowed = 5;
        } else if (isAnnualProd || isAnnualTest) {
          subType = "family-bundle-annual";
          allowed = 5;
        } else {
          // Unknown price ID - log for debugging
          console.warn("Unknown price ID in subscription:", priceId);
        }
      }

      const subStatus = billingSub?.status || "inactive";
      const expiresAt = billingSub?.current_period_end || null;

      // Check if user has an active subscription
      // Consider subscriptions active if status is "active" and not expired
      const isActive = (subStatus === "active" || subStatus === "trialing") && 
        (expiresAt === null || new Date(expiresAt) > new Date()) &&
        subType !== "free";

      // Get current children count
      const { data: childrenData, error: childrenError } = await supabase
        .from("children")
        .select("id", { count: "exact" })
        .eq("parent_id", user.id);

      const currentChildrenCount = childrenError ? 0 : (childrenData?.length || 0);

      setSubscriptionData({
        email: userEmail,
        allowedChildren: allowed,
        subscriptionType: subType,
        subscriptionStatus: subStatus,
        subscriptionExpiresAt: expiresAt,
        currentChildrenCount,
        hasActiveSubscription: isActive,
        stripeCustomerId: billingSub?.stripe_customer_id || null,
      });
    } catch (error) {
      console.error("Error loading subscription info:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscriptionInfo();
  }, [loadSubscriptionInfo]);

  return {
    loading,
    subscriptionData,
    refreshSubscriptionInfo: loadSubscriptionInfo,
  };
};


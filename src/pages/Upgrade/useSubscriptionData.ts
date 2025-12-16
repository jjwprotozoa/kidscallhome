// src/pages/Upgrade/useSubscriptionData.ts
// Purpose: Hook for fetching subscription data and status

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SubscriptionData, SubscriptionTier } from "./types";
import { DEFAULT_ALLOWED_CHILDREN } from "./constants";
import type { Database } from "@/integrations/supabase/types";

type ParentRow = Database["public"]["Tables"]["parents"]["Row"];

export const useSubscriptionData = () => {
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const { toast } = useToast();

  const loadSubscriptionInfo = useCallback(async () => {
    try {
      setLoading(true);
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
          setSubscriptionData({
            email: (parentData as ParentRow | null)?.email || user.email || "",
            allowedChildren: DEFAULT_ALLOWED_CHILDREN,
            subscriptionType: "free",
            subscriptionStatus: "active",
            subscriptionExpiresAt: null,
            currentChildrenCount: 0,
            hasActiveSubscription: false,
          });
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

      const allowed = parentData?.allowed_children ?? DEFAULT_ALLOWED_CHILDREN;
      const subType = parentData?.subscription_type || "free";
      const subStatus = parentData?.subscription_status || "active";
      const expiresAt = parentData?.subscription_expires_at;
      const userEmail = parentData?.email || user.email || "";

      // Check if user has an active subscription
      const isActive = subStatus === "active" && 
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
        subscriptionType: subType as SubscriptionTier,
        subscriptionStatus: subStatus,
        subscriptionExpiresAt: expiresAt,
        currentChildrenCount,
        hasActiveSubscription: isActive,
      });
    } catch (error) {
      console.error("Error loading subscription info:", error);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSubscriptionInfo();
  }, [loadSubscriptionInfo]);

  return {
    loading,
    subscriptionData,
    refreshSubscriptionInfo: loadSubscriptionInfo,
  };
};


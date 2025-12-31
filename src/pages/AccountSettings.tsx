// src/pages/AccountSettings.tsx
// Account settings page with upgrade link

import { ParentLayout } from "@/components/layout/ParentLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { useToast } from "@/hooks/use-toast";
import { useFamilyMemberRedirect } from "@/hooks/useFamilyMemberRedirect";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { isPWA } from "@/utils/platformDetection";
import {
  ArrowRight,
  Crown,
  ExternalLink,
  Loader2,
  Settings,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type ParentData = Pick<
  Database["public"]["Tables"]["parents"]["Row"],
  | "name"
  | "email"
  | "family_code"
  | "subscription_type"
  | "subscription_status"
  | "subscription_expires_at"
  | "allowed_children"
  | "stripe_customer_id"
>;

const AccountSettings = () => {
  // Redirect family members away from parent routes
  useFamilyMemberRedirect();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [parentName, setParentName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [familyCode, setFamilyCode] = useState<string | null>(null);
  const [subscriptionType, setSubscriptionType] = useState<string>("free");
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<string>("active");
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<
    string | null
  >(null);
  const [allowedChildren, setAllowedChildren] = useState(1);
  const [currentChildrenCount, setCurrentChildrenCount] = useState(0);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const checkAuth = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/parent/auth");
      return;
    }
  }, [navigate]);

  const loadAccountInfo = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: parentData, error: parentError } = await supabase
        .from("parents")
        .select(
          "name, email, family_code, subscription_type, subscription_status, subscription_expires_at, allowed_children, stripe_customer_id"
        )
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
          // Set defaults if migration hasn't been run
          if (parentData) {
            const partialData = parentData as Partial<ParentData>;
            setParentName(partialData?.name || null);
            setEmail(partialData?.email || null);
            setFamilyCode(partialData?.family_code || null);
          }
          setSubscriptionType("free");
          setAllowedChildren(1);
          setLoading(false);
          return;
        }
        console.error("Error loading account info:", parentError);
        toast({
          title: "Error",
          description: "Failed to load account information",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const typedData = parentData as ParentData;
      setParentName(typedData.name || null);
      setEmail(typedData.email || null);
      setFamilyCode(typedData.family_code || null);
      setSubscriptionType(typedData.subscription_type || "free");
      setSubscriptionStatus(typedData.subscription_status || "active");
      setSubscriptionExpiresAt(typedData.subscription_expires_at || null);
      setAllowedChildren(typedData.allowed_children || 1);
      setStripeCustomerId(typedData.stripe_customer_id || null);

      // Get current children count
      const { data: childrenData } = await supabase
        .from("children")
        .select("id", { count: "exact" })
        .eq("parent_id", user.id);

      if (childrenData) {
        setCurrentChildrenCount(childrenData.length || 0);
      }
    } catch (error) {
      console.error("Error loading account info:", error);
      toast({
        title: "Error",
        description: "Failed to load account information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    checkAuth();
    loadAccountInfo();
  }, [checkAuth, loadAccountInfo]);

  const handleManageSubscription = () => {
    // Navigate to upgrade page which handles subscription management
    // The upgrade page has the full subscription management UI including
    // upgrade, downgrade, and manage subscription via Stripe Customer Portal
    navigate("/parent/upgrade");
  };

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "Not authenticated",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.rpc("cancel_subscription", {
        p_parent_id: user.id,
        p_cancel_reason: "User requested cancellation",
      });

      if (error) {
        throw error;
      }

      type CancelSubscriptionResponse =
        | { success: true; message?: string }
        | { success?: false; error?: string }
        | null;

      const response = (data as unknown) as CancelSubscriptionResponse;

      if (response && typeof response === "object" && "success" in response && response.success === true) {
        toast({
          title: "Subscription Cancelled",
          description:
            response.message ||
            "Your subscription has been cancelled. Access will continue until expiration.",
        });
        setShowCancelDialog(false);
        await loadAccountInfo(); // Refresh subscription info
      } else {
        const errorResponse = response as { error?: string } | null;
        throw new Error(
          errorResponse?.error || "Failed to cancel subscription"
        );
      }
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to cancel subscription. Please contact support.";
      toast({
        title: "Cancellation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
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
      <OnboardingTour role="parent" pageKey="parent_settings" />
      <HelpBubble role="parent" pageKey="parent_settings" />
      <div className="p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="mt-2">
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6" />
              <h1 className="text-3xl font-bold">Account Settings</h1>
            </div>
            <p className="text-muted-foreground mt-2">
              Manage your account and subscription
            </p>
          </div>

          {/* Account Info */}
          <Card className="p-6 mb-6" data-tour="parent-settings-account">
            <h2 className="text-xl font-semibold mb-4">Account Information</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Name</p>
                <p className="text-base font-medium">
                  {parentName || "Not set"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Email</p>
                <p className="text-base font-medium">{email || "Not set"}</p>
              </div>
              {familyCode && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Family Code
                  </p>
                  <p className="text-base font-mono font-bold">{familyCode}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Subscription Info */}
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Subscription</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Current Plan
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-base font-medium capitalize">
                    {subscriptionType === "free" ? "Free" : subscriptionType}
                  </p>
                  {subscriptionType !== "free" &&
                    subscriptionStatus === "active" && (
                      <Crown className="h-4 w-4 text-primary" />
                    )}
                  {subscriptionStatus === "cancelled" && (
                    <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                      Cancelled
                    </span>
                  )}
                  {subscriptionStatus === "expired" && (
                    <span className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded">
                      Expired
                    </span>
                  )}
                </div>
                {subscriptionStatus === "cancelled" &&
                  subscriptionExpiresAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Access until:{" "}
                      {new Date(subscriptionExpiresAt).toLocaleDateString()}
                    </p>
                  )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Children Limit
                </p>
                <p className="text-base font-medium">
                  {currentChildrenCount} /{" "}
                  {allowedChildren === 999 ? "∞ Unlimited" : allowedChildren}
                </p>
              </div>
              {subscriptionType !== "free" &&
                subscriptionStatus === "active" && (
                  <div className="pt-2 border-t space-y-2">
                    {isPWA() && (
                      <Button
                        variant="default"
                        onClick={handleManageSubscription}
                        className="w-full"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Manage Subscription
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => setShowCancelDialog(true)}
                      className="w-full"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel Subscription
                    </Button>
                  </div>
                )}
            </div>
          </Card>

          {/* Upgrade Section */}
          {(subscriptionType === "free" ||
            subscriptionStatus === "expired" ||
            subscriptionStatus === "cancelled") && (
            <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">
                      {subscriptionStatus === "cancelled"
                        ? "Resubscribe"
                        : "Upgrade Your Plan"}
                    </h2>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    {subscriptionStatus === "cancelled"
                      ? "Your subscription is cancelled but you still have access. Resubscribe to continue after expiration."
                      : "Unlock more features and add more children to your account. Choose from flexible monthly or annual plans."}
                  </p>
                  <Button
                    onClick={() => navigate("/parent/upgrade")}
                    className="w-full sm:w-auto"
                    data-tour="parent-settings-upgrade"
                  >
                    {subscriptionStatus === "cancelled"
                      ? "Resubscribe"
                      : "View Plans"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Beta Testing Section */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Beta Testing</h2>
                </div>
                <p className="text-muted-foreground mb-4">
                  Help us improve KidsCallHome by joining our beta program. Get
                  early access to new features and share your feedback.
                </p>
                <Button
                  onClick={() => navigate("/beta")}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  Join Beta Program
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
        </div>

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your subscription? You'll continue
              to have access until{" "}
              {subscriptionExpiresAt
                ? new Date(subscriptionExpiresAt).toLocaleDateString()
                : "the end of your billing period"}
              . After that, your account will revert to the free tier (1 child
              limit).
              {currentChildrenCount > 1 && (
                <span className="block mt-2 font-semibold text-yellow-600 dark:text-yellow-400">
                  Note: You currently have {currentChildrenCount} children.
                  After expiration, you won't be able to add more children, but
                  existing children can still use the app.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              Keep Subscription
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Yes, Cancel Subscription"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ParentLayout>
  );
};

export default AccountSettings;

// src/pages/AccountSettings.tsx
// Account settings page with upgrade link

import Navigation from "@/components/Navigation";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyMemberRedirect } from "@/hooks/useFamilyMemberRedirect";
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
import { ArrowRight, Crown, Loader2, Settings, Sparkles, X, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isPWA } from "@/utils/platformDetection";

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
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("active");
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [allowedChildren, setAllowedChildren] = useState(1);
  const [currentChildrenCount, setCurrentChildrenCount] = useState(0);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);

  useEffect(() => {
    checkAuth();
    loadAccountInfo();
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

  const loadAccountInfo = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: parentData, error: parentError } = await supabase
        .from("parents")
        .select("name, email, family_code, subscription_type, subscription_status, subscription_expires_at, allowed_children")
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
            setParentName((parentData as any)?.name || null);
            setEmail((parentData as any)?.email || null);
            setFamilyCode((parentData as any)?.family_code || null);
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

      setParentName((parentData as any)?.name || null);
      setEmail((parentData as any)?.email || null);
      setFamilyCode((parentData as any)?.family_code || null);
      setSubscriptionType((parentData as any)?.subscription_type || "free");
      setSubscriptionStatus((parentData as any)?.subscription_status || "active");
      setSubscriptionExpiresAt((parentData as any)?.subscription_expires_at || null);
      setAllowedChildren((parentData as any)?.allowed_children || 1);

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
  };

  const handleManageSubscription = async () => {
    if (!isPWA()) {
      toast({
        title: "Not Available",
        description: "Subscription management is only available in the web app.",
        variant: "default",
      });
      return;
    }

    setIsManagingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-customer-portal-session",
        {
          body: {
            returnUrl: `${window.location.origin}/parent/settings`,
          },
        }
      );

      if (error) {
        throw error;
      }

      if (data?.success && data?.url) {
        // Redirect to Stripe Customer Portal
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || "Failed to create portal session");
      }
    } catch (error: any) {
      console.error("Error opening subscription management:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to open subscription management. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsManagingSubscription(false);
    }
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

      const { data, error } = await (supabase.rpc as any)("cancel_subscription", {
        p_parent_id: user.id,
        p_cancel_reason: "User requested cancellation",
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast({
          title: "Subscription Cancelled",
          description: data.message || "Your subscription has been cancelled. Access will continue until expiration.",
        });
        setShowCancelDialog(false);
        await loadAccountInfo(); // Refresh subscription info
      } else {
        throw new Error(data?.error || "Failed to cancel subscription");
      }
    } catch (error: any) {
      console.error("Error cancelling subscription:", error);
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel subscription. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

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
      <OnboardingTour role="parent" pageKey="parent_settings" />
      <HelpBubble role="parent" pageKey="parent_settings" />
      <div
        className="px-4 pb-4"
        style={{
          paddingTop: "calc(0.5rem + 64px + var(--safe-area-inset-top) * 0.15)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="mt-4 mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Settings className="h-6 w-6" />
              <h1 className="text-3xl font-bold">Account Settings</h1>
            </div>
            <p className="text-muted-foreground">
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
                  {subscriptionType !== "free" && subscriptionStatus === "active" && (
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
                {subscriptionStatus === "cancelled" && subscriptionExpiresAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Access until: {new Date(subscriptionExpiresAt).toLocaleDateString()}
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
              {subscriptionType !== "free" && subscriptionStatus === "active" && (
                <div className="pt-2 border-t space-y-2">
                  {isPWA() && (
                    <Button
                      variant="default"
                      onClick={handleManageSubscription}
                      disabled={isManagingSubscription}
                      className="w-full"
                    >
                      {isManagingSubscription ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Opening...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Manage Subscription
                        </>
                      )}
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
          {(subscriptionType === "free" || subscriptionStatus === "expired" || subscriptionStatus === "cancelled") && (
            <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">
                      {subscriptionStatus === "cancelled" ? "Resubscribe" : "Upgrade Your Plan"}
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
                    {subscriptionStatus === "cancelled" ? "Resubscribe" : "View Plans"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your subscription? You'll continue to have access until{" "}
              {subscriptionExpiresAt 
                ? new Date(subscriptionExpiresAt).toLocaleDateString()
                : "the end of your billing period"}.
              After that, your account will revert to the free tier (1 child limit).
              {currentChildrenCount > 1 && (
                <span className="block mt-2 font-semibold text-yellow-600 dark:text-yellow-400">
                  Note: You currently have {currentChildrenCount} children. After expiration, you won't be able to add more children, but existing children can still use the app.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Keep Subscription</AlertDialogCancel>
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
    </div>
  );
};

export default AccountSettings;


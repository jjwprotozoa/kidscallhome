// src/features/referrals/components/ReferralsTab.tsx
// Purpose: Referrals management tab for parent dashboard

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { safeLog, sanitizeError } from "@/utils/security";
import {
  Check,
  Clock,
  Copy,
  Gift,
  Loader2,
  RefreshCw,
  Share2,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SocialShareButtons } from "./SocialShareButtons";
import { getReferralShareLink } from "../utils/referralHelpers";

interface ReferralStats {
  referral_code: string;
  total_referrals: number;
  pending_referrals: number;
  completed_referrals: number;
  total_bonus_days: number;
  bonus_weeks: number;
}

interface Referral {
  id: string;
  referred_email: string;
  status: string;
  reward_days: number;
  created_at: string;
  credited_at: string | null;
}

export const ReferralsTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadReferralData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Get referral stats
      const { data: statsData, error: statsError } = await supabase.rpc(
        "get_referral_stats",
        { p_parent_id: user.id }
      );

      if (statsError) {
        safeLog.error("Error fetching referral stats:", sanitizeError(statsError));
        throw statsError;
      }

      // Handle JSONB response - Supabase should parse it automatically, but ensure it's an object
      if (statsData) {
        // If statsData is a string (shouldn't happen but handle it), parse it
        const parsedStats = typeof statsData === 'string' ? JSON.parse(statsData) : statsData;
        setStats(parsedStats as ReferralStats);
      } else {
        // If no data returned, set to null to show loading/error state
        setStats(null);
        safeLog.warn("get_referral_stats returned null for user:", user.id);
      }

      // Get referral list
      const { data: referralsData, error: referralsError } = await supabase.rpc(
        "get_referral_list",
        { p_parent_id: user.id }
      );

      if (referralsError) {
        safeLog.error("Error fetching referral list:", sanitizeError(referralsError));
        throw referralsError;
      }
      
      setReferrals(referralsData || []);
    } catch (error) {
      safeLog.error("Error loading referral data:", sanitizeError(error));
      toast({
        title: "Error loading referrals",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
      // Set to null on error so UI shows appropriate state
      setStats(null);
      setReferrals([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadReferralData();
  }, [loadReferralData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadReferralData();
  };

  const copyReferralCode = async () => {
    if (!stats?.referral_code) return;
    try {
      await navigator.clipboard.writeText(stats.referral_code);
      toast({
        title: "Copied!",
        description: "Referral code copied to clipboard",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Please copy manually",
        variant: "destructive",
      });
    }
  };

  const referralUrl = stats?.referral_code
    ? getReferralShareLink(stats.referral_code, "referrals_page")
    : "";

  const getStatusBadge = (status: string, creditedAt: string | null) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            <Clock className="h-3 w-3 mr-1" />
            Invited
          </Badge>
        );
      case "signed_up":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-300">
            <UserPlus className="h-3 w-3 mr-1" />
            Signed Up
          </Badge>
        );
      case "subscribed":
        // If reward is credited, show "Reward credited", otherwise "Subscribed"
        if (creditedAt) {
          return (
            <Badge variant="default" className="bg-green-600">
              <Check className="h-3 w-3 mr-1" />
              Reward Credited
            </Badge>
          );
        }
        return (
          <Badge variant="default" className="bg-green-600">
            <Sparkles className="h-3 w-3 mr-1" />
            Subscribed
          </Badge>
        );
      case "credited":
        return (
          <Badge variant="default" className="bg-green-600">
            <Check className="h-3 w-3 mr-1" />
            Reward Credited
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show error state if stats failed to load (but not if it's just empty)
  const hasError = !loading && stats === null;

  return (
    <div className="space-y-6" data-tour="parent-referrals-share">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Referral Rewards
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Share Kids Call Home and earn free subscription time
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-primary">
            {stats?.total_referrals || 0}
          </div>
          <div className="text-xs text-muted-foreground">Total Referrals</div>
          <div className="text-xs text-muted-foreground/70 mt-0.5">All signups</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">
            {stats?.pending_referrals || 0}
          </div>
          <div className="text-xs text-muted-foreground">Pending</div>
          <div className="text-xs text-muted-foreground/70 mt-0.5">Not subscribed</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {stats?.completed_referrals || 0}
          </div>
          <div className="text-xs text-muted-foreground">Completed</div>
          <div className="text-xs text-muted-foreground/70 mt-0.5">Subscribed</div>
        </Card>
        <Card className="p-4 text-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-200">
            {stats?.bonus_weeks || 0}
          </div>
          <div className="text-xs text-muted-foreground/70 dark:text-white">Weeks Earned</div>
          <div className="text-xs text-muted-foreground/70 dark:text-purple-200/90 mt-0.5">Reward credited</div>
        </Card>
      </div>

      {/* Error State */}
      {hasError && (
        <Card className="p-6 border-destructive">
          <div className="text-center">
            <p className="text-destructive font-medium mb-2">
              Unable to load referral data
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Please try refreshing the page or contact support if the issue persists.
            </p>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* Your Referral Code */}
      {!hasError && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Your Referral Code
          </h3>

          {/* Code Display */}
          <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 p-4 rounded-lg mb-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Your Code
                </div>
                <div className="text-2xl sm:text-3xl font-mono font-bold tracking-widest text-primary">
                  {stats?.referral_code || "Loading..."}
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={copyReferralCode}
                disabled={!stats?.referral_code}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

        {/* How it works */}
        <div className="bg-muted/50 p-4 rounded-lg mb-4">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            How it works
          </h4>
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Share your referral code or link with friends and family</li>
            <li>They sign up for Kids Call Home using your code</li>
            <li>
              When they subscribe to the{" "}
              <span className="font-medium text-foreground">Family Plan</span>,
              you both get{" "}
              <span className="font-medium text-primary">1 week free!</span>{" "}
              You'll see their status change to "Subscribed" in your referral history.
            </li>
          </ol>
        </div>

          <Separator className="my-4" />

          {/* Share Buttons */}
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Share with friends & family
          </h4>
          {stats?.referral_code ? (
            <SocialShareButtons
              referralCode={stats.referral_code}
            />
          ) : (
            <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
              Loading referral code...
            </div>
          )}
        </Card>
      )}

      {/* Referral History */}
      {referrals.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Referral History
          </h3>

          <div className="space-y-3">
            {referrals.map((referral) => {
              // Determine dates based on status
              // Signed up: anyone who has moved past "pending" status
              const hasSignedUp = referral.status !== "pending";
              const signedUpDate = hasSignedUp 
                ? new Date(referral.created_at).toLocaleDateString()
                : null;
              
              // Subscribed: show when they've actually subscribed (subscribed or credited status)
              // For subscribed status, we use created_at as proxy (since we don't have subscribed_at timestamp)
              // For credited status, we can use credited_at which is more accurate
              const hasSubscribed = referral.status === "subscribed" || referral.status === "credited";
              let subscribedDate: string | null = null;
              if (hasSubscribed) {
                if (referral.credited_at) {
                  // If credited, use credited_at as the subscribed date (most accurate)
                  subscribedDate = new Date(referral.credited_at).toLocaleDateString();
                } else if (referral.status === "subscribed") {
                  // If subscribed but not yet credited, use created_at as approximation
                  // (In practice, created_at might be when they signed up, so this is a fallback)
                  subscribedDate = new Date(referral.created_at).toLocaleDateString();
                }
              }

              return (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {referral.referred_email}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {hasSignedUp && (
                        <div>Signed up: {signedUpDate}</div>
                      )}
                      {hasSubscribed && subscribedDate && (
                        <div className="text-green-600">
                          Subscribed: {subscribedDate}
                        </div>
                      )}
                      {referral.credited_at && (
                        <div className="text-green-600">
                          • +{referral.reward_days} days earned
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    {getStatusBadge(referral.status, referral.credited_at)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {referrals.length === 0 && (
        <Card className="p-8 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="font-semibold mb-2">No referrals yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Share your code with friends and family to start earning rewards!
          </p>
        </Card>
      )}
    </div>
  );
};





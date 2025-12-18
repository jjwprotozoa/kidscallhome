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

const BASE_URL = window.location.origin;

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

      if (!user) return;

      // Get referral stats
      const { data: statsData, error: statsError } = await supabase.rpc(
        "get_referral_stats",
        { p_parent_id: user.id }
      );

      if (statsError) throw statsError;
      setStats(statsData as ReferralStats);

      // Get referral list
      const { data: referralsData, error: referralsError } = await supabase.rpc(
        "get_referral_list",
        { p_parent_id: user.id }
      );

      if (referralsError) throw referralsError;
      setReferrals((referralsData || []) as Referral[]);
    } catch (error) {
      safeLog.error("Error loading referral data:", sanitizeError(error));
      toast({
        title: "Error loading referrals",
        description: "Please try again later",
        variant: "destructive",
      });
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
    ? `${BASE_URL}/parent/auth?ref=${stats.referral_code}`
    : "";

  const getStatusBadge = (status: string) => {
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
        return (
          <Badge variant="outline" className="text-purple-600 border-purple-300">
            <Sparkles className="h-3 w-3 mr-1" />
            Subscribed
          </Badge>
        );
      case "credited":
        return (
          <Badge variant="default" className="bg-green-600">
            <Check className="h-3 w-3 mr-1" />
            Rewarded
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

  return (
    <div className="space-y-6">
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
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">
            {stats?.pending_referrals || 0}
          </div>
          <div className="text-xs text-muted-foreground">Pending</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {stats?.completed_referrals || 0}
          </div>
          <div className="text-xs text-muted-foreground">Completed</div>
        </Card>
        <Card className="p-4 text-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
          <div className="text-2xl font-bold text-purple-600">
            {stats?.bonus_weeks || 0}
          </div>
          <div className="text-xs text-muted-foreground">Weeks Earned</div>
        </Card>
      </div>

      {/* Your Referral Code */}
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
                {stats?.referral_code || "..."}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={copyReferralCode}>
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
              <span className="font-medium text-primary">1 week free!</span>
            </li>
          </ol>
        </div>

        <Separator className="my-4" />

        {/* Share Buttons */}
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Share with friends & family
        </h4>
        <SocialShareButtons
          referralCode={stats?.referral_code || ""}
          referralUrl={referralUrl}
        />
      </Card>

      {/* Referral History */}
      {referrals.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Referral History
          </h3>

          <div className="space-y-3">
            {referrals.map((referral) => (
              <div
                key={referral.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {referral.referred_email}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(referral.created_at).toLocaleDateString()}
                    {referral.credited_at && (
                      <span className="ml-2 text-green-600">
                        • +{referral.reward_days} days earned
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-2">{getStatusBadge(referral.status)}</div>
              </div>
            ))}
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


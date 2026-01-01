// src/pages/Beta.tsx
// Purpose: Beta testing signup and feedback page
// Route: /beta
// Deep link support: Marketing emails can link to /beta?ref=email

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEOHead } from "@/components/SEOHead";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  isBetaUser,
  joinBeta,
  submitFeedback,
  type BetaFeedbackPayload,
  type BetaSignupPayload,
} from "@/services/betaService";
import { getAppVersion } from "@/utils/appVersion";
import { getDeviceName } from "@/utils/deviceTracking";
import { isNativeApp } from "@/utils/platformDetection";
import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Loader2,
  MessageSquare,
  Star,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";

const Beta = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [isBeta, setIsBeta] = useState(false);
  const [joinBetaLoading, setJoinBetaLoading] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Join Beta form state
  const [useCase, setUseCase] = useState("");
  const [platform, setPlatform] = useState<"ios" | "android" | "web">("web");
  const [appVersion, setAppVersion] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [timezone, setTimezone] = useState("");
  const [consent, setConsent] = useState(false);

  // Feedback form state
  const [category, setCategory] = useState<"bug" | "ux" | "feature" | "other">(
    "bug"
  );
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [message, setMessage] = useState("");

  // Detect platform, device info, and app version on mount
  useEffect(() => {
    const detectPlatform = () => {
      if (isNativeApp()) {
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes("iphone") || ua.includes("ipad")) {
          return "ios";
        }
        return "android";
      }
      return "web";
    };

    const detectedPlatform = detectPlatform();
    setPlatform(detectedPlatform);
    setDeviceModel(getDeviceName());
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Auto-detect app version
    const loadAppVersion = async () => {
      try {
        const version = await getAppVersion();
        setAppVersion(version);
      } catch (error) {
        // Leave empty if we can't detect it - fail silently
      }
    };
    loadAppVersion();
  }, []);

  // Check if user is already in beta
  useEffect(() => {
    const checkBetaStatus = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          // Not authenticated - show join form but require auth
          setLoading(false);
          return;
        }

        const betaStatus = await isBetaUser();
        setIsBeta(betaStatus);
        setLoading(false);
      } catch (error) {
        console.error("Error checking beta status:", error);
        setLoading(false);
      }
    };

    checkBetaStatus();
  }, []);

  const handleJoinBeta = async () => {
    if (!consent) {
      toast({
        title: "Consent Required",
        description: "Please agree to the beta testing terms to continue.",
        variant: "destructive",
      });
      return;
    }

    setJoinBetaLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to join the beta program.",
          variant: "destructive",
        });
        navigate("/parent/auth");
        return;
      }

      const payload: BetaSignupPayload = {
        platform,
        app_version: appVersion || undefined,
        device_model: deviceModel || undefined,
        timezone: timezone || undefined,
        use_case: useCase || undefined,
        consent: true,
      };

      await joinBeta(payload);

      setIsBeta(true);
      toast({
        title: "Welcome to Beta!",
        description:
          "You're now part of the beta testing program. Thank you for helping us improve!",
        variant: "success",
      });

      // Reset form
      setUseCase("");
      setAppVersion("");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to join beta. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setJoinBetaLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!message.trim()) {
      toast({
        title: "Message Required",
        description: "Please provide your feedback message.",
        variant: "destructive",
      });
      return;
    }

    setFeedbackLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to submit feedback.",
          variant: "destructive",
        });
        navigate("/parent/auth");
        return;
      }

      // Collect metadata
      const meta: Record<string, unknown> = {
        route: location.pathname,
        platform: platform,
        referrer: document.referrer || "",
        user_agent: navigator.userAgent,
        device_model: deviceModel || undefined,
      };

      const payload: BetaFeedbackPayload = {
        category,
        rating: rating || undefined,
        message: message.trim(),
        meta,
      };

      await submitFeedback(payload);

      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback! We'll review it soon.",
        variant: "success",
      });

      // Reset form
      setMessage("");
      setRating(undefined);
      setCategory("bug");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to submit feedback. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setFeedbackLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleBack = () => {
    // Try to go back in history, fallback to parent dashboard if no history
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Fallback to a sensible default
      navigate("/parent/dashboard");
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <SEOHead
        title="Beta Testing Program - Help Shape Kids Call Home"
        description="Join the Kids Call Home beta program. Get early access to new features, provide feedback, and help us build the safest video calling app for kids."
        path="/beta"
      />
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Beta Testing</h1>
            <p className="mt-2 text-muted-foreground">
              Help us improve KidsCallHome by joining our beta program and
              sharing your feedback.
            </p>
          </div>
        </div>
      </div>

      {/* Join Beta Section */}
      {!isBeta && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Join Beta Program
            </CardTitle>
            <CardDescription>
              Be among the first to try new features and help shape the future
              of KidsCallHome.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="platform">Platform *</Label>
              <Select
                value={platform}
                onValueChange={(value) =>
                  setPlatform(value as "ios" | "android" | "web")
                }
              >
                <SelectTrigger id="platform" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ios">iOS</SelectItem>
                  <SelectItem value="android">Android</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="app-version">App Version (optional)</Label>
              <Input
                id="app-version"
                placeholder="e.g., 1.0.0"
                value={appVersion}
                onChange={(e) => setAppVersion(e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="device-model">Device Model (optional)</Label>
              <Input
                id="device-model"
                placeholder="e.g., iPhone 14 Pro"
                value={deviceModel}
                onChange={(e) => setDeviceModel(e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="timezone">Timezone (optional)</Label>
              <Input
                id="timezone"
                placeholder="e.g., America/New_York"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="use-case">
                How do you plan to use KidsCallHome? (optional)
              </Label>
              <Textarea
                id="use-case"
                placeholder="Tell us about your use case..."
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="consent"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="consent" className="cursor-pointer">
                I agree to participate in beta testing and provide feedback to
                help improve the app. *
              </Label>
            </div>

            <Button
              onClick={handleJoinBeta}
              disabled={joinBetaLoading}
              className="w-full"
            >
              {joinBetaLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join Beta Program"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Success State */}
      {isBeta && (
        <Card className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-semibold">You're in the Beta Program!</p>
            </div>
            <p className="mt-2 text-sm text-green-600 dark:text-green-400">
              Thank you for joining. Your feedback helps us build a better
              product.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Send Feedback Section */}
      {isBeta && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Send Feedback
            </CardTitle>
            <CardDescription>
              Share your thoughts, report bugs, or suggest new features.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={category}
                onValueChange={(value) =>
                  setCategory(value as "bug" | "ux" | "feature" | "other")
                }
              >
                <SelectTrigger id="category" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="ux">User Experience</SelectItem>
                  <SelectItem value="feature">Feature Request</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="rating">Rating (optional)</Label>
              <Select
                value={rating?.toString() || ""}
                onValueChange={(value) =>
                  setRating(value ? parseInt(value, 10) : undefined)
                }
              >
                <SelectTrigger id="rating" className="mt-2">
                  <SelectValue placeholder="Select rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Poor</SelectItem>
                  <SelectItem value="2">2 - Fair</SelectItem>
                  <SelectItem value="3">3 - Good</SelectItem>
                  <SelectItem value="4">4 - Very Good</SelectItem>
                  <SelectItem value="5">5 - Excellent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="message">Your Feedback *</Label>
              <Textarea
                id="message"
                placeholder="Describe your feedback, bug report, or feature request..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-2"
                rows={5}
                required
              />
            </div>

            <Button
              onClick={handleSubmitFeedback}
              disabled={feedbackLoading}
              className="w-full"
            >
              {feedbackLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Feedback"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Not authenticated message */}
      {!isBeta && (
        <Card className="mt-6 border-blue-500 bg-blue-50 dark:bg-blue-950">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Note:</strong> You need to be signed in to join the beta
              program. If you're not signed in, you'll be prompted to log in
              when you submit.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Support Information */}
      <Card className="mt-6 border-muted">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Need help or have questions?</strong>{" "}
                Visit our{" "}
                <Link
                  to="/info#contact"
                  className="text-primary hover:underline font-medium"
                >
                  Contact & Support
                </Link>{" "}
                page for support information, FAQs, and ways to get in touch.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Beta;

/*
 * TEST CHECKLIST:
 *
 * Happy Path:
 * - [ ] User can join beta program with all fields filled
 * - [ ] User can join beta program with minimal fields (platform + consent)
 * - [ ] After joining, feedback form appears
 * - [ ] User can submit feedback with all fields
 * - [ ] User can submit feedback with minimal fields (category + message)
 * - [ ] Success toasts appear after successful actions
 *
 * RLS Security:
 * - [ ] User can only see their own beta signup
 * - [ ] User can only see their own feedback
 * - [ ] User cannot modify other users' records
 * - [ ] Unauthenticated users see join form but cannot submit
 *
 * Error Handling:
 * - [ ] Network errors show friendly error messages
 * - [ ] Validation errors prevent submission
 * - [ ] Missing consent shows error toast
 * - [ ] Empty feedback message shows error toast
 * - [ ] Offline mode shows appropriate error
 *
 * UI/UX:
 * - [ ] Loading states disable buttons and show spinners
 * - [ ] Forms reset after successful submission
 * - [ ] Platform auto-detects correctly (ios/android/web)
 * - [ ] Device model auto-fills from user agent
 * - [ ] Timezone auto-detects from browser
 * - [ ] Mobile-responsive layout works correctly
 *
 * Deep Link Support:
 * - [ ] Marketing email link /beta?ref=email works
 * - [ ] Referrer captured in feedback meta
 * - [ ] Route information captured in feedback meta
 *
 * Edge Cases:
 * - [ ] User already in beta sees feedback form only
 * - [ ] User updates existing signup instead of creating duplicate
 * - [ ] Rating validation (1-5) works correctly
 * - [ ] Category validation works correctly
 */

// src/pages/VerifyEmail.tsx
// Purpose: Email verification screen with ability to change email if restricted

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { normalizeEmail, isValidEmailBasic } from "@/utils/emailValidation";
import { getEmailRedirectUrl } from "@/utils/siteUrl";
import {
  isLikelyRestrictedEmail,
  getEmailDomain,
} from "@/utils/emailRestrictions";
import { logAppEvent } from "@/utils/appEventLogging";
import { AlertTriangle, MailCheck, Loader2, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { EmailInputWithBreachCheck } from "@/components/auth/EmailInputWithBreachCheck";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const [changingEmail, setChangingEmail] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [confirmNewEmail, setConfirmNewEmail] = useState("");
  const [isRestrictedNewEmail, setIsRestrictedNewEmail] = useState(false);
  const [overrideChecked, setOverrideChecked] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);

  // Check session and get user email
  useEffect(() => {
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          // If user is already verified, redirect to app
          if (session.user.email_confirmed_at) {
            navigate("/parent/children", { replace: true });
            return;
          }

          setHasSession(true);
          setUserEmail(session.user.email || null);
        } else {
          setHasSession(false);
          // Try to get email from URL params or localStorage if available
          const emailParam = searchParams.get("email");
          if (emailParam) {
            setUserEmail(emailParam);
          }
        }
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth state changes (e.g., when user clicks email verification link)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (session?.user?.email_confirmed_at) {
          // User just verified their email - redirect to app
          navigate("/parent/children", { replace: true });
        } else if (session?.user) {
          // User signed in but not verified yet - update email
          setHasSession(true);
          setUserEmail(session.user.email || null);
        }
      }
    });

    // Poll for email verification status (frictionless - auto-detects when verified)
    // This allows users to verify via email link in another tab/window and auto-redirect
    let pollInterval: NodeJS.Timeout | null = null;

    if (hasSession || userEmail) {
      pollInterval = setInterval(async () => {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession?.user?.email_confirmed_at) {
            // Email verified! Redirect immediately
            navigate("/parent/children", { replace: true });
          }
        } catch (error) {
          // Silently handle errors - polling is non-critical
          console.debug("Polling check error (non-critical):", error);
        }
      }, 3000); // Check every 3 seconds
    }

    return () => {
      subscription.unsubscribe();
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [searchParams, navigate, hasSession, userEmail]);

  const isRestricted = userEmail ? isLikelyRestrictedEmail(userEmail) : false;

  // Manual check for verification status
  const handleCheckVerification = async () => {
    setCheckingVerification(true);
    try {
      // Refresh session to get latest verification status
      const { data: { session }, error } = await supabase.auth.refreshSession();

      if (error) {
        // If refresh fails, try getting session directly
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user?.email_confirmed_at) {
          navigate("/parent/children", { replace: true });
          return;
        }
      } else if (session?.user?.email_confirmed_at) {
        // Email verified! Redirect immediately
        navigate("/parent/children", { replace: true });
        return;
      }

      // Not verified yet
      toast({
        title: "Not verified yet",
        description: "Please check your email and click the verification link. We'll automatically detect when you verify.",
        duration: 5000,
      });
    } catch (error) {
      console.error("Error checking verification:", error);
      toast({
        title: "Error checking status",
        description: "Unable to check verification status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCheckingVerification(false);
    }
  };

  const handleResendEmail = async () => {
    if (!userEmail) {
      toast({
        title: "Email required",
        description: "Please enter your email address first.",
        variant: "destructive",
      });
      return;
    }

    setResendingEmail(true);
    try {
      const normalizedEmail = normalizeEmail(userEmail);
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: getEmailRedirectUrl("/parent/children"),
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Confirmation email sent",
        description:
          "Please check your email (including spam folder) and click the verification link.",
        duration: 8000,
      });
    } catch (error: unknown) {
      console.error("Error resending email:", error);
      toast({
        title: "Failed to send email",
        description:
          error instanceof Error
            ? error.message
            : "Unable to resend confirmation email. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setResendingEmail(false);
    }
  };

  const handleChangeEmail = async () => {
    // Validate new email
    if (!isValidEmailBasic(newEmail)) {
      toast({
        title: "Invalid email",
        description: "Enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    const normalizedNewEmail = normalizeEmail(newEmail);
    const normalizedConfirmNewEmail = normalizeEmail(confirmNewEmail);

    if (normalizedNewEmail !== normalizedConfirmNewEmail) {
      toast({
        title: "Emails don't match",
        description: "Please make sure both emails match",
        variant: "destructive",
      });
      return;
    }

    // Check if restricted and override required
    if (isRestrictedNewEmail && !overrideChecked) {
      toast({
        title: "Email may be restricted",
        description: "Please acknowledge the warning or use a different email",
        variant: "destructive",
      });
      return;
    }

    setChangingEmail(true);
    try {
      if (hasSession) {
        // User has session - update email
        const { error: updateError } = await supabase.auth.updateUser({
          email: normalizedNewEmail,
        });

        if (updateError) {
          throw updateError;
        }

        // Try to resend verification email (may not be available in all Supabase versions)
        // updateUser typically triggers a confirmation email, so this is optional
        try {
          const { error: resendError } = await supabase.auth.resend({
            type: "signup",
            email: normalizedNewEmail,
            options: {
              emailRedirectTo: getEmailRedirectUrl("/parent/children"),
            },
          });

          if (resendError) {
            // Log but don't fail - updateUser may have triggered email
            // Some Supabase versions may not support resend, or rate limits may apply
            console.warn("Resend error (non-critical):", resendError);
          }
        } catch (resendErr) {
          // Silently handle - updateUser should have triggered email
          console.warn("Resend not available or failed (non-critical):", resendErr);
        }

        // Log successful change
        const oldDomain = userEmail ? getEmailDomain(userEmail) : null;
        const newDomain = getEmailDomain(normalizedNewEmail);
        const route = "/verify-email";
        logAppEvent("restricted_email_changed", {
          oldDomain,
          newDomain,
          route,
        });

      toast({
        title: "Email updated",
        description:
          "We sent a verification email to your new email address. Please check your inbox (including spam folder).",
        duration: 8000,
      });

        setUserEmail(normalizedNewEmail);
        setNewEmail("");
        setConfirmNewEmail("");
        setShowChangeEmail(false);
        setOverrideChecked(false);
      } else {
        // No session - show instruction
        toast({
          title: "Sign in required",
          description:
            "Please sign in again with your password first, then you can change your email and resend verification.",
          variant: "destructive",
          duration: 8000,
        });
      }
    } catch (error: unknown) {
      console.error("Error changing email:", error);
      const domain = userEmail ? getEmailDomain(userEmail) : null;
      const route = "/verify-email";
      const reason = hasSession ? "update_failed" : "no_session";
      logAppEvent("restricted_email_change_failed", { domain, route, reason });

      toast({
        title: "Failed to change email",
        description:
          error instanceof Error
            ? error.message
            : "Unable to change email address. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setChangingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <img
              src="/icon-192x192.png"
              alt="Kids Call Home"
              className="h-12 w-12"
            />
          </div>
          <h1 className="text-3xl font-bold">Check your email</h1>
          <p className="text-muted-foreground">
            We've sent a verification link to{" "}
            {userEmail ? (
              <strong>{userEmail}</strong>
            ) : (
              "your email address"
            )}
            . Click the link in your email to verify your account.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            💡 <strong>Tip:</strong> We'll automatically detect when you verify your email. You can keep this page open while checking your inbox.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            variant="default"
            className="w-full"
            onClick={handleCheckVerification}
            disabled={checkingVerification}
          >
            {checkingVerification ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <MailCheck className="mr-2 h-4 w-4" />
                I've Verified My Email
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleResendEmail}
            disabled={resendingEmail || !userEmail}
          >
            {resendingEmail ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <MailCheck className="mr-2 h-4 w-4" />
                Resend Verification Email
              </>
            )}
          </Button>

          <div className="pt-4 border-t">
            <h2 className="text-sm font-semibold mb-3">
              Having trouble receiving the email?
            </h2>

            {isRestricted && userEmail && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    It looks like this email is managed by a school or child
                    account. These accounts often can't receive verification or
                    security emails.
                  </p>
                </div>
                <p className="text-sm text-amber-800 dark:text-amber-200 mt-2">
                  Please use a personal parent email (Gmail, Outlook, etc.), or
                  check with your school provider about allowing external emails.
                </p>
              </div>
            )}

            {!showChangeEmail ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowChangeEmail(true)}
              >
                Change email address
              </Button>
            ) : (
              <div className="space-y-4">
                <EmailInputWithBreachCheck
                  email={newEmail}
                  onChange={setNewEmail}
                  isLogin={false}
                  confirmEmail={confirmNewEmail}
                  onConfirmEmailChange={setConfirmNewEmail}
                  showConfirmEmail={true}
                  onRestrictedEmailDetected={setIsRestrictedNewEmail}
                />

                {isRestrictedNewEmail &&
                  normalizeEmail(newEmail) === normalizeEmail(confirmNewEmail) &&
                  isValidEmailBasic(newEmail) && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                            Email may be restricted
                          </p>
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            It looks like this email is managed by a school or
                            child account. These accounts often can't receive
                            verification or security emails.
                          </p>
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            Please use a personal parent email (Gmail, Outlook,
                            etc.), or check with your school provider about
                            allowing external emails.
                          </p>
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            This helps ensure you can receive password resets and important security messages.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="new-email-override"
                          checked={overrideChecked}
                          onCheckedChange={(checked) =>
                            setOverrideChecked(checked === true)
                          }
                          aria-label="I understand this email may not receive verification or security emails"
                        />
                        <label
                          htmlFor="new-email-override"
                          className="text-sm text-amber-800 dark:text-amber-200 cursor-pointer leading-tight"
                        >
                          I understand this email may not receive verification or security emails.
                        </label>
                      </div>
                    </div>
                  )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowChangeEmail(false);
                      setNewEmail("");
                      setConfirmNewEmail("");
                      setOverrideChecked(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={handleChangeEmail}
                    disabled={changingEmail}
                  >
                    {changingEmail ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update Email"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {!hasSession && (
              <div className="mt-4 p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground mb-2">
                  Please sign in again with your password first, then you can
                  change your email and resend verification.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  asChild
                >
                  <Link to={`/parent/auth?returnTo=/verify-email`}>
                    Go to Login
                  </Link>
                </Button>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/parent/auth")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Button>
          </div>

          <div className="text-center">
            <Link
              to="/info"
              className="text-sm text-primary hover:underline"
            >
              Need help? Visit our info page
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default VerifyEmail;


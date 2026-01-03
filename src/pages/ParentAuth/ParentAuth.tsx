// src/pages/ParentAuth/ParentAuth.tsx
// Purpose: Main page orchestrator for parent authentication (max 200 lines)

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SEOHead } from "@/components/SEOHead";
import { Link } from "react-router-dom";
import { Info, ExternalLink } from "lucide-react";
import { FamilySetupSelection } from "@/features/onboarding/components/FamilySetupSelection";
import { useToast } from "@/hooks/use-toast";
import { useAccountLockout } from "@/hooks/useAccountLockout";
import { usePasswordBreachCheck } from "@/hooks/usePasswordBreachCheck";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/utils/auditLog";
import { detectBot, initBehaviorTracking } from "@/utils/botDetection";
import { getCSRFToken } from "@/utils/csrf";
import { getRateLimitKey, recordRateLimit } from "@/utils/rateLimiting";
import { safeLog, sanitizeError } from "@/utils/security";
import { normalizeEmail, isValidEmailBasic } from "@/utils/emailValidation";
import { getEmailRedirectUrl } from "@/utils/siteUrl";
import { getEmailDomain } from "@/utils/emailRestrictions";
import { logAppEvent } from "@/utils/appEventLogging";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";
import {
  handleLogin as loginHandler,
  handleSignup as signupHandler,
} from "./authHandlers";
import { performSecurityChecks } from "./authSecurityChecks";
import {
  shouldBlockPasswordSubmission,
  validateAuthForm,
} from "./authValidation";
import { AuthValidationResult } from "./types";
import { useAuthState } from "./useAuthState";

const ParentAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const authState = useAuthState();
  const { lockoutInfo, showCaptcha, setShowCaptcha, updateLockoutInfo } =
    useAccountLockout(authState.email, authState.isLogin);
  const { breachStatus, performFinalCheck } = usePasswordBreachCheck(
    authState.password,
    authState.isLogin
  );

  // Extract referral code from URL (e.g., ?ref=ABC123)
  const referralCode = useMemo(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      // Store in localStorage in case user navigates away and comes back
      localStorage.setItem("kch_referral_code", ref.toUpperCase());
      return ref.toUpperCase();
    }
    // Check if there's a stored referral code
    return localStorage.getItem("kch_referral_code");
  }, [searchParams]);

  // Auto-switch to signup mode when referral code is present in URL
  // This ensures new users with referral links see the signup form, not login
  const hasSwitchedToSignup = useRef(false);
  useEffect(() => {
    const refFromUrl = searchParams.get("ref");
    if (refFromUrl && authState.isLogin && !hasSwitchedToSignup.current) {
      // If referral code is in URL, switch to signup mode for new user registration
      authState.setIsLogin(false);
      hasSwitchedToSignup.current = true;
    }
  }, [searchParams, authState.isLogin, authState.setIsLogin]);

  // Initialize security features
  useEffect(() => {
    initBehaviorTracking();
    const botDetection = detectBot();
    if (botDetection.isBot) {
      safeLog.warn("Bot detected:", botDetection);
      logAuditEvent("bot_detected", {
        metadata: {
          reasons: botDetection.reasons,
          confidence: botDetection.confidence,
        },
        severity: "high",
      });
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    authState.setLoading(true);
    authState.setCaptchaToken(null);

    try {
      const validation = validateAuthForm(
        {
          email: authState.email,
          password: authState.password,
          name: authState.name,
          staySignedIn: authState.staySignedIn,
        },
        authState.isLogin
      );

      if (!validation.valid) {
        const firstError = Object.values(validation.errors)[0]?.[0];
        toast({
          title: "Validation Error",
          description: firstError || "Please check your input",
          variant: "destructive",
        });
        return;
      }

      // Check password confirmation for signup
      if (!authState.isLogin && authState.password !== authState.confirmPassword) {
        toast({
          title: "Passwords don't match",
          description: "Please make sure both passwords match",
          variant: "destructive",
        });
        return;
      }

      // Check email confirmation for signup
      if (!authState.isLogin) {
        const normalizedEmail = normalizeEmail(authState.email);
        const normalizedConfirmEmail = normalizeEmail(authState.confirmEmail);
        
        if (!isValidEmailBasic(authState.email)) {
          toast({
            title: "Invalid email",
            description: "Enter a valid email address",
            variant: "destructive",
          });
          return;
        }

        if (normalizedEmail !== normalizedConfirmEmail) {
          toast({
            title: "Emails don't match",
            description: "Please make sure both emails match",
            variant: "destructive",
          });
          return;
        }
      }

      const sanitizedEmail = validation.sanitized.email || authState.email;
      const sanitizedPassword =
        validation.sanitized.password || authState.password;

      if (!authState.isLogin && shouldBlockPasswordSubmission(breachStatus)) {
        toast({
          title: "Password Security Issue",
          description:
            "This password has been found in data breaches and is unsafe to use. Please choose a unique password with a mix of letters, numbers, and symbols.",
          variant: "destructive",
          duration: 8000,
        });
        return;
      }

      if (!authState.isLogin && breachStatus !== "safe") {
        const isValid = await performFinalCheck(sanitizedPassword);
        if (!isValid) {
          toast({
            title: "Password Security Issue",
            description:
              "This password has been found in data breaches and is unsafe to use. Please choose a unique password with a mix of letters, numbers, and symbols.",
            variant: "destructive",
            duration: 8000,
          });
          return;
        }
      }

      const securityCheck = performSecurityChecks({
        email: sanitizedEmail,
        isLogin: authState.isLogin,
        lockoutInfo,
        showCaptcha,
        captchaToken: authState.captchaToken,
        toast,
      });

      if (!securityCheck.allowed) {
        return;
      }

      recordRateLimit(getRateLimitKey(sanitizedEmail, "login"), "login");
      localStorage.setItem("staySignedIn", authState.staySignedIn.toString());
      if (!authState.staySignedIn) {
        sessionStorage.setItem("clearSessionOnClose", "true");
      } else {
        sessionStorage.removeItem("clearSessionOnClose");
      }

      if (authState.isLogin) {
        await handleLogin(sanitizedEmail, sanitizedPassword, authState.captchaToken);
      } else {
        await handleSignup(sanitizedEmail, sanitizedPassword, validation);
      }
    } catch (error: unknown) {
      const sanitizedError = sanitizeError(error);
      safeLog.error("Auth operation failed:", sanitizedError);
      
      // Handle email not confirmed error
      if (error instanceof Error && error.message === "EMAIL_NOT_CONFIRMED") {
        setShowResendEmail(true);
        const isDevelopment = import.meta.env.DEV;
        if (isDevelopment) {
          toast({
            title: "Email not verified",
            description:
              "In development, disable email confirmation in Supabase Dashboard → Authentication → Settings → Email Auth → 'Enable email confirmations' (turn OFF). Or verify manually in Authentication → Users.",
            variant: "destructive",
            duration: 10000,
          });
        } else {
          toast({
            title: "Email not verified",
            description:
              "Please check your email and click the verification link before logging in. If you didn't receive the email, you can resend it below or visit the verification page.",
            variant: "destructive",
            duration: 8000,
          });
        }
        return; // Don't show generic error toast
      }
      
      if (!(error instanceof Error && error.message.includes("locked"))) {
        toast({
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          variant: "destructive",
        });
      }
    } finally {
      authState.setLoading(false);
      authState.setPassword("");
      authState.setConfirmPassword("");
      authState.setCaptchaToken(null);
    }
  };

  const handleLogin = async (email: string, password: string, captchaToken?: string | null) => {
    setShowResendEmail(false); // Reset resend option on new login attempt
    await loginHandler({
      email,
      password,
      captchaToken,
      setShowCaptcha,
      updateLockoutInfo,
      toast,
      navigate,
    });
  };

  const [restrictedEmailOverride, setRestrictedEmailOverride] = useState<string | null>(null);
  const [showResendEmail, setShowResendEmail] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  const handleRestrictedEmailOverride = (email: string) => {
    setRestrictedEmailOverride(email);
  };

  const handleResendVerificationEmail = async () => {
    if (!authState.email) {
      toast({
        title: "Email required",
        description: "Please enter your email address first.",
        variant: "destructive",
      });
      return;
    }

    setResendingEmail(true);
    try {
      const normalizedEmail = normalizeEmail(authState.email);
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
        title: "Verification email sent",
        description: "Please check your email (including spam folder) and click the verification link.",
        duration: 8000,
      });
    } catch (error: unknown) {
      console.error("Error resending email:", error);
      toast({
        title: "Failed to send email",
        description:
          error instanceof Error
            ? error.message
            : "Unable to resend verification email. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSignup = async (
    email: string,
    password: string,
    validation: AuthValidationResult
  ) => {
    const result = await signupHandler({
      email,
      password,
      name: authState.name,
      validation,
      referralCode,
      familyRole: authState.familyRole,
    });
    
    // Log override if user accepted restricted email warning
    if (restrictedEmailOverride && restrictedEmailOverride === email) {
      const domain = getEmailDomain(email);
      const route = location.pathname;
      logAppEvent("restricted_email_override", { domain, route });
      setRestrictedEmailOverride(null);
    }
    
    if (result.needsFamilySetup && result.user) {
      authState.setUserId(result.user.id);
      // Clear stored referral code after successful signup
      localStorage.removeItem("kch_referral_code");
      // Clear signup draft after successful signup
      authState.clearSignupDraft();
      
      // Show family setup immediately - household selection happens BEFORE email verification
      // The FamilySetupSelection component handles unauthenticated users via RPC function
      authState.setNeedsFamilySetup(true);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
      <SEOHead
        title={authState.isLogin ? "Parent Login" : "Create Parent Account - Get Started Free"}
        description="Sign in or create your Kids Call Home parent account. Set up safe video calling for your kids in minutes. Free for 1 child, no credit card required."
        path="/parent/auth"
      />
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <img
              src="/icon-192x192.png"
              alt="Kids Call Home"
              className="h-12 w-12"
            />
          </div>
          <h1 className="text-3xl font-bold">Kids Call Home</h1>
          <p className="text-muted-foreground">
            {authState.isLogin
              ? authState.parentName
                ? `Welcome back, ${authState.parentName}!`
                : "Welcome back!"
              : "Create your account"}
          </p>
          {/* Referral code indicator */}
          {referralCode && !authState.isLogin && (
            <div className="space-y-3">
              <div className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-sm px-3 py-2 rounded-md border border-green-200 dark:border-green-800">
                🎁 Referral code <strong>{referralCode}</strong> applied! You'll
                both get 1 week free when you subscribe.
              </div>
              {/* Learn More section for referral users */}
              <div className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-sm px-3 py-2 rounded-md border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <p className="font-medium">Want to learn more first?</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Explore our home page to see how Kids Call Home works before signing up. Your referral code will be saved.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      asChild
                      className="w-full mt-2 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                    >
                      <Link to="/" className="flex items-center justify-center gap-2">
                        <span>Visit Home Page</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <input type="hidden" name="csrf_token" value={getCSRFToken()} />
          {authState.isLogin ? (
            <LoginForm
              email={authState.email}
              onEmailChange={authState.setEmail}
              password={authState.password}
              onPasswordChange={authState.setPassword}
              staySignedIn={authState.staySignedIn}
              onStaySignedInChange={authState.setStaySignedIn}
              loading={authState.loading}
              lockoutInfo={lockoutInfo}
              showCaptcha={showCaptcha}
              captchaToken={authState.captchaToken}
              onCaptchaVerify={authState.setCaptchaToken}
              onCaptchaError={() => {}}
              disabled={false}
            />
          ) : (
            <SignupForm
              name={authState.name}
              onNameChange={authState.setName}
              email={authState.email}
              onEmailChange={authState.setEmail}
              confirmEmail={authState.confirmEmail}
              onConfirmEmailChange={authState.setConfirmEmail}
              password={authState.password}
              onPasswordChange={authState.setPassword}
              confirmPassword={authState.confirmPassword}
              onConfirmPasswordChange={authState.setConfirmPassword}
              loading={authState.loading}
              disabled={false}
              familyRole={authState.familyRole}
              onFamilyRoleChange={authState.setFamilyRole}
              onOverrideAccepted={handleRestrictedEmailOverride}
            />
          )}
        </form>

        {/* Resend verification email option (shown when email not confirmed) */}
        {authState.isLogin && showResendEmail && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-muted">
            <p className="text-sm text-muted-foreground">
              Your email hasn't been verified yet. You can:
            </p>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResendVerificationEmail}
                disabled={resendingEmail}
                className="w-full"
              >
                {resendingEmail ? "Sending..." : "Resend Verification Email"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                asChild
                className="w-full"
              >
                <Link to={`/verify-email?email=${encodeURIComponent(authState.email)}`}>
                  Go to Verification Page
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Check your spam folder if you don't see the email. The verification link expires after 24 hours.
            </p>
          </div>
        )}

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              authState.setIsLogin(!authState.isLogin);
              setShowResendEmail(false); // Reset resend option when switching modes
            }}
            className="text-sm text-primary hover:underline"
          >
            {authState.isLogin
              ? "Need an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </Card>

      <Dialog
        open={authState.needsFamilySetup && !!authState.userId}
        onOpenChange={() => {}}
      >
        <DialogContent className="w-[95vw] max-w-lg sm:max-w-xl p-4 sm:p-6">
          <DialogTitle className="sr-only">Family Setup</DialogTitle>
          <FamilySetupSelection
            userId={authState.userId!}
            onComplete={async (householdType) => {
              try {
                // FamilySetupSelection component already handles the household_type update
                // (using RPC function if not authenticated, or direct UPDATE if authenticated)
                // So we just need to handle the post-setup flow here
                
                authState.setNeedsFamilySetup(false);
                
                // Check if email confirmation is required AFTER household selection
                // Get the email from current user or fallback to authState.email
                const { data: { user }, error: getUserError } = await supabase.auth.getUser();
                const userEmail = user?.email || authState.email;
                
                // If user is not authenticated OR email is not confirmed, go to verify-email
                if (!user || getUserError || !user.email_confirmed_at) {
                  // User needs email verification - redirect to verify-email screen
                  toast({ 
                    title: "Family setup complete!", 
                    description: "Please verify your email to continue." 
                  });
                  navigate(`/verify-email?email=${encodeURIComponent(userEmail)}`, { replace: true });
                } else {
                  // Email is confirmed - proceed to app
                  toast({ title: "Family setup complete! Welcome!" });
                  navigate("/parent/children", { replace: true });
                }
              } catch (error) {
                console.error("Error after family setup:", error);
                // On error, still try to redirect to verify-email as fallback
                const userEmail = authState.email;
                if (userEmail) {
                  navigate(`/verify-email?email=${encodeURIComponent(userEmail)}`, { replace: true });
                } else {
                  toast({
                    title: "Error",
                    description: error instanceof Error 
                      ? error.message 
                      : "An error occurred. Please try again.",
                    variant: "destructive",
                  });
                }
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ParentAuth;

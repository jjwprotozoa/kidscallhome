// src/pages/ParentAuth/ParentAuth.tsx
// Purpose: Main page orchestrator for parent authentication (max 200 lines)

import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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

  const handleRestrictedEmailOverride = (email: string) => {
    setRestrictedEmailOverride(email);
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
      
      // Check if email confirmation is required
      // If user is not verified, redirect to verify-email screen
      const { data: { user: currentUser }, error: getUserError } = await supabase.auth.getUser();
      
      if (getUserError || !currentUser) {
        // User is not authenticated - wait a moment and retry
        console.warn("User not authenticated after signup, retrying...", getUserError);
        await new Promise(resolve => setTimeout(resolve, 500));
        const { data: { user: retryUser } } = await supabase.auth.getUser();
        if (!retryUser) {
          toast({
            title: "Authentication Error",
            description: "Please refresh the page and try again.",
            variant: "destructive",
          });
          return;
        }
      }
      
      if (currentUser && !currentUser.email_confirmed_at) {
        // User needs email verification - redirect to verify-email screen
        navigate(`/verify-email?email=${encodeURIComponent(email)}`, { replace: true });
        return;
      }
      
      // Ensure user is authenticated before proceeding with family setup
      // This is critical for RLS policies to work
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn("No session found after signup, waiting for session...");
        // Wait a bit longer for session to be established
        await new Promise(resolve => setTimeout(resolve, 1000));
        const { data: { session: retrySession } } = await supabase.auth.getSession();
        if (!retrySession) {
          toast({
            title: "Session Error",
            description: "Please refresh the page and try again.",
            variant: "destructive",
          });
          return;
        }
      }
      
      // User is verified and authenticated - proceed with family setup
      authState.setNeedsFamilySetup(true);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
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
            <div className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-sm px-3 py-2 rounded-md border border-green-200 dark:border-green-800">
              🎁 Referral code <strong>{referralCode}</strong> applied! You'll
              both get 1 week free when you subscribe.
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

        <div className="text-center">
          <button
            type="button"
            onClick={() => authState.setIsLogin(!authState.isLogin)}
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
          <FamilySetupSelection
            userId={authState.userId!}
            onComplete={async (householdType) => {
              try {
                const {
                  data: { user },
                } = await supabase.auth.getUser();
                if (!user) throw new Error("User not found");
                
                // Get parent profile to find family_id
                const { data: parentProfile, error: profileError } = await supabase
                  .from("adult_profiles")
                  .select("family_id")
                  .eq("user_id", user.id)
                  .eq("role", "parent")
                  .single();
                
                // Determine family_id (use fallback if profile doesn't exist)
                const familyId = parentProfile?.family_id || user.id;
                
                // Update family with household type
                // Note: FamilySetupSelection already updates this, but we do it here
                // as a safety measure in case the component's update didn't complete
                const { error: updateError } = await supabase
                  .from("families")
                  .update({ household_type })
                  .eq("id", familyId);
                
                if (updateError) {
                  // Provide more specific error messages
                  if (updateError.code === "PGRST116") {
                    throw new Error(
                      "Family record not found. Please refresh the page and try again."
                    );
                  } else if (updateError.code === "42501") {
                    throw new Error(
                      "Permission denied. Please refresh the page and try again."
                    );
                  } else {
                    console.error("Family update error details:", {
                      code: updateError.code,
                      message: updateError.message,
                      details: updateError.details,
                      hint: updateError.hint,
                    });
                    throw updateError;
                  }
                }
                
                authState.setNeedsFamilySetup(false);
                toast({ title: "Family setup complete! Welcome!" });
                navigate("/parent");
              } catch (error) {
                console.error("Error saving family setup:", error);
                toast({
                  title: "Error",
                  description: error instanceof Error 
                    ? error.message 
                    : "Failed to save family setup. Please try again.",
                  variant: "destructive",
                });
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ParentAuth;

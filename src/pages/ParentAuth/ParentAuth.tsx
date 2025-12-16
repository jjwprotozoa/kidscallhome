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
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  const { toast } = useToast();
  const authState = useAuthState();
  const { lockoutInfo, showCaptcha, setShowCaptcha, updateLockoutInfo } =
    useAccountLockout(authState.email, authState.isLogin);
  const { breachStatus, performFinalCheck } = usePasswordBreachCheck(
    authState.password,
    authState.isLogin
  );

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
        await handleLogin(sanitizedEmail, sanitizedPassword);
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
      authState.setCaptchaToken(null);
    }
  };

  const handleLogin = async (email: string, password: string) => {
    await loginHandler({
      email,
      password,
      setShowCaptcha,
      updateLockoutInfo,
      toast,
      navigate,
    });
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
    });
    if (result.needsFamilySetup && result.user) {
      authState.setUserId(result.user.id);
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
                : "Welcome back, parent!"
              : "Create your parent account"}
          </p>
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
              password={authState.password}
              onPasswordChange={authState.setPassword}
              loading={authState.loading}
              disabled={false}
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
        <DialogContent className="max-w-3xl">
          <FamilySetupSelection
            userId={authState.userId!}
            onComplete={async (householdType) => {
              try {
                const {
                  data: { user },
                } = await supabase.auth.getUser();
                if (!user) throw new Error("User not found");
                const { data: parentProfile } = await supabase
                  .from("adult_profiles")
                  .select("family_id")
                  .eq("user_id", user.id)
                  .eq("role", "parent")
                  .single();
                if (parentProfile?.family_id) {
                  const { error: updateError } = await supabase
                    .from("families")
                    .update({ household_type })
                    .eq("id", parentProfile.family_id);
                  if (updateError) throw updateError;
                }
                authState.setNeedsFamilySetup(false);
                toast({ title: "Family setup complete! Welcome!" });
                navigate("/parent");
              } catch (error) {
                console.error("Error saving family setup:", error);
                toast({
                  title: "Error",
                  description: "Failed to save family setup. Please try again.",
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

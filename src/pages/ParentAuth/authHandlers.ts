// src/pages/ParentAuth/authHandlers.ts
// Purpose: Authentication handler functions (login, signup)

import { toast as toastFn } from "@/hooks/use-toast";
import { LockoutInfo } from "@/hooks/useAccountLockout";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/utils/auditLog";
import { setCookie } from "@/utils/cookies";
import { clearFailedLogins, recordFailedLogin } from "@/utils/rateLimiting";
import { safeLog, sanitizeError } from "@/utils/security";
import { validateTurnstileToken } from "@/utils/turnstileValidation";
import { getUserRole } from "@/utils/userRole";
import { AuthValidationResult } from "./types";

type ToastOptions = Parameters<typeof toastFn>[0];

interface LoginParams {
  email: string;
  password: string;
  captchaToken?: string | null;
  setShowCaptcha: (show: boolean) => void;
  updateLockoutInfo: (info: LockoutInfo) => void;
  toast: (options: ToastOptions) => void;
  navigate: (path: string) => void;
}

interface SignupParams {
  email: string;
  password: string;
  name: string;
  validation: AuthValidationResult;
  referralCode?: string | null;
}

export const handleLogin = async ({
  email,
  password,
  captchaToken,
  setShowCaptcha,
  updateLockoutInfo,
  toast,
  navigate,
}: LoginParams) => {
  logAuditEvent("login_attempt", { email, severity: "low" });

  // Validate Turnstile token if CAPTCHA is provided (non-blocking if service unavailable)
  const CAPTCHA_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";
  if (CAPTCHA_SITE_KEY && captchaToken) {
    try {
      const validationResult = await validateTurnstileToken(captchaToken);
      if (!validationResult.success) {
        const errorMessage =
          validationResult["error-codes"]?.join(", ") ||
          validationResult.error ||
          "Security check failed";
        safeLog.error("Turnstile validation failed:", errorMessage);
        logAuditEvent("turnstile_validation_failed", {
          email,
          metadata: { errorCodes: validationResult["error-codes"] },
          severity: "high",
        });
        toast({
          title: "Security Check Failed",
          description: "Please complete the security check again.",
          variant: "destructive",
        });
        setShowCaptcha(true);
        throw new Error("Turnstile validation failed");
      }
      safeLog.log("Turnstile validation successful", { email });
    } catch (error) {
      // If it's a validation failure, block login
      if (error instanceof Error && error.message === "Turnstile validation failed") {
        throw error;
      }
      // If it's a network/service error, log but allow login to proceed
      // (Cloudflare might be blocking the validation endpoint)
      safeLog.warn("Turnstile validation service unavailable, allowing login:", sanitizeError(error));
      // Don't block login if Turnstile service is unavailable
    }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword({ 
    email, 
    password,
    options: captchaToken ? {
      captchaToken: captchaToken
    } : undefined
  });

  if (error) {
    const failedLogin = recordFailedLogin(email);
    safeLog.error("Auth error:", sanitizeError(error));
    logAuditEvent("login_failed", {
      email,
      metadata: { attempts: failedLogin.attempts },
      severity: "medium",
    });

    if (failedLogin.locked && failedLogin.lockedUntil) {
      const minutes = Math.ceil((failedLogin.lockedUntil - Date.now()) / 60000);
      toast({
        title: "Account Locked",
        description: `Too many failed attempts. Account locked for ${minutes} minute(s).`,
        variant: "destructive",
      });
      updateLockoutInfo({ locked: true, lockedUntil: failedLogin.lockedUntil });
      logAuditEvent("account_locked", { email, severity: "high" });
    } else {
      const remaining = 5 - failedLogin.attempts;
      toast({
        title: "Login Failed",
        description:
          remaining > 0
            ? `Invalid credentials. ${remaining} attempt(s) remaining.`
            : "Invalid credentials.",
        variant: "destructive",
      });
      if (failedLogin.attempts >= 2) setShowCaptcha(true);
    }
    throw error;
  }

  clearFailedLogins(email);
  logAuditEvent("login_success", { userId: user?.id, email, severity: "low" });

  if (user) {
    // Check user role from adult_profiles (canonical source of truth)
    const userRole = await getUserRole(user.id);
    
    if (userRole === "family_member") {
      // User is a family member - redirect to family dashboard immediately
      safeLog.log("✅ [AUTH] User is a family member, redirecting to family dashboard", { 
        userId: user.id,
        email: user.email,
        role: userRole
      });
      toast({ title: "Welcome back!" });
      // Use replace to prevent back navigation to parent routes
      navigate("/family-member", { replace: true });
      return;
    } else if (userRole === "parent") {
      safeLog.log("✅ [AUTH] User is a parent, continuing to parent flow", {
        userId: user.id,
        email: user.email,
        role: userRole
      });
    } else {
      safeLog.warn("⚠️ [AUTH] User role could not be determined, defaulting to parent flow", {
        userId: user.id,
        email: user.email,
        role: userRole
      });
    }

    const { data: parentData } = await supabase
      .from("parents")
      .select("name, privacy_cookie_accepted, email_updates_opt_in")
      .eq("id", user.id)
      .maybeSingle();
    if (parentData?.name) setCookie("parentName", parentData.name, 365);

    const consentDataStr = localStorage.getItem("kch_cookie_consent");
    if (consentDataStr) {
      try {
        const consentData = JSON.parse(consentDataStr);
        if (
          consentData.accepted === true &&
          parentData?.privacy_cookie_accepted !== true
        ) {
          await supabase
            .from("parents")
            .update({
              privacy_cookie_accepted: true,
              email_updates_opt_in:
                consentData.emailOptIn === true ||
                parentData?.email_updates_opt_in === true,
            })
            .eq("id", user.id);
        }
      } catch (error) {
        console.warn("Failed to sync consent:", error);
      }
    }

    try {
      const {
        generateDeviceIdentifierAsync,
        detectDeviceType,
        getDeviceName,
        getClientIP,
        getDeviceMacAddress,
        getCountryFromIP,
      } = await import("@/utils/deviceTracking");
      const deviceIdentifier = await generateDeviceIdentifierAsync();
      const deviceType = detectDeviceType();
      const deviceName = getDeviceName();
      const userAgent = navigator.userAgent;
      const ipAddress = await getClientIP();
      const macAddress = await getDeviceMacAddress();
      const countryCode = await getCountryFromIP(ipAddress);
      await supabase.rpc("update_device_login", {
        p_parent_id: user.id,
        p_device_identifier: deviceIdentifier,
        p_device_name: deviceName,
        p_device_type: deviceType,
        p_user_agent: userAgent,
        p_ip_address: ipAddress || null,
        p_mac_address: macAddress || null,
        p_country_code: countryCode || null,
        p_child_id: null,
      });
    } catch (error) {
      console.warn("Device tracking failed:", error);
    }
  }

  toast({ title: "Welcome back!" });
  navigate("/parent/children");
};

export const handleSignup = async ({
  email,
  password,
  name,
  validation,
  referralCode,
}: SignupParams) => {
  logAuditEvent("signup", { email, severity: "low" });
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name: validation.sanitized.name || name, role: "parent" },
      emailRedirectTo: `${window.location.origin}/parent/children`,
    },
  });

  if (error) {
    safeLog.error("Signup error:", sanitizeError(error));
    logAuditEvent("signup", {
      email,
      metadata: { error: error.message },
      severity: "medium",
    });
    throw error;
  }

  if (validation.sanitized.name || name) {
    setCookie("parentName", validation.sanitized.name || name, 365);
  }

  // Track referral if a code was provided
  if (referralCode && data.user) {
    try {
      const { data: referralResult, error: referralError } = await supabase.rpc(
        "track_referral_signup",
        {
          p_referral_code: referralCode.toUpperCase(),
          p_new_user_id: data.user.id,
          p_new_user_email: email,
        }
      );

      if (referralError) {
        safeLog.warn("Referral tracking failed:", sanitizeError(referralError));
      } else if (referralResult?.success) {
        safeLog.log("Referral tracked successfully:", referralResult);
        logAuditEvent("referral_signup", {
          userId: data.user.id,
          email,
          metadata: { referral_code: referralCode, referrer_id: referralResult.referrer_id },
          severity: "low",
        });
      }
    } catch (refError) {
      // Don't fail signup if referral tracking fails
      safeLog.warn("Referral tracking error:", sanitizeError(refError));
    }
  }

  return { user: data.user, needsFamilySetup: !error && !!data.user };
};

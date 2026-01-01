// src/pages/ParentAuth/authHandlers.ts
// Purpose: Authentication handler functions (login, signup)

import { trackSignupStart } from "@/utils/funnelTracking";
import {
  trackSignupStarted,
  trackSignupComplete,
  trackReferralSignup,
  trackAppOpened,
} from "@/utils/analytics";

import { toast as toastFn } from "@/hooks/use-toast";
import { LockoutInfo } from "@/hooks/useAccountLockout";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/utils/auditLog";
import { setCookie } from "@/utils/cookies";
import { clearFailedLogins, recordFailedLogin } from "@/utils/rateLimiting";
import { safeLog, sanitizeError } from "@/utils/security";
import { validateTurnstileToken } from "@/utils/turnstileValidation";
import { getUserRole } from "@/utils/userRole";
import { getEmailRedirectUrl } from "@/utils/siteUrl";
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
  familyRole?: "parent" | "grandparent" | "aunt" | "uncle" | "cousin" | "other";
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
  const CAPTCHA_ENABLED = import.meta.env.VITE_ENABLE_CAPTCHA !== "false"; // Default to enabled unless explicitly disabled
  
  if (CAPTCHA_ENABLED && CAPTCHA_SITE_KEY && captchaToken) {
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

  // Note: We don't pass captchaToken to Supabase because:
  // 1. We're using Cloudflare Turnstile, not Supabase's captcha system
  // 2. We've already validated the Turnstile token client-side above
  // 3. Supabase's captchaToken option expects Supabase's own captcha tokens
  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword({ 
    email, 
    password
  });

  if (error) {
    // Check if this is the Supabase CAPTCHA conflict error
    const isCaptchaConflictError = 
      error.message?.toLowerCase().includes("captcha verification process failed") ||
      (error.code === "unexpected_failure" && error.message?.toLowerCase().includes("captcha"));
    
    if (isCaptchaConflictError) {
      safeLog.error("❌ [AUTH] Supabase CAPTCHA conflict detected:", sanitizeError(error));
      logAuditEvent("supabase_captcha_conflict", {
        email,
        severity: "high",
      });
      toast({
        title: "Configuration Error",
        description: "Supabase CAPTCHA protection is enabled but conflicts with Turnstile. Please disable Supabase CAPTCHA in project settings.",
        variant: "destructive",
      });
      // Don't increment failed login attempts for this configuration error
      throw new Error("SUPABASE_CAPTCHA_CONFLICT: Please disable Supabase CAPTCHA protection in project settings (Authentication > Bot and Abuse Protection)");
    }

    // Check if this is an "email not confirmed" error
    const isEmailNotConfirmed = 
      error.message?.toLowerCase().includes("email not confirmed") ||
      error.message?.toLowerCase().includes("email_not_confirmed") ||
      error.code === "email_not_confirmed";
    
    if (isEmailNotConfirmed) {
      // Don't increment failed login attempts for unverified email
      safeLog.warn("Login blocked: Email not confirmed", { email });
      logAuditEvent("login_blocked_unverified_email", {
        email,
        severity: "low",
      });
      // Throw a special error that ParentAuth can catch and handle
      const emailNotConfirmedError = new Error("EMAIL_NOT_CONFIRMED");
      (emailNotConfirmedError as any).email = email;
      throw emailNotConfirmedError;
    }

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
        getClientIPWithCountry,
        getDeviceMacAddress,
        getCountryFromIP,
      } = await import("@/utils/deviceTracking");
      const deviceIdentifier = await generateDeviceIdentifierAsync();
      const deviceType = detectDeviceType();
      const deviceName = getDeviceName();
      const userAgent = navigator.userAgent;
      
      // Get IP and country code together (ipapi.co returns both, avoiding second lookup)
      const { ip: ipAddress, countryCode: countryCodeFromIP } = await getClientIPWithCountry();
      
      // Only make a second geolocation lookup if we got IP but not country code
      // (e.g., if we used ipify.org or icanhazip.com instead of ipapi.co)
      let countryCode = countryCodeFromIP;
      if (ipAddress && !countryCode) {
        countryCode = await getCountryFromIP(ipAddress);
      }
      
      const macAddress = await getDeviceMacAddress();
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

  // Track analytics: app opened (return visit)
  trackAppOpened("parent");

  toast({ title: "Welcome back!" });
  navigate("/parent/children");
};

export const handleSignup = async ({
  email,
  password,
  name,
  validation,
  referralCode,
  familyRole = "parent",
}: SignupParams) => {
  // Track funnel event: signup start (intent_type: commit)
  trackSignupStart(referralCode ? "referral" : "direct");
  // Track analytics: signup started
  trackSignupStarted(referralCode ? "referral" : "direct");
  
  logAuditEvent("signup", { email, severity: "low" });
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { 
        name: validation.sanitized.name || name, 
        role: "parent",
        familyRole: familyRole, // Store familyRole in metadata for later use
      },
      emailRedirectTo: getEmailRedirectUrl("/parent/children"),
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
        // Track analytics: referral signup
        trackReferralSignup(referralCode);
      }
    } catch (refError) {
      // Don't fail signup if referral tracking fails
      safeLog.warn("Referral tracking error:", sanitizeError(refError));
    }
  }

  // Create or update adult_profiles record with relationship_type
  // Note: For parents, relationship_type is null. For family members, it would be set via invitation.
  // We store it here for consistency, even though parents don't use relationship_type
  if (data.user) {
    try {
      // Determine role and relationship_type
      const role = familyRole === "parent" ? "parent" : "family_member";
      const relationshipType = familyRole === "parent" ? null : familyRole;

      // Get family_id (for parents, it's their own user_id initially)
      const familyId = data.user.id;

      // Insert or update adult_profiles
      const { error: profileError } = await supabase
        .from("adult_profiles")
        .upsert(
          {
            user_id: data.user.id,
            family_id: familyId,
            role: role,
            relationship_type: relationshipType,
            name: validation.sanitized.name || name,
            email: email,
          },
          {
            onConflict: "user_id,family_id,role",
          }
        );

      if (profileError) {
        safeLog.warn("Failed to create/update adult_profiles:", sanitizeError(profileError));
        // Don't fail signup if profile creation fails - it might be created by trigger
      } else {
        safeLog.log("Adult profile created/updated successfully", {
          userId: data.user.id,
          role,
          relationshipType,
        });
      }
    } catch (profileError) {
      // Don't fail signup if profile creation fails
      safeLog.warn("Error creating adult profile:", sanitizeError(profileError));
    }
  }

  // Track analytics: signup complete
  if (data.user) {
    trackSignupComplete("parent", !!referralCode);
  }

  return { user: data.user, needsFamilySetup: !error && !!data.user };
};

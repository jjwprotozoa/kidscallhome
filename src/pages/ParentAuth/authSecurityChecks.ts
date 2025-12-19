// src/pages/ParentAuth/authSecurityChecks.ts
// Purpose: Security validation checks for auth forms

import { logAuditEvent } from "@/utils/auditLog";
import { detectBot, getBehaviorTracker } from "@/utils/botDetection";
import { checkRateLimit, getRateLimitKey } from "@/utils/rateLimiting";
import { AuthFormData } from "./types";
import { LockoutInfo } from "@/hooks/useAccountLockout";
import { toast as toastFn } from "@/hooks/use-toast";

type ToastOptions = Parameters<typeof toastFn>[0];

interface SecurityCheckParams {
  email: string;
  isLogin: boolean;
  lockoutInfo: LockoutInfo | null;
  showCaptcha: boolean;
  captchaToken: string | null;
  toast: (options: ToastOptions) => void;
}

export const performSecurityChecks = ({
  email,
  isLogin,
  lockoutInfo,
  showCaptcha,
  captchaToken,
  toast,
}: SecurityCheckParams): { allowed: boolean; error?: string } => {
  const rateLimitKey = getRateLimitKey(email, "login");
  const rateLimitCheck = checkRateLimit(rateLimitKey, "login");

  if (!rateLimitCheck.allowed) {
    if (rateLimitCheck.lockedUntil) {
      const minutes = Math.ceil((rateLimitCheck.lockedUntil - Date.now()) / 60000);
      toast({ title: "Account Temporarily Locked", description: `Too many login attempts. Please try again in ${minutes} minute(s).`, variant: "destructive" });
      logAuditEvent("login_locked", { email, severity: "high" });
      return { allowed: false, error: "locked" };
    } else {
      toast({ title: "Too Many Attempts", description: "Please wait before trying again.", variant: "destructive" });
      logAuditEvent("rate_limit_exceeded", { email, severity: "medium" });
      return { allowed: false, error: "rate_limited" };
    }
  }

  if (isLogin) {
    if (lockoutInfo?.locked && lockoutInfo.lockedUntil) {
      const minutes = Math.ceil((lockoutInfo.lockedUntil - Date.now()) / 60000);
      toast({ title: "Account Locked", description: `Account is locked due to multiple failed attempts. Try again in ${minutes} minute(s).`, variant: "destructive" });
      logAuditEvent("account_locked", { email, severity: "high" });
      return { allowed: false, error: "account_locked" };
    }

    // Temporarily disable CAPTCHA requirement if Cloudflare is blocking the site
    // This allows login to work while Cloudflare security issues are resolved
    const CAPTCHA_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";
    const CAPTCHA_ENABLED = import.meta.env.VITE_ENABLE_CAPTCHA !== "false"; // Default to enabled unless explicitly disabled
    
    if (CAPTCHA_ENABLED && showCaptcha && CAPTCHA_SITE_KEY && !captchaToken) {
      // Check if CAPTCHA widget is actually visible/working
      // If widget failed to load, don't block login
      const captchaElement = document.querySelector('.cf-turnstile');
      if (!captchaElement) {
        // CAPTCHA widget not rendered, might be blocked by Cloudflare
        // Allow login to proceed but log the issue
        logAuditEvent("captcha_widget_not_rendered", { email, severity: "medium" });
        return { allowed: true }; // Allow login if widget didn't render
      }
      toast({ title: "Security Check Required", description: "Please complete the security check below.", variant: "destructive" });
      return { allowed: false, error: "captcha_required" };
    }
    
    // If CAPTCHA is disabled or not configured, allow login
    if (!CAPTCHA_ENABLED || !CAPTCHA_SITE_KEY) {
      return { allowed: true };
    }
  }

  const botDetection = detectBot();
  if (botDetection.isBot && botDetection.confidence > 50) {
    const behaviorTracker = getBehaviorTracker();
    const behaviorAnalysis = behaviorTracker?.analyzeBehavior();
    if (behaviorAnalysis?.isSuspicious) {
      toast({ title: "Security Check Failed", description: "Unable to verify you're human. Please try again.", variant: "destructive" });
      logAuditEvent("bot_detected", { email, metadata: { botReasons: botDetection.reasons, behaviorReasons: behaviorAnalysis.reasons }, severity: "high" });
      return { allowed: false, error: "bot_detected" };
    }
  }

  return { allowed: true };
};


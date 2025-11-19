// src/hooks/useEmailBreachCheck.ts
// Hook for real-time email breach checking during signup

import { useEffect, useState } from "react";
import { checkEmailBreach } from "@/utils/passwordBreachCheck";
import { isValidEmail } from "@/utils/inputValidation";

export interface EmailBreachInfo {
  isPwned: boolean;
  breachCount?: number;
  breaches?: Array<{ Name: string; BreachDate: string }>;
}

export const useEmailBreachCheck = (email: string, isLogin: boolean) => {
  const [checkingEmailBreach, setCheckingEmailBreach] = useState(false);
  const [emailBreachInfo, setEmailBreachInfo] = useState<EmailBreachInfo | null>(null);

  // Real-time email breach checking (debounced) for signup
  // NOTE: This is completely non-blocking - if API fails or rate-limited, signup proceeds normally
  useEffect(() => {
    if (isLogin || !email || !isValidEmail(email)) {
      setEmailBreachInfo(null);
      return;
    }

    // Debounce the email breach check (longer delay to respect rate limits)
    const timeoutId = setTimeout(async () => {
      setCheckingEmailBreach(true);
      try {
        // Optional: Get API key from environment if available (requires subscription)
        const apiKey = import.meta.env.VITE_HIBP_API_KEY;
        const emailCheck = await checkEmailBreach(email, apiKey);
        setCheckingEmailBreach(false);

        // Only show breach info if email was actually found in breaches
        // If API failed/rate-limited, emailCheck.isPwned will be false (fail-open)
        if (emailCheck.isPwned) {
          setEmailBreachInfo({
            isPwned: true,
            breachCount: emailCheck.breachCount,
            breaches: emailCheck.breaches,
          });
        } else {
          // Email not breached OR API unavailable/rate-limited - either way, allow signup
          setEmailBreachInfo({ isPwned: false });
        }
      } catch (error) {
        // Any error: silently fail - never block signup
        setCheckingEmailBreach(false);
        setEmailBreachInfo(null);
        // Don't show any error to user - signup proceeds normally
      }
    }, 2000); // 2 second debounce to respect rate limits

    return () => clearTimeout(timeoutId);
  }, [email, isLogin]);

  return {
    checkingEmailBreach,
    emailBreachInfo,
  };
};


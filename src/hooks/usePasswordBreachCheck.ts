// src/hooks/usePasswordBreachCheck.ts
// Hook for real-time password breach checking during signup

import { useEffect, useState } from "react";
import { validatePasswordWithBreachCheck } from "@/utils/passwordBreachCheck";

export type PasswordBreachStatus = "checking" | "safe" | "breached" | null;

export const usePasswordBreachCheck = (
  password: string,
  isLogin: boolean
) => {
  const [checkingBreach, setCheckingBreach] = useState(false);
  const [breachStatus, setBreachStatus] = useState<PasswordBreachStatus>(null);

  // Real-time password breach checking (debounced) for signup
  useEffect(() => {
    if (isLogin || !password || password.length < 8) {
      setBreachStatus(null);
      return;
    }

    // Debounce the breach check
    const timeoutId = setTimeout(async () => {
      setCheckingBreach(true);
      setBreachStatus("checking");
      try {
        const breachCheck = await validatePasswordWithBreachCheck(password);
        setCheckingBreach(false);
        if (breachCheck.isPwned) {
          setBreachStatus("breached");
        } else if (breachCheck.valid) {
          setBreachStatus("safe");
        } else {
          setBreachStatus(null);
        }
      } catch (error) {
        setCheckingBreach(false);
        setBreachStatus(null);
        // Silently fail - don't show error for real-time checks
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(timeoutId);
  }, [password, isLogin]);

  const resetStatus = () => {
    setBreachStatus(null);
  };

  const performFinalCheck = async (password: string): Promise<boolean> => {
    setCheckingBreach(true);
    setBreachStatus("checking");
    try {
      const breachCheck = await validatePasswordWithBreachCheck(password);
      setCheckingBreach(false);

      if (!breachCheck.valid) {
        if (breachCheck.isPwned) {
          setBreachStatus("breached");
        }
        return false;
      } else {
        setBreachStatus("safe");
        return true;
      }
    } catch (error) {
      setCheckingBreach(false);
      setBreachStatus(null);
      // If breach check fails, allow password but log warning
      return true; // Fail open
    }
  };

  return {
    checkingBreach,
    breachStatus,
    resetStatus,
    performFinalCheck,
  };
};


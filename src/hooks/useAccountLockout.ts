// src/hooks/useAccountLockout.ts
// Hook for checking account lockout status and managing CAPTCHA display

import { useEffect, useState } from "react";
import { isEmailLocked } from "@/utils/rateLimiting";

export interface LockoutInfo {
  locked: boolean;
  lockedUntil?: number;
  attemptsRemaining?: number;
}

export const useAccountLockout = (email: string, isLogin: boolean) => {
  const [lockoutInfo, setLockoutInfo] = useState<LockoutInfo | null>(null);
  const [showCaptcha, setShowCaptcha] = useState(false);

  // Check lockout status when email changes
  useEffect(() => {
    if (isLogin && email) {
      const lockout = isEmailLocked(email);
      setLockoutInfo(lockout);

      // Show CAPTCHA after 2 failed attempts
      if (
        lockout.attemptsRemaining !== undefined &&
        lockout.attemptsRemaining <= 3
      ) {
        setShowCaptcha(true);
      }
    } else {
      setLockoutInfo(null);
      setShowCaptcha(false);
    }
  }, [email, isLogin]);

  const updateLockoutInfo = (info: LockoutInfo) => {
    setLockoutInfo(info);
  };

  return {
    lockoutInfo,
    showCaptcha,
    setShowCaptcha,
    updateLockoutInfo,
  };
};


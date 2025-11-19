// src/components/auth/LockoutWarning.tsx
// Component for displaying account lockout warnings

import { AlertCircle, Shield } from "lucide-react";
import { LockoutInfo } from "@/hooks/useAccountLockout";

interface LockoutWarningProps {
  lockoutInfo: LockoutInfo;
}

export const LockoutWarning = ({ lockoutInfo }: LockoutWarningProps) => {
  // Show lockout warning
  if (lockoutInfo.locked && lockoutInfo.lockedUntil) {
    return (
      <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
        <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-destructive">
            Account Locked
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Too many failed login attempts. Please try again in{" "}
            {Math.ceil((lockoutInfo.lockedUntil - Date.now()) / 60000)}{" "}
            minute(s).
          </p>
        </div>
      </div>
    );
  }

  // Show attempts remaining warning
  if (
    !lockoutInfo.locked &&
    lockoutInfo.attemptsRemaining !== undefined &&
    lockoutInfo.attemptsRemaining < 5
  ) {
    return (
      <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
        <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-700">
            Security Notice
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {lockoutInfo.attemptsRemaining} attempt(s) remaining
            before account lockout.
          </p>
        </div>
      </div>
    );
  }

  return null;
};


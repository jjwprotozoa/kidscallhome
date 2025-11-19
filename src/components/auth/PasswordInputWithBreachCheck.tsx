// src/components/auth/PasswordInputWithBreachCheck.tsx
// Password input component with real-time breach checking for signup

import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useRef } from "react";
import { usePasswordBreachCheck } from "@/hooks/usePasswordBreachCheck";

interface PasswordInputWithBreachCheckProps {
  password: string;
  onChange: (value: string) => void;
  isLogin: boolean;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}

export const PasswordInputWithBreachCheck = ({
  password,
  onChange,
  isLogin,
  required = true,
  minLength = 6,
  autoComplete,
}: PasswordInputWithBreachCheckProps) => {
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const { checkingBreach, breachStatus, resetStatus } = usePasswordBreachCheck(
    password,
    isLogin
  );

  const handlePasswordChange = (value: string) => {
    onChange(value);
    // Reset breach status when password changes
    if (!isLogin) {
      resetStatus();
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Password</label>
      <div className="relative">
        <Input
          ref={passwordInputRef}
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => handlePasswordChange(e.target.value)}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          className={
            !isLogin && breachStatus === "breached"
              ? "pr-10 border-destructive focus-visible:ring-destructive"
              : !isLogin && breachStatus === "safe"
              ? "pr-10 border-green-500 focus-visible:ring-green-500"
              : ""
          }
        />
        {!isLogin && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {checkingBreach && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {!checkingBreach && breachStatus === "breached" && (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
            {!checkingBreach &&
              breachStatus === "safe" &&
              password.length >= 8 && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
          </div>
        )}
      </div>
      {!isLogin && checkingBreach && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking password security...
        </p>
      )}
      {!isLogin && breachStatus === "breached" && (
        <p className="text-xs text-destructive flex items-start gap-1">
          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          This password has been compromised in data breaches. Choose a
          unique password that you haven't used elsewhere.
        </p>
      )}
      {!isLogin &&
        breachStatus === "safe" &&
        password.length >= 8 && (
          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Password looks secure!
          </p>
        )}
    </div>
  );
};


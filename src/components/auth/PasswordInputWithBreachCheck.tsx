// src/components/auth/PasswordInputWithBreachCheck.tsx
// Password input component with real-time breach checking for signup

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePasswordBreachCheck } from "@/hooks/usePasswordBreachCheck";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

// Password strength requirements checker
function checkPasswordStrength(password: string) {
  return {
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSymbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
    hasMinLength: password.length >= 8,
  };
}

// Password Strength Indicator Component
function PasswordStrengthIndicator({ password }: { password: string }) {
  const strength = checkPasswordStrength(password);
  const requirements = [
    { key: "hasMinLength", label: "At least 8 characters", met: strength.hasMinLength },
    { key: "hasLowercase", label: "Lowercase letter (a-z)", met: strength.hasLowercase },
    { key: "hasUppercase", label: "Uppercase letter (A-Z)", met: strength.hasUppercase },
    { key: "hasDigit", label: "Number (0-9)", met: strength.hasDigit },
    { key: "hasSymbol", label: "Symbol (!@#$%...)", met: strength.hasSymbol },
  ];

  const metCount = requirements.filter((r) => r.met).length;
  const strengthLevel =
    metCount <= 2 ? "weak" : metCount <= 3 ? "fair" : metCount <= 4 ? "good" : "strong";

  const strengthColors = {
    weak: "bg-red-500",
    fair: "bg-orange-500",
    good: "bg-yellow-500",
    strong: "bg-green-500",
  };

  return (
    <div className="space-y-2 text-xs">
      {/* Strength Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`flex-1 rounded-full transition-colors ${
                i <= metCount ? strengthColors[strengthLevel] : "bg-muted-foreground/20"
              }`}
            />
          ))}
        </div>
        <span
          className={`text-xs font-medium capitalize ${
            strengthLevel === "weak"
              ? "text-red-500"
              : strengthLevel === "fair"
              ? "text-orange-500"
              : strengthLevel === "good"
              ? "text-yellow-600 dark:text-yellow-500"
              : "text-green-500"
          }`}
        >
          {strengthLevel}
        </span>
      </div>

      {/* Requirements List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1 p-2 bg-muted/50 rounded-md">
        {requirements.map((req) => (
          <div
            key={req.key}
            className={`flex items-center gap-1 ${
              req.met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
            }`}
          >
            {req.met ? (
              <Check className="h-3 w-3 flex-shrink-0" />
            ) : (
              <X className="h-3 w-3 flex-shrink-0" />
            )}
            <span className="truncate">{req.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PasswordInputWithBreachCheckProps {
  password: string;
  onChange: (value: string) => void;
  isLogin: boolean;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  /** For signup: enable confirmation field */
  showConfirmation?: boolean;
  /** Confirmation password value (controlled externally) */
  confirmPassword?: string;
  /** Callback when confirmation password changes */
  onConfirmPasswordChange?: (value: string) => void;
}

export const PasswordInputWithBreachCheck = ({
  password,
  onChange,
  isLogin,
  required = true,
  minLength = 6,
  autoComplete,
  showConfirmation = false,
  confirmPassword = "",
  onConfirmPasswordChange,
}: PasswordInputWithBreachCheckProps) => {
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmField, setShowConfirmField] = useState(false);
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

  const passwordsMatch =
    showConfirmation && confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch =
    showConfirmation && confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="space-y-3">
      {/* Main Password Field */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Password</label>
        <div className="relative">
          <Input
            ref={passwordInputRef}
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            required={required}
            minLength={minLength}
            autoComplete={autoComplete}
            className={`pr-20 ${
              !isLogin && breachStatus === "breached"
                ? "border-destructive focus-visible:ring-destructive"
                : !isLogin && breachStatus === "safe"
                ? "border-green-500 focus-visible:ring-green-500"
                : ""
            }`}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {/* Breach status indicator */}
            {!isLogin && (
              <>
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
              </>
            )}
            {/* Show/Hide toggle */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="sr-only">
                {showPassword ? "Hide password" : "Show password"}
              </span>
            </Button>
          </div>
        </div>

        {/* Password Requirements Hint (for signup only) */}
        {!isLogin && password.length === 0 && (
          <div className="text-xs text-muted-foreground space-y-1 p-2 bg-muted/50 rounded-md">
            <p className="font-medium">Password Requirements</p>
            <p>Must include lowercase, uppercase, digits, and symbols</p>
          </div>
        )}

        {/* Password Strength Indicators (for signup only, when typing) */}
        {!isLogin && password.length > 0 && (
          <PasswordStrengthIndicator password={password} />
        )}

        {!isLogin && checkingBreach && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Checking password security...
          </p>
        )}
        {!isLogin && breachStatus === "breached" && (
          <p className="text-xs text-destructive flex items-start gap-1">
            <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            This password has been compromised in data breaches. Choose a unique
            password that you haven't used elsewhere.
          </p>
        )}
        {!isLogin && breachStatus === "safe" && password.length >= 8 && (
          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Password looks secure!
          </p>
        )}
      </div>

      {/* Confirm Password Field (for signup) */}
      {showConfirmation && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Confirm Password</label>
          <div className="relative">
            <Input
              type={showConfirmField ? "text" : "password"}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange?.(e.target.value)}
              required={required}
              className={`pr-12 ${
                passwordsMatch
                  ? "border-green-500 focus-visible:ring-green-500"
                  : passwordsMismatch
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }`}
              autoComplete="new-password"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {/* Match indicator */}
              {passwordsMatch && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              {passwordsMismatch && (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
              {/* Show/Hide toggle */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-transparent"
                onClick={() => setShowConfirmField(!showConfirmField)}
                tabIndex={-1}
              >
                {showConfirmField ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="sr-only">
                  {showConfirmField ? "Hide password" : "Show password"}
                </span>
              </Button>
            </div>
          </div>
          {passwordsMatch && (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Passwords match!
            </p>
          )}
          {passwordsMismatch && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Passwords don't match
            </p>
          )}
        </div>
      )}
    </div>
  );
};


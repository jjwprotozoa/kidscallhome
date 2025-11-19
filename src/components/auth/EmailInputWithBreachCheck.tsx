// src/components/auth/EmailInputWithBreachCheck.tsx
// Email input component with real-time breach checking for signup

import { Input } from "@/components/ui/input";
import { isValidEmail } from "@/utils/inputValidation";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEmailBreachCheck } from "@/hooks/useEmailBreachCheck";

interface EmailInputWithBreachCheckProps {
  email: string;
  onChange: (value: string) => void;
  isLogin: boolean;
  required?: boolean;
}

export const EmailInputWithBreachCheck = ({
  email,
  onChange,
  isLogin,
  required = true,
}: EmailInputWithBreachCheckProps) => {
  const { checkingEmailBreach, emailBreachInfo } = useEmailBreachCheck(
    email,
    isLogin
  );

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Email</label>
      <div className="relative">
        <Input
          type="email"
          placeholder="parent@email.com"
          value={email}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={isLogin ? "username" : "email"}
        />
        {!isLogin && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {checkingEmailBreach && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {!checkingEmailBreach && emailBreachInfo?.isPwned && (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            {!checkingEmailBreach &&
              emailBreachInfo?.isPwned === false &&
              isValidEmail(email) && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
          </div>
        )}
      </div>
      {!isLogin && checkingEmailBreach && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking email security...
        </p>
      )}
      {!isLogin && emailBreachInfo?.isPwned && (
        <div className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
          <p className="flex items-start gap-1">
            <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span className="font-medium">
              This email was found in{" "}
              {emailBreachInfo.breachCount || "multiple"} data breach(es).
            </span>
          </p>
          <p className="pl-4 text-muted-foreground">
            Your email was exposed in:{" "}
            {emailBreachInfo.breaches
              ?.slice(0, 3)
              .map((b) => b.Name)
              .join(", ")}
            {emailBreachInfo.breachCount && emailBreachInfo.breachCount > 3
              ? ` and ${emailBreachInfo.breachCount - 3} more`
              : ""}
          </p>
          <p className="pl-4 text-muted-foreground">
            <strong>Security tip:</strong> Use a strong, unique password
            and consider enabling two-factor authentication if available.
          </p>
        </div>
      )}
      {!isLogin &&
        emailBreachInfo?.isPwned === false &&
        isValidEmail(email) && (
          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Email not found in known breaches
          </p>
        )}
    </div>
  );
};


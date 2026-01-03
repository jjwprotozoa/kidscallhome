// src/components/auth/EmailInputWithBreachCheck.tsx
// Email input component with real-time breach checking for signup

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isValidEmail } from "@/utils/inputValidation";
import {
  normalizeEmail,
  isValidEmailBasic,
  suggestEmailCorrection,
} from "@/utils/emailValidation";
import { isLikelyRestrictedEmail } from "@/utils/emailRestrictions";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEmailBreachCheck } from "@/hooks/useEmailBreachCheck";
import { useState, useEffect, useRef } from "react";

interface EmailInputWithBreachCheckProps {
  email: string;
  onChange: (value: string) => void;
  isLogin: boolean;
  required?: boolean;
  confirmEmail?: string;
  onConfirmEmailChange?: (value: string) => void;
  showConfirmEmail?: boolean;
  onRestrictedEmailDetected?: (isRestricted: boolean) => void;
  emailInputRef?: React.RefObject<HTMLInputElement>;
}

export const EmailInputWithBreachCheck = ({
  email,
  onChange,
  isLogin,
  required = true,
  confirmEmail = "",
  onConfirmEmailChange,
  showConfirmEmail = false,
  onRestrictedEmailDetected,
  emailInputRef: externalRef,
}: EmailInputWithBreachCheckProps) => {
  const { checkingEmailBreach, emailBreachInfo } = useEmailBreachCheck(
    email,
    isLogin
  );

  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [emailBlurred, setEmailBlurred] = useState(false);
  const [confirmEmailBlurred, setConfirmEmailBlurred] = useState(false);
  const internalRef = useRef<HTMLInputElement>(null);
  
  // Use external ref if provided, otherwise use internal ref
  const emailInputRef = externalRef || internalRef;

  // Check for email typo suggestions when email changes or is blurred
  useEffect(() => {
    if (isLogin || !email) {
      setEmailSuggestion(null);
      setShowSuggestion(false);
      return;
    }

    const suggestion = suggestEmailCorrection(email);
    if (suggestion && normalizeEmail(suggestion) !== normalizeEmail(email)) {
      setEmailSuggestion(suggestion);
      // Show suggestion if email is valid shape or user has blurred the field
      if (isValidEmailBasic(email) || emailBlurred) {
        setShowSuggestion(true);
      }
    } else {
      setEmailSuggestion(null);
      setShowSuggestion(false);
    }
  }, [email, emailBlurred, isLogin]);

  const handleUseSuggestion = () => {
    if (emailSuggestion) {
      onChange(emailSuggestion);
      if (onConfirmEmailChange) {
        onConfirmEmailChange("");
      }
      setShowSuggestion(false);
      setEmailSuggestion(null);
    }
  };

  // Validation states
  const normalizedEmail = normalizeEmail(email);
  const normalizedConfirmEmail = normalizeEmail(confirmEmail);
  const emailValid = isValidEmailBasic(email);
  const emailsMatch =
    !showConfirmEmail ||
    !confirmEmail ||
    normalizedEmail === normalizedConfirmEmail;

  // Check if email is likely restricted (only when emails match to avoid double friction)
  const isRestricted =
    !isLogin &&
    emailsMatch &&
    emailValid &&
    isLikelyRestrictedEmail(email);

  // Notify parent component about restricted email detection
  useEffect(() => {
    if (onRestrictedEmailDetected) {
      onRestrictedEmailDetected(isRestricted);
    }
  }, [isRestricted, onRestrictedEmailDetected]);

  // Only show restricted email warning when emails match (avoid double friction)
  const shouldShowRestrictedWarning =
    !isLogin &&
    emailBreachInfo?.isPwned &&
    emailsMatch &&
    emailValid;

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <label className="text-sm font-medium">Email</label>
        <div className="relative">
          <Input
            ref={emailInputRef}
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEmailBlurred(true)}
            required={required}
            autoComplete={isLogin ? "username" : "email"}
            // Add data attributes to help browser extensions identify the field correctly
            data-form-type="email"
            // Prevent browser extensions from interfering with React's DOM management
            data-autofill-safe="true"
            className={
              emailBlurred && !emailValid && email
                ? "border-destructive"
                : ""
            }
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
        {emailBlurred && !emailValid && email && (
          <p className="text-xs text-destructive">
            Enter a valid email address
          </p>
        )}
      </div>

      {/* Email typo suggestion banner */}
      {!isLogin && showSuggestion && emailSuggestion && (
        <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-blue-900 dark:text-blue-100">
              Did you mean <strong>{emailSuggestion}</strong>?
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseSuggestion}
              className="h-6 px-2 text-xs"
            >
              Use this
            </Button>
          </div>
        </div>
      )}

      {/* Confirm Email Field */}
      {!isLogin && showConfirmEmail && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Confirm Email</label>
          <Input
            type="email"
            placeholder="your@email.com"
            value={confirmEmail}
            onChange={(e) => onConfirmEmailChange?.(e.target.value)}
            onBlur={() => setConfirmEmailBlurred(true)}
            required={showConfirmEmail}
            autoComplete="email"
            className={
              confirmEmailBlurred && !emailsMatch && confirmEmail
                ? "border-destructive"
                : ""
            }
          />
          {confirmEmailBlurred && !emailsMatch && confirmEmail && (
            <p className="text-xs text-destructive">Emails don't match.</p>
          )}
        </div>
      )}

      {!isLogin && checkingEmailBreach && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking email security...
        </p>
      )}
      {shouldShowRestrictedWarning && (
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
        isValidEmail(email) &&
        emailsMatch && (
          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Email not found in known breaches
          </p>
        )}
    </div>
  );
};


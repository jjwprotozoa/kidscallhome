// src/pages/ParentAuth/SignupForm.tsx
// Purpose: Signup form UI component

import { EmailInputWithBreachCheck } from "@/components/auth/EmailInputWithBreachCheck";
import { PasswordInputWithBreachCheck } from "@/components/auth/PasswordInputWithBreachCheck";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info, UserPlus, AlertTriangle } from "lucide-react";
import { normalizeEmail, isValidEmailBasic } from "@/utils/emailValidation";
import { isLikelyRestrictedEmail, getEmailDomain } from "@/utils/emailRestrictions";
import { logAppEvent } from "@/utils/appEventLogging";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export type FamilyRole = "parent" | "grandparent" | "aunt" | "uncle" | "cousin" | "other";

const roleOptions: { value: FamilyRole; label: string; placeholder: string }[] = [
  { value: "parent", label: "Parent / Guardian", placeholder: "e.g., Sarah, Dad, Mom" },
  { value: "grandparent", label: "Grandparent", placeholder: "e.g., Grandma Sue, Papa Joe" },
  { value: "aunt", label: "Aunt", placeholder: "e.g., Aunt Maria" },
  { value: "uncle", label: "Uncle", placeholder: "e.g., Uncle Tom" },
  { value: "cousin", label: "Cousin", placeholder: "e.g., Cousin Alex" },
  { value: "other", label: "Other Family Member", placeholder: "e.g., Your name or nickname" },
];

interface SignupFormProps {
  name: string;
  onNameChange: (name: string) => void;
  email: string;
  onEmailChange: (email: string) => void;
  confirmEmail: string;
  onConfirmEmailChange: (email: string) => void;
  password: string;
  onPasswordChange: (password: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (password: string) => void;
  loading: boolean;
  disabled: boolean;
  familyRole?: FamilyRole;
  onFamilyRoleChange?: (role: FamilyRole) => void;
  onOverrideAccepted?: (email: string) => void;
}

export const SignupForm = ({
  name,
  onNameChange,
  email,
  onEmailChange,
  confirmEmail,
  onConfirmEmailChange,
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  loading,
  disabled,
  familyRole = "parent",
  onFamilyRoleChange,
  onOverrideAccepted,
}: SignupFormProps) => {
  const isParent = familyRole === "parent";
  const selectedRole = roleOptions.find((r) => r.value === familyRole);
  const location = useLocation();
  const [isRestrictedEmail, setIsRestrictedEmail] = useState(false);
  const [overrideChecked, setOverrideChecked] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Check if email validation passes for button disable state
  const emailValid = isValidEmailBasic(email);
  const emailsMatch =
    normalizeEmail(email) === normalizeEmail(confirmEmail) || !confirmEmail;
  
  // Check if email is restricted (only when emails match to avoid double friction)
  const normalizedEmail = normalizeEmail(email);
  const normalizedConfirmEmail = normalizeEmail(confirmEmail);
  const emailsMatchForRestriction = normalizedEmail === normalizedConfirmEmail;
  const isRestricted = 
    emailsMatchForRestriction && 
    emailValid && 
    isLikelyRestrictedEmail(email);

  // Update restricted email state
  useEffect(() => {
    setIsRestrictedEmail(isRestricted);
    
    // Log detection on first render of panel (per session using sessionStorage)
    if (isRestricted) {
      const domain = getEmailDomain(email);
      const route = location.pathname;
      const logKey = `restricted_email_detected:${domain}:${route}`;
      
      if (!sessionStorage.getItem(logKey)) {
        logAppEvent("restricted_email_detected", { domain, route });
        sessionStorage.setItem(logKey, "true");
      }
    }
    
    // Reset override when email changes
    if (!isRestricted) {
      setOverrideChecked(false);
    }
  }, [isRestricted, email, location.pathname]);

  // Block submit if restricted and override not checked
  const isFormValid = emailValid && emailsMatch && (!isRestricted || overrideChecked);

  const handleUseDifferentEmail = () => {
    onEmailChange("");
    onConfirmEmailChange("");
    setOverrideChecked(false);
    // Focus email input after clearing
    setTimeout(() => {
      emailInputRef.current?.focus();
    }, 0);
  };

  const handleOverrideChange = (checked: boolean) => {
    setOverrideChecked(checked);
    // Log override acceptance when checked (will be used on submit)
    if (checked && onOverrideAccepted) {
      onOverrideAccepted(email);
    }
  };

  return (
    <>
      {/* Family Role Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">I am a...</label>
        <Select
          value={familyRole}
          onValueChange={(value) => onFamilyRoleChange?.(value as FamilyRole)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select your relationship" />
          </SelectTrigger>
          <SelectContent>
            {roleOptions.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Show different content based on role selection */}
      {isParent ? (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Name</label>
            <Input
              type="text"
              placeholder={selectedRole?.placeholder || "Your name"}
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              required
            />
          </div>

          <EmailInputWithBreachCheck
            email={email}
            onChange={onEmailChange}
            isLogin={false}
            confirmEmail={confirmEmail}
            onConfirmEmailChange={onConfirmEmailChange}
            showConfirmEmail={true}
            onRestrictedEmailDetected={setIsRestrictedEmail}
            emailInputRef={emailInputRef}
          />

          <p className="text-xs text-muted-foreground">
            We use your email to create and secure your account and may contact you about important Kids Call Home service updates. You can opt out of non‑essential emails at any time.
          </p>

          <PasswordInputWithBreachCheck
            password={password}
            onChange={onPasswordChange}
            isLogin={false}
            autoComplete="new-password"
            showConfirmation={true}
            confirmPassword={confirmPassword}
            onConfirmPasswordChange={onConfirmPasswordChange}
          />

          {/* Restricted email warning panel */}
          {isRestrictedEmail && emailsMatchForRestriction && emailValid && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Email may be restricted
                  </h3>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    It looks like this email is managed by a school or child account.
                    These accounts often can't receive verification or security emails.
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Please use a personal parent email (Gmail, Outlook, etc.), or check with your school provider about allowing external emails.
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    This helps ensure you can receive password resets and important security messages.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUseDifferentEmail}
                  className="w-full"
                  aria-label="Use a different email address"
                >
                  Use a different email
                </Button>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="restricted-email-override"
                    checked={overrideChecked}
                    onCheckedChange={handleOverrideChange}
                    aria-label="I understand this email may not receive verification or security emails"
                  />
                  <label
                    htmlFor="restricted-email-override"
                    className="text-sm text-amber-800 dark:text-amber-200 cursor-pointer leading-tight"
                  >
                    I understand this email may not receive verification or security emails.
                  </label>
                </div>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={disabled || loading || !isFormValid}
          >
            {loading ? (
              "Processing..."
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create Account
              </>
            )}
          </Button>
        </>
      ) : (
        /* Family member guidance */
        <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Family members need an invitation
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                As a {selectedRole?.label.toLowerCase()}, you'll need to be invited by the child's parent/guardian. 
                Ask them to send you an invitation from their Kids Call Home dashboard.
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                Once invited, you'll receive an email with a link to create your account.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};













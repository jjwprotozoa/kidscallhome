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
import { Info, UserPlus } from "lucide-react";

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
  password: string;
  onPasswordChange: (password: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (password: string) => void;
  loading: boolean;
  disabled: boolean;
  familyRole?: FamilyRole;
  onFamilyRoleChange?: (role: FamilyRole) => void;
}

export const SignupForm = ({
  name,
  onNameChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  loading,
  disabled,
  familyRole = "parent",
  onFamilyRoleChange,
}: SignupFormProps) => {
  const isParent = familyRole === "parent";
  const selectedRole = roleOptions.find((r) => r.value === familyRole);

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

          <Button
            type="submit"
            className="w-full"
            disabled={disabled || loading}
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











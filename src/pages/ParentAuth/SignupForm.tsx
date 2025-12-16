// src/pages/ParentAuth/SignupForm.tsx
// Purpose: Signup form UI component

import { EmailInputWithBreachCheck } from "@/components/auth/EmailInputWithBreachCheck";
import { PasswordInputWithBreachCheck } from "@/components/auth/PasswordInputWithBreachCheck";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus } from "lucide-react";

interface SignupFormProps {
  name: string;
  onNameChange: (name: string) => void;
  email: string;
  onEmailChange: (email: string) => void;
  password: string;
  onPasswordChange: (password: string) => void;
  loading: boolean;
  disabled: boolean;
}

export const SignupForm = ({
  name,
  onNameChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  loading,
  disabled,
}: SignupFormProps) => {
  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium">Your Name</label>
        <Input
          type="text"
          placeholder="Mom / Dad / Guardian"
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
        We use your email to create and secure your parent account and may contact you about important Kids Call Home service updates. You can opt out of non‑essential emails at any time.
      </p>

      <PasswordInputWithBreachCheck
        password={password}
        onChange={onPasswordChange}
        isLogin={false}
        autoComplete="new-password"
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
  );
};









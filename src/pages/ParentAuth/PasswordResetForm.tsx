// src/pages/ParentAuth/PasswordResetForm.tsx
// Purpose: Password reset form UI component
// Note: Currently not implemented in main component, but structure is ready for future use

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PasswordResetFormProps {
  email: string;
  onEmailChange: (email: string) => void;
  loading: boolean;
  disabled: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const PasswordResetForm = ({
  email,
  onEmailChange,
  loading,
  disabled,
  onSubmit,
}: PasswordResetFormProps) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Email</label>
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={disabled || loading}
      >
        {loading ? "Sending..." : "Send Reset Link"}
      </Button>
    </form>
  );
};








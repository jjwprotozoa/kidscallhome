// src/pages/ParentAuth/LoginForm.tsx
// Purpose: Login form UI component

import { Captcha } from "@/components/Captcha";
import { EmailInputWithBreachCheck } from "@/components/auth/EmailInputWithBreachCheck";
import { LockoutWarning } from "@/components/auth/LockoutWarning";
import { PasswordInputWithBreachCheck } from "@/components/auth/PasswordInputWithBreachCheck";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAccountLockout } from "@/hooks/useAccountLockout";
import { safeLog } from "@/utils/security";
import { LogIn } from "lucide-react";

interface LoginFormProps {
  email: string;
  onEmailChange: (email: string) => void;
  password: string;
  onPasswordChange: (password: string) => void;
  staySignedIn: boolean;
  onStaySignedInChange: (checked: boolean) => void;
  loading: boolean;
  lockoutInfo: ReturnType<typeof useAccountLockout>["lockoutInfo"];
  showCaptcha: boolean;
  captchaToken: string | null;
  onCaptchaVerify: (token: string) => void;
  onCaptchaError: (error: Error | unknown) => void;
  disabled: boolean;
}

export const LoginForm = ({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  staySignedIn,
  onStaySignedInChange,
  loading,
  lockoutInfo,
  showCaptcha,
  captchaToken,
  onCaptchaVerify,
  onCaptchaError,
  disabled,
}: LoginFormProps) => {
  const { toast } = useToast();
  const CAPTCHA_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

  return (
    <>
      <EmailInputWithBreachCheck
        email={email}
        onChange={onEmailChange}
        isLogin={true}
      />

      <PasswordInputWithBreachCheck
        password={password}
        onChange={onPasswordChange}
        isLogin={true}
        autoComplete="current-password"
      />

      {/* SECURITY: Show lockout warning */}
      {lockoutInfo && <LockoutWarning lockoutInfo={lockoutInfo} />}

      {/* SECURITY: CAPTCHA after failed attempts */}
      {showCaptcha && CAPTCHA_SITE_KEY && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Security Check</Label>
          <Captcha
            siteKey={CAPTCHA_SITE_KEY}
            onVerify={onCaptchaVerify}
            onError={(error) => {
              safeLog.error("CAPTCHA error:", error);
              toast({
                title: "Security Check Failed",
                description: "Please complete the security check.",
                variant: "destructive",
              });
              onCaptchaError(error);
            }}
            theme="auto"
            size="invisible"
          />
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id="staySignedIn"
          checked={staySignedIn}
          onCheckedChange={(checked) => onStaySignedInChange(checked === true)}
        />
        <Label
          htmlFor="staySignedIn"
          className="text-sm font-normal cursor-pointer"
        >
          Stay signed in
        </Label>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={disabled || loading || lockoutInfo?.locked}
      >
        {loading ? (
          "Processing..."
        ) : (
          <>
            <LogIn className="mr-2 h-4 w-4" />
            Sign In
          </>
        )}
      </Button>
    </>
  );
};

// src/pages/FamilyMemberInvite.tsx
// Purpose: Page for family members to accept invitations and register

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  checkEmailBreach,
  validatePasswordWithBreachCheck,
} from "@/utils/passwordBreachCheck";
import { safeLog, sanitizeError } from "@/utils/security";
import { getEmailRedirectUrl } from "@/utils/siteUrl";
import { Loader2, Lock, Mail, MailCheck, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const FamilyMemberInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [requiresEmailConfirmation, setRequiresEmailConfirmation] =
    useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [invitation, setInvitation] = useState<{
    id: string;
    email: string;
    name: string;
    relationship: string;
    status: string;
    parent_id: string;
  } | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [emailBreachInfo, setEmailBreachInfo] = useState<{
    isPwned: boolean;
    breachCount?: number;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      toast({
        title: "Invalid invitation",
        description: "No invitation token provided.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    fetchInvitation();
  }, [token, navigate, toast]);

  const fetchInvitation = async () => {
    try {
      const { data, error } = await supabase
        .from("family_members")
        .select("*")
        .eq("invitation_token", token)
        .single();

      if (error || !data) {
        throw new Error("Invitation not found or has expired");
      }

      if (data.status === "active") {
        toast({
          title: "Already registered",
          description:
            "This invitation has already been accepted. Please log in instead.",
        });
        navigate("/family-member/auth");
        return;
      }

      if (data.status !== "pending") {
        throw new Error("This invitation is no longer valid");
      }

      setInvitation(data);

      // Check email breach (non-blocking)
      checkEmailBreach(data.email)
        .then((breachInfo) => {
          if (breachInfo.isPwned) {
            setEmailBreachInfo(breachInfo);
          }
        })
        .catch(() => {
          // Silently fail - breach check is optional
        });
    } catch (error: unknown) {
      safeLog.error("Error fetching invitation:", sanitizeError(error));
      toast({
        title: "Invalid invitation",
        description:
          error instanceof Error
            ? error.message
            : "Invitation not found or expired",
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invitation) return;

    if (!password) {
      toast({
        title: "Password required",
        description: "Please enter a password",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords match",
        variant: "destructive",
      });
      return;
    }

    // Validate password
    const validation = await validatePasswordWithBreachCheck(password, true);
    if (!validation.valid) {
      setPasswordErrors(validation.errors);
      toast({
        title: "Password validation failed",
        description: validation.errors.join(", "),
        variant: "destructive",
      });
      return;
    }

    setRegistering(true);
    setPasswordErrors([]);

    try {
      // Sign up the user with the invitation token in metadata
      const { data: authData, error: signUpError } = await supabase.auth.signUp(
        {
          email: invitation.email,
          password: password,
          options: {
            data: {
              name: invitation.name,
              invitation_token: token,
              role: "family_member",
            },
            emailRedirectTo: getEmailRedirectUrl("/family-member/dashboard"),
          },
        }
      );

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error("Failed to create account");
      }

      // Update family_member record to link with auth user
      // Try direct update first, then fallback to RPC function
      const { error: updateError } = await supabase
        .from("family_members")
        .update({
          id: authData.user.id,
          invitation_accepted_at: new Date().toISOString(),
          status: "active",
        })
        .eq("invitation_token", token);

      if (updateError) {
        safeLog.warn(
          "Direct update failed, trying RPC function:",
          sanitizeError(updateError)
        );
        
        // Fallback: Use the SECURITY DEFINER function to link the user
        // This bypasses RLS restrictions for newly registered users
        const { data: linkResult, error: linkError } = await supabase.rpc(
          "link_family_member_to_auth_user",
          {
            p_invitation_token: token,
            p_auth_user_id: authData.user.id,
          }
        );

        if (linkError) {
          safeLog.error(
            "Error linking family member via RPC:",
            sanitizeError(linkError)
          );
          // Don't throw - account is created, we can fix the link later
          // The trigger on auth.users should also attempt to link
        } else if (linkResult && !linkResult.success) {
          safeLog.warn("RPC link returned error:", linkResult.error);
        } else {
          safeLog.log("Family member linked successfully via RPC");
        }
      }

      // Check if email confirmation is required
      const needsEmailConfirmation = authData.user && !authData.session;
      setRequiresEmailConfirmation(needsEmailConfirmation);

      if (needsEmailConfirmation) {
        // Show success state with resend option
        setAccountCreated(true);
        const isDevelopment = import.meta.env.DEV;
        if (isDevelopment) {
          toast({
            title: "Account created!",
            description:
              "In development mode, email verification is disabled. Check Supabase dashboard → Authentication → Users to verify manually, or disable email confirmation in Auth settings.",
            duration: 10000,
          });
        } else {
          toast({
            title: "Account created!",
            description:
              "Please check your email to verify your account, then you can log in.",
            duration: 8000,
          });
        }
      } else {
        // Email confirmation not required or already confirmed - auto-login
        toast({
          title: "Account created!",
          description: "Welcome! Redirecting to your dashboard...",
        });
        // Redirect to dashboard
        navigate("/family-member");
      }
    } catch (error: unknown) {
      safeLog.error("Error registering:", sanitizeError(error));
      toast({
        title: "Registration failed",
        description:
          error instanceof Error ? error.message : "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleResendConfirmationEmail = async () => {
    if (!invitation?.email) {
      toast({
        title: "Error",
        description: "Email address not found.",
        variant: "destructive",
      });
      return;
    }

    setResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: invitation.email.toLowerCase().trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/family-member/dashboard`,
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Confirmation email sent",
        description:
          "Please check your email (including spam folder) and click the verification link.",
        duration: 8000,
      });
    } catch (error: unknown) {
      safeLog.error(
        "Error resending confirmation email:",
        sanitizeError(error)
      );
      toast({
        title: "Failed to send email",
        description:
          error instanceof Error
            ? error.message
            : "Unable to resend confirmation email. Please check your Supabase email configuration.",
        variant: "destructive",
      });
    } finally {
      setResendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Card className="p-8">
          <div className="flex items-center gap-4">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p>Loading invitation...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  // Show success state if account was created and email confirmation is required
  if (accountCreated && requiresEmailConfirmation) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
        <Card className="p-8 w-full max-w-md">
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <MailCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Account Created!</h1>
              <p className="text-muted-foreground">
                We've sent a verification email to {invitation.email}
              </p>
            </div>

            <div className="space-y-4 p-4 bg-muted rounded-lg border">
              <p className="text-sm text-muted-foreground">
                Please check your email and click the verification link to
                activate your account. If you don't see the email, check your
                spam folder.
              </p>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleResendConfirmationEmail}
                disabled={resendingEmail}
              >
                {resendingEmail ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <MailCheck className="mr-2 h-4 w-4" />
                    Resend Verification Email
                  </>
                )}
              </Button>

              <div className="pt-4 border-t">
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => navigate("/family-member/auth")}
                >
                  Go to Login
                </Button>
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Once you've verified your email, you can log in to access your
              dashboard.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
      <Card className="p-8 w-full max-w-md">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">You're Invited!</h1>
            <p className="text-muted-foreground">
              {invitation.name}, you've been invited to join Kids Call Home as a{" "}
              {invitation.relationship}
            </p>
          </div>

          {emailBreachInfo?.isPwned && (
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>Security Notice:</strong> This email address was found
                in {emailBreachInfo.breachCount || "multiple"} data breach
                {emailBreachInfo.breachCount !== 1 ? "es" : ""}. Please use a
                strong, unique password.
              </p>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={invitation.email}
                  disabled
                  className="pl-10 bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordErrors([]);
                  }}
                  disabled={registering}
                  className="pl-10"
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  required
                />
              </div>
              {passwordErrors.length > 0 && (
                <ul className="text-sm text-destructive list-disc list-inside">
                  {passwordErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={registering}
                  className="pl-10"
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={registering}>
              {registering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <User className="mr-2 h-4 w-4" />
                  Create Account
                </>
              )}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground">
            By creating an account, you agree to our Terms of Service and
            Privacy Policy.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default FamilyMemberInvite;

// src/pages/FamilyMemberAuth.tsx
// Family member authentication page (login)

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SEOHead } from "@/components/SEOHead";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { safeLog, sanitizeError } from "@/utils/security";
import { Lock, LogIn, Mail, MailCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const FamilyMemberAuth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [showResendOption, setShowResendOption] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      if (!email.trim() || !password.trim()) {
        toast({
          title: "Missing fields",
          description: "Please enter both email and password",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Try to check if user is a family member (but don't fail if query has issues)
      // This helps provide better error messages, but we'll also check after auth
      // Note: Query by email might fail due to RLS, but we'll try again after auth
      let familyMember: {
        id: string | null;
        status: string;
        email?: string;
      } | null = null;
      try {
        const { data, error: checkError } = await supabase
          .from("family_members")
          .select("id, status, email")
          .eq("email", normalizedEmail)
          .maybeSingle();

        // Only throw if it's a real error (not "not found" or format issues)
        if (
          checkError &&
          checkError.code !== "PGRST116" &&
          checkError.code !== "406"
        ) {
          safeLog.warn(
            "Error checking family member (non-fatal):",
            sanitizeError(checkError)
          );
        } else if (data) {
          familyMember = data;
          safeLog.log(
            "🔍 [FAMILY MEMBER AUTH] Found family member by email before auth",
            {
              id: data.id,
              status: data.status,
              email: data.email,
            }
          );
        }
      } catch (queryError) {
        // If query fails (e.g., 406 error), continue with auth attempt
        safeLog.debug(
          "Family member query failed, continuing with auth:",
          sanitizeError(queryError)
        );
      }

      // Attempt authentication first - this will tell us if credentials are valid
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: password,
        });

      // If authentication failed, handle the error
      if (authError) {
        // If we couldn't check family_members before, try now (after auth attempt)
        // This handles cases where the query failed due to RLS/format issues
        if (!familyMember) {
          try {
            const { data: fmData } = await supabase
              .from("family_members")
              .select("id, status")
              .eq("email", normalizedEmail)
              .maybeSingle();

            if (fmData) {
              familyMember = fmData;
            }
          } catch (err) {
            // Ignore - we'll handle auth error below
          }
        }

        // Email not confirmed error
        if (
          authError.message?.includes("email not confirmed") ||
          authError.message?.includes("Email not confirmed")
        ) {
          setShowResendOption(true);
          const isDevelopment = import.meta.env.DEV;
          if (isDevelopment) {
            toast({
              title: "Email not verified",
              description:
                "In development, disable email confirmation in Supabase Dashboard → Authentication → Settings → Email Auth → 'Enable email confirmations' (turn OFF). Or verify manually in Authentication → Users.",
              variant: "destructive",
              duration: 10000,
            });
          } else {
            toast({
              title: "Email not verified",
              description:
                "Please check your email and click the verification link before logging in. If you didn't receive the email, you can resend it below.",
              variant: "destructive",
              duration: 8000,
            });
          }
          setLoading(false);
          return;
        }

        // Invalid credentials error
        if (
          authError.message?.includes("Invalid login credentials") ||
          authError.message?.includes("invalid")
        ) {
          // If no family member record found, show appropriate error
          if (!familyMember) {
            toast({
              title: "Account not found",
              description:
                "This email is not registered as a family member, or the password is incorrect. Please check with the family parent for an invitation.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Invalid credentials",
              description:
                "The email or password is incorrect. Please try again.",
              variant: "destructive",
            });
          }
          setLoading(false);
          return;
        }

        // Other auth errors
        safeLog.error("Login error:", sanitizeError(authError));
        throw authError;
      }

      // Authentication succeeded - now verify they're a family member
      if (!authData?.user) {
        throw new Error("Login failed - no user returned");
      }

      // If we don't have family member data yet, fetch it now (we're authenticated)
      // IMPORTANT: Query by id (auth.uid()) not email, as RLS policy only allows querying by id
      // But if we found one by email earlier and it has NULL id, we need to link it
      if (!familyMember) {
        safeLog.log(
          "🔍 [FAMILY MEMBER AUTH] Fetching family member by id after authentication",
          {
            userId: authData.user.id,
            email: normalizedEmail,
          }
        );

        const { data: fmData, error: fmError } = await supabase
          .from("family_members")
          .select("id, status, email")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (fmError) {
          // Log the error for debugging
          safeLog.error(
            "❌ [FAMILY MEMBER AUTH] Error fetching family member after auth:",
            {
              error: sanitizeError(fmError),
              userId: authData.user.id,
              email: normalizedEmail,
              errorCode: fmError.code,
              errorMessage: fmError.message,
            }
          );

          // If it's a 406 or RLS error, try using the RPC function to find and link by email
          if (
            fmError.code === "PGRST116" ||
            fmError.message?.includes("406") ||
            fmError.code === "42501"
          ) {
            safeLog.debug(
              "🔄 [FAMILY MEMBER AUTH] RLS blocked query by id, trying RPC function to find by email"
            );

            // Use the RPC function to find and link the family member by email
            const { data: linkResult, error: rpcError } = await (
              supabase.rpc as unknown as (
                name: string,
                args: { p_email: string; p_auth_user_id: string }
              ) => Promise<{
                data: {
                  success: boolean;
                  message?: string;
                  error?: string;
                  status?: string;
                  family_member_id?: string;
                } | null;
                error: { message: string; code?: string } | null;
              }>
            )("link_family_member_by_email", {
              p_email: normalizedEmail,
              p_auth_user_id: authData.user.id,
            });

            if (rpcError) {
              safeLog.error(
                "❌ [FAMILY MEMBER AUTH] RPC function failed:",
                sanitizeError(rpcError)
              );
            } else if (linkResult) {
              const result = linkResult as {
                success: boolean;
                message?: string;
                error?: string;
                status?: string;
                family_member_id?: string;
              };

              if (result.success) {
                safeLog.log(
                  "✅ [FAMILY MEMBER AUTH] Found and linked family member via RPC",
                  result
                );
                // Create familyMember object from the result
                familyMember = {
                  id: authData.user.id,
                  status: result.status || "active",
                  email: normalizedEmail,
                };
              } else {
                safeLog.error(
                  "❌ [FAMILY MEMBER AUTH] RPC function returned error:",
                  result.error || "Unknown error"
                );
              }
            }
          }
        } else if (fmData) {
          safeLog.log(
            "✅ [FAMILY MEMBER AUTH] Successfully found family member by id",
            {
              id: fmData.id,
              status: fmData.status,
              email: fmData.email,
            }
          );
          familyMember = fmData;
          // Verify the email matches (security check)
          if (fmData.email?.toLowerCase() !== normalizedEmail) {
            safeLog.warn(
              "⚠️ [FAMILY MEMBER AUTH] Email mismatch between auth and family_members record",
              {
                authEmail: normalizedEmail,
                recordEmail: fmData.email,
              }
            );
          }
        } else {
          safeLog.warn(
            "⚠️ [FAMILY MEMBER AUTH] No family member found by id (no error, but no data)",
            {
              userId: authData.user.id,
              email: normalizedEmail,
            }
          );

          // Try using RPC function to find by email as last resort
          safeLog.debug(
            "🔄 [FAMILY MEMBER AUTH] Trying RPC function to find by email as last resort"
          );

          const { data: linkResult, error: rpcError } = await (
            supabase.rpc as unknown as (
              name: string,
              args: { p_email: string; p_auth_user_id: string }
            ) => Promise<{
              data: {
                success: boolean;
                message?: string;
                error?: string;
                status?: string;
                family_member_id?: string;
              } | null;
              error: { message: string; code?: string } | null;
            }>
          )("link_family_member_by_email", {
            p_email: normalizedEmail,
            p_auth_user_id: authData.user.id,
          });

          if (!rpcError && linkResult) {
            const result = linkResult as {
              success: boolean;
              message?: string;
              error?: string;
              status?: string;
              family_member_id?: string;
            };

            if (result.success) {
              safeLog.log(
                "✅ [FAMILY MEMBER AUTH] Found and linked family member via RPC (last resort)",
                result
              );
              familyMember = {
                id: authData.user.id,
                status: result.status || "active",
                email: normalizedEmail,
              };
            } else {
              safeLog.warn(
                "⚠️ [FAMILY MEMBER AUTH] RPC function did not find family member:",
                result.error || "Unknown error"
              );

              // Last resort: Check if adult_profiles exists (indicates family member was registered)
              // This is a fallback if family_members record is missing or unlinked
              const { data: adultProfile } = await supabase
                .from("adult_profiles" as never)
                .select("user_id, email, role, family_id")
                .eq("user_id", authData.user.id)
                .eq("role", "family_member")
                .maybeSingle();

              if (adultProfile) {
                safeLog.log(
                  "✅ [FAMILY MEMBER AUTH] Found adult_profiles record, family member exists",
                  { adultProfile }
                );
                // Create a familyMember object from adult_profiles
                // This allows login to proceed even if family_members.id is not set
                familyMember = {
                  id: authData.user.id,
                  status: "active", // Assume active if adult_profiles exists
                  email: normalizedEmail,
                };
              }
            }
          } else if (rpcError) {
            safeLog.error(
              "❌ [FAMILY MEMBER AUTH] RPC function error:",
              sanitizeError(rpcError)
            );

            // Last resort: Check if adult_profiles exists
            const { data: adultProfile } = await supabase
              .from("adult_profiles" as never)
              .select("user_id, email, role, family_id")
              .eq("user_id", authData.user.id)
              .eq("role", "family_member")
              .maybeSingle();

            if (adultProfile) {
              safeLog.log(
                "✅ [FAMILY MEMBER AUTH] Found adult_profiles record (RPC failed but profile exists)",
                { adultProfile }
              );
              familyMember = {
                id: authData.user.id,
                status: "active",
                email: normalizedEmail,
              };
            }
          }
        }
      } else if (familyMember && !familyMember.id) {
        // We found a family member by email before auth, but it has NULL id
        // This means the record exists but isn't linked to the auth user yet
        // Try to link it now that we're authenticated
        safeLog.log(
          "🔗 [FAMILY MEMBER AUTH] Family member found but id is NULL, attempting to link",
          {
            email: normalizedEmail,
            userId: authData.user.id,
          }
        );

        // Try direct update first
        // Try direct update first
        const { error: linkError } = await supabase
          .from("family_members")
          .update({ id: authData.user.id })
          .eq("email", normalizedEmail)
          .is("id", null);

        if (linkError) {
          safeLog.warn(
            "⚠️ [FAMILY MEMBER AUTH] Direct update failed (likely RLS), trying RPC function:",
            sanitizeError(linkError)
          );

          // RLS is blocking the update because id is NULL, so the policy check fails
          // Use the SECURITY DEFINER function to link the record
          const { data: linkResult, error: rpcError } = await (
            supabase.rpc as unknown as (
              name: string,
              args: { p_email: string; p_auth_user_id: string }
            ) => Promise<{
              data: {
                success: boolean;
                message?: string;
                error?: string;
                status?: string;
                family_member_id?: string;
              } | null;
              error: { message: string; code?: string } | null;
            }>
          )("link_family_member_by_email", {
            p_email: normalizedEmail,
            p_auth_user_id: authData.user.id,
          });

          if (rpcError) {
            safeLog.error(
              "❌ [FAMILY MEMBER AUTH] RPC function also failed:",
              sanitizeError(rpcError)
            );
            toast({
              title: "Account found but needs linking",
              description:
                "Your account exists but needs to be linked. Please contact the family parent or support.",
              variant: "default",
              duration: 8000,
            });
            // Set the id in memory so the login can proceed
            // Note: This won't persist, but allows the user to log in
            familyMember.id = authData.user.id;
          } else if (linkResult) {
            // Type assertion for the RPC result
            const result = linkResult as {
              success: boolean;
              message?: string;
              error?: string;
              status?: string;
              family_member_id?: string;
            };
            if (result.success) {
              safeLog.log(
                "✅ [FAMILY MEMBER AUTH] Successfully linked family member id via RPC",
                result
              );
              familyMember.id = authData.user.id;
              if (result.status) {
                familyMember.status = result.status;
              }
            } else {
              safeLog.error(
                "❌ [FAMILY MEMBER AUTH] RPC function returned error:",
                result.error || "Unknown error"
              );
              // Set the id in memory so the login can proceed
              familyMember.id = authData.user.id;
            }
          } else {
            safeLog.warn(
              "⚠️ [FAMILY MEMBER AUTH] RPC function returned no result"
            );
            // Set the id in memory so the login can proceed
            familyMember.id = authData.user.id;
          }
        } else {
          safeLog.log(
            "✅ [FAMILY MEMBER AUTH] Successfully linked family member id"
          );
          // Update the familyMember object with the new id
          familyMember.id = authData.user.id;
        }
      } else if (
        familyMember &&
        familyMember.id &&
        familyMember.id !== authData.user.id
      ) {
        // Family member record exists but id doesn't match current auth user
        // This is a data integrity issue - the record is linked to a different user
        safeLog.error("❌ [FAMILY MEMBER AUTH] Family member id mismatch", {
          recordId: familyMember.id,
          authUserId: authData.user.id,
          email: normalizedEmail,
        });
        toast({
          title: "Account mismatch",
          description:
            "This email is linked to a different account. Please contact support.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // If still no family member record, they might have an auth account but not be registered
      if (!familyMember) {
        toast({
          title: "Account not found",
          description:
            "You have an account, but you're not registered as a family member. Please check with the family parent for an invitation.",
          variant: "destructive",
        });
        // Sign them out since they shouldn't have access
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // If login succeeds but status is not active, check and potentially fix it
      if (familyMember.status !== "active") {
        if (familyMember.status === "pending") {
          // If they have an id set and we got here, they've registered
          if (familyMember.id && authData.user) {
            // They've registered and can authenticate, but status update failed
            // Try to fix the status
            const { error: fixError } = await supabase
              .from("family_members")
              .update({
                status: "active",
                invitation_accepted_at: new Date().toISOString(),
              })
              .eq("email", normalizedEmail)
              .eq("id", familyMember.id);

            if (!fixError) {
              // Status fixed, continue with login
              toast({
                title: "Account activated",
                description: "Welcome! Redirecting to your dashboard...",
              });
              navigate("/family-member");
              setLoading(false);
              return;
            }
          }

          // If we get here, either no auth account or status fix failed
          toast({
            title: "Account not active",
            description:
              "You need to complete your registration first. Please check your email for the invitation link and click it to create your account.",
            variant: "destructive",
            duration: 10000,
          });
          setLoading(false);
          return;
        } else {
          toast({
            title: "Account not active",
            description:
              "Your account has been suspended. Please contact the family parent.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      // Verify user is linked to family_member record
      if (authData.user.id !== familyMember.id) {
        // User exists but not linked - try to link them
        const { error: linkError } = await supabase
          .from("family_members")
          .update({ id: authData.user.id })
          .eq("email", normalizedEmail);

        if (linkError) {
          safeLog.warn(
            "Failed to link auth user to family member:",
            sanitizeError(linkError)
          );
        }
      }

      setShowResendOption(false);
      toast({
        title: "Welcome back!",
        description: "Successfully logged in.",
      });

      navigate("/family-member/dashboard");
    } catch (error: unknown) {
      safeLog.error("Login failed:", sanitizeError(error));
      toast({
        title: "Login failed",
        description:
          error instanceof Error ? error.message : "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmationEmail = async () => {
    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email address first.",
        variant: "destructive",
      });
      return;
    }

    setResendingEmail(true);
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: getEmailRedirectUrl("/family-member/dashboard"),
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

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
      <SEOHead
        title="Family Member Login - Grandparents, Aunts, Uncles"
        description="Login for invited family members on Kids Call Home. Grandparents, aunts, uncles, and cousins can video call kids safely after being invited by parents."
        path="/family-member/auth"
      />
      <Card className="p-8 w-full max-w-md">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Family Member Login</h1>
            <p className="text-muted-foreground">
              Sign in to connect with your family
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setShowResendOption(false);
                  }}
                  disabled={loading}
                  className="pl-10"
                  autoComplete="email"
                  required
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
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="pl-10"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                "Logging in..."
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>
          </form>

          {showResendOption && (
            <div className="space-y-2 p-4 bg-muted rounded-lg border">
              <p className="text-sm text-muted-foreground">
                Didn't receive the verification email?
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleResendConfirmationEmail}
                disabled={resendingEmail || !email.trim()}
              >
                {resendingEmail ? (
                  "Sending..."
                ) : (
                  <>
                    <MailCheck className="mr-2 h-4 w-4" />
                    Resend Confirmation Email
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Note: If emails still don't arrive, check your Supabase project
                settings for email configuration (SMTP or Resend API).
              </p>
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground">
            <p>
              Need an invitation? Contact the family parent to receive an
              invitation email.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default FamilyMemberAuth;

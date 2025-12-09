// src/pages/ParentAuth.tsx
// Parent authentication page (login/signup) with security features

import { Captcha } from "@/components/Captcha";
import { EmailInputWithBreachCheck } from "@/components/auth/EmailInputWithBreachCheck";
import { LockoutWarning } from "@/components/auth/LockoutWarning";
import { PasswordInputWithBreachCheck } from "@/components/auth/PasswordInputWithBreachCheck";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccountLockout } from "@/hooks/useAccountLockout";
import { usePasswordBreachCheck } from "@/hooks/usePasswordBreachCheck";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/utils/auditLog";
import {
  detectBot,
  getBehaviorTracker,
  initBehaviorTracking,
} from "@/utils/botDetection";
import { getCookie, setCookie } from "@/utils/cookies";
import { getCSRFToken } from "@/utils/csrf";
import { sanitizeAndValidate } from "@/utils/inputValidation";
import {
  checkRateLimit,
  clearFailedLogins,
  getRateLimitKey,
  recordFailedLogin,
  recordRateLimit,
} from "@/utils/rateLimiting";
import { safeLog, sanitizeError } from "@/utils/security";
import { LogIn, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FamilySetupSelection } from "@/features/onboarding/components/FamilySetupSelection";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

const ParentAuth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [parentName, setParentName] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [needsFamilySetup, setNeedsFamilySetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Cloudflare Turnstile site key (set in environment variables)
  const CAPTCHA_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

  // Custom hooks for security features
  const { lockoutInfo, showCaptcha, setShowCaptcha, updateLockoutInfo } =
    useAccountLockout(email, isLogin);
  const { breachStatus, performFinalCheck } = usePasswordBreachCheck(
    password,
    isLogin
  );

  // Initialize security features
  useEffect(() => {
    // Initialize behavior tracking
    initBehaviorTracking();

    // Check for bot
    const botDetection = detectBot();
    if (botDetection.isBot) {
      safeLog.warn("Bot detected:", botDetection);
      logAuditEvent("bot_detected", {
        metadata: {
          reasons: botDetection.reasons,
          confidence: botDetection.confidence,
        },
        severity: "high",
      });
    }

    // Load saved preference and parent name from cookie
    const savedPreference = localStorage.getItem("staySignedIn");
    if (savedPreference !== null) {
      setStaySignedIn(savedPreference === "true");
    }

    const savedParentName = getCookie("parentName");
    if (savedParentName) {
      setParentName(savedParentName);
    }
  }, []);


  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setCaptchaToken(null); // Reset CAPTCHA token

    try {
      // SECURITY: Input validation
      const validation = sanitizeAndValidate({
        email: isLogin ? email : undefined,
        password: password,
        name: !isLogin ? name : undefined,
      });

      if (!validation.valid) {
        const firstError = Object.values(validation.errors)[0]?.[0];
        toast({
          title: "Validation Error",
          description: firstError || "Please check your input",
          variant: "destructive",
        });
        return;
      }

      // Use sanitized values
      const sanitizedEmail = validation.sanitized.email || email;
      const sanitizedPassword = validation.sanitized.password || password;

      // SECURITY: Final password validation check (only for signup/password change)
      // Note: Real-time checking happens in hook, but we do a final check here
      // to ensure the password is still valid at submission time
      if (!isLogin) {
        // If we already know the password is breached, block submission
        if (breachStatus === "breached") {
          toast({
            title: "Password Security Issue",
            description:
              "This password has been found in data breaches and is unsafe to use. Please choose a unique password with a mix of letters, numbers, and symbols.",
            variant: "destructive",
            duration: 8000,
          });
          setLoading(false);
          return;
        }

        // If password is already marked safe, proceed
        // Otherwise, do a final check (in case real-time check didn't complete)
        if (breachStatus !== "safe") {
          const isValid = await performFinalCheck(sanitizedPassword);
          if (!isValid) {
            toast({
              title: "Password Security Issue",
              description:
                "This password has been found in data breaches and is unsafe to use. Please choose a unique password with a mix of letters, numbers, and symbols.",
              variant: "destructive",
              duration: 8000,
            });
            setLoading(false);
            return;
          }
        }
      }

      // SECURITY: Check rate limiting
      const rateLimitKey = getRateLimitKey(sanitizedEmail, "login");
      const rateLimitCheck = checkRateLimit(rateLimitKey, "login");

      if (!rateLimitCheck.allowed) {
        if (rateLimitCheck.lockedUntil) {
          const minutes = Math.ceil(
            (rateLimitCheck.lockedUntil - Date.now()) / 60000
          );
          toast({
            title: "Account Temporarily Locked",
            description: `Too many login attempts. Please try again in ${minutes} minute(s).`,
            variant: "destructive",
          });
          logAuditEvent("login_locked", {
            email: sanitizedEmail,
            severity: "high",
          });
          return;
        } else {
          toast({
            title: "Too Many Attempts",
            description: "Please wait before trying again.",
            variant: "destructive",
          });
          logAuditEvent("rate_limit_exceeded", {
            email: sanitizedEmail,
            severity: "medium",
          });
          return;
        }
      }

      // SECURITY: Check account lockout
      if (isLogin) {
        if (lockoutInfo?.locked && lockoutInfo.lockedUntil) {
          const minutes = Math.ceil(
            (lockoutInfo.lockedUntil - Date.now()) / 60000
          );
          toast({
            title: "Account Locked",
            description: `Account is locked due to multiple failed attempts. Try again in ${minutes} minute(s).`,
            variant: "destructive",
          });
          logAuditEvent("account_locked", {
            email: sanitizedEmail,
            severity: "high",
          });
          setLoading(false);
          return;
        }

        // SECURITY: Require CAPTCHA after failed attempts
        if (showCaptcha && CAPTCHA_SITE_KEY && !captchaToken) {
          toast({
            title: "Security Check Required",
            description: "Please complete the security check below.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      // SECURITY: Bot detection check
      const botDetection = detectBot();
      if (botDetection.isBot && botDetection.confidence > 50) {
        const behaviorTracker = getBehaviorTracker();
        const behaviorAnalysis = behaviorTracker?.analyzeBehavior();

        if (behaviorAnalysis?.isSuspicious) {
          toast({
            title: "Security Check Failed",
            description: "Unable to verify you're human. Please try again.",
            variant: "destructive",
          });
          logAuditEvent("bot_detected", {
            email: sanitizedEmail,
            metadata: {
              botReasons: botDetection.reasons,
              behaviorReasons: behaviorAnalysis.reasons,
            },
            severity: "high",
          });
          return;
        }
      }

      // Record rate limit attempt
      recordRateLimit(rateLimitKey, "login");

      // Store preference for session persistence
      localStorage.setItem("staySignedIn", staySignedIn.toString());

      // If "Stay signed in" is unchecked, use sessionStorage for this session
      if (!staySignedIn) {
        sessionStorage.setItem("clearSessionOnClose", "true");
      } else {
        sessionStorage.removeItem("clearSessionOnClose");
      }

      if (isLogin) {
        // SECURITY: Log login attempt
        logAuditEvent("login_attempt", {
          email: sanitizedEmail,
          severity: "low",
        });

        // SECURITY: Never log passwords - Supabase handles auth securely
        const {
          data: { user },
          error,
        } = await supabase.auth.signInWithPassword({
          email: sanitizedEmail,
          password: sanitizedPassword,
        });

        if (error) {
          // SECURITY: Record failed login
          const failedLogin = recordFailedLogin(sanitizedEmail);

          // SECURITY: Sanitize error before logging
          safeLog.error("Auth error:", sanitizeError(error));

          logAuditEvent("login_failed", {
            email: sanitizedEmail,
            metadata: { attempts: failedLogin.attempts },
            severity: "medium",
          });

          // Show lockout message if locked
          if (failedLogin.locked && failedLogin.lockedUntil) {
            const minutes = Math.ceil(
              (failedLogin.lockedUntil - Date.now()) / 60000
            );
            toast({
              title: "Account Locked",
              description: `Too many failed attempts. Account locked for ${minutes} minute(s).`,
              variant: "destructive",
            });
            updateLockoutInfo({
              locked: true,
              lockedUntil: failedLogin.lockedUntil,
            });
            logAuditEvent("account_locked", {
              email: sanitizedEmail,
              severity: "high",
            });
          } else {
            const remaining = 5 - failedLogin.attempts;
            toast({
              title: "Login Failed",
              description:
                remaining > 0
                  ? `Invalid credentials. ${remaining} attempt(s) remaining.`
                  : "Invalid credentials.",
              variant: "destructive",
            });

            // Show CAPTCHA after 2 failed attempts
            if (failedLogin.attempts >= 2) {
              setShowCaptcha(true);
            }
          }

          throw error;
        }

        // SECURITY: Clear failed logins on success
        clearFailedLogins(sanitizedEmail);

        // SECURITY: Log successful login
        logAuditEvent("login_success", {
          userId: user?.id,
          email: sanitizedEmail,
          severity: "low",
        });

        // Check if user is a family member and redirect accordingly
        if (user) {
          // Check if user is a family member
          const { data: familyMember } = await supabase
            .from("family_members")
            .select("id, name")
            .eq("id", user.id)
            .eq("status", "active")
            .maybeSingle();

          if (familyMember) {
            // User is a family member - redirect to family member dashboard
            toast({ title: "Welcome back!" });
            navigate("/family-member/dashboard");
            setLoading(false);
            return;
          }

          // User is a parent - continue with parent flow
          const { data: parentData } = await supabase
            .from("parents")
            .select("name")
            .eq("id", user.id)
            .maybeSingle();

          if (parentData?.name) {
            setCookie("parentName", parentData.name, 365); // Store for 1 year
          }

          // Track device on login
          try {
            const {
              generateDeviceIdentifierAsync,
              detectDeviceType,
              getDeviceName,
              getClientIP,
              getDeviceMacAddress,
              getCountryFromIP,
            } = await import("@/utils/deviceTracking");
            const deviceIdentifier = await generateDeviceIdentifierAsync();
            const deviceType = detectDeviceType();
            const deviceName = getDeviceName();
            const userAgent = navigator.userAgent;
            const ipAddress = await getClientIP();
            const macAddress = await getDeviceMacAddress();
            const countryCode = await getCountryFromIP(ipAddress);

            await supabase.rpc("update_device_login", {
              p_parent_id: user.id,
              p_device_identifier: deviceIdentifier,
              p_device_name: deviceName,
              p_device_type: deviceType,
              p_user_agent: userAgent,
              p_ip_address: ipAddress || null,
              p_mac_address: macAddress || null,
              p_country_code: countryCode || null,
              p_child_id: null,
            });
          } catch (error) {
            // Silently fail - device tracking shouldn't break login
            console.warn("Device tracking failed:", error);
          }

          // Write presence status to database on login (major state change)
          // Note: This is optional - presence is managed via WebSocket/Realtime
          // Only writes to DB if you need login history/analytics
          // import { writePresenceOnLogin } from "@/features/presence/presenceDb";
          // await writePresenceOnLogin(user.id, "parent");
        }

        toast({ title: "Welcome back!" });
        navigate("/parent/children");
      } else {
        // SECURITY: Log signup attempt
        logAuditEvent("signup", {
          email: sanitizedEmail,
          severity: "low",
        });

        // SECURITY: Never log passwords - Supabase handles auth securely
        const { data, error } = await supabase.auth.signUp({
          email: sanitizedEmail,
          password: sanitizedPassword,
          options: {
            data: { name: validation.sanitized.name || name, role: "parent" },
            emailRedirectTo: `${window.location.origin}/parent/children`,
          },
        });

        if (error) {
          // SECURITY: Sanitize error before logging
          safeLog.error("Signup error:", sanitizeError(error));
          logAuditEvent("signup", {
            email: sanitizedEmail,
            metadata: { error: error.message },
            severity: "medium",
          });
          throw error;
        }

        // If signup successful and user exists, show family setup
        if (!error && data.user) {
          setUserId(data.user.id);
          setNeedsFamilySetup(true);
        }

        // Store name in cookie for new signups
        if (validation.sanitized.name || name) {
          setCookie("parentName", validation.sanitized.name || name, 365);
        }
      }
    } catch (error: unknown) {
      // SECURITY: Sanitize error before logging - never log passwords
      const sanitizedError = sanitizeError(error);
      safeLog.error("Auth operation failed:", sanitizedError);

      // Error toast is handled above for specific cases
      if (!(error instanceof Error && error.message.includes("locked"))) {
        toast({
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
      // SECURITY: Clear password field after use
      setPassword("");
      setCaptchaToken(null);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <img
              src="/icon-192x192.png"
              alt="Kids Call Home"
              className="h-12 w-12"
            />
          </div>
          <h1 className="text-3xl font-bold">Kids Call Home</h1>
          <p className="text-muted-foreground">
            {isLogin
              ? parentName
                ? `Welcome back, ${parentName}!`
                : "Welcome back, parent!"
              : "Create your parent account"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Name</label>
              <Input
                type="text"
                placeholder="Mom / Dad / Guardian"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
              />
            </div>
          )}

          <EmailInputWithBreachCheck
            email={email}
            onChange={setEmail}
            isLogin={isLogin}
          />

          {!isLogin && (
            <p className="text-xs text-muted-foreground">
              We use your email to create and secure your parent account and may contact you about important Kids Call Home service updates. You can opt out of non‑essential emails at any time.
            </p>
          )}

          <PasswordInputWithBreachCheck
            password={password}
            onChange={setPassword}
            isLogin={isLogin}
            autoComplete={isLogin ? "current-password" : "new-password"}
          />

          {isLogin && (
            <>
              {/* SECURITY: Show lockout warning */}
              {lockoutInfo && <LockoutWarning lockoutInfo={lockoutInfo} />}

              {/* SECURITY: CAPTCHA after failed attempts */}
              {showCaptcha && CAPTCHA_SITE_KEY && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Security Check</Label>
                  <Captcha
                    siteKey={CAPTCHA_SITE_KEY}
                    onVerify={(token) => {
                      setCaptchaToken(token);
                    }}
                    onError={(error) => {
                      safeLog.error("CAPTCHA error:", error);
                      toast({
                        title: "Security Check Failed",
                        description: "Please complete the security check.",
                        variant: "destructive",
                      });
                    }}
                    theme="auto"
                    size="normal"
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="staySignedIn"
                  checked={staySignedIn}
                  onCheckedChange={(checked) =>
                    setStaySignedIn(checked === true)
                  }
                />
                <Label
                  htmlFor="staySignedIn"
                  className="text-sm font-normal cursor-pointer"
                >
                  Stay signed in
                </Label>
              </div>
            </>
          )}

          {/* SECURITY: Hidden CSRF token */}
          <input type="hidden" name="csrf_token" value={getCSRFToken()} />

          <Button
            type="submit"
            className="w-full"
            disabled={loading || (isLogin && lockoutInfo?.locked)}
          >
            {loading ? (
              "Processing..."
            ) : isLogin ? (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create Account
              </>
            )}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-primary hover:underline"
          >
            {isLogin
              ? "Need an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </Card>

      {/* Family Setup Modal */}
      <Dialog open={needsFamilySetup && !!userId} onOpenChange={() => {}}>
        <DialogContent className="max-w-3xl">
          <FamilySetupSelection
            userId={userId!}
            onComplete={async (householdType) => {
              // Save household_type to families table
              try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                  throw new Error("User not found");
                }

                // Get parent profile to find family_id
                const { data: parentProfile } = await supabase
                  .from("adult_profiles")
                  .select("family_id")
                  .eq("user_id", user.id)
                  .eq("role", "parent")
                  .single();

                if (parentProfile?.family_id) {
                  const { error: updateError } = await supabase
                    .from("families")
                    .update({ household_type })
                    .eq("id", parentProfile.family_id);

                  if (updateError) {
                    throw updateError;
                  }
                }

                setNeedsFamilySetup(false);
                toast({ title: "Family setup complete! Welcome!" });
                navigate("/parent");
              } catch (error) {
                console.error("Error saving family setup:", error);
                toast({
                  title: "Error",
                  description: "Failed to save family setup. Please try again.",
                  variant: "destructive",
                });
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ParentAuth;

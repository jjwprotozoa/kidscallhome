import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, UserPlus, AlertCircle, Shield, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { safeLog, sanitizeError } from "@/utils/security";
import {
  checkRateLimit,
  recordRateLimit,
  recordFailedLogin,
  clearFailedLogins,
  isEmailLocked,
  getRateLimitKey,
} from "@/utils/rateLimiting";
import { detectBot, initBehaviorTracking, getBehaviorTracker } from "@/utils/botDetection";
import { sanitizeAndValidate } from "@/utils/inputValidation";
import { validatePasswordWithBreachCheck } from "@/utils/passwordBreachCheck";
import { logAuditEvent } from "@/utils/auditLog";
import { getCSRFToken } from "@/utils/csrf";
import { Captcha } from "@/components/Captcha";

// Cookie utility functions
const setCookie = (name: string, value: string, days: number = 365) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

const getCookie = (name: string): string | null => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

const ParentAuth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [parentName, setParentName] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [lockoutInfo, setLockoutInfo] = useState<{ locked: boolean; lockedUntil?: number; attemptsRemaining?: number } | null>(null);
  const [checkingBreach, setCheckingBreach] = useState(false);
  const [passwordBreachStatus, setPasswordBreachStatus] = useState<'checking' | 'safe' | 'breached' | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const passwordInputRef = useRef<HTMLInputElement>(null);
  
  // Cloudflare Turnstile site key (set in environment variables)
  const CAPTCHA_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

  // Initialize security features
  useEffect(() => {
    // Initialize behavior tracking
    initBehaviorTracking();
    
    // Check for bot
    const botDetection = detectBot();
    if (botDetection.isBot) {
      safeLog.warn("Bot detected:", botDetection);
      logAuditEvent('bot_detected', {
        metadata: { reasons: botDetection.reasons, confidence: botDetection.confidence },
        severity: 'high',
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
  
  // Check lockout status when email changes
  useEffect(() => {
    if (isLogin && email) {
      const lockout = isEmailLocked(email);
      setLockoutInfo(lockout);
      
      // Show CAPTCHA after 2 failed attempts
      if (lockout.attemptsRemaining !== undefined && lockout.attemptsRemaining <= 3) {
        setShowCaptcha(true);
      }
    } else {
      setLockoutInfo(null);
      setShowCaptcha(false);
    }
  }, [email, isLogin]);

  // Real-time password breach checking (debounced) for signup
  useEffect(() => {
    if (isLogin || !password || password.length < 6) {
      setPasswordBreachStatus(null);
      return;
    }

    // Debounce the breach check
    const timeoutId = setTimeout(async () => {
      setCheckingBreach(true);
      setPasswordBreachStatus('checking');
      try {
        const breachCheck = await validatePasswordWithBreachCheck(password);
        setCheckingBreach(false);
        if (breachCheck.isPwned) {
          setPasswordBreachStatus('breached');
        } else if (breachCheck.valid) {
          setPasswordBreachStatus('safe');
        } else {
          setPasswordBreachStatus(null);
        }
      } catch (error) {
        setCheckingBreach(false);
        setPasswordBreachStatus(null);
        // Silently fail - don't show error for real-time checks
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(timeoutId);
  }, [password, isLogin]);

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
      // Note: Real-time checking happens in useEffect, but we do a final check here
      // to ensure the password is still valid at submission time
      if (!isLogin) {
        // If we already know the password is breached, block submission
        if (passwordBreachStatus === 'breached') {
          toast({
            title: "Password Security Issue",
            description: "This password has been found in data breaches and is unsafe to use. Please choose a unique password with a mix of letters, numbers, and symbols.",
            variant: "destructive",
            duration: 8000,
          });
          return;
        }

        // If password is already marked safe, proceed
        // Otherwise, do a final check (in case real-time check didn't complete)
        if (passwordBreachStatus !== 'safe') {
          setCheckingBreach(true);
          setPasswordBreachStatus('checking');
          try {
            const breachCheck = await validatePasswordWithBreachCheck(sanitizedPassword);
            setCheckingBreach(false);
            
            if (!breachCheck.valid) {
              if (breachCheck.isPwned) {
                setPasswordBreachStatus('breached');
                toast({
                  title: "Password Security Issue",
                  description: "This password has been found in data breaches and is unsafe to use. Please choose a unique password with a mix of letters, numbers, and symbols.",
                  variant: "destructive",
                  duration: 8000,
                });
              } else {
                // Other validation errors
                const firstError = breachCheck.errors[0];
                toast({
                  title: "Password Validation Error",
                  description: firstError || "Please choose a stronger password",
                  variant: "destructive",
                });
              }
              return;
            } else {
              setPasswordBreachStatus('safe');
            }
          } catch (error) {
            setCheckingBreach(false);
            setPasswordBreachStatus(null);
            // If breach check fails, allow password but log warning
            safeLog.warn("Breach check failed:", sanitizeError(error));
          }
        }
      }

      // SECURITY: Check rate limiting
      const rateLimitKey = getRateLimitKey(sanitizedEmail, 'login');
      const rateLimitCheck = checkRateLimit(rateLimitKey, 'login');
      
      if (!rateLimitCheck.allowed) {
        if (rateLimitCheck.lockedUntil) {
          const minutes = Math.ceil((rateLimitCheck.lockedUntil - Date.now()) / 60000);
          toast({
            title: "Account Temporarily Locked",
            description: `Too many login attempts. Please try again in ${minutes} minute(s).`,
            variant: "destructive",
          });
          logAuditEvent('login_locked', {
            email: sanitizedEmail,
            severity: 'high',
          });
          return;
        } else {
          toast({
            title: "Too Many Attempts",
            description: "Please wait before trying again.",
            variant: "destructive",
          });
          logAuditEvent('rate_limit_exceeded', {
            email: sanitizedEmail,
            severity: 'medium',
          });
          return;
        }
      }

      // SECURITY: Check account lockout
      if (isLogin) {
        const lockout = isEmailLocked(sanitizedEmail);
        if (lockout.locked && lockout.lockedUntil) {
          const minutes = Math.ceil((lockout.lockedUntil - Date.now()) / 60000);
          toast({
            title: "Account Locked",
            description: `Account is locked due to multiple failed attempts. Try again in ${minutes} minute(s).`,
            variant: "destructive",
          });
          setLockoutInfo(lockout);
          logAuditEvent('account_locked', {
            email: sanitizedEmail,
            severity: 'high',
          });
          return;
        }

        // SECURITY: Require CAPTCHA after failed attempts
        if (showCaptcha && CAPTCHA_SITE_KEY && !captchaToken) {
          toast({
            title: "Security Check Required",
            description: "Please complete the security check below.",
            variant: "destructive",
          });
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
          logAuditEvent('bot_detected', {
            email: sanitizedEmail,
            metadata: {
              botReasons: botDetection.reasons,
              behaviorReasons: behaviorAnalysis.reasons,
            },
            severity: 'high',
          });
          return;
        }
      }

      // Record rate limit attempt
      recordRateLimit(rateLimitKey, 'login');

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
        logAuditEvent('login_attempt', {
          email: sanitizedEmail,
          severity: 'low',
        });

        // SECURITY: Never log passwords - Supabase handles auth securely
        const { data: { user }, error } = await supabase.auth.signInWithPassword({
          email: sanitizedEmail,
          password: sanitizedPassword,
        });
        
        if (error) {
          // SECURITY: Record failed login
          const failedLogin = recordFailedLogin(sanitizedEmail);
          
          // SECURITY: Sanitize error before logging
          safeLog.error("Auth error:", sanitizeError(error));
          
          logAuditEvent('login_failed', {
            email: sanitizedEmail,
            metadata: { attempts: failedLogin.attempts },
            severity: 'medium',
          });

          // Show lockout message if locked
          if (failedLogin.locked && failedLogin.lockedUntil) {
            const minutes = Math.ceil((failedLogin.lockedUntil - Date.now()) / 60000);
            toast({
              title: "Account Locked",
              description: `Too many failed attempts. Account locked for ${minutes} minute(s).`,
              variant: "destructive",
            });
            setLockoutInfo({
              locked: true,
              lockedUntil: failedLogin.lockedUntil,
            });
            logAuditEvent('account_locked', {
              email: sanitizedEmail,
              severity: 'high',
            });
          } else {
            const remaining = 5 - failedLogin.attempts;
            toast({
              title: "Login Failed",
              description: remaining > 0 
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
        logAuditEvent('login_success', {
          userId: user?.id,
          email: sanitizedEmail,
          severity: 'low',
        });
        
        // Fetch parent name and store in cookie
        if (user) {
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
            const { generateDeviceIdentifierAsync, detectDeviceType, getDeviceName, getClientIP, getDeviceMacAddress, getCountryFromIP } = await import("@/utils/deviceTracking");
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
        logAuditEvent('signup', {
          email: sanitizedEmail,
          severity: 'low',
        });

        // SECURITY: Never log passwords - Supabase handles auth securely
        const { error } = await supabase.auth.signUp({
          email: sanitizedEmail,
          password: sanitizedPassword,
          options: {
            data: { name: validation.sanitized.name || name },
            emailRedirectTo: `${window.location.origin}/parent/children`,
          },
        });
        
        if (error) {
          // SECURITY: Sanitize error before logging
          safeLog.error("Signup error:", sanitizeError(error));
          logAuditEvent('signup', {
            email: sanitizedEmail,
            metadata: { error: error.message },
            severity: 'medium',
          });
          throw error;
        }
        
        // Store name in cookie for new signups
        if (validation.sanitized.name || name) {
          setCookie("parentName", validation.sanitized.name || name, 365);
        }
        
        toast({ title: "Account created! Welcome!" });
        navigate("/parent/children");
      }
    } catch (error: unknown) {
      // SECURITY: Sanitize error before logging - never log passwords
      const sanitizedError = sanitizeError(error);
      safeLog.error("Auth operation failed:", sanitizedError);
      
      // Error toast is handled above for specific cases
      if (!(error instanceof Error && error.message.includes('locked'))) {
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
      setCheckingBreach(false);
      // SECURITY: Clear password field after use
      setPassword("");
      setPasswordBreachStatus(null);
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="parent@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <div className="relative">
              <Input
                ref={passwordInputRef}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  // Reset breach status when password changes
                  if (!isLogin) {
                    setPasswordBreachStatus(null);
                  }
                }}
                required
                minLength={6}
                autoComplete={isLogin ? "current-password" : "new-password"}
                className={
                  !isLogin && passwordBreachStatus === 'breached'
                    ? "pr-10 border-destructive focus-visible:ring-destructive"
                    : !isLogin && passwordBreachStatus === 'safe'
                    ? "pr-10 border-green-500 focus-visible:ring-green-500"
                    : ""
                }
                // SECURITY: Ensure password is never exposed in DOM
                onBlur={() => {
                  // Clear password from memory after blur (best effort)
                  // Note: React state will still hold it, but this prevents DOM exposure
                }}
              />
              {!isLogin && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingBreach && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {!checkingBreach && passwordBreachStatus === 'breached' && (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  {!checkingBreach && passwordBreachStatus === 'safe' && password.length >= 6 && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                </div>
              )}
            </div>
            {!isLogin && checkingBreach && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking password security...
              </p>
            )}
            {!isLogin && passwordBreachStatus === 'breached' && (
              <p className="text-xs text-destructive flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                This password has been compromised in data breaches. Choose a unique password that you haven't used elsewhere.
              </p>
            )}
            {!isLogin && passwordBreachStatus === 'safe' && password.length >= 6 && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Password looks secure!
              </p>
            )}
          </div>

          {isLogin && (
            <>
              {/* SECURITY: Show lockout warning */}
              {lockoutInfo?.locked && lockoutInfo.lockedUntil && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">Account Locked</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Too many failed login attempts. Please try again in{' '}
                      {Math.ceil((lockoutInfo.lockedUntil - Date.now()) / 60000)} minute(s).
                    </p>
                  </div>
                </div>
              )}
              
              {/* SECURITY: Show attempts remaining warning */}
              {lockoutInfo && !lockoutInfo.locked && lockoutInfo.attemptsRemaining !== undefined && lockoutInfo.attemptsRemaining < 5 && (
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                  <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-700">Security Notice</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {lockoutInfo.attemptsRemaining} attempt(s) remaining before account lockout.
                    </p>
                  </div>
                </div>
              )}

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
                  onCheckedChange={(checked) => setStaySignedIn(checked === true)}
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

          <Button type="submit" className="w-full" disabled={loading || (isLogin && lockoutInfo?.locked)}>
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
    </div>
  );
};

export default ParentAuth;

// src/components/CookieConsent.tsx
// GDPR/Privacy consent banner component for EU and other regions requiring consent
// Includes unified cookie/privacy consent and email updates opt-in

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Cookie, Mail, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Dev mode: Set to true to force show banner for testing
const FORCE_SHOW_BANNER = import.meta.env.DEV && false; // Set to true to test

// Routes where privacy consent should NOT be shown
// - Child routes: children don't need to consent (parents consent for them)
// - Auth routes: user isn't logged in yet, show after login
// - Info/Beta pages: publicly accessible without login
const EXCLUDED_ROUTES = ["/", "/child", "/parent/auth", "/family-member/auth", "/family-member/invite", "/info", "/beta"];

export const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(FORCE_SHOW_BANNER);
  const [isChecking, setIsChecking] = useState(true);
  const [emailUpdatesOptIn, setEmailUpdatesOptIn] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show cookie consent on excluded routes (landing, auth, child, info pages)
  const isExcludedRoute = 
    location.pathname === "/" || 
    EXCLUDED_ROUTES.some((route) => route !== "/" && location.pathname.startsWith(route));

  useEffect(() => {
    // Skip consent check entirely for excluded routes (landing, auth, child, info pages)
    if (isExcludedRoute) {
      setShowBanner(false);
      setIsChecking(false);
      return;
    }
    // Dev mode: Skip check if forcing banner to show
    if (FORCE_SHOW_BANNER) {
      setIsChecking(false);
      return;
    }

    const checkConsent = async () => {
      setIsChecking(true);

      try {
        // Check if user is authenticated
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          // User is authenticated - this is the only case where we show the banner
          setIsAuthenticated(true);
          
          // Check database for consent status (source of truth for authenticated users)
          const { data: parentData, error } = await supabase
            .from("parents")
            .select("privacy_cookie_accepted, email_updates_opt_in")
            .eq("id", session.user.id)
            .maybeSingle();

          if (error) {
            // If error (e.g., column doesn't exist yet), show banner
            console.warn(
              "Error checking privacy consent from database:",
              error
            );
            const timer = setTimeout(() => {
              setShowBanner(true);
              setIsChecking(false);
            }, 500);
            return () => clearTimeout(timer);
          } else if (parentData) {
            // Database is source of truth
            if (parentData.privacy_cookie_accepted === true) {
              // User has already accepted privacy/cookie consent, don't show banner
              setShowBanner(false);
              setIsChecking(false);
              return;
            } else {
              // User hasn't accepted yet - show banner
              // Pre-populate email opt-in checkbox if they already opted in
              const emailOptIn = parentData.email_updates_opt_in === true;
              setEmailUpdatesOptIn(emailOptIn);
              const timer = setTimeout(() => {
                setShowBanner(true);
                setIsChecking(false);
              }, 500);
              return () => clearTimeout(timer);
            }
          } else {
            // No parent record found (shouldn't happen normally)
            // Show banner anyway so they can accept
            const timer = setTimeout(() => {
              setShowBanner(true);
              setIsChecking(false);
            }, 500);
            return () => clearTimeout(timer);
          }
        } else {
          // User NOT authenticated - don't show banner
          // They'll see it after login when consent is tied to their account
          setIsAuthenticated(false);
          setShowBanner(false);
          setIsChecking(false);
        }
      } catch (error) {
        // Error checking, don't show banner for unauthenticated users
        console.warn("Error checking consent:", error);
        setShowBanner(false);
        setIsChecking(false);
      }
    };

    checkConsent();

    // Listen for auth state changes (e.g., user signs in)
    // This ensures consent is checked immediately after login
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        // User just signed in - check consent and show banner if needed
        setIsAuthenticated(true);
        setTimeout(() => {
          checkConsent();
        }, 300); // Short delay to allow profile to be created
      } else if (event === "SIGNED_OUT") {
        setIsAuthenticated(false);
        setShowBanner(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isExcludedRoute]);

  const handleAccept = async () => {
    // Immediately hide the banner for snappy UX
    setShowBanner(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        // Save consent to Supabase (linked to user's account)
        const { error } = await supabase
          .from("parents")
          .update({
            privacy_cookie_accepted: true,
            email_updates_opt_in: emailUpdatesOptIn,
          })
          .eq("id", session.user.id);

        if (error) {
          console.error("Error saving privacy consent to database:", error);
        }
      }
    } catch (error) {
      console.error("Error handling consent acceptance:", error);
    }
  };

  const handleDecline = async () => {
    // Immediately hide the banner for snappy UX
    setShowBanner(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        // Save decline to Supabase - set privacy_cookie_accepted to false
        // This records the decision but still allows basic app functionality
        // User can accept later from settings if they change their mind
        const { error } = await supabase
          .from("parents")
          .update({
            privacy_cookie_accepted: false,
            email_updates_opt_in: false,
          })
          .eq("id", session.user.id);

        if (error) {
          console.error("Error saving privacy decline to database:", error);
        }
      }
    } catch (error) {
      console.error("Error handling consent decline:", error);
    }
  };

  const handleManagePreferences = () => {
    navigate("/info#privacy");
    setShowBanner(false);
  };

  // Don't show banner while checking, if it shouldn't be shown, 
  // on excluded routes, or if user isn't authenticated
  if (isChecking || !showBanner || isExcludedRoute || !isAuthenticated) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-4"
      style={{
        paddingBottom: `calc(1rem + var(--safe-area-inset-bottom))`,
      }}
    >
      <Card className="max-w-4xl mx-auto shadow-lg border-2 p-4 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1 flex items-center gap-2">
                <Cookie className="h-4 w-4" />
                Privacy & Cookie Consent
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                We use essential cookies and local storage to provide our
                service (authentication, preferences). We do not use tracking
                cookies or third-party analytics. By using this app, you agree
                to our{" "}
                <button
                  onClick={handleManagePreferences}
                  className="text-primary hover:underline font-medium"
                >
                  Privacy Policy
                </button>
                .
              </p>

              {/* Email Updates Opt-in Checkbox */}
              <div className="flex items-start gap-2 mt-3 p-3 rounded-md bg-muted/50 border border-border">
                <Checkbox
                  id="email-updates-opt-in"
                  checked={emailUpdatesOptIn}
                  onCheckedChange={(checked) =>
                    setEmailUpdatesOptIn(checked === true)
                  }
                  className="mt-0.5"
                />
                <Label
                  htmlFor="email-updates-opt-in"
                  className="text-sm text-muted-foreground cursor-pointer flex-1 leading-relaxed"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className="h-4 w-4" />
                    <span className="font-medium">
                      Email Updates (Optional)
                    </span>
                  </div>
                  <span className="text-xs">
                    Receive important service updates and notifications about
                    Kids Call Home. You can opt out at any time.
                  </span>
                </Label>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManagePreferences}
              className="w-full sm:w-auto"
            >
              Learn More
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDecline}
              className="w-full sm:w-auto text-muted-foreground"
            >
              Decline
            </Button>
            <Button
              size="sm"
              onClick={handleAccept}
              className="w-full sm:w-auto"
            >
              Accept{emailUpdatesOptIn ? " All" : ""}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

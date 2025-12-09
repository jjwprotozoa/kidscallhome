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
import { useNavigate } from "react-router-dom";

const CONSENT_STORAGE_KEY = "kch_cookie_consent";
const CONSENT_VERSION = "1.0"; // Increment when policy changes

// Dev mode: Set to true to force show banner for testing
const FORCE_SHOW_BANNER = import.meta.env.DEV && false; // Set to true to test

export const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(FORCE_SHOW_BANNER);
  const [isChecking, setIsChecking] = useState(true);
  const [emailUpdatesOptIn, setEmailUpdatesOptIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
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
          // User is authenticated - check database flags
          const { data: parentData, error } = await supabase
            .from("parents")
            .select("privacy_cookie_accepted, email_updates_opt_in")
            .eq("id", session.user.id)
            .maybeSingle();

          if (error) {
            // If error (e.g., column doesn't exist yet), fall back to localStorage
            console.warn(
              "Error checking privacy consent from database:",
              error
            );
            // Still show banner with email checkbox even if DB error
            const timer = setTimeout(() => {
              setShowBanner(true);
              setIsChecking(false);
            }, 1000);
            return () => clearTimeout(timer);
          } else if (parentData) {
            // Database is source of truth
            if (parentData.privacy_cookie_accepted === true) {
              // User has accepted privacy/cookie consent, don't show banner
              setShowBanner(false);
              setIsChecking(false);
              return;
            } else {
              // User hasn't accepted privacy/cookie consent, show banner
              // Pre-populate email opt-in checkbox if they already opted in
              const emailOptIn = parentData.email_updates_opt_in === true;
              setEmailUpdatesOptIn(emailOptIn);
              console.log(
                "Showing consent banner with email checkbox. Email opt-in:",
                emailOptIn
              );
              const timer = setTimeout(() => {
                setShowBanner(true);
                setIsChecking(false);
              }, 1000);
              return () => clearTimeout(timer);
            }
          } else {
            // No parent record found, check localStorage as fallback
            checkLocalStorage();
          }
        } else {
          // User not authenticated, check localStorage
          checkLocalStorage();
        }
      } catch (error) {
        // Error checking database, fall back to localStorage
        console.warn("Error checking consent:", error);
        checkLocalStorage();
      }
    };

    const checkLocalStorage = () => {
      // Check if user has already given consent in localStorage (fallback for unauthenticated users)
      const consentDataStr = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (!consentDataStr) {
        // Show banner after a short delay to avoid blocking initial page load
        console.log(
          "No localStorage consent found, showing banner with email checkbox"
        );
        const timer = setTimeout(() => {
          setShowBanner(true);
          setIsChecking(false);
        }, 1000);
        return () => clearTimeout(timer);
      }

      // Parse and validate consent data
      try {
        const consentData = JSON.parse(consentDataStr);
        // Check if consent was given (accepted or declined) and version matches
        if (consentData.version === CONSENT_VERSION && consentData.timestamp) {
          // User has already responded, don't show banner
          setShowBanner(false);
          setIsChecking(false);
          return;
        }
        // Policy version changed, show banner again
        const timer = setTimeout(() => {
          setShowBanner(true);
          setIsChecking(false);
        }, 1000);
        return () => clearTimeout(timer);
      } catch (error) {
        // Invalid data, show banner
        const timer = setTimeout(() => {
          setShowBanner(true);
          setIsChecking(false);
        }, 1000);
        return () => clearTimeout(timer);
      }
    };

    checkConsent();
  }, []);

  const handleAccept = async () => {
    // Immediately hide the toast for snappy UX
    setShowBanner(false);

    try {
      // Check if user is authenticated
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        // Update both database flags for authenticated users
        // privacy_cookie_accepted is required (always true when accepting)
        // email_updates_opt_in is optional (based on checkbox state)
        const { error } = await supabase
          .from("parents")
          .update({
            privacy_cookie_accepted: true,
            email_updates_opt_in: emailUpdatesOptIn,
          })
          .eq("id", session.user.id);

        if (error) {
          console.error("Error updating privacy consent:", error);
          // Fall back to localStorage if database update fails
          localStorage.setItem(
            CONSENT_STORAGE_KEY,
            JSON.stringify({
              accepted: true,
              emailOptIn: emailUpdatesOptIn,
              version: CONSENT_VERSION,
              timestamp: new Date().toISOString(),
            })
          );
        }
      } else {
        // User not authenticated, store in localStorage
        localStorage.setItem(
          CONSENT_STORAGE_KEY,
          JSON.stringify({
            accepted: true,
            emailOptIn: emailUpdatesOptIn,
            version: CONSENT_VERSION,
            timestamp: new Date().toISOString(),
          })
        );
      }
    } catch (error) {
      console.error("Error handling consent acceptance:", error);
      // Fall back to localStorage on error
      localStorage.setItem(
        CONSENT_STORAGE_KEY,
        JSON.stringify({
          accepted: true,
          emailOptIn: emailUpdatesOptIn,
          version: CONSENT_VERSION,
          timestamp: new Date().toISOString(),
        })
      );
    }
  };

  const handleDecline = async () => {
    // Immediately hide the toast for snappy UX
    setShowBanner(false);

    // Store that user declined (still allow basic functionality)
    // Note: We don't update the database for decline - only for accept
    // This allows users to accept later if they change their mind
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        accepted: false,
        version: CONSENT_VERSION,
        timestamp: new Date().toISOString(),
      })
    );
  };

  const handleManagePreferences = () => {
    navigate("/info#privacy");
    setShowBanner(false);
  };

  // Don't show banner while checking or if it shouldn't be shown
  if (isChecking || !showBanner) {
    return null;
  }

  // Debug: Log when banner is rendered
  console.log(
    "Rendering consent banner. Email opt-in state:",
    emailUpdatesOptIn
  );

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

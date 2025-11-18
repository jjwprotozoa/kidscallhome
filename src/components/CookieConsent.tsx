// src/components/CookieConsent.tsx
// GDPR/Privacy consent banner component for EU and other regions requiring consent

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Cookie } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const CONSENT_STORAGE_KEY = "kch_cookie_consent";
const CONSENT_VERSION = "1.0"; // Increment when policy changes

export const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has already given consent
    const consentData = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!consentData) {
      // Show banner after a short delay to avoid blocking initial page load
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        accepted: true,
        version: CONSENT_VERSION,
        timestamp: new Date().toISOString(),
      })
    );
    setShowBanner(false);
  };

  const handleDecline = () => {
    // Store that user declined (still allow basic functionality)
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        accepted: false,
        version: CONSENT_VERSION,
        timestamp: new Date().toISOString(),
      })
    );
    setShowBanner(false);
  };

  const handleManagePreferences = () => {
    navigate("/info#privacy");
    setShowBanner(false);
  };

  if (!showBanner) {
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
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-1">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1 flex items-center gap-2">
                <Cookie className="h-4 w-4" />
                Privacy & Cookie Consent
              </h3>
              <p className="text-sm text-muted-foreground">
                We use essential cookies and local storage to provide our service
                (authentication, preferences). We do not use tracking cookies or
                third-party analytics. By using this app, you agree to our{" "}
                <button
                  onClick={handleManagePreferences}
                  className="text-primary hover:underline font-medium"
                >
                  Privacy Policy
                </button>
                .
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManagePreferences}
              className="w-full sm:w-auto"
            >
              Learn More
            </Button>
            <Button
              size="sm"
              onClick={handleAccept}
              className="w-full sm:w-auto"
            >
              Accept
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDecline}
              className="w-full sm:w-auto text-muted-foreground"
            >
              Decline
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};


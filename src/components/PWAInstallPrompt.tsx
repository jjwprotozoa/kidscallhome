// src/components/PWAInstallPrompt.tsx
// PWA install prompt component for encouraging users to install the app
// Purpose: Shows a custom install prompt when the app is installable

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

const INSTALL_PROMPT_STORAGE_KEY = "kch_install_prompt_dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const PWAInstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed (standalone mode)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const isIOSInstalled = (window.navigator as any).standalone === true;
    
    if (isStandalone || isIOSInstalled) {
      setIsInstalled(true);
      return;
    }

    // Check if user has dismissed the prompt
    const dismissed = localStorage.getItem(INSTALL_PROMPT_STORAGE_KEY);
    if (dismissed) {
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default browser install prompt
      e.preventDefault();
      // Store the event for later use
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show our custom prompt after a delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000); // Show after 3 seconds
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check if app was just installed
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      // User accepted the install prompt
      setShowPrompt(false);
      setDeferredPrompt(null);
      // Clear dismissed flag in case they want to see it again after uninstall
      localStorage.removeItem(INSTALL_PROMPT_STORAGE_KEY);
    } else {
      // User dismissed the install prompt
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Store dismissal for 7 days
    localStorage.setItem(
      INSTALL_PROMPT_STORAGE_KEY,
      JSON.stringify({
        dismissed: true,
        timestamp: new Date().toISOString(),
      })
    );
  };

  // Don't show if already installed or no prompt available
  if (isInstalled || !showPrompt || !deferredPrompt) {
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
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Install Kids Call Home</h3>
              <p className="text-sm text-muted-foreground">
                Install our app for a better experience! Get faster access, offline
                support, and push notifications for calls and messages.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Button
              size="sm"
              onClick={handleInstall}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Install App
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="w-full sm:w-auto text-muted-foreground"
            >
              <X className="h-4 w-4 mr-2" />
              Not Now
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};


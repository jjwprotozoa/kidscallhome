// src/components/UpdateAvailableToast.tsx
// Purpose: Shows a toast notification when a PWA update is available with a 3-day countdown and feedback link

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { safeJSONGet, safeJSONSet } from "@/utils/safeStorage";

const UPDATE_TOAST_STORAGE_KEY = "kch_update_toast";
const TOAST_DURATION_DAYS = 3;
const CHECK_INTERVAL_MS = 60000; // Check for updates every minute

export const UpdateAvailableToast = () => {
  const { toast } = useToast();
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [toastShowing, setToastShowing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const toastIdRef = useRef<string | null>(null);

  // Calculate time remaining
  const calculateTimeRemaining = (startTime: number): string => {
    const now = Date.now();
    const elapsed = now - startTime;
    const totalMs = TOAST_DURATION_DAYS * 24 * 60 * 60 * 1000;
    const remaining = totalMs - elapsed;

    if (remaining <= 0) {
      return "0 days";
    }

    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

    if (days > 0) {
      return `${days} day${days !== 1 ? "s" : ""} ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Check if toast should be shown
  const shouldShowToast = (): boolean => {
    try {
      const stored = safeJSONGet<{ startTime: number; dismissed: boolean }>(UPDATE_TOAST_STORAGE_KEY);
      if (!stored) {
        return true; // First time, show it
      }

      if (stored.dismissed) {
        return false; // User dismissed it
      }

      const elapsed = Date.now() - stored.startTime;
      const totalMs = TOAST_DURATION_DAYS * 24 * 60 * 60 * 1000;
      return elapsed < totalMs; // Still within 3 days
    } catch {
      return true; // Invalid data or storage error, show it
    }
  };

  // Initialize toast state
  const initializeToast = () => {
    // Don't show if toast is already showing
    if (toastIdRef.current) {
      return;
    }

    try {
      const stored = safeJSONGet<{ startTime: number; dismissed: boolean }>(UPDATE_TOAST_STORAGE_KEY);
      let startTime: number;

      if (stored) {
        if (stored.dismissed) {
          return; // User dismissed, don't show
        }
        startTime = stored.startTime;
      } else {
        // First time, set start time
        startTime = Date.now();
        safeJSONSet(UPDATE_TOAST_STORAGE_KEY, { startTime, dismissed: false });
      }

      // Check if still within 3 days
      const elapsed = Date.now() - startTime;
      const totalMs = TOAST_DURATION_DAYS * 24 * 60 * 60 * 1000;
      if (elapsed >= totalMs) {
        // Expired, mark as dismissed
        localStorage.setItem(
          UPDATE_TOAST_STORAGE_KEY,
          JSON.stringify({ startTime, dismissed: true })
        );
        return;
      }

      // Show toast
      const initialTimeRemaining = calculateTimeRemaining(startTime);
      setTimeRemaining(initialTimeRemaining);

      const { id } = toast({
        title: "Update Available",
        description: (
          <div className="space-y-2">
            <p>A new version of KidsCallHome is available!</p>
            <p className="text-xs text-muted-foreground">
              This notification will disappear in {initialTimeRemaining}
            </p>
          </div>
        ),
        variant: "default",
        duration: Infinity, // Don't auto-dismiss
        action: (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              asChild
              className="h-8"
            >
              <Link to="/beta">
                <ExternalLink className="h-3 w-3 mr-1" />
                Feedback
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                // Mark as dismissed
                const current = safeJSONGet<{ startTime: number; dismissed: boolean }>(UPDATE_TOAST_STORAGE_KEY);
                if (current) {
                  safeJSONSet(UPDATE_TOAST_STORAGE_KEY, { ...current, dismissed: true });
                }
                if (toastIdRef.current) {
                  toast({ id: toastIdRef.current, open: false });
                  toastIdRef.current = null;
                  setToastShowing(false);
                }
              }}
              className="h-8 px-2"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ),
      });

      toastIdRef.current = id;
      setToastShowing(true);
    } catch (error) {
      // Silently fail if toast initialization fails
      console.warn("Failed to initialize update toast:", error);
    }
  };

  // Update countdown timer (only runs when toast is showing)
  useEffect(() => {
    // Only start countdown if toast is showing
    if (!toastShowing || !toastIdRef.current) {
      return;
    }

    if (!shouldShowToast()) {
      return;
    }

    const stored = safeJSONGet<{ startTime: number; dismissed: boolean }>(UPDATE_TOAST_STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const { startTime, dismissed } = stored;
      if (dismissed) {
        return;
      }

      // Update countdown every minute
      const updateCountdown = () => {
        // Check if toast is still showing
        if (!toastIdRef.current) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return;
        }

        const remaining = calculateTimeRemaining(startTime);
        setTimeRemaining(remaining);

        // Check if expired
        const elapsed = Date.now() - startTime;
        const totalMs = TOAST_DURATION_DAYS * 24 * 60 * 60 * 1000;
        if (elapsed >= totalMs) {
          // Expired, dismiss toast and mark as dismissed
          localStorage.setItem(
            UPDATE_TOAST_STORAGE_KEY,
            JSON.stringify({ startTime, dismissed: true })
          );
          if (toastIdRef.current) {
            toast({ id: toastIdRef.current, open: false });
            toastIdRef.current = null;
            setToastShowing(false);
          }
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return;
        }

        // Update toast description with new countdown
        if (toastIdRef.current) {
          toast({
            id: toastIdRef.current,
            description: (
              <div className="space-y-2">
                <p>A new version of KidsCallHome is available!</p>
                <p className="text-xs text-muted-foreground">
                  This notification will disappear in {remaining}
                </p>
              </div>
            ),
          });
        }
      };

      // Update immediately
      updateCountdown();

      // Then update every minute
      intervalRef.current = setInterval(updateCountdown, CHECK_INTERVAL_MS);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } catch {
      // Invalid data, ignore
    }
  }, [toast, toastShowing]);

  // Check on mount if toast should be restored (user refreshed page)
  useEffect(() => {
    if (shouldShowToast() && !toastIdRef.current) {
      // Check if there's a stored startTime that's still valid
      const stored = safeJSONGet<{ startTime: number; dismissed: boolean }>(UPDATE_TOAST_STORAGE_KEY);
      if (stored && !stored.dismissed) {
        const elapsed = Date.now() - stored.startTime;
        const totalMs = TOAST_DURATION_DAYS * 24 * 60 * 60 * 1000;
        if (elapsed < totalMs) {
          // Still within 3 days, restore toast
          initializeToast();
        }
      }
    }
  }, []);

  // Check for service worker updates and show toast
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    // Wait for service worker to be ready
    navigator.serviceWorker.ready.then((registration) => {
      // Function to check if update is available and show toast
      const checkAndShowToast = () => {
        // Check if toast should be shown
        if (!shouldShowToast()) {
          return;
        }

        // Check if there's a waiting service worker (update available)
        if (registration.waiting) {
          // Update available, show toast
          initializeToast();
        }
      };

      // Check immediately
      checkAndShowToast();

      // Listen for updatefound event (new service worker found)
      registration.addEventListener("updatefound", () => {
        // New service worker installing, wait for it to be installed
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && registration.waiting) {
              // New service worker installed and waiting, show toast
              checkAndShowToast();
            }
          });
        }
      });

      // Check for updates periodically (every 5 minutes)
      const checkForUpdate = () => {
        registration.update().catch(() => {
          // Ignore errors
        });
      };

      const updateInterval = setInterval(checkForUpdate, 5 * 60 * 1000);

      // Also listen for controllerchange (service worker updated)
      const handleControllerChange = () => {
        // Service worker updated, check if there's a new one waiting
        navigator.serviceWorker.ready.then((newRegistration) => {
          if (newRegistration.waiting) {
            checkAndShowToast();
          }
        });
      };

      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

      return () => {
        clearInterval(updateInterval);
        navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      };
    });
  }, []);

  return null; // This component doesn't render anything directly
};

// Also export as default for compatibility
export default UpdateAvailableToast;


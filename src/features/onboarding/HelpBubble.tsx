// src/features/onboarding/HelpBubble.tsx
// Persistent help bubble that allows re-running the tour
// Shows on all screens in the bottom right corner

import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { useOnboardingTour } from "./useOnboardingTour";
import { Role } from "./onboardingConfig";

interface HelpBubbleProps {
  role: Role;
  pageKey: string;
}

const STORAGE_PREFIX = "kch_tour_";

function getStorageKey(role: Role, pageKey: string): string {
  return `${STORAGE_PREFIX}${role}_${pageKey}_done`;
}

export function HelpBubble({ role, pageKey }: HelpBubbleProps) {
  const { isRunning } = useOnboardingTour({ role, pageKey });

  const handleClick = () => {
    // Clear the completion flag
    const key = getStorageKey(role, pageKey);
    localStorage.removeItem(key);
    
    // Also clear device fingerprint so tour will run regardless of device
    // This allows manual restart on same device
    const deviceKey = `${STORAGE_PREFIX}${role}_${pageKey}_device`;
    localStorage.removeItem(deviceKey);
    
    // Dispatch custom event to trigger tour restart
    window.dispatchEvent(new CustomEvent("onboarding:restart", { 
      detail: { role, pageKey } 
    }));
  };

  // Hide help bubble when tour is running
  if (isRunning) {
    return null;
  }

  return (
    <Button
      onClick={handleClick}
      className="fixed right-4 sm:right-6 h-12 w-12 rounded-full shadow-lg z-50 safe-area-bottom bg-primary hover:bg-primary/90 text-primary-foreground"
      style={{ 
        bottom: "calc(1rem + var(--safe-area-inset-bottom))",
      }}
      size="icon"
      variant="default"
      aria-label="Show help tour"
      title="Show me around"
    >
      <HelpCircle className="h-5 w-5" />
    </Button>
  );
}


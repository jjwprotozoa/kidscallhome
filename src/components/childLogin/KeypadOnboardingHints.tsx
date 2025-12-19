// src/components/childLogin/KeypadOnboardingHints.tsx
// Purpose: Animated onboarding hints for first-time keypad users

import { ChevronLeft, ChevronRight, Hand } from "lucide-react";
import { useEffect, useState } from "react";

interface KeypadOnboardingHintsProps {
  showSwipeHint: boolean;
  showTapHint: boolean;
  onDismiss: () => void;
  isFirstBlock: boolean;
  isLastBlock: boolean;
}

export const KeypadOnboardingHints = ({
  showSwipeHint,
  showTapHint,
  onDismiss,
  isFirstBlock,
  isLastBlock,
}: KeypadOnboardingHintsProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Auto-dismiss after 8 seconds
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 8000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <>
      {/* Swipe hint overlay */}
      {showSwipeHint && !isLastBlock && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none z-20 flex justify-between px-1">
          {/* Left swipe indicator (show when not on first block) */}
          {!isFirstBlock && (
            <div className="flex items-center gap-1 text-primary/70 animate-swipe-hint-left">
              <ChevronLeft className="h-6 w-6" />
              <span className="text-xs font-medium hidden sm:inline">Swipe</span>
            </div>
          )}
          
          {/* Spacer when on first block */}
          {isFirstBlock && <div />}
          
          {/* Right swipe indicator (show when not on last block) */}
          {!isLastBlock && (
            <div className="flex items-center gap-1 text-primary/70 animate-swipe-hint-right">
              <span className="text-xs font-medium hidden sm:inline">Swipe</span>
              <ChevronRight className="h-6 w-6" />
            </div>
          )}
        </div>
      )}

      {/* Tap hint - floating hand animation */}
      {showTapHint && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none z-20 animate-float-up">
          <div className="flex items-center gap-2 bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-full shadow-lg">
            <Hand className="h-4 w-4 animate-tap-hint" />
            <span className="text-xs font-medium whitespace-nowrap">Tap a letter!</span>
          </div>
        </div>
      )}
    </>
  );
};

// Hook to manage first-time user state
export const useFirstTimeUser = (key: string) => {
  const storageKey = `kidscallhome_seen_${key}`;
  
  const [isFirstTime, setIsFirstTime] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(storageKey) !== "true";
  });

  const markAsSeen = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, "true");
    }
    setIsFirstTime(false);
  };

  const reset = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
    setIsFirstTime(true);
  };

  return { isFirstTime, markAsSeen, reset };
};




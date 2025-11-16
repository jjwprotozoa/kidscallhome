// src/features/onboarding/OnboardingTour.tsx
// Onboarding tour UI component with overlay and speech bubbles

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useOnboardingTour } from "./useOnboardingTour";
import { Role } from "./onboardingConfig";
import { cn } from "@/lib/utils";

interface OnboardingTourProps {
  role: Role;
  pageKey: string;
}

interface BubblePosition {
  top: number;
  left: number;
  placement: "top" | "bottom" | "left" | "right";
}

export function OnboardingTour({ role, pageKey }: OnboardingTourProps) {
  const { activeStep, stepIndex, totalSteps, isRunning, next, back, skip, finish } =
    useOnboardingTour({ role, pageKey });
  const [bubblePosition, setBubblePosition] = useState<BubblePosition | null>(null);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Find and highlight target element
  useEffect(() => {
    if (!activeStep || !isRunning) {
      setTargetElement(null);
      setBubblePosition(null);
      return;
    }

    const element = document.querySelector<HTMLElement>(activeStep.selector);
    if (!element) {
      // Element not found - skip to next step after a short delay
      console.warn(`Onboarding: Element not found for selector "${activeStep.selector}"`);
      setTimeout(() => {
        next();
      }, 100);
      return;
    }

    setTargetElement(element);

    // Calculate bubble position
    const updatePosition = () => {
      const rect = element.getBoundingClientRect();
      const placement = activeStep.placement || "bottom";
      const spacing = 16; // Space between element and bubble
      const viewportWidth = window.innerWidth;
      const isMobile = viewportWidth < 640; // sm breakpoint
      const bubbleWidth = isMobile ? Math.min(viewportWidth - 32, 320) : 320; // Responsive width
      const bubbleHeight = 120; // Approximate bubble height

      let top = 0;
      let left = 0;

      switch (placement) {
        case "top":
          top = rect.top - bubbleHeight - spacing;
          left = rect.left + rect.width / 2 - bubbleWidth / 2;
          break;
        case "bottom":
          top = rect.bottom + spacing;
          left = rect.left + rect.width / 2 - bubbleWidth / 2;
          break;
        case "left":
          top = rect.top + rect.height / 2 - bubbleHeight / 2;
          left = rect.left - bubbleWidth - spacing;
          break;
        case "right":
          top = rect.top + rect.height / 2 - bubbleHeight / 2;
          left = rect.right + spacing;
          break;
      }

      // Ensure bubble stays within viewport
      const viewportHeight = window.innerHeight;

      if (left < 16) left = 16;
      if (left + bubbleWidth > viewportWidth - 16) {
        left = viewportWidth - bubbleWidth - 16;
      }
      if (top < 16) top = 16;
      if (top + bubbleHeight > viewportHeight - 16) {
        top = viewportHeight - bubbleHeight - 16;
      }

      // On mobile, prefer bottom placement if there's not enough space
      if (isMobile && (top < 16 || top + bubbleHeight > viewportHeight - 16)) {
        top = Math.min(rect.bottom + spacing, viewportHeight - bubbleHeight - 16);
        left = Math.max(16, Math.min(left, viewportWidth - bubbleWidth - 16));
      }

      setBubblePosition({ top, left, placement });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [activeStep, isRunning, next]);

  // Add highlight effect to target element
  useEffect(() => {
    if (!targetElement) return;

    const originalZIndex = targetElement.style.zIndex;
    const originalPosition = targetElement.style.position;
    const originalOutline = targetElement.style.outline;

    // Ensure element is above backdrop
    targetElement.style.zIndex = "10001";
    if (getComputedStyle(targetElement).position === "static") {
      targetElement.style.position = "relative";
    }
    targetElement.style.outline = "3px solid hsl(var(--primary))";
    targetElement.style.outlineOffset = "4px";
    targetElement.style.borderRadius = "8px";

    return () => {
      targetElement.style.zIndex = originalZIndex;
      targetElement.style.position = originalPosition;
      targetElement.style.outline = originalOutline;
      targetElement.style.outlineOffset = "";
      targetElement.style.borderRadius = "";
    };
  }, [targetElement]);

  if (!isRunning || !activeStep || !bubblePosition) {
    return null;
  }

  const isLastStep = stepIndex === totalSteps - 1;
  const isFirstStep = stepIndex === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[10000]"
        onClick={skip}
        aria-hidden="true"
      />

      {/* Speech bubble */}
      <div
        ref={bubbleRef}
        className="fixed z-[10002] bg-background border-2 border-primary rounded-lg shadow-lg p-4 max-w-[calc(100vw-2rem)] sm:max-w-[320px] mx-4 sm:mx-0"
        style={{
          top: `${bubblePosition.top}px`,
          left: `${bubblePosition.left}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Skip button */}
        <button
          onClick={skip}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Skip tour"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className={cn("pr-6 sm:pr-8", role === "child" && "text-base sm:text-lg")}>
          {activeStep.title && role === "parent" && (
            <h3 className="font-bold text-base sm:text-lg mb-2">{activeStep.title}</h3>
          )}
          <p className={cn("text-sm sm:text-base text-muted-foreground", role === "child" && "text-base sm:text-lg")}>
            {activeStep.description}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <Button variant="outline" size="sm" onClick={back} className="text-xs sm:text-sm">
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {stepIndex + 1} / {totalSteps}
            </span>
            <Button onClick={isLastStep ? finish : next} size="sm" className="text-xs sm:text-sm">
              {isLastStep ? "Got it!" : "Next"}
              {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}


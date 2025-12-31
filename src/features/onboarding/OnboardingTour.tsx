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
      // Only log in development to reduce console noise
      if (import.meta.env.DEV) {
        console.warn(`Onboarding: Element not found for selector "${activeStep.selector}"`);
      }
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
      const spacing = 24; // Increased space between element and bubble
      const viewportWidth = window.innerWidth;
      const isMobile = viewportWidth < 640; // sm breakpoint
      const bubbleWidth = isMobile ? Math.min(viewportWidth - 32, 320) : 320; // Responsive width
      const bubbleHeight = 140; // Increased approximate bubble height
      const padding = 16;
      const viewportHeight = window.innerHeight;

      let top = 0;
      let left = 0;

      // Calculate target bounds with extra padding to ensure no overlap
      const targetTop = rect.top - 8; // Include outline offset
      const targetBottom = rect.bottom + 8;
      const targetLeft = rect.left - 8;
      const targetRight = rect.right + 8;

      switch (placement) {
        case "top":
          top = targetTop - bubbleHeight - spacing;
          left = rect.left + rect.width / 2 - bubbleWidth / 2;
          break;
        case "bottom":
          top = targetBottom + spacing;
          left = rect.left + rect.width / 2 - bubbleWidth / 2;
          break;
        case "left":
          top = rect.top + rect.height / 2 - bubbleHeight / 2;
          left = targetLeft - bubbleWidth - spacing;
          break;
        case "right":
          top = rect.top + rect.height / 2 - bubbleHeight / 2;
          left = targetRight + spacing;
          break;
      }

      // Check for overlap and adjust position
      const bubbleRight = left + bubbleWidth;
      const bubbleBottom = top + bubbleHeight;
      const bubbleLeft = left;
      const bubbleTop = top;

      // Check if bubble overlaps with target element (with padding)
      const overlapsHorizontally = bubbleLeft < targetRight && bubbleRight > targetLeft;
      const overlapsVertically = bubbleTop < targetBottom && bubbleBottom > targetTop;
      const overlaps = overlapsHorizontally && overlapsVertically;

      if (overlaps) {
        // Try alternative positions to avoid overlap
        if (placement === "top" || placement === "bottom") {
          // Try right side first
          if (targetRight + spacing + bubbleWidth < viewportWidth - padding) {
            left = targetRight + spacing;
            top = Math.max(padding, Math.min(rect.top + rect.height / 2 - bubbleHeight / 2, viewportHeight - bubbleHeight - padding));
          }
          // Try left side if right doesn't work
          else if (targetLeft - spacing - bubbleWidth > padding) {
            left = targetLeft - spacing - bubbleWidth;
            top = Math.max(padding, Math.min(rect.top + rect.height / 2 - bubbleHeight / 2, viewportHeight - bubbleHeight - padding));
          }
          // If neither side works, place above/below with more spacing
          else if (placement === "top") {
            top = targetTop - bubbleHeight - spacing * 2;
            left = Math.max(padding, Math.min(left, viewportWidth - bubbleWidth - padding));
          } else {
            top = targetBottom + spacing * 2;
            left = Math.max(padding, Math.min(left, viewportWidth - bubbleWidth - padding));
          }
        } else if (placement === "left" || placement === "right") {
          // Try bottom first
          if (targetBottom + spacing + bubbleHeight < viewportHeight - padding) {
            top = targetBottom + spacing;
            left = Math.max(padding, Math.min(rect.left + rect.width / 2 - bubbleWidth / 2, viewportWidth - bubbleWidth - padding));
          }
          // Try top if bottom doesn't work
          else if (targetTop - spacing - bubbleHeight > padding) {
            top = targetTop - spacing - bubbleHeight;
            left = Math.max(padding, Math.min(rect.left + rect.width / 2 - bubbleWidth / 2, viewportWidth - bubbleWidth - padding));
          }
          // If neither works, place left/right with more spacing
          else if (placement === "left") {
            left = targetLeft - bubbleWidth - spacing * 2;
            top = Math.max(padding, Math.min(top, viewportHeight - bubbleHeight - padding));
          } else {
            left = targetRight + spacing * 2;
            top = Math.max(padding, Math.min(top, viewportHeight - bubbleHeight - padding));
          }
        }
      }

      // Ensure bubble stays within viewport bounds
      if (left < padding) left = padding;
      if (left + bubbleWidth > viewportWidth - padding) {
        left = viewportWidth - bubbleWidth - padding;
      }
      if (top < padding) top = padding;
      if (top + bubbleHeight > viewportHeight - padding) {
        top = viewportHeight - bubbleHeight - padding;
      }

      // Final overlap check - if still overlapping, force position above
      const finalBubbleRight = left + bubbleWidth;
      const finalBubbleBottom = top + bubbleHeight;
      const stillOverlaps = 
        left < targetRight && finalBubbleRight > targetLeft &&
        top < targetBottom && finalBubbleBottom > targetTop;

      if (stillOverlaps) {
        // Force position above the target with extra spacing
        top = targetTop - bubbleHeight - spacing * 2;
        left = Math.max(padding, Math.min(rect.left + rect.width / 2 - bubbleWidth / 2, viewportWidth - bubbleWidth - padding));
        
        // If above doesn't fit, try below
        if (top < padding) {
          top = targetBottom + spacing * 2;
        }
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

  // Track target element position for backdrop cutout
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Update target element position for backdrop cutout
  useEffect(() => {
    if (!targetElement) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const rect = targetElement.getBoundingClientRect();
      setTargetRect(rect);
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [targetElement]);

  // Add highlight effect to target element
  useEffect(() => {
    if (!targetElement) return;

    const originalZIndex = targetElement.style.zIndex;
    const originalPosition = targetElement.style.position;
    const originalOutline = targetElement.style.outline;
    const originalBoxShadow = targetElement.style.boxShadow;

    // Ensure element is above backdrop but below speech bubble
    targetElement.style.zIndex = "10002";
    if (getComputedStyle(targetElement).position === "static") {
      targetElement.style.position = "relative";
    }
    targetElement.style.outline = "3px solid hsl(var(--primary))";
    targetElement.style.outlineOffset = "4px";
    targetElement.style.borderRadius = "8px";
    // Add shadow to make it stand out more
    targetElement.style.boxShadow = "0 0 0 4px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.15)";
    // Ensure target is clickable
    targetElement.style.pointerEvents = "auto";

    return () => {
      targetElement.style.zIndex = originalZIndex;
      targetElement.style.position = originalPosition;
      targetElement.style.outline = originalOutline;
      targetElement.style.outlineOffset = "";
      targetElement.style.borderRadius = "";
      targetElement.style.boxShadow = originalBoxShadow;
    };
  }, [targetElement]);

  if (!isRunning || !activeStep || !bubblePosition) {
    return null;
  }

  const isLastStep = stepIndex === totalSteps - 1;
  const isFirstStep = stepIndex === 0;

  return (
    <>
      {/* Backdrop with cutout for target element */}
      {targetRect ? (
        <>
          {/* Top overlay */}
          <div
            className="fixed z-[10000] bg-black/50"
            style={{
              top: 0,
              left: 0,
              right: 0,
              height: `${Math.max(0, targetRect.top - 8)}px`,
            }}
            onClick={skip}
            inert
          />
          {/* Bottom overlay */}
          <div
            className="fixed z-[10000] bg-black/50"
            style={{
              top: `${targetRect.bottom + 8}px`,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            onClick={skip}
            inert
          />
          {/* Left overlay */}
          <div
            className="fixed z-[10000] bg-black/50"
            style={{
              top: `${Math.max(0, targetRect.top - 8)}px`,
              left: 0,
              width: `${Math.max(0, targetRect.left - 8)}px`,
              height: `${targetRect.height + 16}px`,
            }}
            onClick={skip}
            inert
          />
          {/* Right overlay */}
          <div
            className="fixed z-[10000] bg-black/50"
            style={{
              top: `${Math.max(0, targetRect.top - 8)}px`,
              left: `${targetRect.right + 8}px`,
              right: 0,
              height: `${targetRect.height + 16}px`,
            }}
            onClick={skip}
            inert
          />
        </>
      ) : (
        <div
          className="fixed inset-0 bg-black/50 z-[10000]"
          onClick={skip}
          inert
        />
      )}

      {/* Speech bubble - positioned above cutout area */}
      <div
        ref={bubbleRef}
        className="fixed z-[10003] bg-background border-2 border-primary rounded-lg shadow-xl p-4 max-w-[calc(100vw-2rem)] sm:max-w-[320px] mx-4 sm:mx-0 pointer-events-auto"
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


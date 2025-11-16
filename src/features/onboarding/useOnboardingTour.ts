// src/features/onboarding/useOnboardingTour.ts
// Hook for managing onboarding tour state

import { useState, useEffect, useCallback } from "react";
import { Role, OnboardingStep, getTourConfig } from "./onboardingConfig";

export interface UseOnboardingTourArgs {
  role: Role;
  pageKey: string; // e.g. "parent_dashboard" | "child_dashboard"
}

export interface UseOnboardingTourResult {
  activeStep: OnboardingStep | null;
  stepIndex: number;
  totalSteps: number;
  isRunning: boolean;
  start: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  finish: () => void;
}

const STORAGE_PREFIX = "kch_tour_";

function getStorageKey(role: Role, pageKey: string): string {
  return `${STORAGE_PREFIX}${role}_${pageKey}_done`;
}

function isTourCompleted(role: Role, pageKey: string): boolean {
  const key = getStorageKey(role, pageKey);
  return localStorage.getItem(key) === "true";
}

function markTourCompleted(role: Role, pageKey: string): void {
  const key = getStorageKey(role, pageKey);
  localStorage.setItem(key, "true");
}

export function useOnboardingTour({
  role,
  pageKey,
}: UseOnboardingTourArgs): UseOnboardingTourResult {
  const steps = getTourConfig(role);
  const [stepIndex, setStepIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // Check if tour should auto-start on mount
  useEffect(() => {
    if (!isTourCompleted(role, pageKey)) {
      // Auto-start tour on first visit
      setIsRunning(true);
      setStepIndex(0);
    }
  }, [role, pageKey]);

  // Listen for restart event from HelpBubble
  useEffect(() => {
    const handleRestart = (event: CustomEvent) => {
      if (event.detail.role === role && event.detail.pageKey === pageKey) {
        setIsRunning(true);
        setStepIndex(0);
      }
    };

    window.addEventListener("onboarding:restart" as any, handleRestart as EventListener);
    return () => {
      window.removeEventListener("onboarding:restart" as any, handleRestart as EventListener);
    };
  }, [role, pageKey]);

  const start = useCallback(() => {
    setIsRunning(true);
    setStepIndex(0);
  }, []);

  const next = useCallback(() => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      // Last step - finish tour
      finish();
    }
  }, [stepIndex, steps.length]);

  const back = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  }, [stepIndex]);

  const skip = useCallback(() => {
    markTourCompleted(role, pageKey);
    setIsRunning(false);
    setStepIndex(0);
  }, [role, pageKey]);

  const finish = useCallback(() => {
    markTourCompleted(role, pageKey);
    setIsRunning(false);
    setStepIndex(0);
  }, [role, pageKey]);

  const activeStep = isRunning && stepIndex < steps.length ? steps[stepIndex] : null;

  return {
    activeStep,
    stepIndex,
    totalSteps: steps.length,
    isRunning,
    start,
    next,
    back,
    skip,
    finish,
  };
}


// src/features/onboarding/onboardingConfig.ts
// Configuration for role-aware onboarding tours

export type Role = "parent" | "child";

export interface OnboardingStep {
  id: string; // e.g. "parent-call-button"
  selector: string; // CSS selector (e.g. '[data-tour="parent-call-button"]')
  title?: string; // parent only or optional
  description: string; // text bubble copy
  placement?: "top" | "bottom" | "left" | "right";
}

// Parent dashboard tour steps
export const parentDashboardTour: OnboardingStep[] = [
  {
    id: "parent-call-button",
    selector: '[data-tour="parent-call-button"]',
    title: "Start a call",
    description: "Tap your child's name to start a video call.",
    placement: "bottom",
  },
  {
    id: "parent-status-indicator",
    selector: '[data-tour="parent-status-indicator"]',
    description: "Green dot = they're online and available.",
    placement: "right",
  },
  {
    id: "parent-messages",
    selector: '[data-tour="parent-messages"]',
    description: "Use messages for quick notes when they can't talk.",
    placement: "bottom",
  },
  {
    id: "parent-menu",
    selector: '[data-tour="parent-menu"]',
    description: "Use the navigation menu to switch between pages.",
    placement: "bottom",
  },
];

// Child dashboard tour steps
export const childDashboardTour: OnboardingStep[] = [
  {
    id: "child-answer-button",
    selector: '[data-tour="child-answer-button"]',
    description: "Tap this to talk to mom or dad. 👋",
    placement: "bottom",
  },
  {
    id: "child-messages",
    selector: '[data-tour="child-messages"]',
    description: "Tap here to see messages. 💬",
    placement: "bottom",
  },
  {
    id: "child-help",
    selector: '[data-tour="child-help"]',
    description: "Use the navigation menu to switch between pages.",
    placement: "bottom",
  },
];

// Get tour config for a role
export function getTourConfig(role: Role): OnboardingStep[] {
  return role === "parent" ? parentDashboardTour : childDashboardTour;
}


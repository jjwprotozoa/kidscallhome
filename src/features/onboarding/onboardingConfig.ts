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
    id: "parent-child-name-status",
    selector: '[data-tour="parent-child-name-status"]',
    title: "Child Status",
    description: "Your child's name and online status. Green dot means they're online and available to call.",
    placement: "bottom",
  },
  {
    id: "parent-login-code",
    selector: '[data-tour="parent-login-code"]',
    title: "Login Code",
    description: "This is your child's unique login code. Share this code with them so they can log in to their account.",
    placement: "bottom",
  },
  {
    id: "parent-copy-code",
    selector: '[data-tour="parent-copy-code"]',
    title: "Copy Code",
    description: "Tap this button to copy the login code to your clipboard. Easy way to share it via text or email.",
    placement: "bottom",
  },
  {
    id: "parent-copy-link",
    selector: '[data-tour="parent-copy-link"]',
    title: "Copy Link",
    description: "Copy a magic link that includes the login code. Your child can tap the link to log in automatically.",
    placement: "bottom",
  },
  {
    id: "parent-print-code",
    selector: '[data-tour="parent-print-code"]',
    title: "Print Code",
    description: "Print the login code on a card or paper. Great for giving to your child to keep handy.",
    placement: "bottom",
  },
  {
    id: "parent-view-qr",
    selector: '[data-tour="parent-view-qr"]',
    title: "View QR Code",
    description: "See a QR code version of the login code. Your child can scan it with their device camera to log in.",
    placement: "bottom",
  },
  {
    id: "parent-call-button",
    selector: '[data-tour="parent-call-button"]',
    title: "Start a Video Call",
    description: "Tap this button to start a video call with your child. Make sure they're online (green dot) for best results.",
    placement: "bottom",
  },
  {
    id: "parent-messages",
    selector: '[data-tour="parent-messages"]',
    title: "Send Messages",
    description: "Send text messages to your child. Perfect for quick notes when they can't answer a call.",
    placement: "bottom",
  },
  {
    id: "parent-delete-child",
    selector: '[data-tour="parent-delete-child"]',
    title: "Delete Child",
    description: "Remove this child from your account. Use with caution - this action cannot be undone.",
    placement: "bottom",
  },
  {
    id: "parent-upgrade-plan",
    selector: '[data-tour="parent-upgrade-plan"]',
    title: "Upgrade Plan",
    description: "Tap here to upgrade your subscription and add more children to your account. View available plans and pricing.",
    placement: "bottom",
  },
  {
    id: "parent-upgrade-limit",
    selector: '[data-tour="parent-upgrade-limit"]',
    title: "Upgrade When Limit Reached",
    description: "When you reach your subscription limit, tap this button to upgrade and add more children to your account.",
    placement: "bottom",
  },
  {
    id: "parent-menu",
    selector: '[data-tour="parent-menu"]',
    title: "Navigation Menu",
    description: "Use the menu at the top to navigate between pages: Home, Dashboard, Children, Devices, Settings, and App Information.",
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

// Parent home tour steps
export const parentHomeTour: OnboardingStep[] = [
  {
    id: "parent-home-view-children",
    selector: '[data-tour="parent-home-view-children"]',
    title: "View Children",
    description: "Tap here to see all your children and their profiles.",
    placement: "bottom",
  },
  {
    id: "parent-home-dashboard",
    selector: '[data-tour="parent-home-dashboard"]',
    title: "Go to Dashboard",
    description: "Access the full dashboard to manage children, login codes, and more.",
    placement: "bottom",
  },
];

// Parent children list tour steps
export const parentChildrenListTour: OnboardingStep[] = [
  {
    id: "parent-children-list-card",
    selector: '[data-tour="parent-children-list-card"]',
    title: "Child Profile",
    description: "Each card shows your child's name, online status, and login code.",
    placement: "bottom",
  },
  {
    id: "parent-children-list-call",
    selector: '[data-tour="parent-children-list-call"]',
    title: "Call Your Child",
    description: "Tap the Call button to start a video call with your child.",
    placement: "bottom",
  },
  {
    id: "parent-children-list-message",
    selector: '[data-tour="parent-children-list-message"]',
    title: "Send Message",
    description: "Tap the Message button to send a text message to your child.",
    placement: "bottom",
  },
];

// Parent devices tour steps
export const parentDevicesTour: OnboardingStep[] = [
  {
    id: "parent-devices-list",
    selector: '[data-tour="parent-devices-list"]',
    title: "Device Management",
    description: "View and manage all devices that can access your account. You can remove devices for security.",
    placement: "bottom",
  },
];

// Parent upgrade tour steps
export const parentUpgradeTour: OnboardingStep[] = [
  {
    id: "parent-upgrade-plans",
    selector: '[data-tour="parent-upgrade-plans"]',
    title: "Subscription Plans",
    description: "Choose a plan that fits your needs. Monthly or annual billing available.",
    placement: "bottom",
  },
];

// Parent settings tour steps
export const parentSettingsTour: OnboardingStep[] = [
  {
    id: "parent-settings-account",
    selector: '[data-tour="parent-settings-account"]',
    title: "Account Settings",
    description: "Manage your account information, subscription, and children limit here.",
    placement: "bottom",
  },
  {
    id: "parent-settings-upgrade",
    selector: '[data-tour="parent-settings-upgrade"]',
    title: "Upgrade Subscription",
    description: "Tap here to upgrade your plan and add more children to your account.",
    placement: "bottom",
  },
];

// Child home tour steps
export const childHomeTour: OnboardingStep[] = [
  {
    id: "child-home-parents",
    selector: '[data-tour="child-home-parents"]',
    description: "Tap here to see your parents and start a call. 👋",
    placement: "bottom",
  },
];

// Child parents list tour steps
export const childParentsListTour: OnboardingStep[] = [
  {
    id: "child-parents-list-card",
    selector: '[data-tour="child-parents-list-card"]',
    description: "Tap a parent's card to call them. 📞",
    placement: "bottom",
  },
];

// Get tour config for a role and page
export function getTourConfig(role: Role, pageKey?: string): OnboardingStep[] {
  // If pageKey is provided, use page-specific tours
  if (pageKey) {
    switch (pageKey) {
      case "parent_home":
        return parentHomeTour;
      case "parent_dashboard":
        return parentDashboardTour;
      case "parent_children_list":
        return parentChildrenListTour;
      case "parent_devices":
        return parentDevicesTour;
      case "parent_upgrade":
        return parentUpgradeTour;
      case "parent_settings":
        return parentSettingsTour;
      case "child_home":
        return childHomeTour;
      case "child_dashboard":
        return childDashboardTour;
      case "child_parents_list":
        return childParentsListTour;
      default:
        // Fallback to role-based tours
        return role === "parent" ? parentDashboardTour : childDashboardTour;
    }
  }
  
  // Fallback to role-based tours
  return role === "parent" ? parentDashboardTour : childDashboardTour;
}


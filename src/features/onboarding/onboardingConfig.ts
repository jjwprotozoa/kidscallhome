// src/features/onboarding/onboardingConfig.ts
// Configuration for role-aware onboarding tours
// Updated to match current site structure with Children, Family, Connections, Safety, Referrals, Subscription pages

export type Role = "parent" | "child" | "family_member";

export interface OnboardingStep {
  id: string; // e.g. "parent-call-button"
  selector: string; // CSS selector (e.g. '[data-tour="parent-call-button"]')
  title?: string; // parent only or optional
  description: string; // text bubble copy
  placement?: "top" | "bottom" | "left" | "right";
}

// ============================================
// PARENT TOUR CONFIGURATIONS
// ============================================

// Parent Children List tour steps (main page for parents)
export const parentChildrenListTour: OnboardingStep[] = [
  {
    id: "parent-children-list-card",
    selector: '[data-tour="parent-children-list-card"]',
    title: "Child Profile",
    description: "Each card shows your child's name and online status. Green glow means they're online!",
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
  {
    id: "parent-children-list-add-child",
    selector: '[data-tour="parent-children-list-add-child"]',
    title: "Add Child",
    description: "Tap here to add a new child to your account and get their login code.",
    placement: "bottom",
  },
  {
    id: "parent-menu-children",
    selector: '[data-tour="parent-menu-children"]',
    title: "Children",
    description: "You're here! This is where you see all your children and can call or message them.",
    placement: "bottom",
  },
  {
    id: "parent-menu-family",
    selector: '[data-tour="parent-menu-family"]',
    title: "Family",
    description: "Invite grandparents, aunts, uncles, or other trusted adults to connect with your children.",
    placement: "bottom",
  },
  {
    id: "parent-menu-connections",
    selector: '[data-tour="parent-menu-connections"]',
    title: "Connections",
    description: "Manage friend requests between your children and other families' children.",
    placement: "bottom",
  },
  {
    id: "parent-menu-safety",
    selector: '[data-tour="parent-menu-safety"]',
    title: "Safety",
    description: "View safety reports and manage blocked contacts to keep your children safe.",
    placement: "bottom",
  },
  {
    id: "parent-menu-referrals",
    selector: '[data-tour="parent-menu-referrals"]',
    title: "Referrals",
    description: "Share Kids Call Home with friends and earn free subscription time!",
    placement: "bottom",
  },
  {
    id: "parent-menu-subscription",
    selector: '[data-tour="parent-menu-subscription"]',
    title: "Subscription",
    description: "Upgrade your plan to add more children or access premium features.",
    placement: "bottom",
  },
  {
    id: "parent-menu-more",
    selector: '[data-tour="parent-menu-more"]',
    title: "More Options",
    description: "Access Devices (manage logged-in devices), Settings (account info), App Information, and Beta Testing features.",
    placement: "bottom",
  },
  {
    id: "parent-menu-share",
    selector: '[data-tour="parent-menu-share"]',
    title: "Share",
    description: "Love Kids Call Home? Share it with friends and family! You can also earn free subscription time through referrals.",
    placement: "bottom",
  },
  {
    id: "parent-menu-network",
    selector: '[data-tour="parent-menu-network"]',
    title: "Network Quality",
    description: "Shows your current connection quality. Green means great for video calls, yellow is okay, red may cause issues.",
    placement: "bottom",
  },
  {
    id: "parent-menu-logout",
    selector: '[data-tour="parent-menu-logout"]',
    title: "Logout",
    description: "Sign out of your account when you're done. Your children will stay logged in on their devices.",
    placement: "bottom",
  },
];

// Parent Family page tour steps
export const parentFamilyTour: OnboardingStep[] = [
  {
    id: "parent-family-code",
    selector: '[data-tour="parent-family-code"]',
    title: "Family Code",
    description: "Share this code with family members so they can join your family and connect with your children.",
    placement: "bottom",
  },
  {
    id: "parent-family-members",
    selector: '[data-tour="parent-family-members"]',
    title: "Family Members",
    description: "View and manage family members who can call and message your children.",
    placement: "bottom",
  },
];

// Parent Connections page tour steps
export const parentConnectionsTour: OnboardingStep[] = [
  {
    id: "parent-connections-requests",
    selector: '[data-tour="parent-connections-requests"]',
    title: "Connection Requests",
    description: "Review and approve connection requests from other families for your children.",
    placement: "bottom",
  },
];

// Parent Safety page tour steps
export const parentSafetyTour: OnboardingStep[] = [
  {
    id: "parent-safety-reports",
    selector: '[data-tour="parent-safety-reports"]',
    title: "Safety Reports",
    description: "View reports from your children about blocked contacts and safety concerns.",
    placement: "bottom",
  },
];

// Parent Referrals page tour steps
export const parentReferralsTour: OnboardingStep[] = [
  {
    id: "parent-referrals-share",
    selector: '[data-tour="parent-referrals-share"]',
    title: "Share & Earn",
    description: "Share Kids Call Home with friends and earn free subscription time when they sign up!",
    placement: "bottom",
  },
];

// Parent Upgrade/Subscription page tour steps
export const parentUpgradeTour: OnboardingStep[] = [
  {
    id: "parent-upgrade-plans",
    selector: '[data-tour="parent-upgrade-plans"]',
    title: "Subscription Plans",
    description: "Choose a plan that fits your family's needs. Add more children with a premium subscription.",
    placement: "bottom",
  },
];

// Parent Devices page tour steps
export const parentDevicesTour: OnboardingStep[] = [
  {
    id: "parent-devices-list",
    selector: '[data-tour="parent-devices-list"]',
    title: "Device Management",
    description: "View and manage all devices that can access your account. Remove unrecognized devices for security.",
    placement: "bottom",
  },
];

// Parent Settings page tour steps
export const parentSettingsTour: OnboardingStep[] = [
  {
    id: "parent-settings-account",
    selector: '[data-tour="parent-settings-account"]',
    title: "Account Settings",
    description: "Manage your account information and subscription details here.",
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

// ============================================
// CHILD TOUR CONFIGURATIONS
// ============================================

// Child Dashboard tour steps (main page for children)
export const childDashboardTour: OnboardingStep[] = [
  {
    id: "child-call-button",
    selector: '[data-tour="child-call-button"]',
    description: "Tap this big button to call your parent! 📞",
    placement: "bottom",
  },
  {
    id: "child-message-button",
    selector: '[data-tour="child-message-button"]',
    description: "Tap here to send messages to your parent. 💬",
    placement: "bottom",
  },
  {
    id: "child-help",
    selector: '[data-tour="child-help"]',
    title: "Navigation",
    description: "Use the menu to see your family and switch between pages.",
    placement: "bottom",
  },
];

// Child Home tour steps
export const childHomeTour: OnboardingStep[] = [
  {
    id: "child-home-parents",
    selector: '[data-tour="child-home-parents"]',
    description: "Tap here to see your family and start a call! 👋",
    placement: "bottom",
  },
];

// Child Family/Parents List tour steps
export const childParentsListTour: OnboardingStep[] = [
  {
    id: "child-family-welcome",
    selector: '[data-tour="child-family-welcome"]',
    description: "This is where you can talk to your family! 👨‍👩‍👧‍👦",
    placement: "bottom",
  },
  {
    id: "child-parents-list-card",
    selector: '[data-tour="child-parents-list-card"]',
    description: "This is your parent! A green glow means they're online and ready to talk! ✨",
    placement: "bottom",
  },
  {
    id: "child-family-call",
    selector: '[data-tour="child-family-call"]',
    description: "Tap Call to start a video call! 📞",
    placement: "top",
  },
  {
    id: "child-family-message",
    selector: '[data-tour="child-family-message"]',
    description: "Tap Message to send a text! 💬",
    placement: "top",
  },
  {
    id: "child-family-members-section",
    selector: '[data-tour="child-family-members-section"]',
    description: "You can also talk to other family members like grandparents! 👴👵",
    placement: "top",
  },
];

// ============================================
// FAMILY MEMBER TOUR CONFIGURATIONS
// ============================================

// Family Member Dashboard tour steps
export const familyMemberDashboardTour: OnboardingStep[] = [
  {
    id: "family-member-welcome",
    selector: '[data-tour="family-member-welcome"]',
    title: "Welcome to Kids Call Home!",
    description: "This is your dashboard where you can connect with the children in your family. Let's show you around!",
    placement: "bottom",
  },
  {
    id: "family-member-child-card",
    selector: '[data-tour="family-member-child-card"]',
    title: "Child Profile",
    description: "Each card shows a child's name and online status. A green glow means they're currently online and available!",
    placement: "bottom",
  },
  {
    id: "family-member-call",
    selector: '[data-tour="family-member-call"]',
    title: "Video Call",
    description: "Tap the Call button to start a video call with this child. They'll receive a notification on their device.",
    placement: "top",
  },
  {
    id: "family-member-message",
    selector: '[data-tour="family-member-message"]',
    title: "Send a Message",
    description: "Tap Message to send a text message. A red badge will show if you have unread messages.",
    placement: "top",
  },
  {
    id: "family-member-menu",
    selector: '[data-tour="family-member-menu"]',
    title: "Navigation Menu",
    description: "Use the menu to access your account settings and sign out when needed.",
    placement: "bottom",
  },
];

// ============================================
// LEGACY TOUR CONFIGURATIONS (for backward compatibility)
// ============================================

// Parent dashboard tour steps (legacy - redirects to children list)
export const parentDashboardTour: OnboardingStep[] = parentChildrenListTour;

// Parent home tour steps (legacy)
export const parentHomeTour: OnboardingStep[] = parentChildrenListTour;

// ============================================
// TOUR CONFIG GETTER
// ============================================

// Get tour config for a role and page
export function getTourConfig(role: Role, pageKey?: string): OnboardingStep[] {
  // If pageKey is provided, use page-specific tours
  if (pageKey) {
    switch (pageKey) {
      // Parent pages
      case "parent_children_list":
        return parentChildrenListTour;
      case "parent_family":
        return parentFamilyTour;
      case "parent_connections":
        return parentConnectionsTour;
      case "parent_safety":
        return parentSafetyTour;
      case "parent_referrals":
        return parentReferralsTour;
      case "parent_upgrade":
        return parentUpgradeTour;
      case "parent_devices":
        return parentDevicesTour;
      case "parent_settings":
        return parentSettingsTour;
      // Legacy parent pages (redirect to children list tour)
      case "parent_home":
      case "parent_dashboard":
        return parentChildrenListTour;
      // Child pages
      case "child_home":
        return childHomeTour;
      case "child_dashboard":
        return childDashboardTour;
      case "child_parents_list":
        return childParentsListTour;
      // Family member pages
      case "family_member_dashboard":
        return familyMemberDashboardTour;
      default:
        // Fallback to role-based tours
        if (role === "parent") return parentChildrenListTour;
        if (role === "child") return childDashboardTour;
        if (role === "family_member") return familyMemberDashboardTour;
        return parentChildrenListTour;
    }
  }
  
  // Fallback to role-based tours
  if (role === "parent") return parentChildrenListTour;
  if (role === "child") return childDashboardTour;
  if (role === "family_member") return familyMemberDashboardTour;
  return parentChildrenListTour;
}


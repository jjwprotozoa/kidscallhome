// src/pages/Upgrade/types.ts
// Purpose: Type definitions for Upgrade page

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  priceValue: number;
  interval: "month" | "year";
  kidsSupported: number | "unlimited";
  stripeLink: string;
  description: string;
  recommended?: boolean;
  allowQuantity?: boolean;
  // Native app store product IDs
  playStoreProductId?: string; // Google Play subscription ID
  appStoreProductId?: string; // Apple App Store product ID
}

export type SubscriptionTier = "free" | "additional-kid-monthly" | "additional-kid-annual" | "family-bundle-monthly" | "family-bundle-annual" | "annual-family-plan";

export type PaymentState = "idle" | "processing" | "success" | "error";

export interface SubscriptionData {
  email: string;
  allowedChildren: number;
  subscriptionType: SubscriptionTier;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  currentChildrenCount: number;
  hasActiveSubscription: boolean;
  stripeCustomerId: string | null;
}

export interface Feature {
  name: string;
  free: boolean | string;
  basic: boolean | string;
  premium: boolean | string;
}









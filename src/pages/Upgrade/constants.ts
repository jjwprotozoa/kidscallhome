// src/pages/Upgrade/constants.ts
// Purpose: Constants and configurations for Upgrade page

import { SubscriptionPlan } from "./types";

export const PLANS: SubscriptionPlan[] = [
  {
    id: "family-bundle-monthly",
    name: "Family Plan Monthly",
    price: "US$14.99",
    priceValue: 14.99,
    interval: "month",
    kidsSupported: 5,
    stripeLink: "https://buy.stripe.com/4gM3cw17hc7I1HB4Yabsc00",
    playStoreProductId: "family_bundle_monthly", // Google Play subscription ID
    appStoreProductId: "com.kidscallhome.family_bundle_monthly", // App Store subscription ID
    description: "Perfect for families with up to 5 kids",
  },
  {
    id: "family-bundle-annual",
    name: "Family Plan Annual",
    price: "US$149",
    priceValue: 149,
    interval: "year",
    kidsSupported: 5,
    stripeLink: "https://buy.stripe.com/14A28sg2b6Noeun8ambsc01",
    playStoreProductId: "family_bundle_annual", // Google Play subscription ID
    appStoreProductId: "com.kidscallhome.family_bundle_annual", // App Store subscription ID
    description: "Up to 5 kids - Save 17% vs monthly",
    recommended: true,
  },
];

export const TRIAL_PERIOD_DAYS = 0; // No trial period currently

export const DEFAULT_ALLOWED_CHILDREN = 1;

export const UNLIMITED_CHILDREN = 999;

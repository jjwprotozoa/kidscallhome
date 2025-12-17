// src/pages/Upgrade/constants.ts
// Purpose: Constants and configurations for Upgrade page

import { SubscriptionPlan } from "./types";

export const PLANS: SubscriptionPlan[] = [
  {
    id: "additional-kid-monthly",
    name: "Additional Kid Monthly",
    price: "$4.99",
    priceValue: 4.99,
    interval: "month",
    kidsSupported: 1,
    stripeLink: "https://buy.stripe.com/7sYaEX4tHdms9b9fpqfQI05",
    playStoreProductId: "additional_kid_monthly", // Google Play subscription ID
    appStoreProductId: "com.kidscallhome.additional_kid_monthly", // App Store subscription ID
    description: "Add one more child to your account",
    allowQuantity: true,
  },
  {
    id: "additional-kid-annual",
    name: "Additional Kid Annual",
    price: "$49.99",
    priceValue: 49.99,
    interval: "year",
    kidsSupported: 1,
    stripeLink: "https://buy.stripe.com/14AdR94tH0zGdrpcdefQI06",
    playStoreProductId: "additional_kid_annual", // Google Play subscription ID
    appStoreProductId: "com.kidscallhome.additional_kid_annual", // App Store subscription ID
    description: "Add one more child - Save 2 months with annual billing!",
    allowQuantity: true,
  },
  {
    id: "family-bundle-monthly",
    name: "Family Bundle Monthly",
    price: "$14.99",
    priceValue: 14.99,
    interval: "month",
    kidsSupported: 5,
    stripeLink: "https://buy.stripe.com/aFa00j8JXciogDB3GIfQI07",
    playStoreProductId: "family_bundle_monthly", // Google Play subscription ID
    appStoreProductId: "com.kidscallhome.family_bundle_monthly", // App Store subscription ID
    description: "Perfect for families with up to 5 kids",
  },
  {
    id: "family-bundle-annual",
    name: "Family Bundle Annual",
    price: "$149.99",
    priceValue: 149.99,
    interval: "year",
    kidsSupported: 5,
    stripeLink: "https://buy.stripe.com/aFa00j8JXciogDB3GIfQI07", // TODO: Update with actual Stripe link for annual plan
    playStoreProductId: "family_bundle_annual", // Google Play subscription ID
    appStoreProductId: "com.kidscallhome.family_bundle_annual", // App Store subscription ID
    description: "Up to 5 kids - Save 17% vs monthly",
  },
  {
    id: "annual-family-plan",
    name: "Annual Family Plan",
    price: "$99",
    priceValue: 99,
    interval: "year",
    kidsSupported: 10,
    stripeLink: "https://buy.stripe.com/8x24gz7FT3LS5YXgtufQI08",
    playStoreProductId: "annual_family_plan", // Google Play subscription ID
    appStoreProductId: "com.kidscallhome.annual_family_plan", // App Store subscription ID
    description:
      "Best value - up to 10 kids for the whole family. Just $8.25/month - billed annually",
    recommended: true,
  },
];

export const TRIAL_PERIOD_DAYS = 0; // No trial period currently

export const DEFAULT_ALLOWED_CHILDREN = 1;

export const UNLIMITED_CHILDREN = 999;

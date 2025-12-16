// src/pages/Upgrade/constants.ts
// Purpose: Constants and configurations for Upgrade page

import { SubscriptionPlan } from "./types";

export const PLANS: SubscriptionPlan[] = [
  {
    id: "additional-kid-monthly",
    name: "Additional Kid Monthly",
    price: "$2.99",
    priceValue: 2.99,
    interval: "month",
    kidsSupported: 1,
    stripeLink: "https://buy.stripe.com/7sYaEX4tHdms9b9fpqfQI05",
    description: "Add one more child to your account",
    allowQuantity: true,
  },
  {
    id: "additional-kid-annual",
    name: "Additional Kid Annual",
    price: "$29.99",
    priceValue: 29.99,
    interval: "year",
    kidsSupported: 1,
    stripeLink: "https://buy.stripe.com/14AdR94tH0zGdrpcdefQI06",
    description: "Add one more child (save 17% vs monthly)",
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
    description: "Perfect for families with up to 5 kids",
  },
  {
    id: "annual-family-plan",
    name: "Annual Family Plan",
    price: "$99",
    priceValue: 99,
    interval: "year",
    kidsSupported: "unlimited",
    stripeLink: "https://buy.stripe.com/8x24gz7FT3LS5YXgtufQI08",
    description: "Best value - unlimited kids for the whole family",
    recommended: true,
  },
];

export const TRIAL_PERIOD_DAYS = 0; // No trial period currently

export const DEFAULT_ALLOWED_CHILDREN = 1;

export const UNLIMITED_CHILDREN = 999;









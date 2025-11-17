// Stripe utility functions
import { loadStripe, Stripe } from "@stripe/stripe-js";

// Get Stripe publishable key from environment
// In production, this should be in your .env file
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

let stripePromise: Promise<Stripe | null> | null = null;

export const getStripe = () => {
  // Return null if Stripe key is not configured (prevents errors)
  if (!STRIPE_PUBLISHABLE_KEY) {
    console.warn("⚠️ [STRIPE] VITE_STRIPE_PUBLISHABLE_KEY is not set. Stripe features will be disabled.");
    return Promise.resolve(null);
  }
  
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};


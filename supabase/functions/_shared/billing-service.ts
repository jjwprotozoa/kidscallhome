// supabase/functions/_shared/billing-service.ts
// Purpose: Centralized billing service wrapper for Stripe operations

// Allowed price IDs (from user requirements)
export const ALLOWED_PRICE_IDS = {
  MONTHLY: "price_1SUVdqIIyqCwTeH2zggZpPAK",
  ANNUAL: "price_1SkPL7IIyqCwTeH2tI9TxHRB",
} as const;

// Product ID
export const STRIPE_PRODUCT_ID = "prod_TROQs4IwtU17Fv";

// Proration policy
export const PRORATION_POLICY = {
  // Monthly -> Annual: immediate (upgrade)
  MONTHLY_TO_ANNUAL: "immediate" as const,
  // Annual -> Monthly: next_cycle (downgrade)
  ANNUAL_TO_MONTHLY: "next_cycle" as const,
} as const;

// Validate price ID
export function isValidPriceId(priceId: string): boolean {
  return Object.values(ALLOWED_PRICE_IDS).includes(priceId as any);
}

// Get Stripe secret key based on environment
export function getStripeSecretKey(origin: string | null): string {
  const isLocalhost = origin && (
    origin.includes("localhost") || 
    origin.includes("127.0.0.1")
  );
  
  if (isLocalhost) {
    return Deno.env.get("STRIPE_SECRET_KEY_TEST") || 
           Deno.env.get("STRIPE_SECRET_KEY") || 
           "";
  }
  
  return Deno.env.get("STRIPE_SECRET_KEY_LIVE") || 
         Deno.env.get("STRIPE_SECRET_KEY") || 
         "";
}

// Get app URL from origin or environment
export function getAppUrl(origin: string | null): string {
  if (origin) {
    try {
      const url = new URL(origin);
      return url.origin;
    } catch {
      // Invalid origin, use default
    }
  }
  
  // Fallback to environment variable or default
  return Deno.env.get("APP_URL") || 
         Deno.env.get("VITE_BASE_URL") || 
         "https://www.kidscallhome.com";
}

// Determine proration mode based on price change
export function getProrationMode(
  currentPriceId: string | null,
  newPriceId: string
): "immediate" | "next_cycle" {
  if (!currentPriceId) {
    return "immediate"; // New subscription
  }
  
  // Monthly -> Annual: immediate (upgrade)
  if (currentPriceId === ALLOWED_PRICE_IDS.MONTHLY && 
      newPriceId === ALLOWED_PRICE_IDS.ANNUAL) {
    return PRORATION_POLICY.MONTHLY_TO_ANNUAL;
  }
  
  // Annual -> Monthly: next_cycle (downgrade)
  if (currentPriceId === ALLOWED_PRICE_IDS.ANNUAL && 
      newPriceId === ALLOWED_PRICE_IDS.MONTHLY) {
    return PRORATION_POLICY.ANNUAL_TO_MONTHLY;
  }
  
  // Default to immediate for same-tier changes
  return "immediate";
}



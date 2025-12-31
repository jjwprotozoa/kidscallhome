// supabase/functions/stripe-change-subscription/index.ts
// Purpose: Modify subscription price (upgrade/downgrade) with proration control

/// <reference types="../deno.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripeApiUrl = "https://api.stripe.com/v1";

// Allowed price IDs
const ALLOWED_PRICE_IDS = {
  MONTHLY: "price_1SUVdqIIyqCwTeH2zggZpPAK",
  ANNUAL: "price_1SkPL7IIyqCwTeH2tI9TxHRB",
} as const;

// Validate price ID
function isValidPriceId(priceId: string): boolean {
  return Object.values(ALLOWED_PRICE_IDS).includes(priceId as any);
}

// Get Stripe secret key based on environment
function getStripeSecretKey(origin: string | null): string {
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

// Determine proration mode based on price change
function getProrationMode(
  currentPriceId: string | null,
  newPriceId: string
): "immediate" | "next_cycle" {
  if (!currentPriceId) {
    return "immediate"; // New subscription
  }
  
  // Monthly -> Annual: immediate (upgrade)
  if (currentPriceId === ALLOWED_PRICE_IDS.MONTHLY && 
      newPriceId === ALLOWED_PRICE_IDS.ANNUAL) {
    return "immediate";
  }
  
  // Annual -> Monthly: next_cycle (downgrade)
  if (currentPriceId === ALLOWED_PRICE_IDS.ANNUAL && 
      newPriceId === ALLOWED_PRICE_IDS.MONTHLY) {
    return "next_cycle";
  }
  
  // Default to immediate for same-tier changes
  return "immediate";
}

// Allowed origins for CORS
const allowedOrigins = [
  "https://www.kidscallhome.com",
  "https://kidscallhome.com",
  "http://localhost:8080",
  "http://localhost:5173",
];

// Pattern-based origin matching (for Vercel deployments, etc.)
const allowedOriginPatterns = [
  /^https:\/\/.*\.vercel\.app$/, // Vercel deployment URLs
];

// Helper function to check if origin is allowed (exact match or pattern match)
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  
  // Check exact matches first
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  
  // Check pattern matches
  return allowedOriginPatterns.some(pattern => pattern.test(origin));
}

// Helper function to get CORS headers
function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };

  if (origin && isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

// Helper function to validate Content-Type
function validateContentType(req: Request): boolean {
  const contentType = req.headers.get("content-type");
  return contentType?.includes("application/json") || false;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: Validate Content-Type for POST requests
  if (req.method === "POST" && !validateContentType(req)) {
    return new Response(
      JSON.stringify({
        error: "Invalid Content-Type. Expected application/json",
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Parse request body
    const { newPriceId, prorationMode } = await req.json();

    // Validate newPriceId
    if (!newPriceId || typeof newPriceId !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid newPriceId" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!isValidPriceId(newPriceId)) {
      return new Response(
        JSON.stringify({ error: "Invalid price ID" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate prorationMode if provided
    if (prorationMode && !["immediate", "next_cycle"].includes(prorationMode)) {
      return new Response(
        JSON.stringify({
          error: "Invalid prorationMode. Must be 'immediate' or 'next_cycle'",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Load subscription from database
    const { data: subscription, error: subError } = await supabaseClient
      .from("billing_subscriptions")
      .select("stripe_subscription_id, stripe_price_id")
      .eq("user_id", user.id)
      .single();

    if (subError || !subscription?.stripe_subscription_id) {
      return new Response(
        JSON.stringify({
          error: "No active subscription found",
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Get Stripe secret key
    const stripeSecretKey = getStripeSecretKey(origin);
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({
          error: "Payment processing is not configured",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Determine proration mode
    const effectiveProrationMode =
      prorationMode ||
      getProrationMode(subscription.stripe_price_id, newPriceId);

    // Fetch subscription from Stripe to get subscription_item_id
    const subscriptionResponse = await fetch(
      `${stripeApiUrl}/subscriptions/${subscription.stripe_subscription_id}?expand[]=items.data`,
      {
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
        },
      }
    );

    if (!subscriptionResponse.ok) {
      const error = await subscriptionResponse.json();
      console.error("Failed to fetch subscription:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch subscription details",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const stripeSubscription = await subscriptionResponse.json();

    if (
      !stripeSubscription.items?.data ||
      stripeSubscription.items.data.length === 0
    ) {
      return new Response(
        JSON.stringify({
          error: "Subscription has no items",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const subscriptionItemId = stripeSubscription.items.data[0].id;

    // Prepare update parameters
    const updateParams = new URLSearchParams({
      "items[0][id]": subscriptionItemId,
      "items[0][price]": newPriceId,
    });

    // Handle proration behavior
    if (effectiveProrationMode === "immediate") {
      // Bill immediately with proration
      updateParams.append("proration_behavior", "always_invoice");
    } else {
      // For "next_cycle", use Subscription Schedule to apply at period end
      // First, update with no proration
      updateParams.append("proration_behavior", "none");
      
      // Create a subscription schedule to apply the change at period end
      const scheduleParams = new URLSearchParams({
        subscription: subscription.stripe_subscription_id,
        "phases[0][items][0][price]": newPriceId,
        "phases[0][items][0][quantity]": "1",
        "phases[0][start_date]": stripeSubscription.current_period_end.toString(),
      });

      const scheduleResponse = await fetch(
        `${stripeApiUrl}/subscription_schedules`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: scheduleParams,
        }
      );

      if (scheduleResponse.ok) {
        // Schedule created successfully, return early
        const schedule = await scheduleResponse.json();
        return new Response(
          JSON.stringify({
            success: true,
            message: "Subscription change scheduled for next billing cycle",
            scheduleId: schedule.id,
            effectiveDate: new Date(
              stripeSubscription.current_period_end * 1000
            ).toISOString(),
          }),
          { status: 200, headers: corsHeaders }
        );
      } else {
        // If schedule creation fails, fall back to immediate update
        console.warn("Failed to create subscription schedule, using immediate update");
        updateParams.set("proration_behavior", "always_invoice");
      }
    }

    // Update subscription item
    const updateResponse = await fetch(
      `${stripeApiUrl}/subscriptions/${subscription.stripe_subscription_id}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: updateParams,
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      console.error("Failed to update subscription:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to update subscription",
          details: error.error?.message || "Unknown error",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const updatedSubscription = await updateResponse.json();

    // Return updated subscription summary
    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId: updatedSubscription.id,
        priceId: newPriceId,
        status: updatedSubscription.status,
        currentPeriodEnd: new Date(
          updatedSubscription.current_period_end * 1000
        ).toISOString(),
        prorationMode: effectiveProrationMode,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Subscription change error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: getCorsHeaders(req.headers.get("origin")),
      }
    );
  }
});


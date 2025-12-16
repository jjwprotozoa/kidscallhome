// Supabase Edge Function: Create Stripe Subscription
// Purpose: Create a Stripe subscription for a user

/// <reference types="../deno.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const stripeApiUrl = "https://api.stripe.com/v1";

// Allowed origins for CORS
const allowedOrigins = [
  "https://www.kidscallhome.com",
  "https://kidscallhome.com",
  "http://localhost:8080", // Development only
  "http://localhost:5173", // Development only
];

// Stripe Price IDs - Replace with your actual Stripe Price IDs
const STRIPE_PRICE_IDS = {
  "additional-kid-monthly":
    Deno.env.get("STRIPE_PRICE_ADDITIONAL_KID_MONTHLY") || "",
  "additional-kid-annual":
    Deno.env.get("STRIPE_PRICE_ADDITIONAL_KID_ANNUAL") || "",
  "family-bundle-monthly":
    Deno.env.get("STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY") || "",
  "annual-family-plan": Deno.env.get("STRIPE_PRICE_ANNUAL_FAMILY_PLAN") || "",
};

// Helper function to get CORS headers
function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

// Helper function to validate redirect URL
function validateRedirectUrl(url: string | null): string {
  if (!url) {
    return "http://localhost:8080"; // Default for development
  }

  // Validate URL is from allowed origins
  try {
    const urlObj = new URL(url);
    const origin = urlObj.origin;

    if (allowedOrigins.includes(origin)) {
      return origin;
    }
  } catch {
    // Invalid URL format
  }

  // Fallback to default if invalid
  return "http://localhost:8080";
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
        { status: 401, headers: { "Content-Type": "application/json" } }
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
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { subscriptionType, quantity = 1 } = await req.json();

    // Validate subscription type
    if (
      !subscriptionType ||
      !STRIPE_PRICE_IDS[subscriptionType as keyof typeof STRIPE_PRICE_IDS]
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid subscription type" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate quantity parameter (prevent resource exhaustion)
    const quantityNum = Number.parseInt(String(quantity), 10);
    if (!Number.isInteger(quantityNum) || quantityNum < 1 || quantityNum > 10) {
      return new Response(
        JSON.stringify({
          error: "Invalid quantity. Must be between 1 and 10.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const priceId =
      STRIPE_PRICE_IDS[subscriptionType as keyof typeof STRIPE_PRICE_IDS];
    if (!priceId) {
      return new Response(
        JSON.stringify({
          error: "Stripe price ID not configured for this plan",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get parent data
    const { data: parentData, error: parentError } = await supabaseClient
      .from("parents")
      .select("email, stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (parentError || !parentData) {
      return new Response(
        JSON.stringify({ error: "Parent account not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    let stripeCustomerId = parentData.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!stripeCustomerId) {
      const customerResponse = await fetch(`${stripeApiUrl}/customers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          email: parentData.email,
          metadata: JSON.stringify({ parent_id: user.id }),
        }),
      });

      if (!customerResponse.ok) {
        // Log detailed error server-side only
        const error = await customerResponse.json();
        console.error("Stripe customer creation failed:", error);
        // Return generic error to prevent information leakage
        return new Response(
          JSON.stringify({
            error: "Payment processing failed. Please try again.",
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      const customer = await customerResponse.json();
      stripeCustomerId = customer.id;

      // Save customer ID to database
      await supabaseClient
        .from("parents")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", user.id);
    }

    // Create Stripe Checkout Session for subscription (recommended approach)
    // Validate and sanitize return URL to prevent open redirect
    const validatedOrigin = validateRedirectUrl(origin);

    const checkoutParams = new URLSearchParams({
      customer: stripeCustomerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": quantityNum.toString(),
      mode: "subscription",
      success_url: `${validatedOrigin}/parent/upgrade?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${validatedOrigin}/parent/upgrade?canceled=true`,
      metadata: JSON.stringify({
        parent_id: user.id,
        subscription_type: subscriptionType,
      }),
      subscription_data: JSON.stringify({
        metadata: {
          parent_id: user.id,
          subscription_type: subscriptionType,
        },
      }),
    });

    const checkoutResponse = await fetch(`${stripeApiUrl}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: checkoutParams,
    });

    if (!checkoutResponse.ok) {
      // Log detailed error server-side only
      const error = await checkoutResponse.json();
      console.error("Stripe checkout session creation failed:", error);
      // Return generic error to prevent information leakage
      return new Response(
        JSON.stringify({
          error: "Payment processing failed. Please try again.",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const checkoutSession = await checkoutResponse.json();

    // Return checkout session URL for frontend to redirect
    return new Response(
      JSON.stringify({
        success: true,
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
        customerId: stripeCustomerId,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    // Log detailed error server-side only
    console.error("Subscription creation error:", error);
    // Return generic error to prevent information leakage
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: getCorsHeaders(req.headers.get("origin")),
    });
  }
});

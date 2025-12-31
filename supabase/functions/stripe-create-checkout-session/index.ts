// supabase/functions/stripe-create-checkout-session/index.ts
// Purpose: Create Stripe Checkout Session for subscription signup

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

// Get app URL from origin or environment
function getAppUrl(origin: string | null): string {
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

// Allowed origins for CORS
const allowedOrigins = [
  "https://www.kidscallhome.com",
  "https://kidscallhome.com",
  "http://localhost:8080",
  "http://localhost:5173",
];

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
    const { priceId } = await req.json();

    // Validate priceId
    if (!priceId || typeof priceId !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid priceId" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!isValidPriceId(priceId)) {
      return new Response(
        JSON.stringify({ error: "Invalid price ID" }),
        { status: 400, headers: corsHeaders }
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

    // Get app URL
    const appUrl = getAppUrl(origin);

    // Create Stripe Checkout Session
    const checkoutParams = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      client_reference_id: user.id,
      "metadata[user_id]": user.id,
      success_url: `${appUrl}/parent/upgrade?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/parent/upgrade?canceled=1`,
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
      const error = await checkoutResponse.json();
      console.error("Stripe checkout session creation failed:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to create checkout session",
          details: error.error?.message || "Unknown error",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const checkoutSession = await checkoutResponse.json();

    return new Response(
      JSON.stringify({ 
        success: true,
        url: checkoutSession.url 
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("Checkout session creation error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: getCorsHeaders(req.headers.get("origin")),
      }
    );
  }
});


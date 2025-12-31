// supabase/functions/stripe-create-portal-session/index.ts
// Purpose: Create Stripe Customer Portal session for subscription management

/// <reference types="../deno.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripeApiUrl = "https://api.stripe.com/v1";

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

    // Lookup stripe_customer_id from billing_subscriptions
    const { data: subscription, error: subError } = await supabaseClient
      .from("billing_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (subError || !subscription?.stripe_customer_id) {
      return new Response(
        JSON.stringify({
          error: "No active subscription found. Please subscribe first.",
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

    // Get app URL
    const appUrl = getAppUrl(origin);

    // Create Stripe Billing Portal session
    const portalParams = new URLSearchParams({
      customer: subscription.stripe_customer_id,
      return_url: `${appUrl}/parent/upgrade`,
    });

    const portalResponse = await fetch(
      `${stripeApiUrl}/billing_portal/sessions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: portalParams,
      }
    );

    if (!portalResponse.ok) {
      const error = await portalResponse.json();
      console.error("Stripe portal session creation failed:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to create portal session",
          details: error.error?.message || "Unknown error",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const portalSession = await portalResponse.json();

    return new Response(
      JSON.stringify({ url: portalSession.url }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("Portal session creation error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: getCorsHeaders(req.headers.get("origin")),
      }
    );
  }
});


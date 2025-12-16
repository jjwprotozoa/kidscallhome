// Supabase Edge Function: Create Stripe Customer Portal Session
// Purpose: Generate a Stripe Customer Portal session for subscription management

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
function validateRedirectUrl(
  url: string | null,
  defaultOrigin: string
): string {
  if (!url) {
    return defaultOrigin;
  }

  // Validate URL is from allowed origins
  try {
    const urlObj = new URL(url);
    const urlOrigin = urlObj.origin;

    if (allowedOrigins.includes(urlOrigin)) {
      return url;
    }
  } catch {
    // Invalid URL format
  }

  // Fallback to default if invalid
  return defaultOrigin;
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

    // Get parent's Stripe customer ID
    const { data: parentData, error: parentError } = await supabaseClient
      .from("parents")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (parentError || !parentData?.stripe_customer_id) {
      return new Response(
        JSON.stringify({
          error: "No Stripe customer found. Please subscribe first.",
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Get return URL from request and validate it
    const { returnUrl } = await req.json();
    const defaultOrigin = origin || "http://localhost:8080";
    const defaultReturnUrl = `${defaultOrigin}/parent/settings`;
    const validatedReturnUrl = validateRedirectUrl(returnUrl, defaultReturnUrl);

    // Create Customer Portal session
    const portalParams = new URLSearchParams({
      customer: parentData.stripe_customer_id,
      return_url: validatedReturnUrl,
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
      // Log detailed error server-side only
      const error = await portalResponse.json();
      console.error("Stripe portal session creation failed:", error);
      // Return generic error to prevent information leakage
      return new Response(
        JSON.stringify({
          error: "Failed to create portal session. Please try again.",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const portalSession = await portalResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        url: portalSession.url,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    // Log detailed error server-side only
    console.error("Portal session creation error:", error);
    // Return generic error to prevent information leakage
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: getCorsHeaders(req.headers.get("origin")),
    });
  }
});

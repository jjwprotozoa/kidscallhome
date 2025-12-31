// Supabase Edge Function: Create Stripe Customer Portal Session
// Purpose: Generate a Stripe Customer Portal session for subscription management
// Path: supabase/functions/create-customer-portal-session/index.ts

/// <reference types="../deno.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripeApiUrl = "https://api.stripe.com/v1";

// Localhost origins (use TEST mode)
const localhostOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:5173",
];

// Helper function to detect if request is from localhost (test mode)
function isTestMode(origin: string | null): boolean {
  if (!origin) return false;
  return localhostOrigins.includes(origin);
}

// Function to get the correct Stripe secret key based on environment
function getStripeSecretKey(origin: string | null): string {
  if (isTestMode(origin)) {
    // Use test mode key for localhost
    return Deno.env.get("STRIPE_SECRET_KEY_TEST") || Deno.env.get("STRIPE_SECRET_KEY") || "";
  }
  // Use live mode key for production
  return Deno.env.get("STRIPE_SECRET_KEY_LIVE") || Deno.env.get("STRIPE_SECRET_KEY") || "";
}

// Validate required environment variables at startup
const defaultStripeKey = Deno.env.get("STRIPE_SECRET_KEY");
if (!defaultStripeKey || defaultStripeKey.trim() === "") {
  console.error("ERROR: STRIPE_SECRET_KEY environment variable is not set!");
  console.error("For localhost testing, you can also set STRIPE_SECRET_KEY_TEST");
  console.error("For production, you can also set STRIPE_SECRET_KEY_LIVE");
}

// Allowed origins for CORS
const allowedOrigins = [
  "https://www.kidscallhome.com",
  "https://kidscallhome.com",
  ...localhostOrigins, // Include all localhost variants
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

    if (isOriginAllowed(urlOrigin)) {
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

// Type for Stripe error responses
type StripeErrorResponse = {
  error?: {
    message?: string;
    type?: string;
  };
  message?: string;
  type?: string;
};

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

    // Get authenticated user (the logged-in parent)
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

    // Get the logged-in user's Stripe customer ID from billing_subscriptions
    const { data: billingSub, error: billingError } = await supabaseClient
      .from("billing_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (billingError) {
      console.error("Error fetching billing subscription:", billingError);
      return new Response(
        JSON.stringify({
          error: "Unable to retrieve account information. Please try again.",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!billingSub?.stripe_customer_id) {
      return new Response(
        JSON.stringify({
          error: "No active subscription found. Please subscribe first.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get environment-specific Stripe configuration
    const stripeSecretKey = getStripeSecretKey(origin);
    const isLocalhost = isTestMode(origin);
    
    // Log which mode we're using (for debugging)
    console.warn(`Using ${isLocalhost ? "TEST" : "LIVE"} mode Stripe configuration (origin: ${origin})`);
    
    // Validate Stripe secret key is configured
    if (!stripeSecretKey || stripeSecretKey.trim() === "") {
      const mode = isLocalhost ? "TEST" : "LIVE";
      console.error(`ERROR: STRIPE_SECRET_KEY${isLocalhost ? "_TEST" : "_LIVE"} is not configured!`);
      return new Response(
        JSON.stringify({
          error: "Payment processing is not configured. Please contact support.",
          details: `STRIPE_SECRET_KEY${isLocalhost ? "_TEST" : "_LIVE"} environment variable is missing for ${mode} mode`,
        }),
        { status: 500, headers: corsHeaders }
      );
    }
    
    // Detect Stripe key mode (test vs live) for validation
    const isTestKey = stripeSecretKey.startsWith("sk_test_");
    const isLiveKey = stripeSecretKey.startsWith("sk_live_");
    
    // Warn if key mode doesn't match environment
    if (isLocalhost && !isTestKey) {
      console.warn("WARNING: Using localhost (test mode) but Stripe key appears to be LIVE mode");
    }
    if (!isLocalhost && !isLiveKey) {
      console.warn("WARNING: Using production (live mode) but Stripe key appears to be TEST mode");
    }

    // Get return URL from request and validate it
    let returnUrl: string | null = null;
    try {
      const requestBody = await req.json();
      returnUrl = requestBody?.returnUrl || null;
    } catch (parseError) {
      // If JSON parsing fails, use default
      console.warn("Failed to parse request body, using default return URL:", parseError);
    }
    
    const defaultOrigin = origin || "http://localhost:8080";
    const defaultReturnUrl = `${defaultOrigin}/parent/upgrade`;
    const validatedReturnUrl = validateRedirectUrl(returnUrl, defaultReturnUrl);

    // Validate return URL is a proper URL
    try {
      new URL(validatedReturnUrl);
    } catch (urlError) {
      return new Response(
        JSON.stringify({
          error: "Invalid return URL format.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Create Customer Portal session
    const portalParams = new URLSearchParams({
      customer: billingSub.stripe_customer_id,
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
      let stripeError: StripeErrorResponse = {};
      try {
        stripeError = (await portalResponse.json()) as StripeErrorResponse;
      } catch (e) {
        const errorText = await portalResponse.text();
        stripeError = { error: { message: errorText || "Unknown error" } };
      }
      
      console.error("Stripe portal session creation failed:", JSON.stringify(stripeError, null, 2));
      
      // Return the actual Stripe error message for debugging (safely)
      const errorMessage = stripeError?.error?.message || stripeError?.message || "Failed to create portal session";
      
      // Common Stripe billing portal errors:
      // - "This customer has no subscriptions" - customer needs a subscription first
      // - "No such customer" - customer ID doesn't exist
      // - "Billing portal not configured" - needs setup in Stripe Dashboard
      
      return new Response(
        JSON.stringify({
          error: errorMessage,
          details: stripeError?.error?.type || stripeError?.type || "billing_portal_error",
        }),
        { 
          status: portalResponse.status, // Preserve Stripe's status code (400, 404, etc.)
          headers: corsHeaders 
        }
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

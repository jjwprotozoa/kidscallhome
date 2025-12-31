// Supabase Edge Function: Create Stripe Subscription
// Purpose: Create a Stripe subscription for a user

/// <reference types="../deno.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Stripe API Configuration
// Supports both TEST and LIVE modes based on request origin
const stripeApiUrl = "https://api.stripe.com/v1";

// Allowed origins for CORS
const allowedOrigins = [
  "https://www.kidscallhome.com",
  "https://kidscallhome.com",
  "http://localhost:8080", // Development only
  "http://localhost:5173", // Development only
];

// Localhost origins (use TEST mode)
const localhostOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
];

// Helper function to detect if request is from localhost (test mode)
function isTestMode(origin: string | null): boolean {
  if (!origin) return false;
  return localhostOrigins.includes(origin);
}

// Stripe Price IDs Configuration
// TEST mode (localhost) - Use test mode Price IDs
const STRIPE_PRICE_IDS_TEST = {
  "family-bundle-monthly": "price_1SjULhIIyqCwTeH2GmBL1jVk", // Test mode monthly
  "family-bundle-annual": "price_1SkQUaIIyqCwTeH2QowSbcfb", // Test mode annual (prod_Tgs5NIzPSgWahP)
};

// LIVE mode (production) - Use live mode Price IDs from environment variables
const STRIPE_PRICE_IDS_LIVE = {
  "family-bundle-monthly":
    Deno.env.get("STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY") || "",
  "family-bundle-annual":
    Deno.env.get("STRIPE_PRICE_FAMILY_BUNDLE_ANNUAL") || "",
};

// Function to get the correct Price IDs based on environment
function getStripePriceIds(origin: string | null) {
  if (isTestMode(origin)) {
    return STRIPE_PRICE_IDS_TEST;
  }
  return STRIPE_PRICE_IDS_LIVE;
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
    // Get environment-specific Stripe configuration
    const stripeSecretKey = getStripeSecretKey(origin);
    const stripePriceIds = getStripePriceIds(origin);
    const isLocalhost = isTestMode(origin);
    
    // Log which mode we're using (for debugging)
    console.error(`Using ${isLocalhost ? "TEST" : "LIVE"} mode Stripe configuration (origin: ${origin})`);
    
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
      !stripePriceIds[subscriptionType as keyof typeof stripePriceIds]
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
      stripePriceIds[subscriptionType as keyof typeof stripePriceIds];
    if (!priceId || priceId.trim() === "") {
      const mode = isLocalhost ? "TEST" : "LIVE";
      const envVarName = subscriptionType === "family-bundle-monthly" 
        ? "STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY"
        : "STRIPE_PRICE_FAMILY_BUNDLE_ANNUAL";
      return new Response(
        JSON.stringify({
          error: `Stripe price ID not configured for ${mode} mode.`,
          details: `Subscription type: ${subscriptionType}, Mode: ${mode}, Missing price ID for ${mode} mode. For localhost, test mode Price IDs are hardcoded. For production, set environment variable: ${envVarName}`,
        }),
        { status: 500, headers: corsHeaders }
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
    let existingSubscription = null;

    // Check if customer already has an active subscription
    if (stripeCustomerId) {
      const subscriptionsResponse = await fetch(
        `${stripeApiUrl}/subscriptions?customer=${stripeCustomerId}&status=active`,
        {
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
          },
        }
      );

      if (subscriptionsResponse.ok) {
        const subscriptionsData = await subscriptionsResponse.json();
        if (subscriptionsData.data && subscriptionsData.data.length > 0) {
          const subscriptionId = subscriptionsData.data[0].id;
          
          // Fetch full subscription details with expanded items
          const fullSubscriptionResponse = await fetch(
            `${stripeApiUrl}/subscriptions/${subscriptionId}?expand[]=items.data.price`,
            {
              headers: {
                Authorization: `Bearer ${stripeSecretKey}`,
              },
            }
          );
          
          if (fullSubscriptionResponse.ok) {
            existingSubscription = await fullSubscriptionResponse.json();
            
            // Check if user is trying to subscribe to the same plan
            const currentPriceId = existingSubscription.items?.data?.[0]?.price?.id;
            if (currentPriceId === priceId) {
              // User already has this exact plan - redirect to Customer Portal
              return new Response(
                JSON.stringify({
                  success: false,
                  error: "You are already subscribed to this plan. Please use the Customer Portal to manage your subscription.",
                  hasExistingSubscription: true,
                  redirectToPortal: true,
                }),
                { status: 400, headers: corsHeaders }
              );
            }
            
            // User has a different plan - allow upgrade/downgrade
          } else {
            const errorText = await fullSubscriptionResponse.text();
            console.error("Failed to fetch full subscription details:", errorText);
            // If we can't fetch full details, we can't safely update the subscription
            // Fall back to checkout session creation (which will handle it via webhooks)
            existingSubscription = null;
          }
        }
      } else {
        const errorText = await subscriptionsResponse.text();
        console.error("Failed to fetch subscriptions:", errorText);
        // If we can't fetch subscriptions, continue with checkout session creation
      }
    }

    // Create Stripe customer if doesn't exist
    if (!stripeCustomerId) {
      // Stripe requires metadata as individual key-value pairs, not JSON string
      const customerParams = new URLSearchParams({
        email: parentData.email,
        "metadata[parent_id]": user.id,
      });
      
      const customerResponse = await fetch(`${stripeApiUrl}/customers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: customerParams,
      });

      if (!customerResponse.ok) {
        // Log detailed error server-side only
        const error = await customerResponse.json();
        console.error("Stripe customer creation failed:", JSON.stringify(error, null, 2));
        
        // Return detailed error for debugging
        const stripeError = error.error || error;
        const errorCode = stripeError?.code || stripeError?.type || "unknown";
        const errorMessage = stripeError?.message || stripeError?.param || "Unknown error";
        
        return new Response(
          JSON.stringify({
            error: "Payment processing failed. Please try again.",
            details: `Customer creation failed: ${errorCode}: ${errorMessage}`,
            stripeErrorCode: errorCode,
            stripeErrorMessage: errorMessage,
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

    // Handle existing subscription upgrades/downgrades
    if (existingSubscription) {
      // Update existing subscription instead of creating a new one
      const subscriptionId = existingSubscription.id;
      
      // Validate subscription has items
      if (!existingSubscription.items || !existingSubscription.items.data || existingSubscription.items.data.length === 0) {
        console.error("Subscription has no items:", existingSubscription);
        return new Response(
          JSON.stringify({
            error: "Invalid subscription structure. Please contact support.",
            details: "Subscription exists but has no items",
          }),
          { status: 500, headers: corsHeaders }
        );
      }
      
      const currentItemId = existingSubscription.items.data[0].id;
      
      // Stripe requires metadata as individual key-value pairs for form-encoded requests
      const updateParams = new URLSearchParams({
        "items[0][id]": currentItemId,
        "items[0][price]": priceId,
        "items[0][quantity]": quantityNum.toString(),
        proration_behavior: "always_invoice", // Prorate the upgrade/downgrade
        "metadata[parent_id]": user.id,
        "metadata[subscription_type]": subscriptionType,
      });

      const updateResponse = await fetch(
        `${stripeApiUrl}/subscriptions/${subscriptionId}`,
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
        console.error("Stripe subscription update failed:", JSON.stringify(error, null, 2));
        
        const stripeError = error.error || error;
        const errorCode = stripeError?.code || stripeError?.type || "unknown";
        const errorMessage = stripeError?.message || stripeError?.param || "Unknown error";
        
        // If update fails due to payment method issues, try creating a checkout session instead
        if (errorCode === "payment_method_required" || 
            stripeError?.type === "card_error" ||
            errorCode === "subscription_update_invalid") {
          // Fall back to checkout session for payment method collection
          console.error("Subscription update requires payment method, creating checkout session instead");
          // Continue to checkout session creation below
        } else {
          return new Response(
            JSON.stringify({
              error: "Failed to update subscription. Please try again or contact support.",
              details: `Subscription update failed: ${errorCode}: ${errorMessage}`,
              stripeErrorCode: errorCode,
              stripeErrorMessage: errorMessage,
            }),
            { status: 500, headers: corsHeaders }
          );
        }
      } else {
        // Update successful
        const updatedSubscription = await updateResponse.json();

        // Update database immediately with new subscription type
        // Map subscription type to allowed children
        const allowedChildren = subscriptionType === "family-bundle-monthly" || subscriptionType === "family-bundle-annual" 
          ? 5 
          : 1;

        // Update parent record with new subscription details
        const { error: updateError } = await supabaseClient
          .from("parents")
          .update({
            subscription_type: subscriptionType,
            allowed_children: allowedChildren,
            subscription_status: "active",
            subscription_expires_at: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
            stripe_subscription_id: updatedSubscription.id,
          })
          .eq("id", user.id);

        if (updateError) {
          console.error("Error updating database after subscription update:", updateError);
          // Still return success since Stripe update worked, webhook will sync later
        } else {
          console.error("Database updated successfully with new subscription type:", subscriptionType);
        }

        // Return success - subscription updated, no redirect needed
        return new Response(
          JSON.stringify({
            success: true,
            subscriptionId: updatedSubscription.id,
            message: "Subscription updated successfully",
            // For upgrades, we can redirect to a success page or return to upgrade page
            url: `${validateRedirectUrl(origin)}/parent/upgrade?upgraded=true`,
          }),
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      }
    }

    // Create Stripe Checkout Session for new subscription or fallback for existing subscription
    // Validate and sanitize return URL to prevent open redirect
    const validatedOrigin = validateRedirectUrl(origin);

    // Stripe requires metadata as individual key-value pairs for form-encoded requests
    const checkoutParams = new URLSearchParams({
      customer: stripeCustomerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": quantityNum.toString(),
      mode: "subscription",
      locale: "auto", // Auto-detect browser language, prevents locale module errors
      success_url: `${validatedOrigin}/parent/upgrade?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${validatedOrigin}/parent/upgrade?canceled=1`,
      client_reference_id: user.id, // This is the primary way to identify the user
      "metadata[user_id]": user.id, // Also set in metadata for webhook
      "metadata[parent_id]": user.id, // Keep for backward compatibility
      "metadata[subscription_type]": subscriptionType,
      // subscription_data.metadata also needs to be individual fields
      "subscription_data[metadata][user_id]": user.id,
      "subscription_data[metadata][parent_id]": user.id,
      "subscription_data[metadata][subscription_type]": subscriptionType,
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
      console.error("Stripe checkout session creation failed:", JSON.stringify(error, null, 2));
      
      // Return detailed error for debugging
      const stripeError = error.error || error;
      const errorCode = stripeError?.code || stripeError?.type || "unknown";
      const errorMessage = stripeError?.message || stripeError?.param || "Unknown error";
      
      // Detect mode mismatch (test key with live price or vice versa)
      const isTestKey = stripeSecretKey.startsWith("sk_test_");
      let enhancedMessage = errorMessage;
      if (errorCode === "resource_missing" && errorMessage.includes("similar object exists in")) {
        if (isTestKey && errorMessage.includes("live mode")) {
          enhancedMessage = `${errorMessage} - You're using a TEST mode Stripe key but a LIVE mode Price ID. For localhost, test mode Price IDs are automatically used. For production, ensure you're using LIVE mode Price IDs.`;
        } else if (!isTestKey && errorMessage.includes("test mode")) {
          enhancedMessage = `${errorMessage} - You're using a LIVE mode Stripe key but a TEST mode Price ID. For production, ensure you're using LIVE mode Price IDs from your Stripe Dashboard (Live Mode).`;
        }
      }
      
      return new Response(
        JSON.stringify({
          error: "Payment processing failed. Please try again.",
          details: `${errorCode}: ${enhancedMessage}`,
          stripeErrorCode: errorCode,
          stripeErrorMessage: enhancedMessage,
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
    
    // Extract error message safely
    let errorMessage = "Internal server error";
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error("Error details:", errorMessage);
    }
    
    // Return error with details (safe to expose as it's our own error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error)
      }), 
      {
        status: 500,
        headers: getCorsHeaders(req.headers.get("origin")),
      }
    );
  }
});

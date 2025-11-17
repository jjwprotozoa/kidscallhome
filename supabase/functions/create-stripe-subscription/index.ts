// Supabase Edge Function: Create Stripe Subscription
// Purpose: Create a Stripe subscription for a user

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const stripeApiUrl = "https://api.stripe.com/v1";

// Stripe Price IDs - Replace with your actual Stripe Price IDs
const STRIPE_PRICE_IDS = {
  "additional-kid-monthly": Deno.env.get("STRIPE_PRICE_ADDITIONAL_KID_MONTHLY") || "",
  "additional-kid-annual": Deno.env.get("STRIPE_PRICE_ADDITIONAL_KID_ANNUAL") || "",
  "family-bundle-monthly": Deno.env.get("STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY") || "",
  "annual-family-plan": Deno.env.get("STRIPE_PRICE_ANNUAL_FAMILY_PLAN") || "",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
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
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { subscriptionType, quantity = 1 } = await req.json();

    if (!subscriptionType || !STRIPE_PRICE_IDS[subscriptionType as keyof typeof STRIPE_PRICE_IDS]) {
      return new Response(
        JSON.stringify({ error: "Invalid subscription type" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const priceId = STRIPE_PRICE_IDS[subscriptionType as keyof typeof STRIPE_PRICE_IDS];
    if (!priceId) {
      return new Response(
        JSON.stringify({ error: "Stripe price ID not configured for this plan" }),
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
          "Authorization": `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          email: parentData.email,
          metadata: JSON.stringify({ parent_id: user.id }),
        }),
      });

      if (!customerResponse.ok) {
        const error = await customerResponse.json();
        return new Response(
          JSON.stringify({ error: "Failed to create Stripe customer", details: error }),
          { status: 500, headers: { "Content-Type": "application/json" } }
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
    const returnUrl = req.headers.get("origin") || "http://localhost:8080";
    
    const checkoutParams = new URLSearchParams({
      customer: stripeCustomerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": quantity.toString(),
      mode: "subscription",
      success_url: `${returnUrl}/parent/upgrade?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}/parent/upgrade?canceled=true`,
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
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: checkoutParams,
    });

    if (!checkoutResponse.ok) {
      const error = await checkoutResponse.json();
      return new Response(
        JSON.stringify({ error: "Failed to create Stripe checkout session", details: error }),
        { status: 500, headers: { "Content-Type": "application/json" } }
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
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});


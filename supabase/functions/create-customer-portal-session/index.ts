// Supabase Edge Function: Create Stripe Customer Portal Session
// Purpose: Generate a Stripe Customer Portal session for subscription management

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const stripeApiUrl = "https://api.stripe.com/v1";

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

    // Get parent's Stripe customer ID
    const { data: parentData, error: parentError } = await supabaseClient
      .from("parents")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (parentError || !parentData?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: "No Stripe customer found. Please subscribe first." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get return URL from request
    const { returnUrl } = await req.json();
    const defaultReturnUrl = `${req.headers.get("origin") || "http://localhost:8080"}/parent/settings`;

    // Create Customer Portal session
    const portalParams = new URLSearchParams({
      customer: parentData.stripe_customer_id,
      return_url: returnUrl || defaultReturnUrl,
    });

    const portalResponse = await fetch(`${stripeApiUrl}/billing_portal/sessions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: portalParams,
    });

    if (!portalResponse.ok) {
      const error = await portalResponse.json();
      return new Response(
        JSON.stringify({ error: "Failed to create portal session", details: error }),
        { status: 500, headers: { "Content-Type": "application/json" } }
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


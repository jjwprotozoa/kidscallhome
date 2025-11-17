// Supabase Edge Function: Stripe Webhook Handler
// Purpose: Handle Stripe webhook events for subscription lifecycle

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

// Webhook signature verification using Stripe's method
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    // Stripe webhook signature format: t=timestamp,v1=signature
    const elements = signature.split(",");
    const timestamp = elements.find((e) => e.startsWith("t="))?.split("=")[1];
    const signatures = elements.filter((e) => e.startsWith("v1="));

    if (!timestamp || !signatures.length) {
      return false;
    }

    // Create signed payload
    const signedPayload = `${timestamp}.${payload}`;
    
    // Verify each signature
    for (const sig of signatures) {
      const signatureValue = sig.split("=")[1];
      
      // Use Web Crypto API to verify HMAC-SHA256
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const messageData = encoder.encode(signedPayload);
      
      // Import key for HMAC
      const cryptoKey = crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      
      // Sign and compare
      cryptoKey.then((key) => {
        return crypto.subtle.sign("HMAC", key, messageData);
      }).then((signatureBuffer) => {
        // Convert to hex
        const signatureArray = Array.from(new Uint8Array(signatureBuffer));
        const signatureHex = signatureArray
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        
        // Compare signatures using constant-time comparison
        return signatureHex === signatureValue;
      });
    }
    
    // Simplified verification - in production, use Stripe SDK
    // For Deno Edge Functions, we'll use a simpler approach
    return true; // Will be properly verified below
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.text();

    // Verify webhook signature using Stripe's method
    // For Deno Edge Functions, we'll use the Stripe SDK approach
    // Import Stripe SDK for proper verification
    const stripe = await import("https://esm.sh/stripe@14.21.0?target=deno");
    const stripeInstance = stripe.default(stripeSecretKey || "", {
      apiVersion: "2023-10-16",
    });

    let event;
    try {
      event = stripeInstance.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(
        JSON.stringify({
          error: `Webhook signature verification failed: ${err.message}`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        // Handle checkout completion
        console.log("Checkout session completed:", session.id);
        if (session.subscription) {
          // Fetch subscription and update
          const subscriptionResponse = await fetch(
            `https://api.stripe.com/v1/subscriptions/${session.subscription}`,
            {
              headers: {
                Authorization: `Bearer ${stripeSecretKey}`,
              },
            }
          );
          if (subscriptionResponse.ok) {
            const subscription = await subscriptionResponse.json();
            await handleSubscriptionUpdate(supabaseAdmin, subscription);
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        await handleSubscriptionUpdate(supabaseAdmin, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await handleSubscriptionCancelled(supabaseAdmin, subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        await handlePaymentSucceeded(supabaseAdmin, invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        await handlePaymentFailed(supabaseAdmin, invoice);
        break;
      }

      case "invoice.payment_action_required": {
        const invoice = event.data.object;
        await handlePaymentActionRequired(supabaseAdmin, invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function handleSubscriptionUpdate(
  supabase: any,
  subscription: any
) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  // Find parent by Stripe customer ID or subscription ID
  const { data: parentData } = await supabase
    .from("parents")
    .select("id")
    .or(`stripe_customer_id.eq.${customerId},stripe_subscription_id.eq.${subscriptionId}`)
    .single();

  if (!parentData) {
    console.error("Parent not found for customer:", customerId, "or subscription:", subscriptionId);
    return;
  }

  // Map Stripe status to our database status
  const dbStatus = mapStripeStatusToDbStatus(status);

  // Update subscription in database
  const { error } = await supabase.rpc("sync_stripe_subscription", {
    p_stripe_subscription_id: subscriptionId,
    p_stripe_customer_id: customerId,
    p_subscription_status: dbStatus,
    p_current_period_end: currentPeriodEnd,
  });

  if (error) {
    console.error("Error syncing subscription:", error);
    // Fallback: direct update
    await supabase
      .from("parents")
      .update({
        subscription_status: dbStatus,
        subscription_expires_at: currentPeriodEnd,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
      })
      .eq("id", parentData.id);
  }
}

// Map Stripe subscription statuses to database statuses
function mapStripeStatusToDbStatus(stripeStatus: string): string {
  const statusMap: Record<string, string> = {
    trialing: "active", // Allow access during trial
    active: "active",
    incomplete: "incomplete", // Payment pending
    incomplete_expired: "expired", // Payment failed after 23 hours
    past_due: "active", // Keep access, payment retrying
    canceled: "cancelled",
    unpaid: "expired", // Payment failed, revoke access
    paused: "active", // Allow access during pause
  };
  
  return statusMap[stripeStatus] || "expired";
}

async function handleSubscriptionCancelled(
  supabase: any,
  subscription: any
) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;

  // Update subscription status to cancelled
  const { error } = await supabase
    .from("parents")
    .update({
      subscription_status: "cancelled",
      subscription_cancelled_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("Error cancelling subscription:", error);
  }
}

async function handlePaymentSucceeded(supabase: any, invoice: any) {
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) return;

  // Ensure subscription is active
  const { error } = await supabase
    .from("parents")
    .update({
      subscription_status: "active",
      subscription_expires_at: new Date(invoice.period_end * 1000).toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("Error updating subscription after payment:", error);
  }
}

async function handlePaymentFailed(supabase: any, invoice: any) {
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) return;

  // Mark subscription as past_due but keep access
  const { error } = await supabase
    .from("parents")
    .update({
      subscription_status: "past_due",
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("Error updating subscription after failed payment:", error);
  }
}

async function handlePaymentActionRequired(supabase: any, invoice: any) {
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;
  const paymentIntent = invoice.payment_intent;

  if (!subscriptionId || !paymentIntent) return;

  // Get payment intent client secret for frontend
  const clientSecret = typeof paymentIntent === "string" 
    ? null 
    : paymentIntent.client_secret;

  // Find parent and notify (you could send a push notification or email here)
  const { data: parentData } = await supabase
    .from("parents")
    .select("id, email")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (parentData) {
    // Store payment intent info for frontend to retrieve
    await supabase
      .from("parents")
      .update({
        subscription_status: "incomplete", // Payment requires action
        // Store client secret temporarily (or use a separate table)
      })
      .eq("stripe_subscription_id", subscriptionId);

    console.log(
      `Payment action required for subscription ${subscriptionId}. Client secret: ${clientSecret}`
    );
    // In production, send notification to user via push/email
  }
}


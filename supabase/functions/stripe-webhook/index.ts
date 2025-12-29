// Supabase Edge Function: Stripe Webhook Handler
// Purpose: Handle Stripe webhook events for subscription lifecycle

/// <reference types="../deno.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Type definitions for Stripe webhook events
interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_end: number;
  items?: {
    data?: Array<{
      price?: {
        id: string;
      };
    }>;
  };
  metadata?: {
    subscription_type?: string;
  };
}

interface StripeInvoice {
  customer: string;
  subscription: string | null;
  period_end: number;
  payment_intent: string | { client_secret: string | null } | null;
}

interface StripeCheckoutSession {
  id: string;
  subscription: string | null;
}

interface StripeEvent {
  type: string;
  data: {
    object: StripeSubscription | StripeInvoice | StripeCheckoutSession;
  };
}

// Type for Supabase client (simplified for Edge Functions)
type SupabaseClient = ReturnType<typeof createClient>;

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

// Allowed origins for CORS (production domains only - webhooks don't need CORS but included for consistency)
const allowedOrigins = [
  "https://www.kidscallhome.com",
  "https://kidscallhome.com",
];

// Rate limiting storage (in-memory - for production, use Redis/Upstash)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Rate limit configuration for webhook endpoint
const WEBHOOK_RATE_LIMIT = {
  maxAttempts: 100, // Allow up to 100 webhook events per minute
  windowMs: 60 * 1000, // 1 minute window
};

// Helper function to get rate limit key (use IP address)
function getRateLimitKey(req: Request): string {
  // For webhooks, Stripe sends from their IPs, but we can still rate limit by signature
  // Use a combination of IP and timestamp bucket
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const timestamp = Math.floor(Date.now() / WEBHOOK_RATE_LIMIT.windowMs);
  return `webhook:${ip}:${timestamp}`;
}

// Check rate limit
function checkRateLimit(key: string): { allowed: boolean; resetAt?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // New window or expired
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + WEBHOOK_RATE_LIMIT.windowMs,
    });
    return { allowed: true };
  }

  if (entry.count >= WEBHOOK_RATE_LIMIT.maxAttempts) {
    return { allowed: false, resetAt: entry.resetAt };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);
  return { allowed: true };
}

// Helper function to validate Content-Type
function validateContentType(req: Request): boolean {
  const contentType = req.headers.get("content-type");
  // Stripe webhooks send as application/json or text/plain
  return (
    contentType?.includes("application/json") ||
    contentType?.includes("text/plain") ||
    false
  );
}

// Helper function to get CORS headers
function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

serve(async (req) => {
  // Validate HTTP method
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // SECURITY: Validate Content-Type header
  if (!validateContentType(req)) {
    return new Response(JSON.stringify({ error: "Invalid Content-Type" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // SECURITY: Rate limiting for webhook endpoint
  const rateLimitKey = getRateLimitKey(req);
  const rateLimitCheck = checkRateLimit(rateLimitKey);

  if (!rateLimitCheck.allowed) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        message: "Too many webhook requests. Please try again later.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": rateLimitCheck.resetAt
            ? Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000).toString()
            : "60",
        },
      }
    );
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
    } catch (err: unknown) {
      // Log detailed error server-side only
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Webhook signature verification failed:", errorMessage);
      // Return generic error to client to prevent information leakage
      return new Response(
        JSON.stringify({
          error: "Webhook signature verification failed",
        }),
        {
          status: 400,
          headers: getCorsHeaders(req.headers.get("origin")),
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
        const session = event.data.object as StripeCheckoutSession;
        // Handle checkout completion
        console.warn("Checkout session completed:", session.id);
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
        const subscription = event.data.object as StripeSubscription;
        await handleSubscriptionUpdate(supabaseAdmin, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as StripeSubscription;
        await handleSubscriptionCancelled(supabaseAdmin, subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as StripeInvoice;
        await handlePaymentSucceeded(supabaseAdmin, invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as StripeInvoice;
        await handlePaymentFailed(supabaseAdmin, invoice);
        break;
      }

      case "invoice.payment_action_required": {
        const invoice = event.data.object as StripeInvoice;
        await handlePaymentActionRequired(supabaseAdmin, invoice);
        break;
      }

      default:
        console.warn(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: getCorsHeaders(req.headers.get("origin")),
    });
  } catch (error) {
    // Log detailed error server-side only
    console.error("Webhook error:", error);
    // Return generic error to prevent information leakage
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: getCorsHeaders(req.headers.get("origin")),
    });
  }
});

// Helper function to map Price ID to subscription type
function mapPriceIdToSubscriptionType(priceId: string | undefined): string {
  if (!priceId) return "free";
  
  // Test mode Price IDs
  if (priceId === "price_1SjULhIIyqCwTeH2GmBL1jVk") return "family-bundle-monthly";
  if (priceId === "price_1SjUiEIIyqCwTeH2xnxCVAAT") return "family-bundle-annual"; // Updated test annual Price ID
  
  // Live mode Price IDs (from environment or common patterns)
  // Check against environment variables
  const liveMonthly = Deno.env.get("STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY");
  const liveAnnual = Deno.env.get("STRIPE_PRICE_FAMILY_BUNDLE_ANNUAL");
  
  if (priceId === liveMonthly) return "family-bundle-monthly";
  if (priceId === liveAnnual) return "family-bundle-annual";
  
  // Fallback: check metadata
  return "free";
}

async function handleSubscriptionUpdate(
  supabase: SupabaseClient,
  subscription: StripeSubscription
) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const currentPeriodEnd = new Date(
    subscription.current_period_end * 1000
  ).toISOString();

  // Extract subscription type from Price ID or metadata
  let subscriptionType = subscription.metadata?.subscription_type;
  let allowedChildren = 1;
  
  if (!subscriptionType && subscription.items?.data?.[0]?.price?.id) {
    const priceId = subscription.items.data[0].price.id;
    subscriptionType = mapPriceIdToSubscriptionType(priceId);
  }
  
  // Map subscription type to allowed children
  if (subscriptionType === "family-bundle-monthly" || subscriptionType === "family-bundle-annual") {
    allowedChildren = 5;
  }

  // Find parent by Stripe customer ID or subscription ID
  const { data: parentData } = await supabase
    .from("parents")
    .select("id")
    .or(
      `stripe_customer_id.eq.${customerId},stripe_subscription_id.eq.${subscriptionId}`
    )
    .single();

  if (!parentData) {
    console.error(
      "Parent not found for customer:",
      customerId,
      "or subscription:",
      subscriptionId
    );
    return;
  }

  // Map Stripe status to our database status
  const dbStatus = mapStripeStatusToDbStatus(status);

  // Update subscription in database with subscription type
  const updateData: Record<string, unknown> = {
    subscription_status: dbStatus,
    subscription_expires_at: currentPeriodEnd,
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: customerId,
  };
  
  // Only update subscription_type if we found it
  if (subscriptionType && subscriptionType !== "free") {
    updateData.subscription_type = subscriptionType;
    updateData.allowed_children = allowedChildren;
  }

  const { error } = await supabase.rpc("sync_stripe_subscription", {
    p_stripe_subscription_id: subscriptionId,
    p_stripe_customer_id: customerId,
    p_subscription_status: dbStatus,
    p_current_period_end: currentPeriodEnd,
  });

  if (error) {
    console.error("Error syncing subscription:", error);
    // Fallback: direct update with subscription type
    await supabase
      .from("parents")
      .update(updateData)
      .eq("id", parentData.id);
  } else {
    // If RPC succeeded, also update subscription_type separately if needed
    if (subscriptionType && subscriptionType !== "free") {
      await supabase
        .from("parents")
        .update({
          subscription_type: subscriptionType,
          allowed_children: allowedChildren,
        })
        .eq("id", parentData.id);
    }
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
  supabase: SupabaseClient,
  subscription: StripeSubscription
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

async function handlePaymentSucceeded(
  supabase: SupabaseClient,
  invoice: StripeInvoice
) {
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) return;

  // Ensure subscription is active
  const { error } = await supabase
    .from("parents")
    .update({
      subscription_status: "active",
      subscription_expires_at: new Date(
        invoice.period_end * 1000
      ).toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("Error updating subscription after payment:", error);
  }
}

async function handlePaymentFailed(
  supabase: SupabaseClient,
  invoice: StripeInvoice
) {
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

async function handlePaymentActionRequired(
  supabase: SupabaseClient,
  invoice: StripeInvoice
) {
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;
  const paymentIntent = invoice.payment_intent;

  if (!subscriptionId || !paymentIntent) return;

  // Get payment intent client secret for frontend
  const clientSecret =
    typeof paymentIntent === "string" ? null : paymentIntent.client_secret;

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

    console.warn(
      `Payment action required for subscription ${subscriptionId}. Client secret: ${clientSecret}`
    );
    // In production, send notification to user via push/email
  }
}

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

// Get Stripe secret key - prefer LIVE for production, fallback to TEST or default
function getStripeSecretKey(): string {
  // For webhooks, we need to determine which key to use
  // Since webhooks come from Stripe (not from a specific origin),
  // we should prefer LIVE key if available, otherwise use TEST or default
  const liveKey = Deno.env.get("STRIPE_SECRET_KEY_LIVE");
  const defaultKey = Deno.env.get("STRIPE_SECRET_KEY");
  const testKey = Deno.env.get("STRIPE_SECRET_KEY_TEST");
  
  // Prefer LIVE, then default, then TEST
  return liveKey || defaultKey || testKey || "";
}

const stripeSecretKey = getStripeSecretKey();
// Support both test and live webhook secrets
const webhookSecretTest = Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST");
const webhookSecretLive = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const webhookSecret = webhookSecretTest || webhookSecretLive; // Fallback to live if test not set

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
  // Log that webhook was called (for debugging)
  console.warn("Webhook endpoint called:", {
    method: req.method,
    url: req.url,
    hasSignature: !!req.headers.get("stripe-signature"),
    timestamp: new Date().toISOString(),
  });

  // Validate HTTP method
  if (req.method !== "POST") {
    console.warn("Webhook called with non-POST method:", req.method);
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
      console.error("Webhook called without stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!webhookSecretTest && !webhookSecretLive) {
      console.error("Neither STRIPE_WEBHOOK_SECRET_TEST nor STRIPE_WEBHOOK_SECRET is set!");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!stripeSecretKey) {
      console.error("Stripe secret key is not configured! Check STRIPE_SECRET_KEY_LIVE or STRIPE_SECRET_KEY");
      return new Response(
        JSON.stringify({ error: "Stripe secret key not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.text();

    // Try to determine if this is a test or live event by checking the raw JSON
    // Test mode events have "livemode": false, live mode events have "livemode": true
    let isTestMode = false;
    try {
      const rawEvent = JSON.parse(body);
      isTestMode = rawEvent.livemode === false;
      console.warn("Event livemode:", rawEvent.livemode, "isTestMode:", isTestMode);
    } catch (e) {
      console.warn("Could not parse event JSON to check livemode, will try both secrets");
    }

    // Select the appropriate webhook secret based on event mode
    const selectedWebhookSecret = isTestMode 
      ? (webhookSecretTest || webhookSecretLive) // Prefer test, fallback to live
      : (webhookSecretLive || webhookSecretTest); // Prefer live, fallback to test

    if (!selectedWebhookSecret) {
      console.error("No webhook secret available for", isTestMode ? "test" : "live", "mode");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured for this mode" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

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
        selectedWebhookSecret
      );
      console.warn("Webhook signature verified successfully. Event type:", event.type, "Mode:", isTestMode ? "TEST" : "LIVE");
    } catch (err: unknown) {
      // If first attempt failed and we have both secrets, try the other one
      if (webhookSecretTest && webhookSecretLive && selectedWebhookSecret === webhookSecretTest) {
        console.warn("Test secret failed, trying live secret...");
        try {
          event = stripeInstance.webhooks.constructEvent(
            body,
            signature,
            webhookSecretLive
          );
          console.warn("Webhook signature verified with live secret. Event type:", event.type);
          isTestMode = false; // Update mode based on successful verification
        } catch (err2: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const errorMessage2 = err2 instanceof Error ? err2.message : String(err2);
          console.error("Webhook signature verification failed with both secrets");
          console.error("Test secret error:", errorMessage);
          console.error("Live secret error:", errorMessage2);
          console.error("Signature header:", signature?.substring(0, 20) + "...");
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
      } else {
        // Log detailed error server-side only
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Webhook signature verification failed:", errorMessage);
        console.error("Signature header:", signature?.substring(0, 20) + "...");
        console.error("Using webhook secret for:", isTestMode ? "TEST" : "LIVE", "mode");
        console.error("Test secret configured:", !!webhookSecretTest);
        console.error("Live secret configured:", !!webhookSecretLive);
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
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Handle different event types
    console.warn("Processing webhook event:", event.type, "ID:", event.id);
    
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as StripeCheckoutSession;
        // Handle checkout completion
        console.warn("Checkout session completed:", session.id);
        console.warn("Full session object:", JSON.stringify(session, null, 2));
        
        // Extract user_id from metadata or client_reference_id
        const sessionObj = session as any;
        const userId = sessionObj.metadata?.user_id || 
                       sessionObj.client_reference_id;
        
        console.warn("Extracted user_id from checkout session:", userId);
        console.warn("Session subscription ID:", session.subscription);
        console.warn("Session metadata:", sessionObj.metadata);
        console.warn("Session client_reference_id:", sessionObj.client_reference_id);
        
        if (!userId) {
          console.error("No user_id found in checkout session metadata or client_reference_id");
          console.error("Session object keys:", Object.keys(sessionObj));
          // Don't break - try to continue with subscription.created event
          return new Response(JSON.stringify({ 
            received: true,
            warning: "No user_id found, waiting for subscription.created event" 
          }), {
            status: 200,
            headers: getCorsHeaders(req.headers.get("origin")),
          });
        }
        
        // Always record checkout session in stripe_checkout_sessions table
        await handleCheckoutSessionRecorded(supabaseAdmin, sessionObj, userId, stripeSecretKey);
        
        if (session.subscription) {
          // Fetch subscription and update
          console.warn("Fetching subscription:", session.subscription);
          const subscriptionResponse = await fetch(
            `https://api.stripe.com/v1/subscriptions/${session.subscription}?expand[]=items.data.price`,
            {
              headers: {
                Authorization: `Bearer ${stripeSecretKey}`,
              },
            }
          );
          if (subscriptionResponse.ok) {
            const subscription = await subscriptionResponse.json();
            console.warn("Fetched subscription for checkout:", subscription.id);
            await handleCheckoutCompleted(supabaseAdmin, subscription, userId);
          } else {
            const errorText = await subscriptionResponse.text();
            console.error("Failed to fetch subscription:", errorText);
            console.error("Subscription response status:", subscriptionResponse.status);
          }
        } else {
          console.warn("Checkout session has no subscription ID (payment mode, not subscription)");
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as StripeSubscription;
        console.warn("Processing subscription event:", event.type, "Subscription ID:", subscription.id);
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

// Helper function to map Stripe status to database status
function mapStripeStatusToDbStatus(stripeStatus: string): string {
  const statusMap: Record<string, string> = {
    trialing: "active",
    active: "active",
    incomplete: "incomplete",
    incomplete_expired: "expired",
    past_due: "past_due",
    canceled: "cancelled",
    unpaid: "expired",
    paused: "active",
  };

  return statusMap[stripeStatus] || "inactive";
}

// Helper function to determine subscription_type from price ID
function getSubscriptionTypeFromPriceId(priceId: string | null): string | null {
  if (!priceId) return null;
  
  // Production price IDs
  const isMonthlyProd = priceId === 'price_1SUVdqIIyqCwTeH2zggZpPAK';
  const isAnnualProd = priceId === 'price_1SkPL7IIyqCwTeH2tI9TxHRB';
  
  // Test price IDs
  const isMonthlyTest = priceId === 'price_1SjULhIIyqCwTeH2GmBL1jVk';
  const isAnnualTest = priceId === 'price_1SkQUaIIyqCwTeH2QowSbcfb';
  
  if (isMonthlyProd || isMonthlyTest) {
    return 'family-bundle-monthly';
  } else if (isAnnualProd || isAnnualTest) {
    return 'family-bundle-annual';
  }
  
  return null;
}

// Handle checkout session recording in stripe_checkout_sessions table
async function handleCheckoutSessionRecorded(
  supabase: SupabaseClient,
  session: any,
  userId: string,
  stripeSecretKey: string
) {
  const checkoutSessionId = session.id;
  
  // Get subscription_type from session metadata or determine from price
  let subscriptionType = session.metadata?.subscription_type || null;
  
  // If not in metadata, try to determine from subscription or line items
  if (!subscriptionType && session.subscription) {
    try {
      const subscriptionResponse = await fetch(
        `https://api.stripe.com/v1/subscriptions/${session.subscription}?expand[]=items.data.price`,
        {
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
          },
        }
      );
      if (subscriptionResponse.ok) {
        const subscription = await subscriptionResponse.json();
        const priceId = subscription.items?.data?.[0]?.price?.id || null;
        subscriptionType = getSubscriptionTypeFromPriceId(priceId);
      }
    } catch (err) {
      console.warn("Could not fetch subscription to determine type:", err);
    }
  }
  
  // If still no subscription_type, try to get from line items in session
  if (!subscriptionType) {
    try {
      const lineItemsResponse = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${checkoutSessionId}/line_items`,
        {
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
          },
        }
      );
      if (lineItemsResponse.ok) {
        const lineItems = await lineItemsResponse.json();
        const priceId = lineItems.data?.[0]?.price?.id || null;
        subscriptionType = getSubscriptionTypeFromPriceId(priceId);
      }
    } catch (err) {
      console.warn("Could not fetch line items:", err);
    }
  }
  
  if (!subscriptionType) {
    console.warn(`Could not determine subscription_type for checkout session ${checkoutSessionId}`);
    // Still record the session, but with 'unknown' type
  }
  
  console.warn("Recording checkout session:", checkoutSessionId);
  
  const { error } = await supabase
    .from("stripe_checkout_sessions")
    .upsert({
      checkout_session_id: checkoutSessionId,
      parent_id: userId,
      subscription_type: subscriptionType || 'unknown',
      used_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }, {
      onConflict: "checkout_session_id",
    });
  
  if (error) {
    console.error("Error recording checkout session:", error);
  } else {
    console.warn("Successfully recorded checkout session in stripe_checkout_sessions");
  }
}

// Handle checkout.session.completed event
async function handleCheckoutCompleted(
  supabase: SupabaseClient,
  subscription: StripeSubscription,
  userId: string
) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const currentPeriodEnd = new Date(
    subscription.current_period_end * 1000
  ).toISOString();
  const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
  
  // Get price ID from subscription items
  const priceId = subscription.items?.data?.[0]?.price?.id || null;

  console.warn("Upserting billing subscription:", {
    user_id: userId,
    customer_id: customerId,
    subscription_id: subscriptionId,
    price_id: priceId,
    status: mapStripeStatusToDbStatus(status),
  });

  // Upsert billing_subscriptions
  const { data, error } = await supabase
    .from("billing_subscriptions")
    .upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      status: mapStripeStatusToDbStatus(status),
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id",
    });

  if (error) {
    console.error("Error upserting billing subscription:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
  } else {
    console.warn("Successfully upserted billing subscription for user:", userId);
  }
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
  const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
  
  // Get price ID from subscription items
  const priceId = subscription.items?.data?.[0]?.price?.id || null;

  // Try to find user_id from subscription metadata or by looking up customer
  let userId: string | null = null;
  
  // First, try to find existing billing subscription
  const { data: billingSub, error: findError } = await supabase
    .from("billing_subscriptions")
    .select("user_id")
    .or(
      `stripe_customer_id.eq.${customerId},stripe_subscription_id.eq.${subscriptionId}`
    )
    .maybeSingle();

  if (billingSub) {
    userId = billingSub.user_id;
  } else {
    // If not found, try to get user_id from Stripe customer metadata
    // Fetch customer from Stripe to get metadata
    try {
      const customerResponse = await fetch(
        `https://api.stripe.com/v1/customers/${customerId}`,
        {
          headers: {
            Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY") || ""}`,
          },
        }
      );
      if (customerResponse.ok) {
        const customer = await customerResponse.json();
        userId = customer.metadata?.user_id || customer.metadata?.parent_id || null;
      }
    } catch (err) {
      console.error("Error fetching customer from Stripe:", err);
    }
    
    // If still no user_id, try to find by customer_id in parents table (fallback)
    if (!userId) {
      const { data: parentData } = await supabase
        .from("parents")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      if (parentData) {
        userId = parentData.id;
      }
    }
  }

  if (!userId) {
    console.error(
      "Could not determine user_id for subscription:",
      subscriptionId,
      "customer:",
      customerId
    );
    return;
  }

  // Upsert billing_subscriptions (create if doesn't exist, update if does)
  const { error } = await supabase
    .from("billing_subscriptions")
    .upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      status: mapStripeStatusToDbStatus(status),
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id",
    });

  if (error) {
    console.error("Error upserting billing subscription:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
  } else {
    console.warn("Successfully upserted billing subscription for user:", userId);
  }
}

async function handleSubscriptionCancelled(
  supabase: SupabaseClient,
  subscription: StripeSubscription
) {
  const subscriptionId = subscription.id;

  // Update subscription status to cancelled
  const { error } = await supabase
    .from("billing_subscriptions")
    .update({
      status: "cancelled",
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
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
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) return;

  // Ensure subscription is active
  const { error } = await supabase
    .from("billing_subscriptions")
    .update({
      status: "active",
      current_period_end: new Date(
        invoice.period_end * 1000
      ).toISOString(),
      updated_at: new Date().toISOString(),
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
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) return;

  // Mark subscription as past_due
  const { error } = await supabase
    .from("billing_subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
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
  const subscriptionId = invoice.subscription;
  const paymentIntent = invoice.payment_intent;

  if (!subscriptionId || !paymentIntent) return;

  // Get payment intent client secret for frontend
  const clientSecret =
    typeof paymentIntent === "string" ? null : paymentIntent.client_secret;

  // Update subscription status to incomplete
  const { error } = await supabase
    .from("billing_subscriptions")
    .update({
      status: "incomplete",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("Error updating subscription after payment action required:", error);
  }

  console.warn(
    `Payment action required for subscription ${subscriptionId}. Client secret: ${clientSecret}`
  );
  // In production, send notification to user via push/email
}

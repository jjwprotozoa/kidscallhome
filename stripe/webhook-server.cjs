// stripe/webhook-server.cjs
// Local Stripe webhook receiver for development
// Purpose: Receives webhooks from Stripe CLI and updates Supabase database

const http = require('http');
const url = require('url');
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PORT = 4242;

// Initialize Supabase client (requires service role key for admin operations)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log('✅ Supabase client initialized');
} else {
  console.warn('⚠️  Supabase not configured - database updates will be skipped');
  console.warn('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable database updates');
}

// CRITICAL: Webhook route MUST use raw body
// Stripe signature verification requires the raw request body
// We collect the raw body as a Buffer before parsing

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Health check endpoint
  if (pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'stripe-webhook-server' }));
    return;
  }

  // Webhook endpoint
  if (pathname === '/webhook' && req.method === 'POST') {
    // Collect raw body as Buffer
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('❌ STRIPE_WEBHOOK_SECRET environment variable is not set');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Webhook secret not configured' }));
      return;
    }

    if (!sig) {
      console.error('❌ Missing stripe-signature header');
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing signature' }));
      return;
    }

    let event;

    try {
      // Verify webhook signature using raw body
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      console.error('   Make sure STRIPE_WEBHOOK_SECRET matches the secret from "stripe listen"');
      console.error('   Current secret: ' + webhookSecret.substring(0, 20) + '...');
      console.error('   Get the correct secret from the "stripe listen" output');
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Webhook Error: ${err.message}` }));
      return;
    }

    // Log received event
    console.log(`\n✅ Webhook received: ${event.type}`);
    console.log(`   Event ID: ${event.id}`);

    // Handle different event types
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          console.log(`   Session ID: ${session.id}`);
          console.log(`   Customer: ${session.customer || 'N/A'}`);
          console.log(`   Subscription: ${session.subscription || 'N/A'}`);
          console.log(`   Mode: ${session.mode || 'N/A'}`);
          
          const userId = session.metadata?.user_id || session.client_reference_id;
          
          if (!userId) {
            console.warn('   ⚠️  No user_id found in session metadata or client_reference_id');
            console.warn('   💡 This is normal for test events from "stripe trigger"');
            console.warn('   💡 Real checkout sessions will include user_id in metadata');
            break;
          }
          
          if (supabase) {
            // Always update stripe_checkout_sessions table when we have user_id
            await handleCheckoutSessionRecorded(session, userId);
            
            // If this is a subscription checkout, also update billing_subscriptions
            if (session.subscription) {
              try {
                const subscriptionResponse = await fetch(
                  `https://api.stripe.com/v1/subscriptions/${session.subscription}?expand[]=items.data.price`,
                  {
                    headers: {
                      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
                    },
                  }
                );
                if (subscriptionResponse.ok) {
                  const subscription = await subscriptionResponse.json();
                  await handleCheckoutCompleted(subscription, userId);
                }
              } catch (err) {
                console.error('   ❌ Error fetching subscription:', err.message);
              }
            } else {
              console.log('   ℹ️  Payment mode checkout (not subscription) - only recording session');
            }
          }
          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          console.log(`   Subscription ID: ${subscription.id}`);
          console.log(`   Customer: ${subscription.customer}`);
          console.log(`   Status: ${subscription.status}`);
          console.log(`   Current Period End: ${new Date(subscription.current_period_end * 1000).toISOString()}`);
          
          if (supabase) {
            await handleSubscriptionUpdate(subscription);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          console.log(`   Subscription ID: ${subscription.id}`);
          console.log(`   Customer: ${subscription.customer}`);
          
          if (supabase) {
            await handleSubscriptionCancelled(subscription);
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          console.log(`   Invoice ID: ${invoice.id}`);
          console.log(`   Customer: ${invoice.customer}`);
          console.log(`   Subscription: ${invoice.subscription || 'N/A'}`);
          
          if (supabase && invoice.subscription) {
            await handlePaymentSucceeded(invoice);
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          console.log(`   Invoice ID: ${invoice.id}`);
          console.log(`   Customer: ${invoice.customer}`);
          console.log(`   Subscription: ${invoice.subscription || 'N/A'}`);
          
          if (supabase && invoice.subscription) {
            await handlePaymentFailed(invoice);
          }
          break;
        }

        case 'invoice.payment_action_required': {
          const invoice = event.data.object;
          console.log(`   Invoice ID: ${invoice.id}`);
          console.log(`   Subscription: ${invoice.subscription || 'N/A'}`);
          console.log(`   ⚠️  Payment action required`);
          
          if (supabase && invoice.subscription) {
            await handlePaymentActionRequired(invoice);
          }
          break;
        }

        // Informational events (just log, no database updates needed)
        case 'product.created':
        case 'product.updated':
        case 'product.deleted':
        case 'price.created':
        case 'price.updated':
        case 'price.deleted':
        case 'charge.succeeded':
        case 'charge.updated':
        case 'payment_intent.created':
        case 'payment_intent.succeeded':
        case 'payment_intent.payment_failed': {
          const obj = event.data.object;
          console.log(`   📋 Informational event: ${event.type}`);
          if (obj.id) console.log(`   ID: ${obj.id}`);
          break;
        }

        default:
          console.log(`   ⚠️  Unhandled event type: ${event.type}`);
      }
    } catch (err) {
      console.error(`   ❌ Error handling event: ${err.message}`);
      console.error(err.stack);
    }

    // Always return 200 to acknowledge receipt
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ received: true }));
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Helper function to map Stripe status to database status
function mapStripeStatusToDbStatus(stripeStatus) {
  const statusMap = {
    trialing: 'active',
    active: 'active',
    incomplete: 'incomplete',
    incomplete_expired: 'expired',
    past_due: 'past_due',
    canceled: 'cancelled',
    unpaid: 'expired',
    paused: 'active',
  };
  return statusMap[stripeStatus] || 'inactive';
}

// Helper function to determine subscription_type from price ID
function getSubscriptionTypeFromPriceId(priceId) {
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
async function handleCheckoutSessionRecorded(session, userId) {
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
            Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          },
        }
      );
      if (subscriptionResponse.ok) {
        const subscription = await subscriptionResponse.json();
        const priceId = subscription.items?.data?.[0]?.price?.id || null;
        subscriptionType = getSubscriptionTypeFromPriceId(priceId);
      }
    } catch (err) {
      console.error(`   ⚠️  Could not fetch subscription to determine type: ${err.message}`);
    }
  }
  
  // If still no subscription_type, try to get from line items in session
  if (!subscriptionType && session.line_items) {
    try {
      const lineItemsResponse = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${checkoutSessionId}/line_items`,
        {
          headers: {
            Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          },
        }
      );
      if (lineItemsResponse.ok) {
        const lineItems = await lineItemsResponse.json();
        const priceId = lineItems.data?.[0]?.price?.id || null;
        subscriptionType = getSubscriptionTypeFromPriceId(priceId);
      }
    } catch (err) {
      console.error(`   ⚠️  Could not fetch line items: ${err.message}`);
    }
  }
  
  if (!subscriptionType) {
    console.warn(`   ⚠️  Could not determine subscription_type for checkout session ${checkoutSessionId}`);
    // Still record the session, but without subscription_type
  }
  
  console.log(`   💾 Recording checkout session: ${checkoutSessionId}`);
  
  const { error } = await supabase
    .from('stripe_checkout_sessions')
    .upsert({
      checkout_session_id: checkoutSessionId,
      parent_id: userId,
      subscription_type: subscriptionType || 'unknown',
      used_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'checkout_session_id',
    });
  
  if (error) {
    console.error(`   ❌ Error recording checkout session: ${error.message}`);
  } else {
    console.log(`   ✅ Checkout session recorded in stripe_checkout_sessions`);
  }
}

// Handle checkout.session.completed event
async function handleCheckoutCompleted(subscription, userId) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
  const priceId = subscription.items?.data?.[0]?.price?.id || null;

  console.log(`   💾 Updating database for user: ${userId}`);

  const { error } = await supabase
    .from('billing_subscriptions')
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
      onConflict: 'user_id',
    });

  if (error) {
    console.error(`   ❌ Database error: ${error.message}`);
  } else {
    console.log(`   ✅ Database updated successfully`);
  }
}

// Handle subscription created/updated
async function handleSubscriptionUpdate(subscription) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
  const priceId = subscription.items?.data?.[0]?.price?.id || null;

  // Try to find user_id from existing billing subscription
  let userId = null;
  const { data: billingSub } = await supabase
    .from('billing_subscriptions')
    .select('user_id')
    .or(`stripe_customer_id.eq.${customerId},stripe_subscription_id.eq.${subscriptionId}`)
    .maybeSingle();

  if (billingSub) {
    userId = billingSub.user_id;
  } else {
    // Try to get user_id from Stripe customer metadata
    try {
      const customerResponse = await fetch(
        `https://api.stripe.com/v1/customers/${customerId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          },
        }
      );
      if (customerResponse.ok) {
        const customer = await customerResponse.json();
        userId = customer.metadata?.user_id || customer.metadata?.parent_id || null;
      }
    } catch (err) {
      console.error(`   ⚠️  Could not fetch customer: ${err.message}`);
    }
  }

  if (!userId) {
    console.warn(`   ⚠️  Could not determine user_id for subscription ${subscriptionId}`);
    return;
  }

  console.log(`   💾 Updating database for subscription: ${subscriptionId}`);

  const { error } = await supabase
    .from('billing_subscriptions')
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
      onConflict: 'user_id',
    });

  if (error) {
    console.error(`   ❌ Database error: ${error.message}`);
  } else {
    console.log(`   ✅ Database updated successfully`);
  }
}

// Handle subscription cancelled
async function handleSubscriptionCancelled(subscription) {
  const subscriptionId = subscription.id;

  console.log(`   💾 Marking subscription as cancelled: ${subscriptionId}`);

  const { error } = await supabase
    .from('billing_subscriptions')
    .update({
      status: 'cancelled',
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) {
    console.error(`   ❌ Database error: ${error.message}`);
  } else {
    console.log(`   ✅ Subscription marked as cancelled`);
  }
}

// Handle payment succeeded
async function handlePaymentSucceeded(invoice) {
  const subscriptionId = invoice.subscription;

  console.log(`   💾 Updating subscription after successful payment: ${subscriptionId}`);

  const { error } = await supabase
    .from('billing_subscriptions')
    .update({
      status: 'active',
      current_period_end: new Date(invoice.period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) {
    console.error(`   ❌ Database error: ${error.message}`);
  } else {
    console.log(`   ✅ Payment status updated`);
  }
}

// Handle payment failed
async function handlePaymentFailed(invoice) {
  const subscriptionId = invoice.subscription;

  console.log(`   💾 Marking subscription as past_due: ${subscriptionId}`);

  const { error } = await supabase
    .from('billing_subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) {
    console.error(`   ❌ Database error: ${error.message}`);
  } else {
    console.log(`   ✅ Payment failure recorded`);
  }
}

// Handle payment action required
async function handlePaymentActionRequired(invoice) {
  const subscriptionId = invoice.subscription;

  console.log(`   💾 Marking subscription as incomplete: ${subscriptionId}`);

  const { error } = await supabase
    .from('billing_subscriptions')
    .update({
      status: 'incomplete',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) {
    console.error(`   ❌ Database error: ${error.message}`);
  } else {
    console.log(`   ✅ Payment action required status set`);
  }
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Stripe Webhook Server running`);
  console.log(`   Listening on http://127.0.0.1:${PORT}/webhook`);
  console.log(`   Health check: http://127.0.0.1:${PORT}/health\n`);
  
  // Check and display environment variable status
  console.log('📋 Environment Variables Status:');
  
  // Required variables
  if (process.env.STRIPE_SECRET_KEY) {
    console.log(`   ✅ STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY.substring(0, 12)}...`);
  } else {
    console.log('   ❌ STRIPE_SECRET_KEY: Not set (REQUIRED)');
  }
  
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    console.log(`   ✅ STRIPE_WEBHOOK_SECRET: ${process.env.STRIPE_WEBHOOK_SECRET.substring(0, 12)}...`);
  } else {
    console.log('   ❌ STRIPE_WEBHOOK_SECRET: Not set (REQUIRED)');
  }
  
  // Optional Supabase variables
  if (process.env.SUPABASE_URL) {
    console.log(`   ✅ SUPABASE_URL: ${process.env.SUPABASE_URL}`);
  } else {
    console.log('   ⚠️  SUPABASE_URL: Not set (database updates will be skipped)');
  }
  
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log(`   ✅ SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 12)}...`);
  } else {
    console.log('   ⚠️  SUPABASE_SERVICE_ROLE_KEY: Not set (database updates will be skipped)');
  }
  
  if (supabase) {
    console.log('\n✅ Database updates: ENABLED');
  } else {
    console.log('\n⚠️  Database updates: DISABLED (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable)');
  }
  
  console.log('');
});


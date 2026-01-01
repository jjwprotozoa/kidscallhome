// stripe/sync-checkout-session.cjs
// Manual script to sync a Stripe checkout session to local database
// Usage: node stripe/sync-checkout-session.cjs <checkout_session_id> <user_id>

const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const checkoutSessionId = process.argv[2];
const userId = process.argv[3];

if (!checkoutSessionId || !userId) {
  console.error('Usage: node stripe/sync-checkout-session.cjs <checkout_session_id> <user_id>');
  console.error('Example: node stripe/sync-checkout-session.cjs cs_test_abc123 70888a10-ad5e-4764-8dff-537ad2da34d1');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncCheckoutSession() {
  console.log(`\n🔄 Syncing checkout session: ${checkoutSessionId}`);
  console.log(`   User ID: ${userId}\n`);

  try {
    // Fetch checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
      expand: ['line_items', 'subscription'],
    });

    console.log('📋 Checkout Session Details:');
    console.log(`   ID: ${session.id}`);
    console.log(`   Mode: ${session.mode}`);
    console.log(`   Customer: ${session.customer || 'N/A'}`);
    console.log(`   Subscription: ${session.subscription || 'N/A'}`);
    console.log(`   Status: ${session.status}`);
    console.log(`   Metadata:`, session.metadata);
    console.log(`   Client Reference ID: ${session.client_reference_id || 'N/A'}\n`);

    // Determine subscription_type
    let subscriptionType = session.metadata?.subscription_type || null;
    
    if (!subscriptionType && session.subscription) {
      const subscription = typeof session.subscription === 'string' 
        ? await stripe.subscriptions.retrieve(session.subscription, { expand: ['items.data.price'] })
        : session.subscription;
      
      const priceId = subscription.items?.data?.[0]?.price?.id || null;
      
      // Map price ID to subscription type
      const isMonthlyProd = priceId === 'price_1SUVdqIIyqCwTeH2zggZpPAK';
      const isAnnualProd = priceId === 'price_1SkPL7IIyqCwTeH2tI9TxHRB';
      const isMonthlyTest = priceId === 'price_1SjULhIIyqCwTeH2GmBL1jVk';
      const isAnnualTest = priceId === 'price_1SkQUaIIyqCwTeH2QowSbcfb';
      
      if (isMonthlyProd || isMonthlyTest) {
        subscriptionType = 'family-bundle-monthly';
      } else if (isAnnualProd || isAnnualTest) {
        subscriptionType = 'family-bundle-annual';
      }
    }

    // 1. Update stripe_checkout_sessions table
    console.log('💾 Step 1: Recording checkout session...');
    const { error: sessionError } = await supabase
      .from('stripe_checkout_sessions')
      .upsert({
        checkout_session_id: checkoutSessionId,
        parent_id: userId,
        subscription_type: subscriptionType || 'unknown',
        used_at: new Date().toISOString(),
        created_at: new Date(session.created * 1000).toISOString(),
      }, {
        onConflict: 'checkout_session_id',
      });

    if (sessionError) {
      console.error(`   ❌ Error: ${sessionError.message}`);
    } else {
      console.log(`   ✅ Checkout session recorded in stripe_checkout_sessions`);
    }

    // 2. Update billing_subscriptions if it's a subscription checkout
    if (session.subscription) {
      console.log('\n💾 Step 2: Updating billing subscription...');
      
      const subscription = typeof session.subscription === 'string'
        ? await stripe.subscriptions.retrieve(session.subscription, { expand: ['items.data.price'] })
        : session.subscription;

      const customerId = subscription.customer;
      const subscriptionId = subscription.id;
      const status = subscription.status;
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
      const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
      const priceId = subscription.items?.data?.[0]?.price?.id || null;

      // Map Stripe status to database status
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
      const dbStatus = statusMap[status] || 'inactive';

      const { error: billingError } = await supabase
        .from('billing_subscriptions')
        .upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: priceId,
          status: dbStatus,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: cancelAtPeriodEnd,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (billingError) {
        console.error(`   ❌ Error: ${billingError.message}`);
      } else {
        console.log(`   ✅ Billing subscription updated in billing_subscriptions`);
        console.log(`   Status: ${dbStatus}`);
        console.log(`   Price ID: ${priceId}`);
        console.log(`   Period End: ${currentPeriodEnd}`);
      }
    } else {
      console.log('\nℹ️  Step 2: Skipped (not a subscription checkout)');
    }

    console.log('\n✅ Sync complete!\n');

  } catch (error) {
    console.error('\n❌ Error syncing checkout session:', error.message);
    if (error.type === 'StripeInvalidRequestError') {
      console.error('   Make sure the checkout session ID is correct');
    }
    process.exit(1);
  }
}

syncCheckoutSession();




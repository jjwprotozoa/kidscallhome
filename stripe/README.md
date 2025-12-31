# Stripe Webhook Configuration

This directory contains scripts for running a **local Stripe webhook receiver** during development. The webhook system is configured to work in two separate environments:

## Environment Separation

### 🏠 Localhost (Development Testing)

- **Purpose:** Test webhooks locally during development
- **Server:** Local Node.js server (`webhook-server.cjs`) running on `http://127.0.0.1:4242`
- **Stripe Mode:** Test mode only (`sk_test_...`)
- **Webhook Secret:** From `stripe listen` CLI (changes each session)
- **Database Updates:** Updates both `billing_subscriptions` and `stripe_checkout_sessions` tables

### 🌐 Development/Production (Supabase Edge Function)

- **Purpose:** Handle real webhooks from Stripe in deployed environments
- **Server:** Supabase Edge Function at `/functions/v1/stripe-webhook`
- **Stripe Mode:** Supports both test and live mode (auto-detects from event `livemode` property)
- **Webhook Secrets:**
  - Test: `STRIPE_WEBHOOK_SECRET_TEST` (for test mode events)
  - Live: `STRIPE_WEBHOOK_SECRET` (for live mode events)
- **Database Updates:** Updates both `billing_subscriptions` and `stripe_checkout_sessions` tables

## Quick Start (Localhost)

1. **Start Stripe CLI forwarding** (in one terminal):

   ```powershell
   C:\Users\DevBox\stripe.exe listen --forward-to http://127.0.0.1:4242/webhook
   ```

   **IMPORTANT:** Copy the webhook signing secret from the output (starts with `whsec_...`)

2. **Update the webhook secret** in `start-webhook.ps1`:
   - Open `stripe/start-webhook.ps1`
   - Find line with `$env:STRIPE_WEBHOOK_SECRET = "whsec_..."`
   - Replace with the secret from step 1

3. **Start the webhook server** (in another terminal):

   ```powershell
   npm run stripe:webhook:start
   ```

   Or manually:

   ```powershell
   .\stripe\start-webhook.ps1
   ```

## Files

- `webhook-server.cjs` - Main webhook server (Node.js HTTP server) for localhost
- `start-webhook.ps1` - Startup script that sets env vars and runs server
- `setup-env.ps1` - Helper script to check environment variable status
- `test-webhook.ps1` - Test script to verify setup

## Environment Variables

### Localhost (set in `start-webhook.ps1`)

The startup script sets these automatically:

- `STRIPE_SECRET_KEY` - Your Stripe **test** secret key (`sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret (from `stripe listen`)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database updates

### Development/Production (Supabase Edge Function Secrets)

Set these in Supabase Dashboard → Edge Functions → Secrets:

- `STRIPE_SECRET_KEY` - Default Stripe secret key (test or live)
- `STRIPE_SECRET_KEY_TEST` - Test mode secret key (optional, for explicit test mode)
- `STRIPE_SECRET_KEY_LIVE` - Live mode secret key (optional, for explicit live mode)
- `STRIPE_WEBHOOK_SECRET_TEST` - Test mode webhook signing secret (`whsec_...`)
- `STRIPE_WEBHOOK_SECRET` - Live mode webhook signing secret (`whsec_...`)
- `SUPABASE_URL` - Your Supabase project URL (usually auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (usually auto-set)

## Database Tables Updated

Both environments update these Supabase tables:

### 1. `billing_subscriptions`

Tracks user subscription status and Stripe subscription details:

- `user_id` - Links to `auth.users`
- `stripe_customer_id` - Stripe customer ID
- `stripe_subscription_id` - Stripe subscription ID
- `stripe_price_id` - Stripe price ID
- `status` - Subscription status (`active`, `inactive`, `cancelled`, `past_due`, `incomplete`, `expired`)
- `current_period_end` - When current billing period ends
- `cancel_at_period_end` - Whether subscription will cancel at period end

### 2. `stripe_checkout_sessions`

Tracks completed checkout sessions for fraud prevention:

- `checkout_session_id` - Stripe checkout session ID
- `parent_id` - Links to `parents` table (user who completed checkout)
- `subscription_type` - Type of subscription purchased
- `used_at` - When the session was recorded
- `created_at` - When the record was created

**Purpose:** Prevents duplicate checkout session usage and subscription sharing.

## Troubleshooting

### Signature Verification Failed

**Problem:** `❌ Webhook signature verification failed`

**Solution:** The webhook secret doesn't match what `stripe listen` is using.

1. Check `stripe listen` output for the current secret
2. Update `STRIPE_WEBHOOK_SECRET` in `start-webhook.ps1`
3. Restart the webhook server

### Port Already in Use

**Problem:** `Error: listen EADDRINUSE: address already in use 0.0.0.0:4242`

**Solution:** The startup script automatically frees the port, but if it persists:

```powershell
# Find and stop the process
$conn = Get-NetTCPConnection -LocalPort 4242
Stop-Process -Id $conn.OwningProcess -Force
```

### Database Updates Not Working

**Problem:** Events received but database not updated

**Solution:** Check that Supabase variables are set:

```powershell
.\stripe\setup-env.ps1
```

Make sure both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` show as set.

## Testing

### Test Events (from Stripe CLI)

1. **Trigger a test event:**

   ```powershell
   C:\Users\DevBox\stripe.exe trigger checkout.session.completed
   ```

2. **Check webhook server logs** - Should show:
   - ✅ Webhook received
   - 💾 Database update messages
   - ✅ Success confirmations

### Real Checkout Sessions

**Important:** When you complete a checkout in your browser, Stripe sends the webhook to the **production endpoint** configured in Stripe Dashboard, NOT your local server.

**To sync a real checkout session to your local database:**

1. **Get the checkout session ID** from:
   - URL after checkout: `?session_id=cs_test_...`
   - Stripe Dashboard → Payments → Checkout Sessions
   - Browser console logs

2. **Get your user ID** (UUID from `auth.users` table)

3. **Run the sync script:**

   ```powershell
   # Make sure environment variables are set first
   $env:STRIPE_SECRET_KEY="sk_test_..."
   $env:SUPABASE_URL="https://itmhojbjfacocrpmslmt.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   
   npm run stripe:sync cs_test_YOUR_SESSION_ID YOUR_USER_ID
   ```

   Example:

   ```powershell
   npm run stripe:sync cs_test_a1CO9oIExqy5P1zI9dHznV6j196b2wRcC5THYSzNGiBJhNApDyYzQgPw3Q 70888a10-ad5e-4764-8dff-537ad2da34d1
   ```

4. **Verify in Supabase Dashboard:**
   - Check `billing_subscriptions` table
   - Check `stripe_checkout_sessions` table

### Check Stripe Dashboard

Events should appear at:
<https://dashboard.stripe.com/test/events>

## Development/Production Webhook Setup

For deployed environments, webhooks are handled by the Supabase Edge Function at:

```
https://your-project.supabase.co/functions/v1/stripe-webhook
```

### Stripe Dashboard Configuration

1. **Test Mode Webhook:**
   - Go to: <https://dashboard.stripe.com/test/webhooks>
   - Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
   - Copy signing secret → Set as `STRIPE_WEBHOOK_SECRET_TEST` in Supabase secrets

2. **Live Mode Webhook:**
   - Go to: <https://dashboard.stripe.com/webhooks> (switch to live mode)
   - Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
   - Copy signing secret → Set as `STRIPE_WEBHOOK_SECRET` in Supabase secrets

### Webhook Events Handled

Both localhost and development/production handle these events:

- `checkout.session.completed` - Records checkout session and creates/updates subscription
- `customer.subscription.created` - Creates subscription record
- `customer.subscription.updated` - Updates subscription status/details
- `customer.subscription.deleted` - Marks subscription as cancelled
- `invoice.payment_succeeded` - Updates subscription to active
- `invoice.payment_failed` - Marks subscription as past_due
- `invoice.payment_action_required` - Marks subscription as incomplete

## Verification Checklist

To verify Stripe is configured correctly:

### ✅ Localhost Configuration

- [ ] `stripe listen` is running and forwarding to `http://127.0.0.1:4242/webhook`
- [ ] `STRIPE_WEBHOOK_SECRET` in `start-webhook.ps1` matches the secret from `stripe listen`
- [ ] `STRIPE_SECRET_KEY` is set to test key (`sk_test_...`)
- [ ] Webhook server is running and receiving events
- [ ] Both `billing_subscriptions` and `stripe_checkout_sessions` tables are updated when testing

### ✅ Development/Production Configuration

- [ ] Test mode webhook endpoint configured in Stripe Dashboard
- [ ] Live mode webhook endpoint configured in Stripe Dashboard
- [ ] `STRIPE_WEBHOOK_SECRET_TEST` set in Supabase Edge Function secrets
- [ ] `STRIPE_WEBHOOK_SECRET` (live) set in Supabase Edge Function secrets
- [ ] `STRIPE_SECRET_KEY` or `STRIPE_SECRET_KEY_LIVE` set in Supabase Edge Function secrets
- [ ] Both `billing_subscriptions` and `stripe_checkout_sessions` tables are updated when webhooks fire

### ✅ Table Updates Verification

Both environments should update these tables:

1. **`billing_subscriptions`** - Updated on:
   - `checkout.session.completed` (if subscription created)
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `invoice.payment_action_required`

2. **`stripe_checkout_sessions`** - Updated on:
   - `checkout.session.completed` (always, if user_id is present)

## Notes

- **Localhost:** The webhook secret from `stripe listen` changes each time you restart it - always update `start-webhook.ps1` with the current secret
- **Development/Production:** Webhook secrets are stable and set in Supabase Dashboard
- Database updates require valid Supabase credentials (service role key)
- Localhost server runs on `http://127.0.0.1:4242/webhook`
- Development/Production uses Supabase Edge Function (auto-scales, no port management needed)
- **Environment Separation:** Localhost uses test keys only. Development/Production supports both test and live modes automatically based on event `livemode` property

# Setup Stripe Environment Variables

## Issue: Missing Stripe Secret Key

If you see errors like:
- `ERROR: STRIPE_SECRET_KEY environment variable is not set!`
- Webhook logs show "No results found"

You need to set environment variables in Supabase Dashboard.

## Step 1: Get Your Stripe Keys

### Test Mode (for development)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Make sure you're in **Test mode** (toggle in top right)
3. Copy:
   - **Secret key** (starts with `sk_test_...`)
   - **Publishable key** (starts with `pk_test_...`) - for frontend if needed

### Live Mode (for production)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Make sure you're in **Live mode** (toggle in top right)
3. Copy:
   - **Secret key** (starts with `sk_live_...`)
   - **Publishable key** (starts with `pk_live_...`) - for frontend if needed

## Step 2: Set Environment Variables in Supabase

### Via Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt/settings/functions
   - Or navigate: **Project Settings** → **Edge Functions** → **Secrets**

2. **Add Required Secrets:**

   Click **"Add new secret"** for each:

   #### Required for All Functions:
   - **Name:** `STRIPE_SECRET_KEY`
   - **Value:** Your Stripe Secret Key (`sk_test_...` for test, `sk_live_...` for production)
   - **Description:** Stripe API secret key

   #### Required for Webhook:
   - **Name:** `STRIPE_WEBHOOK_SECRET`
   - **Value:** Your webhook signing secret (see Step 3 below)
   - **Description:** Stripe webhook endpoint signing secret

   #### Optional (for environment-specific keys):
   - **Name:** `STRIPE_SECRET_KEY_TEST`
   - **Value:** Test mode secret key (`sk_test_...`)
   - **Description:** Test mode Stripe key (for localhost)

   - **Name:** `STRIPE_SECRET_KEY_LIVE`
   - **Value:** Live mode secret key (`sk_live_...`)
   - **Description:** Live mode Stripe key (for production)

   #### Auto-Set (usually already configured):
   - `SUPABASE_URL` - Auto-set by Supabase
   - `SUPABASE_ANON_KEY` - Auto-set by Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` - Auto-set by Supabase (required for webhook)

3. **Save Each Secret:**
   - Click **"Save"** after adding each secret
   - Secrets are encrypted and stored securely

### Via Supabase CLI (Alternative)

```bash
# Set test key
supabase secrets set STRIPE_SECRET_KEY=sk_test_...

# Set webhook secret
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# Set environment-specific keys (optional)
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
supabase secrets set STRIPE_SECRET_KEY_LIVE=sk_live_...
```

## Step 3: Get Webhook Signing Secret

The webhook signing secret is different from your API keys. You get it when you create a webhook endpoint in Stripe.

### If Webhook Already Exists:

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click on your webhook endpoint
3. Click **"Reveal"** next to "Signing secret"
4. Copy the secret (starts with `whsec_...`)

### If Webhook Doesn't Exist Yet:

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **"Add endpoint"**
3. **Endpoint URL:** `https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-webhook`
4. **Description:** "KidsCallHome Subscription Webhook"
5. **Events to send:**
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `invoice.payment_action_required`
6. Click **"Add endpoint"**
7. **Copy the signing secret** (shown after creation, starts with `whsec_...`)
8. Add it to Supabase as `STRIPE_WEBHOOK_SECRET`

## Step 4: Verify Setup

### Check Environment Variables

1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Verify these are set:
   - ✅ `STRIPE_SECRET_KEY`
   - ✅ `STRIPE_WEBHOOK_SECRET`
   - ✅ `SUPABASE_SERVICE_ROLE_KEY` (auto-set)

### Test Webhook Endpoint

1. Go to Stripe Dashboard → Webhooks
2. Click on your webhook endpoint
3. Click **"Send test webhook"**
4. Select event: `checkout.session.completed`
5. Click **"Send test webhook"**
6. Check Supabase Dashboard → Edge Functions → `stripe-webhook` → Logs
7. You should see log entries showing the webhook was received

### Test Checkout Session Creation

1. Navigate to `/parent/upgrade` in your app
2. Click "Select Plan" on monthly or annual
3. Should redirect to Stripe Checkout (no CORS errors)
4. If you see errors, check:
   - Edge Function logs for `create-stripe-subscription`
   - Browser console for error messages

## Troubleshooting

### "STRIPE_SECRET_KEY not set" Error

- **Cause:** Environment variable not set in Supabase
- **Fix:** Follow Step 2 above to set the secret

### Webhook Shows "No results found"

- **Cause:** Webhook hasn't received any events yet
- **Fix:**
  1. Verify webhook endpoint is configured in Stripe (Step 3)
  2. Send a test webhook from Stripe Dashboard
  3. Check if logs appear in Supabase

### Webhook Returns 401 or 500

- **Cause:** Missing `STRIPE_WEBHOOK_SECRET` or invalid signature
- **Fix:**
  1. Verify `STRIPE_WEBHOOK_SECRET` is set correctly
  2. Check webhook signing secret matches in Stripe Dashboard
  3. Verify webhook endpoint URL matches exactly

### Function Works Locally But Not in Production

- **Cause:** Environment variables only set locally
- **Fix:** Set secrets in Supabase Dashboard (they're separate from local env vars)

## Security Notes

⚠️ **Never commit secrets to git:**
- Secrets are stored encrypted in Supabase
- Local `.env` files should be in `.gitignore`
- Use Supabase Dashboard for production secrets

✅ **Best Practices:**
- Use test keys for development
- Use live keys only in production
- Rotate keys if compromised
- Use different keys for different environments






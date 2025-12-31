# Billing Troubleshooting Guide

## Quick Fix: Missing Environment Variables

If you see errors like `STRIPE_SECRET_KEY environment variable is not set!`:

👉 **See:** [SETUP_STRIPE_ENV_VARS.md](./SETUP_STRIPE_ENV_VARS.md) for complete setup instructions

**Quick Steps:**

1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Add `STRIPE_SECRET_KEY` with your Stripe secret key
3. Add `STRIPE_WEBHOOK_SECRET` with your webhook signing secret
4. Redeploy the webhook function

---

## Issue: Subscription Not Showing as Active After Payment

### Symptoms

- Payment completed successfully in Stripe
- User redirected back to upgrade page
- Plan still shows "Select Plan" instead of "Current Plan"
- `billing_subscriptions` table is empty or not updated

### Diagnosis Steps

#### 1. Check Webhook Delivery

1. Go to Stripe Dashboard → Developers → Webhooks
2. Find your webhook endpoint: `https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-webhook`
3. Check recent events:
   - Look for `checkout.session.completed` event
   - Check if it was delivered successfully (green checkmark)
   - If failed (red X), click to see error details

#### 2. Check Webhook Logs

1. Go to Supabase Dashboard → Edge Functions → `stripe-webhook` → Logs
2. Look for:
   - "Checkout session completed: cs_..."
   - "Extracted user_id from checkout session: ..."
   - "Successfully upserted billing subscription for user: ..."
   - Any error messages

#### 3. Verify Database Record

Run this SQL in Supabase SQL Editor:

```sql
SELECT * FROM billing_subscriptions 
WHERE user_id = 'YOUR_USER_ID_HERE';
```

If no record exists:

- Webhook didn't process yet (wait a few seconds)
- Webhook failed (check logs)
- user_id wasn't extracted correctly

#### 4. Check user_id Extraction

The webhook extracts user_id from:

1. `session.metadata.user_id` (preferred)
2. `session.client_reference_id` (fallback)

Verify the checkout session has these set:

- Check Stripe Dashboard → Payments → Checkout Sessions
- Find your session and check "Metadata" and "Client Reference ID"

### Common Issues

#### Issue: user_id is null in webhook

**Cause:** Checkout session wasn't created with user_id in metadata/client_reference_id

**Fix:**

- Update `create-stripe-subscription` function to set:
  - `client_reference_id: user.id`
  - `metadata[user_id]: user.id`

#### Issue: Webhook returns 200 but no database update

**Cause:** RLS policy blocking or service role key not set

**Fix:**

- Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Edge Function secrets
- Service role bypasses RLS, so this should work
- Check webhook logs for specific error messages

#### Issue: Price ID mismatch

**Cause:** Test vs Live price IDs don't match

**Fix:**

- Check what price ID is stored in `billing_subscriptions.stripe_price_id`
- Verify it matches one of the allowed price IDs in `useSubscriptionData.ts`
- Update price ID mapping if needed

### Manual Fix (If Webhook Failed)

If the webhook didn't process, you can manually create the record:

```sql
-- Get user_id from auth.users or parents table
-- Get subscription details from Stripe Dashboard

INSERT INTO billing_subscriptions (
  user_id,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  status,
  current_period_end,
  cancel_at_period_end
) VALUES (
  'USER_ID_HERE',
  'cus_...',
  'sub_...',
  'price_1SUVdqIIyqCwTeH2zggZpPAK', -- or annual price ID
  'active',
  '2025-02-23T00:00:00Z', -- from Stripe subscription
  false
) ON CONFLICT (user_id) DO UPDATE SET
  stripe_customer_id = EXCLUDED.stripe_customer_id,
  stripe_subscription_id = EXCLUDED.stripe_subscription_id,
  stripe_price_id = EXCLUDED.stripe_price_id,
  status = EXCLUDED.status,
  current_period_end = EXCLUDED.current_period_end;
```

### Testing Webhook Locally

1. Install Stripe CLI: <https://stripe.com/docs/stripe-cli>
2. Forward webhooks:

   ```bash
   stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
   ```

3. Trigger test event:

   ```bash
   stripe trigger checkout.session.completed
   ```

4. Check logs and database

### Verification Checklist

After a successful subscription:

- [ ] `billing_subscriptions` table has a record for the user
- [ ] `stripe_customer_id` is set
- [ ] `stripe_subscription_id` is set
- [ ] `stripe_price_id` matches one of the allowed price IDs
- [ ] `status` is "active"
- [ ] `current_period_end` is set to a future date
- [ ] Frontend can read the record (RLS policy working)
- [ ] UI shows "Current Plan" for the subscribed plan

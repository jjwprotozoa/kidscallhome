# Webhook Debug Checklist

## Issue: Webhook Not Processing Checkout Events

If `billing_subscriptions` table is not being updated after successful Stripe transactions, follow this checklist:

## Step 1: Verify Webhook is Configured in Stripe

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Find your webhook endpoint: `https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-webhook`
3. **Check:**
   - [ ] Webhook endpoint exists
   - [ ] Status is "Enabled" (not disabled)
   - [ ] Events are configured:
     - [ ] `checkout.session.completed`
     - [ ] `customer.subscription.created`
     - [ ] `customer.subscription.updated`
     - [ ] `customer.subscription.deleted`
     - [ ] `invoice.payment_succeeded`
     - [ ] `invoice.payment_failed`

## Step 2: Check Recent Webhook Events

1. In Stripe Dashboard → Webhooks → Your endpoint
2. Click on "Recent events" or "Events"
3. **Look for:**
   - [ ] `checkout.session.completed` events after your test payment
   - [ ] Check delivery status:
     - ✅ Green checkmark = Delivered successfully
     - ❌ Red X = Failed (click to see error)
     - ⏳ Clock icon = Pending

4. **If events show as failed:**
   - Click on the failed event
   - Check the error message
   - Common errors:
     - "Webhook signature verification failed" → Wrong `STRIPE_WEBHOOK_SECRET`
     - "500 Internal Server Error" → Check Supabase logs
     - "404 Not Found" → Webhook endpoint URL is wrong

## Step 3: Check Supabase Webhook Logs

1. Go to Supabase Dashboard → Edge Functions → `stripe-webhook` → Logs
2. **Look for these log entries:**
   - [ ] "Webhook endpoint called:" (confirms webhook is receiving requests)
   - [ ] "Webhook signature verified successfully. Event type: checkout.session.completed"
   - [ ] "Checkout session completed: cs_..."
   - [ ] "Extracted user_id from checkout session: ..."
   - [ ] "Successfully upserted billing subscription for user: ..."

3. **If you see errors:**
   - "Missing signature" → Stripe isn't sending signature header (unlikely)
   - "Webhook secret not configured" → `STRIPE_WEBHOOK_SECRET` not set
   - "Stripe secret key not configured" → `STRIPE_SECRET_KEY_LIVE` or `STRIPE_SECRET_KEY` not set
   - "Webhook signature verification failed" → Wrong webhook secret

## Step 4: Verify Environment Variables

1. Go to Supabase Dashboard → Edge Functions → Secrets
2. **Verify these are set:**
   - [ ] `STRIPE_SECRET_KEY_LIVE` = `sk_live_...` (or `STRIPE_SECRET_KEY`)
   - [ ] `STRIPE_WEBHOOK_SECRET` = `whsec_...`
   - [ ] `SUPABASE_SERVICE_ROLE_KEY` = (auto-set, but verify it exists)

3. **Get webhook secret:**
   - Go to Stripe Dashboard → Webhooks → Your endpoint
   - Click "Reveal" next to "Signing secret"
   - Copy the secret (starts with `whsec_`)
   - Make sure it matches what's in Supabase

## Step 5: Test Webhook Manually

### Option A: Send Test Webhook from Stripe

1. Go to Stripe Dashboard → Webhooks → Your endpoint
2. Click "Send test webhook"
3. Select event: `checkout.session.completed`
4. Click "Send test webhook"
5. Check Supabase logs for processing

### Option B: Use Stripe CLI (Local Testing)

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local Supabase
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook

# In another terminal, trigger test event
stripe trigger checkout.session.completed
```

## Step 6: Check Database Directly

Run this SQL to check if any records exist:

```sql
-- Check if any billing subscriptions exist
SELECT * FROM billing_subscriptions 
ORDER BY created_at DESC 
LIMIT 10;

-- Check for specific user
SELECT * FROM billing_subscriptions 
WHERE user_id = 'YOUR_USER_ID_HERE';
```

**If no records exist:**

- Webhook hasn't processed any events yet
- Webhook is failing silently
- Check logs for errors

## Step 7: Verify Checkout Session Metadata

The webhook needs `user_id` from the checkout session. Verify it's being set:

1. Go to Stripe Dashboard → Payments → Checkout Sessions
2. Find your recent checkout session
3. **Check:**
   - [ ] "Client Reference ID" is set (should be user_id)
   - [ ] "Metadata" contains `user_id` field

4. **If missing:**
   - The `create-stripe-subscription` function needs to set:
     - `client_reference_id: user.id`
     - `metadata[user_id]: user.id`

## Common Issues & Fixes

### Issue: "Webhook signature verification failed"

**Cause:** Webhook secret doesn't match

**Fix:**

1. Get the correct secret from Stripe Dashboard → Webhooks → Your endpoint
2. Update `STRIPE_WEBHOOK_SECRET` in Supabase
3. Redeploy webhook function (or wait for next event)

### Issue: "No user_id found in checkout session"

**Cause:** Checkout session wasn't created with user_id

**Fix:**

1. Update `create-stripe-subscription` function to set:

   ```typescript
   client_reference_id: user.id,
   "metadata[user_id]": user.id,
   ```

2. Redeploy the function
3. Test with a new checkout session

### Issue: Webhook returns 200 but no database update

**Cause:** Database upsert is failing silently

**Fix:**

1. Check webhook logs for "Error upserting billing subscription"
2. Verify RLS policies allow service role to write
3. Check `SUPABASE_SERVICE_ROLE_KEY` is set correctly

### Issue: Events show as "Delivered" but logs show nothing

**Cause:** Webhook function might not be deployed or is using old code

**Fix:**

1. Redeploy webhook function with latest code
2. Verify function is active in Supabase Dashboard
3. Check function code matches `supabase/functions/stripe-webhook/index.ts`

## Quick Test Script

After fixing issues, test with this flow:

1. ✅ Create a test checkout session
2. ✅ Complete payment in Stripe
3. ✅ Check Stripe Dashboard → Webhooks → Recent events (should show `checkout.session.completed`)
4. ✅ Check Supabase Dashboard → Edge Functions → `stripe-webhook` → Logs (should show processing)
5. ✅ Check database: `SELECT * FROM billing_subscriptions WHERE user_id = '...'`
6. ✅ Refresh `/parent/upgrade` page (should show "Current Plan")

## Still Not Working?

If webhook still isn't processing:

1. **Check webhook endpoint URL:**
   - Must be exactly: `https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-webhook`
   - No trailing slash
   - Correct project ID

2. **Check webhook is receiving events:**
   - Stripe Dashboard should show events being sent
   - Supabase logs should show "Webhook endpoint called"

3. **Check function is deployed:**
   - Supabase Dashboard → Edge Functions → `stripe-webhook`
   - Status should be "Active"
   - Last deployed should be recent

4. **Manual database insert (temporary fix):**
   - If webhook continues to fail, you can manually insert the record
   - See `BILLING_TROUBLESHOOTING.md` for SQL

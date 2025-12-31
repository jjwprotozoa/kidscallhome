# Stripe Webhook Setup Guide

## ⚠️ Important: Configure Webhook in Stripe Dashboard

The webhook must be configured in **Stripe Dashboard**, not just Supabase. Supabase webhooks are for sending events FROM Supabase, not receiving events FROM Stripe.

## Step 1: Configure Webhook in Stripe Dashboard

1. **Go to Stripe Dashboard:**
   - Visit: <https://dashboard.stripe.com/webhooks>
   - Make sure you're in the correct mode (Test or Live)

2. **Add Webhook Endpoint:**
   - Click **"Add endpoint"** button (top right)
   - **Endpoint URL:** `https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-webhook`
   - **Description:** "KidsCallHome Subscription Webhook"
   - Click **"Add endpoint"**

3. **Select Events to Listen To:**
   After creating the endpoint, you'll see "Select events to listen to"

   **Required Events:**
   - ✅ `checkout.session.completed` - When checkout is completed
   - ✅ `customer.subscription.created` - When subscription is created
   - ✅ `customer.subscription.updated` - When subscription is updated
   - ✅ `customer.subscription.deleted` - When subscription is cancelled
   - ✅ `invoice.payment_succeeded` - When payment succeeds
   - ✅ `invoice.payment_failed` - When payment fails
   - ✅ `invoice.payment_action_required` - When payment needs action

   **Quick Select:**
   - Click **"Select events"**
   - Search for each event above
   - Or use **"Select all events"** and filter later

4. **Save and Get Signing Secret:**
   - Click **"Add endpoint"** or **"Save"**
   - **IMPORTANT:** Copy the **"Signing secret"** (starts with `whsec_...`)
   - This is shown immediately after creating the endpoint
   - If you missed it, click on the endpoint → **"Reveal"** next to "Signing secret"

## Step 2: Add Signing Secret to Supabase

1. **Go to Supabase Dashboard:**
   - Visit: <https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt/settings/functions>
   - Or: Project Settings → Edge Functions → Secrets

2. **Add Secret:**
   - Click **"Add new secret"**
   - **Name:** `STRIPE_WEBHOOK_SECRET`
   - **Value:** Paste the signing secret from Stripe (starts with `whsec_...`)
   - Click **"Save"**

## Step 3: Verify Webhook is Active

1. **In Stripe Dashboard → Webhooks:**
   - Find your endpoint: `https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-webhook`
   - Status should show **"Enabled"** (green)
   - Should show number of events (e.g., "7 events")

2. **Test the Webhook:**
   - Click on your webhook endpoint
   - Click **"Send test webhook"** button
   - Select event: `checkout.session.completed`
   - Click **"Send test webhook"**

3. **Check Supabase Logs:**
   - Go to Supabase Dashboard → Edge Functions → `stripe-webhook` → Logs
   - You should see:
     - "Webhook endpoint called:"
     - "Webhook signature verified successfully"
     - "Checkout session completed: cs_..."

## Step 4: Verify After Real Payment

After a real checkout:

1. **Check Stripe Dashboard → Webhooks → Your endpoint:**
   - Click on your endpoint
   - Go to **"Recent events"** tab
   - Look for `checkout.session.completed` event
   - Status should be ✅ (green checkmark = delivered)

2. **If Event Shows as Failed:**
   - Click on the failed event
   - Check error message:
     - "Webhook signature verification failed" → Wrong `STRIPE_WEBHOOK_SECRET`
     - "500 Internal Server Error" → Check Supabase logs
     - "404 Not Found" → Webhook URL is wrong

3. **Check Supabase Logs:**
   - Supabase Dashboard → Edge Functions → `stripe-webhook` → Logs
   - Should show processing of the event

## Common Issues

### Issue: "No events in Stripe Dashboard"

**Cause:** Webhook endpoint not configured in Stripe

**Fix:** Follow Step 1 above to create the webhook endpoint in Stripe Dashboard

### Issue: "Events show as failed in Stripe"

**Cause:** Webhook secret mismatch or function error

**Fix:**

1. Verify `STRIPE_WEBHOOK_SECRET` in Supabase matches Stripe
2. Check Supabase logs for error details
3. Redeploy webhook function

### Issue: "Webhook shows as disabled"

**Cause:** Webhook was disabled in Stripe

**Fix:**

1. Go to Stripe Dashboard → Webhooks
2. Click on your endpoint
3. Toggle **"Enabled"** to ON

### Issue: "Wrong webhook secret"

**Cause:** Using test mode secret with live mode, or vice versa

**Fix:**

1. Make sure you're using the correct secret for your mode
2. Test mode webhooks have different secrets than Live mode
3. Get the secret from the correct mode in Stripe Dashboard

## Verification Checklist

After setup, verify:

- [ ] Webhook endpoint created in Stripe Dashboard
- [ ] Endpoint URL is correct: `https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-webhook`
- [ ] Events are selected (at least `checkout.session.completed`)
- [ ] Webhook status is "Enabled" in Stripe
- [ ] `STRIPE_WEBHOOK_SECRET` is set in Supabase
- [ ] Test webhook works (check Supabase logs)
- [ ] Real checkout triggers webhook (check Stripe → Recent events)

## Next Steps

Once webhook is configured:

1. Make a test payment
2. Check Stripe Dashboard → Webhooks → Recent events (should show `checkout.session.completed`)
3. Check Supabase Dashboard → Edge Functions → `stripe-webhook` → Logs (should show processing)
4. Check database: `SELECT * FROM billing_subscriptions` (should have new record)

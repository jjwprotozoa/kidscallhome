# Stripe Test Webhook Setup Guide

## Step 1: Switch to Test Mode in Stripe

1. **Go to Stripe Dashboard:**
   - Visit: https://dashboard.stripe.com/test/webhooks
   - Or go to https://dashboard.stripe.com and toggle **"Test mode"** in the top right (toggle should say "Test mode" when active)

2. **Verify You're in Test Mode:**
   - Look at the top right of Stripe Dashboard
   - Should see **"Test mode"** toggle (not "Live mode")
   - URL should include `/test/` if you used the direct link

## Step 2: Create Test Webhook Endpoint

1. **Navigate to Webhooks:**
   - In Stripe Dashboard, go to **Developers** → **Webhooks**
   - Or visit: https://dashboard.stripe.com/test/webhooks

2. **Add Endpoint:**
   - Click **"Add endpoint"** button (top right, blue button)
   - You'll see a form to create a new webhook

3. **Enter Endpoint Details:**
   - **Endpoint URL:** `https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-webhook`
   - **Description:** "KidsCallHome Test Webhook" (optional but helpful)
   - Click **"Add endpoint"** button at the bottom

## Step 3: Select Events for Test Webhook

After clicking "Add endpoint", you'll see a screen to select events:

1. **Click "Select events"** or **"Add events"**

2. **Search and Select These Events:**
   - Type in the search box or scroll to find:
     - ✅ `checkout.session.completed`
     - ✅ `customer.subscription.created`
     - ✅ `customer.subscription.updated`
     - ✅ `customer.subscription.deleted`
     - ✅ `invoice.payment_succeeded`
     - ✅ `invoice.payment_failed`
     - ✅ `invoice.payment_action_required`

3. **Select Each Event:**
   - Click the checkbox next to each event
   - Or use the search box to find them quickly

4. **Save Events:**
   - Click **"Add events"** or **"Save"** button
   - You should see "7 events" or similar count

## Step 4: Copy Test Webhook Signing Secret

**IMPORTANT:** Do this immediately after creating the endpoint!

1. **After Adding Events:**
   - You'll see a screen showing your webhook endpoint
   - **Look for "Signing secret"** section
   - Click **"Reveal"** or **"Click to reveal"** button
   - Copy the secret (starts with `whsec_...`)
   - **Save it somewhere safe** - you'll need it for Supabase

2. **If You Missed It:**
   - Go to Webhooks → Click on your endpoint
   - Look for **"Signing secret"** section
   - Click **"Reveal"** button
   - Copy the secret

## Step 5: Add Test Webhook Secret to Supabase

1. **Go to Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt/settings/functions
   - Or: Project Settings → Edge Functions → Secrets

2. **Add Secret:**
   - Click **"Add new secret"** button
   - **Name:** `STRIPE_WEBHOOK_SECRET`
   - **Value:** Paste the test webhook secret from Stripe (starts with `whsec_...`)
   - **Note:** If you already have this secret set, you can update it or use a different name like `STRIPE_WEBHOOK_SECRET_TEST` for test mode
   - Click **"Save"**

## Step 6: Test the Webhook

1. **In Stripe Dashboard → Webhooks:**
   - Click on your test webhook endpoint
   - Scroll down to find **"Send test webhook"** section
   - Click **"Send test webhook"** button

2. **Select Test Event:**
   - A modal will appear
   - Select event: `checkout.session.completed`
   - Click **"Send test webhook"**

3. **Check Results:**
   - In Stripe: You should see the event appear in "Recent events" with a green checkmark ✅
   - In Supabase: Go to Edge Functions → `stripe-webhook` → Logs
   - You should see:
     - "Webhook endpoint called:"
     - "Webhook signature verified successfully"
     - "Checkout session completed: cs_test_..."

## Step 7: Verify Test Mode Configuration

### In Stripe:
- [ ] Test mode toggle is ON (top right of Stripe Dashboard)
- [ ] Webhook endpoint shows "Enabled" status
- [ ] Webhook shows "7 events" (or number of events you selected)
- [ ] Test webhook sends successfully (green checkmark)

### In Supabase:
- [ ] `STRIPE_WEBHOOK_SECRET` is set with test mode secret
- [ ] `STRIPE_SECRET_KEY_TEST` is set (for test mode API calls)
- [ ] Webhook function logs show successful processing

## Important Notes

### Test vs Live Mode Secrets

- **Test mode webhook secret:** Starts with `whsec_...` (from test mode webhook)
- **Live mode webhook secret:** Different `whsec_...` (from live mode webhook)
- **They are different!** Make sure you're using the test mode secret for testing

### Using Test Mode

When testing:
- Use Stripe test cards: https://stripe.com/docs/testing
- Test card: `4242 4242 4242 4242`
- Any future expiry date
- Any 3-digit CVC
- Any ZIP code

### Switching Between Test and Live

- **For testing:** Use test mode in Stripe + test webhook secret in Supabase
- **For production:** Use live mode in Stripe + live webhook secret in Supabase
- You can have both configured, but make sure you're using the right one for your current mode

## Troubleshooting

### Issue: "Can't find webhook endpoint in Stripe"

**Fix:**
- Make sure you're in **Test mode** (toggle in top right)
- Go to Developers → Webhooks
- Look for your endpoint URL

### Issue: "Webhook secret doesn't work"

**Fix:**
- Make sure you copied the secret from **Test mode** webhook
- Test mode secrets are different from Live mode secrets
- Verify the secret starts with `whsec_`

### Issue: "Test webhook fails"

**Fix:**
1. Check Supabase logs for error messages
2. Verify `STRIPE_WEBHOOK_SECRET` is set correctly
3. Make sure webhook function is deployed
4. Check webhook endpoint URL is correct

### Issue: "No events selected"

**Fix:**
- Click on your webhook endpoint in Stripe
- Click "Edit" or "Manage events"
- Add the required events (see Step 3)

## Quick Reference

**Test Webhook URL:**
```
https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-webhook
```

**Required Events:**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `invoice.payment_action_required`

**Test Cards:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- More: https://stripe.com/docs/testing

## Next Steps

After setting up test webhook:

1. ✅ Test webhook works (Step 6)
2. ✅ Make a test payment using test card
3. ✅ Check Stripe → Webhooks → Recent events (should show `checkout.session.completed`)
4. ✅ Check Supabase → Edge Functions → `stripe-webhook` → Logs (should show processing)
5. ✅ Check database: `SELECT * FROM billing_subscriptions` (should have test record)

Once test mode works, you can set up live mode webhook the same way (but in Live mode in Stripe).






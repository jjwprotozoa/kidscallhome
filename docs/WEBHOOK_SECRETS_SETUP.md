# Webhook Secrets Setup Guide

## Overview

Your webhook function now supports both **test mode** and **live mode** webhook secrets. This allows you to test with Stripe test mode and use live mode in production without changing code.

## Environment Variables

Set these in Supabase Dashboard → Edge Functions → Secrets:

### For Test Mode (Localhost/Testing):
- **Name:** `STRIPE_WEBHOOK_SECRET_TEST`
- **Value:** Your test mode webhook signing secret from Stripe (starts with `whsec_...`)
- **Get it from:** Stripe Dashboard → Test Mode → Webhooks → Your endpoint → Signing secret

### For Live Mode (Production):
- **Name:** `STRIPE_WEBHOOK_SECRET`
- **Value:** Your live mode webhook signing secret from Stripe (starts with `whsec_...`)
- **Get it from:** Stripe Dashboard → Live Mode → Webhooks → Your endpoint → Signing secret

## How It Works

The webhook function automatically detects which mode the event is from:

1. **Checks event `livemode` property:**
   - `livemode: false` → Uses `STRIPE_WEBHOOK_SECRET_TEST`
   - `livemode: true` → Uses `STRIPE_WEBHOOK_SECRET`

2. **Fallback behavior:**
   - If test event but no test secret → Falls back to live secret
   - If live event but no live secret → Falls back to test secret
   - If verification fails with first secret → Tries the other secret

3. **Logging:**
   - Logs which mode was detected
   - Logs which secret was used
   - Logs verification success/failure

## Setup Steps

### Step 1: Create Test Mode Webhook in Stripe

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. URL: `https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-webhook`
4. Select events (see main webhook setup guide)
5. Copy the signing secret (starts with `whsec_...`)

### Step 2: Create Live Mode Webhook in Stripe

1. Go to: https://dashboard.stripe.com/webhooks (Live mode)
2. Click "Add endpoint"
3. URL: `https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-webhook`
4. Select events (same as test mode)
5. Copy the signing secret (different from test mode!)

### Step 3: Add Secrets to Supabase

1. Go to: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt/settings/functions
2. Add `STRIPE_WEBHOOK_SECRET_TEST` with test mode secret
3. Add `STRIPE_WEBHOOK_SECRET` with live mode secret

## Verification

### Test Mode:
1. Send test webhook from Stripe (Test mode)
2. Check Supabase logs:
   - Should see: "Event livemode: false isTestMode: true"
   - Should see: "Webhook signature verified successfully. Event type: ... Mode: TEST"

### Live Mode:
1. Make a real payment (Live mode)
2. Check Supabase logs:
   - Should see: "Event livemode: true isTestMode: false"
   - Should see: "Webhook signature verified successfully. Event type: ... Mode: LIVE"

## Current Setup

Based on your configuration:

- ✅ **Test Mode:** `STRIPE_WEBHOOK_SECRET_TEST` (for localhost/testing)
- ✅ **Live Mode:** `STRIPE_WEBHOOK_SECRET` (for "Kids Call Home - Supabase Webhook" production)

## Troubleshooting

### Issue: "Webhook signature verification failed"

**Possible causes:**
1. Wrong secret for the mode (test vs live)
2. Secret not set in Supabase
3. Webhook endpoint URL mismatch

**Fix:**
1. Verify you're using the correct secret for the mode
2. Check Stripe Dashboard → Webhooks → Your endpoint → Signing secret
3. Make sure secret in Supabase matches exactly (no extra spaces)

### Issue: "No webhook secret available for test/live mode"

**Cause:** The required secret for that mode is not set

**Fix:**
- For test mode: Set `STRIPE_WEBHOOK_SECRET_TEST`
- For live mode: Set `STRIPE_WEBHOOK_SECRET`

### Issue: Works in test but not live (or vice versa)

**Cause:** Only one secret is configured

**Fix:**
- Make sure both `STRIPE_WEBHOOK_SECRET_TEST` and `STRIPE_WEBHOOK_SECRET` are set
- Each mode needs its own webhook endpoint in Stripe and its own secret

## Best Practices

1. **Always test in test mode first** before using live mode
2. **Keep secrets separate** - don't mix test and live secrets
3. **Verify both modes work** before going to production
4. **Check logs** to confirm which mode is being used

## Quick Reference

**Test Mode Webhook:**
- Stripe: https://dashboard.stripe.com/test/webhooks
- Secret env var: `STRIPE_WEBHOOK_SECRET_TEST`
- Event `livemode`: `false`

**Live Mode Webhook:**
- Stripe: https://dashboard.stripe.com/webhooks
- Secret env var: `STRIPE_WEBHOOK_SECRET`
- Event `livemode`: `true`

**Both use same endpoint:**
```
https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-webhook
```




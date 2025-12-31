# Verify Live Mode Stripe Setup

## ✅ Environment Variables Checklist

Based on your setup, verify these are set in Supabase Dashboard → Edge Functions → Secrets:

### Required Secrets:

- [x] `STRIPE_SECRET_KEY_LIVE` - Your live mode secret key (`sk_live_...`)
- [x] `STRIPE_SECRET_KEY_TEST` - Your test mode secret key (`sk_test_...`)  
- [x] `STRIPE_WEBHOOK_SECRET` - Your webhook signing secret (`whsec_...`)
- [x] `STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY` = `price_1SUVdqIIyqCwTeH2zggZpPAK`
- [x] `STRIPE_PRICE_FAMILY_BUNDLE_ANNUAL` = `price_1SkPL7IIyqCwTeH2tI9TxHRB`

### Optional (Fallback):

- [ ] `STRIPE_SECRET_KEY` - Can be set as fallback (will use LIVE if available)

## ✅ Price IDs Verification

### Monthly Plan:
- **Price ID:** `price_1SUVdqIIyqCwTeH2zggZpPAK`
- **Status:** ✅ Confirmed in code
- **Location:** 
  - Frontend: `src/pages/Upgrade/Upgrade.tsx` (line 158)
  - Frontend: `src/pages/Upgrade/useSubscriptionData.ts` (line 69)
  - Backend: Uses env var `STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY`

### Annual Plan:
- **Price ID:** `price_1SkPL7IIyqCwTeH2tI9TxHRB`
- **Status:** ✅ Confirmed in code
- **Location:**
  - Frontend: `src/pages/Upgrade/Upgrade.tsx` (line 159)
  - Frontend: `src/pages/Upgrade/useSubscriptionData.ts` (line 70)
  - Backend: Uses env var `STRIPE_PRICE_FAMILY_BUNDLE_ANNUAL`

## 🔍 How It Works

### For Production (Live Mode):

1. **Checkout Session Creation** (`create-stripe-subscription`):
   - Detects origin is NOT localhost → Uses LIVE mode
   - Gets price ID from: `STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY` or `STRIPE_PRICE_FAMILY_BUNDLE_ANNUAL`
   - Uses Stripe key from: `STRIPE_SECRET_KEY_LIVE` (or `STRIPE_SECRET_KEY` as fallback)
   - Creates checkout session with live mode price IDs

2. **Webhook Processing** (`stripe-webhook`):
   - Uses: `STRIPE_SECRET_KEY_LIVE` (preferred) or `STRIPE_SECRET_KEY` (fallback)
   - Verifies webhook signature using: `STRIPE_WEBHOOK_SECRET`
   - Stores subscription in `billing_subscriptions` table
   - Price ID is stored as-is from Stripe (should match your live price IDs)

3. **Frontend Display** (`useSubscriptionData`):
   - Reads from `billing_subscriptions` table
   - Matches `stripe_price_id` against known price IDs:
     - `price_1SUVdqIIyqCwTeH2zggZpPAK` → "family-bundle-monthly"
     - `price_1SkPL7IIyqCwTeH2tI9TxHRB` → "family-bundle-annual"
   - Shows "Current Plan" if subscription is active

## 🧪 Testing Checklist

### 1. Test Checkout Session Creation

1. Navigate to `/parent/upgrade` on your production site
2. Click "Select Plan" on Monthly or Annual
3. Should redirect to Stripe Checkout (live mode)
4. Complete test payment
5. Should redirect back with `?success=1&session_id=...`

### 2. Test Webhook Processing

1. After completing checkout, check:
   - **Stripe Dashboard** → Webhooks → Your endpoint → Recent events
   - Should see `checkout.session.completed` event (green checkmark)
   
2. Check **Supabase Dashboard** → Edge Functions → `stripe-webhook` → Logs
   - Should see: "Checkout session completed: cs_..."
   - Should see: "Extracted user_id from checkout session: ..."
   - Should see: "Successfully upserted billing subscription for user: ..."

3. Check **Database**:
   ```sql
   SELECT * FROM billing_subscriptions 
   WHERE stripe_price_id IN (
     'price_1SUVdqIIyqCwTeH2zggZpPAK',
     'price_1SkPL7IIyqCwTeH2tI9TxHRB'
   );
   ```
   - Should see your subscription record
   - `status` should be "active"
   - `stripe_price_id` should match one of your price IDs

### 3. Test UI Display

1. After subscription is created, refresh `/parent/upgrade`
2. Should see:
   - "Current Plan" badge on the subscribed plan
   - Button should say "Current Plan" and be disabled
   - Subscription details should show renewal date

## ⚠️ Common Issues

### Issue: "Price ID not configured" Error

**Symptoms:** Error message says price ID is missing for LIVE mode

**Fix:**
1. Verify `STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY` and `STRIPE_PRICE_FAMILY_BUNDLE_ANNUAL` are set
2. Check the values match exactly (no extra spaces)
3. Redeploy the `create-stripe-subscription` function after setting env vars

### Issue: Webhook Not Processing

**Symptoms:** Payment succeeds but no database record

**Fix:**
1. Verify `STRIPE_WEBHOOK_SECRET` is set correctly
2. Check webhook endpoint URL in Stripe matches exactly
3. Verify webhook is receiving events (check Stripe Dashboard)
4. Check webhook logs in Supabase for errors

### Issue: Wrong Price ID in Database

**Symptoms:** Subscription created but UI doesn't recognize it

**Fix:**
1. Check what price ID is stored: `SELECT stripe_price_id FROM billing_subscriptions WHERE user_id = '...'`
2. Verify it matches one of the recognized price IDs in `useSubscriptionData.ts`
3. If different, either:
   - Update the price ID mapping in code, OR
   - Fix the Stripe price ID configuration

## 📝 Next Steps

1. ✅ Environment variables are set
2. ✅ Price IDs are confirmed
3. ⏳ Test a live subscription
4. ⏳ Verify webhook processes it
5. ⏳ Confirm UI displays correctly

## 🔗 Related Documentation

- [SETUP_STRIPE_ENV_VARS.md](./SETUP_STRIPE_ENV_VARS.md) - Complete environment variable setup
- [BILLING_TROUBLESHOOTING.md](./BILLING_TROUBLESHOOTING.md) - Troubleshooting guide
- [DEPLOY_BILLING_FUNCTIONS.md](./DEPLOY_BILLING_FUNCTIONS.md) - Deployment instructions


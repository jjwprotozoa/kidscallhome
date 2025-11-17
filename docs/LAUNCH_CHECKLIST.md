# Stripe + Supabase Subscription Launch Checklist

## ✅ Immediate Actions

### 1. Run Final Migration

**Status:** ⏳ **PENDING**

```bash
# Run this migration to fix function overload conflicts
supabase migration up
```

Or manually in Supabase SQL Editor:

```sql
-- File: supabase/migrations/20250122000011_fix_function_overload.sql
```

**Verification:**

```sql
-- Check function exists with correct signature
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname = 'upgrade_family_subscription';
```

---

### 2. Create Stripe Products & Prices

**Status:** ⏳ **PENDING** (Do in Stripe Dashboard)

#### Steps:

1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. Click **"+ Add product"**

#### Product 1: Additional Kid Monthly

- **Name:** Additional Kid Monthly
- **Description:** Add one more child to your account
- **Pricing:**
  - Amount: $2.99
  - Billing: Recurring
  - Interval: Monthly
- **Copy Price ID:** `price_...` (starts with `price_`)

#### Product 2: Additional Kid Annual

- **Name:** Additional Kid Annual
- **Description:** Add one more child (save 17% vs monthly)
- **Pricing:**
  - Amount: $29.99
  - Billing: Recurring
  - Interval: Yearly
- **Copy Price ID:** `price_...`

#### Product 3: Family Bundle Monthly

- **Name:** Family Bundle Monthly
- **Description:** Perfect for families with up to 5 kids
- **Pricing:**
  - Amount: $14.99
  - Billing: Recurring
  - Interval: Monthly
- **Copy Price ID:** `price_...`

#### Product 4: Annual Family Plan

- **Name:** Annual Family Plan
- **Description:** Best value - unlimited kids for the whole family
- **Pricing:**
  - Amount: $99.00
  - Billing: Recurring
  - Interval: Yearly
- **Copy Price ID:** `price_...`

**⚠️ Important:** Create these in **Test Mode** first, then duplicate for **Live Mode** when ready.

---

### 3. Configure Environment Variables

**Status:** ⏳ **PENDING**

#### A. Supabase Edge Functions Secrets

**Location:** Supabase Dashboard → Project Settings → Edge Functions → Secrets

**Add these secrets:**

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_... # Test mode key (change to sk_live_... for production)
STRIPE_WEBHOOK_SECRET=whsec_... # Webhook signing secret (get from webhook endpoint)

# Stripe Price IDs (from step 2)
STRIPE_PRICE_ADDITIONAL_KID_MONTHLY=price_...
STRIPE_PRICE_ADDITIONAL_KID_ANNUAL=price_...
STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL_FAMILY_PLAN=price_...
```

**How to add:**

1. Go to Supabase Dashboard → Project Settings → Edge Functions
2. Click "Secrets" tab
3. Click "Add new secret"
4. Add each secret one by one

#### B. Frontend Environment Variables

**Location:** Create `.env.local` file in project root

```bash
# Stripe Publishable Key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... # Test mode (change to pk_live_... for production)
```

**How to add:**

1. Create `.env.local` file in project root
2. Add the variable above
3. Restart dev server: `npm run dev`

**⚠️ Security:** Never commit `.env.local` to git (should be in `.gitignore`)

---

### 4. Deploy Edge Functions

**Status:** ⏳ **PENDING**

#### Deploy Commands:

```bash
# Deploy all three Edge Functions
supabase functions deploy create-stripe-subscription
supabase functions deploy stripe-webhook
supabase functions deploy create-customer-portal-session
```

#### Verify Deployment:

**Check endpoints are accessible:**

- `https://[your-project].supabase.co/functions/v1/create-stripe-subscription`
- `https://[your-project].supabase.co/functions/v1/stripe-webhook`
- `https://[your-project].supabase.co/functions/v1/create-customer-portal-session`

**Test endpoint (should return 401 without auth):**

```bash
curl https://[your-project].supabase.co/functions/v1/create-stripe-subscription
# Should return: {"error":"Missing authorization header"}
```

---

### 5. Set Up Stripe Webhook Endpoint

**Status:** ⏳ **PENDING** (Do in Stripe Dashboard)

#### Steps:

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **"+ Add endpoint"**
3. **Endpoint URL:** `https://[your-project].supabase.co/functions/v1/stripe-webhook`
4. **Description:** "Kids Call Home Subscription Webhooks"
5. **Events to send:** Select these events:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`
   - ✅ `invoice.payment_action_required` ⭐ (for 3DS)
6. Click **"Add endpoint"**
7. **Copy Signing Secret:** Click on the endpoint → "Signing secret" → "Reveal" → Copy `whsec_...`
8. **Add to Supabase Secrets:** Use this as `STRIPE_WEBHOOK_SECRET`

#### Test Webhook:

1. In Stripe Dashboard → Webhooks → Your endpoint
2. Click **"Send test webhook"**
3. Select event: `checkout.session.completed`
4. Click **"Send test webhook"**
5. Check Supabase Edge Function logs for receipt

---

## 🧪 Testing

### Test Plan

#### A. Subscription Creation Flow

**Test Case 1: Successful Subscription**

1. ✅ Go to `/parent/upgrade`
2. ✅ Select a plan (e.g., "Family Bundle Monthly")
3. ✅ Confirm email
4. ✅ Click "Complete Payment"
5. ✅ Should redirect to Stripe Checkout
6. ✅ Use test card: `4242 4242 4242 4242`
7. ✅ Complete payment
8. ✅ Should redirect back with `?session_id=xxx`
9. ✅ Check database: `subscription_status` should be `active`
10. ✅ Check Stripe Dashboard: Subscription should be `active`

**Test Case 2: 3DS Authentication**

1. ✅ Use test card requiring 3DS: `4000 0025 0000 3155`
2. ✅ Should show 3DS authentication modal
3. ✅ Complete authentication
4. ✅ Payment should succeed
5. ✅ Subscription should activate

**Test Case 3: Payment Failure**

1. ✅ Use declined card: `4000 0000 0000 0002`
2. ✅ Should show error message
3. ✅ Subscription should remain `incomplete`
4. ✅ User can retry payment

#### B. Subscription Limits

**Test Case 4: Child Limit Enforcement**

1. ✅ Subscribe to "Family Bundle Monthly" (5 children limit)
2. ✅ Add 5 children → Should succeed
3. ✅ Try to add 6th child → Should fail with "Subscription Limit Reached"
4. ✅ Check "Add Child" button is disabled

**Test Case 5: Free Tier Limit**

1. ✅ Start with free tier (1 child limit)
2. ✅ Add 1 child → Should succeed
3. ✅ Try to add 2nd child → Should fail
4. ✅ Upgrade to paid plan
5. ✅ Should be able to add more children

#### C. Subscription Management

**Test Case 6: Cancellation**

1. ✅ Go to `/parent/settings`
2. ✅ Click "Cancel Subscription"
3. ✅ Confirm cancellation
4. ✅ Check database: `subscription_status` should be `cancelled`
5. ✅ Check `subscription_expires_at` is set
6. ✅ User should still have access until expiration

**Test Case 7: Resubscribe**

1. ✅ After cancelling, go to `/parent/upgrade`
2. ✅ Should show "Resubscribe" option
3. ✅ Select plan and complete payment
4. ✅ Subscription should reactivate

#### D. Webhook Events

**Test Case 8: Webhook Signature Verification**

1. ✅ Send invalid webhook (wrong signature)
2. ✅ Should be rejected (check logs)
3. ✅ Send valid webhook
4. ✅ Should be processed successfully

**Test Case 9: Subscription Status Updates**

1. ✅ Create subscription
2. ✅ Check webhook fires: `customer.subscription.created`
3. ✅ Database should update automatically
4. ✅ Cancel subscription in Stripe Dashboard
5. ✅ Check webhook fires: `customer.subscription.deleted`
6. ✅ Database should update to `cancelled`

#### E. Security

**Test Case 10: Email Verification**

1. ✅ Try to upgrade with different email
2. ✅ Should fail with "You can only upgrade your own account"
3. ✅ Check backend also verifies `auth.uid()`

**Test Case 11: Duplicate Payment Prevention**

1. ✅ Complete payment successfully
2. ✅ Try to use same checkout session ID again
3. ✅ Should fail with "payment already processed"

---

## 🚀 Go Live Checklist

### Pre-Launch

- [ ] All tests pass in test mode
- [ ] Webhook signature verification working
- [ ] 3DS authentication working
- [ ] Subscription limits enforced
- [ ] Cancellation flow working
- [ ] Error handling tested

### Switch to Live Mode

1. **Stripe Dashboard:**

   - [ ] Create Products & Prices in **Live Mode**
   - [ ] Copy Live Mode Price IDs
   - [ ] Get Live Mode API keys (`sk_live_...`, `pk_live_...`)
   - [ ] Create Live Mode webhook endpoint
   - [ ] Copy Live Mode webhook secret (`whsec_...`)

2. **Supabase:**

   - [ ] Update Edge Function secrets with Live Mode keys
   - [ ] Update Price IDs in secrets
   - [ ] Update webhook secret

3. **Frontend:**

   - [ ] Update `.env.local` with Live Mode publishable key
   - [ ] Rebuild and deploy frontend

4. **Verification:**
   - [ ] Test one subscription in Live Mode
   - [ ] Verify webhook receives events
   - [ ] Check database updates correctly
   - [ ] Monitor Stripe Dashboard for errors

---

## 📊 Monitoring

### After Launch

**Monitor These:**

1. **Stripe Dashboard:**

   - Failed payments
   - Webhook delivery failures
   - Subscription cancellations
   - Payment disputes

2. **Supabase Edge Function Logs:**

   - Webhook processing errors
   - Subscription creation failures
   - Signature verification failures

3. **Database:**

   - Subscription status distribution
   - Failed subscription activations
   - Expired subscriptions

4. **Application:**
   - User-reported issues
   - Payment flow errors
   - Subscription limit errors

---

## 🔧 Additional Best Practices

### Customer Portal Integration

**Status:** ✅ Function ready, ⏳ UI integration pending

**To add:**

1. Add button in `AccountSettings.tsx`:

```typescript
const handleManageSubscription = async () => {
  const { data } = await supabase.functions.invoke(
    "create-customer-portal-session",
    {
      body: { returnUrl: window.location.href },
    }
  );

  if (data?.url) {
    window.location.href = data.url;
  }
};
```

### Cron Job for Expired Subscriptions

**Status:** ✅ Function ready, ⏳ Cron job pending

**To set up:**

1. Create Supabase Edge Function scheduled job
2. Or use external cron service to call:
   ```sql
   SELECT * FROM public.process_expired_subscriptions();
   ```
3. Schedule to run daily at midnight UTC

### Email Notifications

**Status:** ⏳ Not implemented

**Can add:**

- Payment success emails
- Payment failure notifications
- Subscription cancellation confirmations
- Expiration warnings

---

## 📝 Quick Reference

### Stripe Test Cards

| Card Number           | Purpose            |
| --------------------- | ------------------ |
| `4242 4242 4242 4242` | Success            |
| `4000 0025 0000 3155` | 3DS Required       |
| `4000 0000 0000 0002` | Declined           |
| `4000 0000 0000 9995` | Insufficient Funds |

### Important URLs

- **Stripe Dashboard:** https://dashboard.stripe.com
- **Webhooks:** https://dashboard.stripe.com/webhooks
- **Products:** https://dashboard.stripe.com/products
- **API Keys:** https://dashboard.stripe.com/apikeys

### Migration Order

```sql
1. 20250122000007_add_subscription_system.sql
2. 20250122000008_add_subscription_security.sql
3. 20250122000009_add_subscription_cancellation.sql
4. 20250122000010_migrate_to_stripe_subscriptions.sql
5. 20250122000011_fix_function_overload.sql ⚠️ RUN THIS LAST
```

---

## ✅ Completion Status

- [ ] Step 1: Run Final Migration
- [ ] Step 2: Create Stripe Products & Prices
- [ ] Step 3: Configure Environment Variables
- [ ] Step 4: Deploy Edge Functions
- [ ] Step 5: Set Up Stripe Webhook Endpoint
- [ ] Step 6: Complete Testing
- [ ] Step 7: Go Live

**Current Status:** Ready for launch after completing checklist items above.

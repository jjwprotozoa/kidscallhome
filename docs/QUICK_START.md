# Quick Start Guide - Stripe Subscriptions

## 🚀 Fastest Path to Launch

### Step 1: Run Migration (Fix Function Conflict)

**Option A: Supabase Dashboard SQL Editor**
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20250122000011_fix_function_overload.sql`
3. Paste and run

**Option B: Supabase CLI** (if installed)
```bash
supabase migration up
```

**Verification:**
```sql
-- Run this to verify function exists
SELECT proname, pg_get_function_arguments(oid) 
FROM pg_proc 
WHERE proname = 'upgrade_family_subscription';
-- Should return one function with 8 parameters
```

---

### Step 2: Stripe Dashboard Setup (15 minutes)

#### A. Create Products & Prices

1. **Go to:** https://dashboard.stripe.com/products
2. **Click:** "+ Add product"
3. **Create 4 products** (see checklist for details)
4. **Copy Price IDs** (start with `price_`)

#### B. Get API Keys

1. **Go to:** https://dashboard.stripe.com/apikeys
2. **Copy:**
   - Publishable key (`pk_test_...`)
   - Secret key (`sk_test_...`)

#### C. Create Webhook

1. **Go to:** https://dashboard.stripe.com/webhooks
2. **Click:** "+ Add endpoint"
3. **URL:** `https://[your-project].supabase.co/functions/v1/stripe-webhook`
4. **Events:** Select all 7 events (see checklist)
5. **Copy:** Signing secret (`whsec_...`)

---

### Step 3: Configure Secrets (5 minutes)

#### Supabase Edge Functions Secrets

**Location:** Supabase Dashboard → Project Settings → Edge Functions → Secrets

**Add 7 secrets:**
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ADDITIONAL_KID_MONTHLY=price_...
STRIPE_PRICE_ADDITIONAL_KID_ANNUAL=price_...
STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL_FAMILY_PLAN=price_...
```

#### Frontend Environment Variable

**Create `.env.local` file:**
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Restart dev server:**
```bash
npm run dev
```

---

### Step 4: Deploy Functions (2 minutes)

**If using Supabase CLI:**
```bash
supabase functions deploy create-stripe-subscription
supabase functions deploy stripe-webhook
supabase functions deploy create-customer-portal-session
```

**If using Supabase Dashboard:**
1. Go to Edge Functions
2. Upload each function folder
3. Set secrets (from Step 3)

---

### Step 5: Test (10 minutes)

1. **Test Subscription Creation:**
   - Go to `/parent/upgrade`
   - Select plan → Complete payment
   - Use test card: `4242 4242 4242 4242`
   - Verify subscription activates

2. **Test Webhook:**
   - In Stripe Dashboard → Webhooks
   - Click "Send test webhook"
   - Select `checkout.session.completed`
   - Check Supabase logs for receipt

3. **Test Limits:**
   - Try adding children up to limit
   - Verify "Add Child" button disables at limit

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Migration `20250122000011` is applied
- [ ] 4 Stripe Products created with Price IDs
- [ ] 7 Edge Function secrets configured
- [ ] Frontend `.env.local` has publishable key
- [ ] 3 Edge Functions deployed
- [ ] Webhook endpoint created and tested
- [ ] Test subscription works end-to-end

---

## 🆘 Troubleshooting

### Function Overload Error
**Solution:** Run migration `20250122000011_fix_function_overload.sql`

### Webhook Not Receiving Events
**Check:**
- Webhook URL is correct
- Webhook secret is set in Supabase
- Events are selected in Stripe Dashboard
- Check Supabase Edge Function logs

### Payment Not Working
**Check:**
- Stripe publishable key is set in `.env.local`
- Edge Function secrets are configured
- Price IDs match Stripe Dashboard
- Check browser console for errors

### Subscription Not Updating
**Check:**
- Webhook is receiving events
- `sync_stripe_subscription` function exists
- Check Supabase logs for webhook errors
- Verify `stripe_customer_id` and `stripe_subscription_id` are stored

---

## 📞 Next Steps After Setup

1. ✅ Complete test scenarios (see `LAUNCH_CHECKLIST.md`)
2. ✅ Test 3DS authentication
3. ✅ Test cancellation flow
4. ✅ Switch to Live Mode when ready
5. ✅ Set up monitoring/alerts

---

## 📚 Full Documentation

- **Launch Checklist:** `docs/LAUNCH_CHECKLIST.md`
- **Implementation Summary:** `docs/IMPLEMENTATION_SUMMARY.md`
- **Setup Guide:** `docs/STRIPE_SUBSCRIPTIONS_SETUP.md`
- **Complete Guide:** `docs/STRIPE_SUBSCRIPTIONS_COMPLETE.md`


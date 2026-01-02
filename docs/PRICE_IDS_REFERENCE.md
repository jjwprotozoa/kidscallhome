# Stripe Price IDs Reference

## Test Mode (Localhost/Development)

**Product:** `prod_Tgs5NIzPSgWahP`

- **Monthly:** `price_1SjULhIIyqCwTeH2GmBL1jVk`
- **Annual:** `price_1SkQUaIIyqCwTeH2QowSbcfb`

**Used in:**
- `supabase/functions/create-stripe-subscription/index.ts` (hardcoded for test mode)
- `src/pages/Upgrade/useSubscriptionData.ts` (for recognizing subscriptions)

## Live Mode (Production)

**Product:** `prod_TROQs4IwtU17Fv`

- **Monthly:** `price_1SUVdqIIyqCwTeH2zggZpPAK`
- **Annual:** `price_1SkPL7IIyqCwTeH2tI9TxHRB`

**Environment Variables:**
- `STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY` = `price_1SUVdqIIyqCwTeH2zggZpPAK`
- `STRIPE_PRICE_FAMILY_BUNDLE_ANNUAL` = `price_1SkPL7IIyqCwTeH2tI9TxHRB`

**Used in:**
- `supabase/functions/create-stripe-subscription/index.ts` (from env vars for live mode)
- `src/pages/Upgrade/useSubscriptionData.ts` (for recognizing subscriptions)

## How It Works

### Backend (Edge Functions)

The `create-stripe-subscription` function automatically selects the correct price IDs:

1. **Test Mode (localhost):**
   - Detects origin is `localhost:8080` or `localhost:5173`
   - Uses hardcoded test price IDs from `STRIPE_PRICE_IDS_TEST`

2. **Live Mode (production):**
   - Detects origin is production domain
   - Uses price IDs from environment variables:
     - `STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY`
     - `STRIPE_PRICE_FAMILY_BUNDLE_ANNUAL`

### Frontend

The `useSubscriptionData` hook recognizes both test and production price IDs:

- Checks `billing_subscriptions.stripe_price_id`
- Maps to subscription type:
  - Monthly price IDs → `"family-bundle-monthly"`
  - Annual price IDs → `"family-bundle-annual"`

## Verification

To verify price IDs are correct:

1. **Check Stripe Dashboard:**
   - Test mode: https://dashboard.stripe.com/test/products
   - Live mode: https://dashboard.stripe.com/products
   - Verify product IDs and price IDs match

2. **Check Code:**
   - Test IDs: `supabase/functions/create-stripe-subscription/index.ts` (lines 35-38)
   - Live IDs: Supabase Dashboard → Edge Functions → Secrets

3. **Check Frontend Recognition:**
   - `src/pages/Upgrade/useSubscriptionData.ts` (lines 68-74)
   - Should recognize both test and production price IDs

## Updating Price IDs

### Test Mode

Edit `supabase/functions/create-stripe-subscription/index.ts`:
```typescript
const STRIPE_PRICE_IDS_TEST = {
  "family-bundle-monthly": "price_1SjULhIIyqCwTeH2GmBL1jVk",
  "family-bundle-annual": "price_1SkQUaIIyqCwTeH2QowSbcfb",
};
```

Also update `src/pages/Upgrade/useSubscriptionData.ts`:
```typescript
const isMonthlyTest = priceId === "price_1SjULhIIyqCwTeH2GmBL1jVk";
const isAnnualTest = priceId === "price_1SkQUaIIyqCwTeH2QowSbcfb";
```

### Live Mode

Update environment variables in Supabase Dashboard:
- `STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY`
- `STRIPE_PRICE_FAMILY_BUNDLE_ANNUAL`

Also update `src/pages/Upgrade/useSubscriptionData.ts`:
```typescript
const isMonthlyProd = priceId === "price_1SUVdqIIyqCwTeH2zggZpPAK";
const isAnnualProd = priceId === "price_1SkPL7IIyqCwTeH2tI9TxHRB";
```

## Notes

- Test and Live price IDs are **different** - make sure you're using the correct ones
- Price IDs are tied to specific Stripe products
- Changing price IDs requires updating both backend and frontend code
- Always test in test mode before using live mode





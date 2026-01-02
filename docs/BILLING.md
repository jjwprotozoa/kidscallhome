# Billing Integration Guide

## Overview

KidsCallHome uses Stripe for subscription billing with flat-rate monthly and annual plans. The billing system is integrated with Supabase Edge Functions and uses a dedicated `billing_subscriptions` table as the source of truth for access/entitlements.

## Architecture

### Database Schema

The `billing_subscriptions` table stores:
- `user_id` (UUID, references auth.users)
- `stripe_customer_id` (TEXT)
- `stripe_subscription_id` (TEXT)
- `stripe_price_id` (TEXT)
- `status` (TEXT: active, inactive, cancelled, past_due, incomplete, expired)
- `current_period_end` (TIMESTAMPTZ)
- `cancel_at_period_end` (BOOLEAN)

**RLS Policies:**
- Users can read their own subscription
- Only service role can write (for webhooks)

### Edge Functions

#### 1. `stripe-create-checkout-session`
Creates a Stripe Checkout Session for new subscriptions.

**Input:**
```json
{
  "priceId": "price_1SUVdqIIyqCwTeH2zggZpPAK" // or annual price ID
}
```

**Output:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

**Flow:**
1. Validates user authentication
2. Validates price ID against allowed list
3. Creates Stripe Checkout Session with `mode=subscription`
4. Sets `client_reference_id` and `metadata.user_id` to user_id
5. Returns checkout URL

#### 2. `stripe-create-portal-session`
Creates a Stripe Customer Portal session for subscription management.

**Input:** None (uses authenticated user)

**Output:**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

**Flow:**
1. Validates user authentication
2. Looks up `stripe_customer_id` from `billing_subscriptions`
3. Creates Stripe Billing Portal session
4. Returns portal URL

#### 3. `stripe-change-subscription`
Modifies an existing subscription's price (upgrade/downgrade).

**Input:**
```json
{
  "newPriceId": "price_1SUVdqIIyqCwTeH2zggZpPAK",
  "prorationMode": "immediate" | "next_cycle" // optional
}
```

**Output:**
```json
{
  "success": true,
  "subscriptionId": "sub_...",
  "priceId": "price_...",
  "status": "active",
  "currentPeriodEnd": "2025-02-23T00:00:00Z",
  "prorationMode": "immediate"
}
```

**Proration Policy:**
- Monthly → Annual: `immediate` (upgrade, bill immediately)
- Annual → Monthly: `next_cycle` (downgrade, apply at period end)

**Flow:**
1. Validates user authentication
2. Validates new price ID
3. Loads subscription from database
4. Fetches subscription from Stripe to get subscription_item_id
5. Updates subscription item:
   - If `immediate`: uses `proration_behavior=always_invoice`
   - If `next_cycle`: creates Subscription Schedule to apply at period end

#### 4. `stripe-webhook`
Handles Stripe webhook events for subscription lifecycle.

**Events Handled:**
- `checkout.session.completed`: Creates/updates billing_subscriptions record
- `customer.subscription.created/updated`: Updates subscription status and details
- `customer.subscription.deleted`: Marks subscription as cancelled
- `invoice.payment_succeeded`: Ensures subscription is active
- `invoice.payment_failed`: Marks subscription as past_due
- `invoice.payment_action_required`: Marks subscription as incomplete

**Security:**
- Uses raw request body for signature verification (DO NOT parse JSON before verification)
- Validates webhook signature using Stripe SDK
- Only service role can write to database

## Stripe Configuration

### Price IDs
- **Product:** `prod_TROQs4IwtU17Fv`
- **Monthly:** `price_1SUVdqIIyqCwTeH2zggZpPAK`
- **Annual:** `price_1SkPL7IIyqCwTeH2tI9TxHRB`

### Environment Variables

Set in Supabase Dashboard → Edge Functions → Secrets:

```
STRIPE_SECRET_KEY=sk_test_... (or sk_live_...)
STRIPE_SECRET_KEY_TEST=sk_test_... (optional, for localhost)
STRIPE_SECRET_KEY_LIVE=sk_live_... (optional, for production)
STRIPE_WEBHOOK_SECRET=whsec_...
APP_URL=https://www.kidscallhome.com (optional, defaults to origin)
```

## Frontend Integration

### Upgrade Page (`/parent/upgrade`)

The upgrade page provides:
1. **Subscribe Monthly/Annually**: Calls `stripe-create-checkout-session` and redirects to Stripe Checkout
2. **Manage Subscription**: Calls `stripe-create-portal-session` and redirects to Stripe Customer Portal
3. **Switch Plans**: Calls `stripe-change-subscription` with appropriate proration mode

### Subscription Data Hook

`useSubscriptionData` reads from `billing_subscriptions` table:
- Subscription status
- Current price ID
- Period end date
- Cancel at period end flag

## Testing Locally

### Using Stripe CLI

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli

2. Forward webhooks to local function:
```bash
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

3. Use test mode price IDs (hardcoded in billing-service.ts for localhost)

4. Test checkout flow:
   - Navigate to `/parent/upgrade`
   - Click "Subscribe Monthly" or "Subscribe Annually"
   - Complete checkout with test card: `4242 4242 4242 4242`

### Test Cards

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires authentication: `4000 0025 0000 3155`

## Deployment Checklist

- [ ] Run migration: `supabase/migrations/20250123000000_create_billing_subscriptions.sql`
- [ ] Deploy edge functions:
  - `stripe-create-checkout-session`
  - `stripe-create-portal-session`
  - `stripe-change-subscription`
  - `stripe-webhook`
- [ ] Set environment variables in Supabase Dashboard
- [ ] Configure Stripe webhook endpoint in Stripe Dashboard
- [ ] Test checkout flow end-to-end
- [ ] Test subscription switching
- [ ] Test webhook processing

## Troubleshooting

### Webhook signature verification fails
- Ensure webhook secret is set correctly
- Verify raw body is used (not parsed JSON)
- Check webhook endpoint URL matches Stripe Dashboard

### Portal session creation fails
- Verify customer has active subscription
- Check `stripe_customer_id` exists in `billing_subscriptions`
- Ensure Stripe Billing Portal is configured in Stripe Dashboard

### Subscription change fails
- Verify subscription exists in database
- Check subscription has items in Stripe
- Ensure price ID is valid and matches environment (test vs live)

## Security Notes

1. **Never trust client redirects**: Webhooks are the source of truth for subscription activation
2. **Validate price IDs**: Only allow specific price IDs from billing-service.ts
3. **RLS policies**: Users can only read their own subscription
4. **Webhook verification**: Always verify webhook signatures using raw body
5. **Service role only**: Only service role can write to `billing_subscriptions`





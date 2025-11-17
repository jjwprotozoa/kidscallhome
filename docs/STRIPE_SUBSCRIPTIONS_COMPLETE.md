# Complete Stripe Subscriptions Implementation Guide

## ✅ Implementation Complete

This document outlines the complete Stripe Subscriptions API implementation for Kids Call Home.

## Architecture Overview

### Backend (Supabase Edge Functions)

1. **`create-stripe-subscription`** - Creates Stripe subscriptions
   - Creates/retrieves Stripe Customer
   - Creates subscription with `payment_behavior: default_incomplete`
   - Returns `clientSecret` for payment confirmation

2. **`stripe-webhook`** - Handles Stripe webhook events
   - ✅ **Webhook signature verification** (using Stripe SDK)
   - Handles all subscription lifecycle events
   - Updates database automatically

3. **`create-customer-portal-session`** - Customer Portal integration
   - Generates Stripe Customer Portal session
   - Self-service subscription management

### Frontend (React + Stripe.js)

1. **Upgrade Page** (`src/pages/Upgrade.tsx`)
   - Calls Edge Function to create subscription
   - Uses Stripe.js to confirm payment
   - Handles 3DS/SCA automatically
   - Updates UI after successful payment

2. **Stripe Utility** (`src/utils/stripe.ts`)
   - Initializes Stripe.js
   - Provides `getStripe()` helper

## Setup Instructions

### 1. Stripe Dashboard Setup

#### Create Products & Prices

In Stripe Dashboard → Products:

1. **Additional Kid Monthly**
   - Price: $2.99/month
   - Billing: Recurring monthly
   - Copy Price ID (starts with `price_`)

2. **Additional Kid Annual**
   - Price: $29.99/year
   - Billing: Recurring yearly
   - Copy Price ID

3. **Family Bundle Monthly**
   - Price: $14.99/month
   - Billing: Recurring monthly
   - Copy Price ID

4. **Annual Family Plan**
   - Price: $99/year
   - Billing: Recurring yearly
   - Copy Price ID

#### Get API Keys

1. Stripe Dashboard → Developers → API keys
2. Copy **Publishable key** (starts with `pk_test_` or `pk_live_`)
3. Copy **Secret key** (starts with `sk_test_` or `sk_live_`)

#### Set Up Webhook

1. Stripe Dashboard → Developers → Webhooks
2. Click **Add endpoint**
3. URL: `https://[your-project].supabase.co/functions/v1/stripe-webhook`
4. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `invoice.payment_action_required` ⭐ (for 3DS)
5. Copy **Signing secret** (starts with `whsec_`)

### 2. Environment Variables

#### Supabase Edge Functions Secrets

In Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```bash
STRIPE_SECRET_KEY=sk_test_... # Your Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_... # Webhook signing secret
STRIPE_PRICE_ADDITIONAL_KID_MONTHLY=price_...
STRIPE_PRICE_ADDITIONAL_KID_ANNUAL=price_...
STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL_FAMILY_PLAN=price_...
```

#### Frontend Environment Variables

Create `.env.local` file:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... # Your Stripe publishable key
```

### 3. Deploy Edge Functions

```bash
# Deploy all three functions
supabase functions deploy create-stripe-subscription
supabase functions deploy stripe-webhook
supabase functions deploy create-customer-portal-session
```

### 4. Run Database Migrations

Run in order:

```sql
-- 1. Base subscription system
supabase/migrations/20250122000007_add_subscription_system.sql

-- 2. Security measures
supabase/migrations/20250122000008_add_subscription_security.sql

-- 3. Cancellation support
supabase/migrations/20250122000009_add_subscription_cancellation.sql

-- 4. Stripe Subscriptions API migration
supabase/migrations/20250122000010_migrate_to_stripe_subscriptions.sql
```

### 5. Install Frontend Dependencies

```bash
npm install @stripe/stripe-js
```

## Payment Flow

### Step-by-Step Process

1. **User selects plan** → `handlePlanSelect()`
2. **Email dialog opens** → User confirms email
3. **User clicks "Complete Payment"** → `handlePayment()`
4. **Frontend calls Edge Function** → `create-stripe-subscription`
5. **Edge Function creates subscription** → Returns `clientSecret`
6. **Frontend confirms payment** → `stripe.confirmCardPayment()`
7. **Stripe handles 3DS** → Automatic authentication if needed
8. **Payment succeeds** → Frontend updates database
9. **Webhook confirms** → `invoice.payment_succeeded` event
10. **Database synced** → Subscription active

## Webhook Events Handled

| Event | Handler | Action |
|-------|---------|--------|
| `customer.subscription.created` | `handleSubscriptionUpdate` | Create subscription in DB |
| `customer.subscription.updated` | `handleSubscriptionUpdate` | Update subscription status |
| `customer.subscription.deleted` | `handleSubscriptionCancelled` | Mark as cancelled |
| `invoice.payment_succeeded` | `handlePaymentSucceeded` | Activate subscription |
| `invoice.payment_failed` | `handlePaymentFailed` | Mark as past_due |
| `invoice.payment_action_required` | `handlePaymentActionRequired` | Notify for 3DS |

## Subscription Status Mapping

| Stripe Status | Database Status | Access Level |
|---------------|----------------|--------------|
| `trialing` | `active` | ✅ Full access |
| `active` | `active` | ✅ Full access |
| `incomplete` | `incomplete` | ⚠️ Payment pending |
| `incomplete_expired` | `expired` | ❌ No access |
| `past_due` | `active` | ✅ Full access (retrying) |
| `canceled` | `cancelled` | ✅ Access until expiration |
| `unpaid` | `expired` | ❌ No access |
| `paused` | `active` | ✅ Full access |

## Security Features

### ✅ Implemented

1. **Webhook Signature Verification**
   - Uses Stripe SDK `constructEvent()`
   - Rejects invalid signatures
   - Prevents webhook spoofing

2. **Email Verification**
   - Frontend verifies email matches authenticated user
   - Backend double-checks with `auth.uid()`
   - Prevents account sharing

3. **Duplicate Payment Prevention**
   - Tracks used checkout sessions
   - Prevents payment reuse

4. **Authentication Required**
   - All operations require authenticated session
   - RLS policies enforce data isolation

## 3DS/SCA Support

### How It Works

1. **Stripe detects 3DS requirement**
2. **`invoice.payment_action_required` event** fired
3. **Webhook handler** stores payment intent info
4. **Stripe.js automatically** shows authentication modal
5. **User authenticates** → Payment completes
6. **`invoice.payment_succeeded`** event confirms

### Frontend Handling

Stripe.js `confirmCardPayment()` automatically:
- Detects if 3DS is required
- Shows authentication modal
- Handles authentication flow
- Returns success/error status

## Testing

### Test Cards

Use Stripe test cards:

- **Success**: `4242 4242 4242 4242`
- **3DS Required**: `4000 0025 0000 3155`
- **Declined**: `4000 0000 0000 0002`

### Test Scenarios

1. ✅ **Create subscription** → Status `incomplete`
2. ✅ **Pay invoice** → Status `active`
3. ✅ **3DS authentication** → Modal appears, payment succeeds
4. ✅ **Payment fails** → Status `past_due`
5. ✅ **Cancel subscription** → Status `cancelled`
6. ✅ **Webhook verification** → Invalid signatures rejected

## Troubleshooting

### Webhook Not Receiving Events

- Check webhook URL is correct
- Verify webhook secret is set
- Check Stripe Dashboard → Webhooks → Recent events
- Check Supabase Edge Function logs

### Payment Not Confirming

- Verify `clientSecret` is returned
- Check Stripe.js is initialized
- Check browser console for errors
- Verify publishable key is correct

### Subscription Not Updating

- Check webhook logs in Supabase Dashboard
- Verify `sync_stripe_subscription` function exists
- Check database for `stripe_customer_id` and `stripe_subscription_id`
- Verify webhook events are being received

## Production Checklist

Before going live:

- [ ] Switch to live Stripe keys
- [ ] Update webhook endpoint to production URL
- [ ] Test all payment flows
- [ ] Verify webhook signature verification works
- [ ] Test 3DS authentication
- [ ] Test subscription cancellation
- [ ] Test payment failures
- [ ] Set up monitoring/alerts
- [ ] Document customer support process

## Next Steps

1. ✅ **Webhook signature verification** - DONE
2. ✅ **3DS/SCA support** - DONE
3. ✅ **Frontend integration** - DONE
4. ⏳ **Customer Portal integration** - Ready to use
5. ⏳ **Email notifications** - Can be added
6. ⏳ **Subscription analytics** - Can be added

## Support

For issues:
1. Check Supabase Edge Function logs
2. Check Stripe Dashboard → Events
3. Check browser console for frontend errors
4. Review webhook event payloads


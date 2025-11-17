# Stripe Subscriptions API Setup Guide

## Overview

This guide explains how to migrate from Stripe Payment Links to Stripe Subscriptions API for better subscription management.

## Benefits of Stripe Subscriptions API

✅ **Proper Subscription Objects** - Real subscription entities in Stripe  
✅ **Webhook Events** - Automatic lifecycle management  
✅ **Customer Portal** - Self-service subscription management  
✅ **Automatic Billing** - Recurring payments handled by Stripe  
✅ **Better Cancellation** - Proper cancellation flow with period-end handling  

## Setup Steps

### 1. Create Stripe Products and Prices

In Stripe Dashboard → Products:

1. **Additional Kid Monthly**
   - Price: $2.99/month
   - Billing: Recurring monthly
   - Copy the **Price ID** (starts with `price_`)

2. **Additional Kid Annual**
   - Price: $29.99/year
   - Billing: Recurring yearly
   - Copy the **Price ID**

3. **Family Bundle Monthly**
   - Price: $14.99/month
   - Billing: Recurring monthly
   - Copy the **Price ID**

4. **Annual Family Plan**
   - Price: $99/year
   - Billing: Recurring yearly
   - Copy the **Price ID**

### 2. Set Environment Variables

Add to Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```bash
STRIPE_SECRET_KEY=sk_test_... # Your Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_... # Webhook signing secret (get from Stripe Dashboard)
STRIPE_PRICE_ADDITIONAL_KID_MONTHLY=price_...
STRIPE_PRICE_ADDITIONAL_KID_ANNUAL=price_...
STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL_FAMILY_PLAN=price_...
```

### 3. Deploy Edge Functions

Deploy the three Edge Functions:

```bash
# Deploy create-stripe-subscription
supabase functions deploy create-stripe-subscription

# Deploy stripe-webhook
supabase functions deploy stripe-webhook

# Deploy create-customer-portal-session
supabase functions deploy create-customer-portal-session
```

### 4. Set Up Stripe Webhook

In Stripe Dashboard → Developers → Webhooks:

1. **Add Endpoint**
   - URL: `https://[your-project].supabase.co/functions/v1/stripe-webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

2. **Copy Webhook Signing Secret**
   - Copy the `whsec_...` secret
   - Add to Supabase secrets as `STRIPE_WEBHOOK_SECRET`

### 5. Run Database Migration

Run the migration to update schema:

```sql
-- File: supabase/migrations/20250122000010_migrate_to_stripe_subscriptions.sql
```

### 6. Update Frontend Code

Update `src/pages/Upgrade.tsx` to use the new Edge Function instead of payment links.

## Migration Flow

### Old Flow (Payment Links):
1. User clicks plan → Opens Stripe Payment Link
2. User pays → Manual confirmation
3. User enters email → Backend upgrades account

### New Flow (Subscriptions API):
1. User clicks plan → Frontend calls Edge Function
2. Edge Function creates Stripe Customer (if needed)
3. Edge Function creates Stripe Subscription
4. Frontend redirects to Stripe Checkout
5. User pays → Stripe webhook updates database automatically
6. Account upgraded automatically

## API Endpoints

### Create Subscription
```
POST /functions/v1/create-stripe-subscription
Authorization: Bearer [user-jwt-token]
Content-Type: application/json

{
  "subscriptionType": "family-bundle-monthly",
  "quantity": 1
}
```

Response:
```json
{
  "success": true,
  "subscriptionId": "sub_...",
  "clientSecret": "pi_...",
  "status": "incomplete",
  "customerId": "cus_..."
}
```

### Customer Portal
```
POST /functions/v1/create-customer-portal-session
Authorization: Bearer [user-jwt-token]
Content-Type: application/json

{
  "returnUrl": "https://yourapp.com/parent/settings"
}
```

Response:
```json
{
  "success": true,
  "url": "https://billing.stripe.com/session/..."
}
```

## Webhook Events

The webhook handler automatically processes:

- **subscription.created** - Sets subscription to active
- **subscription.updated** - Updates subscription status
- **subscription.deleted** - Marks subscription as cancelled
- **invoice.payment_succeeded** - Ensures subscription stays active
- **invoice.payment_failed** - Marks subscription as past_due

## Frontend Integration

### Using Stripe.js for Payment

Install Stripe.js:
```bash
npm install @stripe/stripe-js
```

Example integration:
```typescript
import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe('pk_test_...'); // Your publishable key

// Create subscription
const response = await supabase.functions.invoke('create-stripe-subscription', {
  body: { subscriptionType: 'family-bundle-monthly' }
});

const { clientSecret } = await response.json();

// Confirm payment
const { error } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: { name: 'Customer Name' }
  }
});
```

## Customer Portal Integration

Add to Account Settings page:

```typescript
const handleManageSubscription = async () => {
  const { data } = await supabase.functions.invoke('create-customer-portal-session', {
    body: { returnUrl: window.location.href }
  });
  
  if (data?.url) {
    window.location.href = data.url;
  }
};
```

## Testing

### Test Mode
1. Use Stripe test mode keys
2. Use test card: `4242 4242 4242 4242`
3. Test webhook locally with Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
   ```

### Test Scenarios
1. ✅ Create subscription
2. ✅ Payment succeeds → Subscription active
3. ✅ Payment fails → Subscription past_due
4. ✅ Cancel subscription → Cancelled at period end
5. ✅ Subscription expires → Reverts to free tier

## Troubleshooting

### Webhook Not Receiving Events
- Check webhook URL is correct
- Verify webhook secret is set
- Check Stripe Dashboard → Webhooks → Recent events

### Subscription Not Updating
- Check webhook logs in Supabase Dashboard
- Verify `sync_stripe_subscription` function is working
- Check database for `stripe_customer_id` and `stripe_subscription_id`

### Customer Portal Not Working
- Ensure Stripe Customer exists
- Check Customer Portal is enabled in Stripe Dashboard
- Verify return URL is correct

## Next Steps

1. ✅ Set up Stripe Products and Prices
2. ✅ Configure environment variables
3. ✅ Deploy Edge Functions
4. ✅ Set up webhook endpoint
5. ✅ Update frontend to use new API
6. ✅ Test subscription flow
7. ✅ Test cancellation flow
8. ✅ Test webhook events


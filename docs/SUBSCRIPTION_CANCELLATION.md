# Subscription Cancellation Guide

## Overview

The subscription cancellation system allows users to cancel their subscriptions while maintaining access until the expiration date. After expiration, accounts automatically revert to the free tier.

## How Cancellation Works

### User-Initiated Cancellation

1. **User cancels subscription** via Account Settings page
2. **Subscription status** changes to `cancelled`
3. **Access continues** until `subscription_expires_at` date
4. **After expiration**, account reverts to free tier (1 child limit)

### Automatic Expiration Processing

- Expired subscriptions are processed via `process_expired_subscriptions()` function
- Should be run via cron job or scheduled task (daily recommended)
- Automatically reverts expired subscriptions to free tier
- Preserves existing children but sets limit to 1

## Stripe Integration

### Payment Links vs Subscriptions

**Current Implementation:**
- Uses Stripe Payment Links (one-time or recurring payments)
- Payment Links don't create Stripe Subscription objects
- Cancellation is handled manually in the database

### Recommended: Stripe Customer Portal

For better self-service cancellation, integrate Stripe Customer Portal:

1. **Create Stripe Customer** when user subscribes
2. **Store `stripe_customer_id`** in database
3. **Generate Customer Portal session** for cancellation
4. **Handle webhooks** for subscription updates

### Stripe Webhook Setup (Recommended)

Set up webhooks to handle:
- `checkout.session.completed` - Payment successful
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.payment_failed` - Payment failed
- `customer.subscription.updated` - Subscription changed

**Webhook Endpoint:** `/api/stripe-webhook` (to be created)

## Database Functions

### `cancel_subscription(p_parent_id, p_cancel_reason)`
- Cancels active subscription
- Sets status to `cancelled`
- Records cancellation reason
- User retains access until expiration

### `process_expired_subscriptions()`
- Processes all expired subscriptions
- Reverts to free tier
- Returns list of processed subscriptions
- Should run daily via cron

### `reactivate_subscription(p_parent_id, p_subscription_type, p_allowed_children)`
- Reactivates cancelled/expired subscription
- Used when user resubscribes
- Resets expiration date

## UI Implementation

### Account Settings Page
- Shows current subscription status
- "Cancel Subscription" button for active subscriptions
- Shows expiration date for cancelled subscriptions
- "Resubscribe" option for cancelled subscriptions

### Upgrade Page
- Shows cancelled subscriptions can be reactivated
- Allows resubscribing to same or different plan

## Expiration Behavior

### When Subscription Expires:

1. **Status changes** to `expired`
2. **Subscription type** reverts to `free`
3. **Allowed children** set to 1
4. **Existing children** remain (not deleted)
5. **Cannot add more children** until resubscribing

### Example:
- User has 5 children on Family Bundle
- Subscription expires
- Status: `expired`, Type: `free`, Allowed: 1
- All 5 children can still log in ✅
- Cannot add 6th child ❌
- Must resubscribe to add more children

## Stripe Customer Portal Integration (Future)

### Benefits:
- Self-service cancellation
- Payment method updates
- Invoice history
- Automatic webhook handling

### Implementation Steps:

1. **Create Stripe Customer** on subscription
2. **Store customer ID** in `stripe_customer_id` column
3. **Create Customer Portal session** endpoint
4. **Redirect user** to Stripe portal
5. **Handle webhooks** for status updates

### Example Code:

```typescript
// Create Customer Portal session
const session = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: `${window.location.origin}/parent/settings`,
});

// Redirect user
window.location.href = session.url;
```

## Manual Cancellation Flow

### Current Implementation:

1. User clicks "Cancel Subscription" in Account Settings
2. Confirmation dialog shows expiration date
3. Backend function cancels subscription
4. Status set to `cancelled`
5. Access continues until expiration
6. After expiration, `process_expired_subscriptions()` runs
7. Account reverts to free tier

## Cron Job Setup

### Recommended: Daily Expiration Check

```sql
-- Run daily at midnight UTC
SELECT * FROM public.process_expired_subscriptions();
```

### Supabase Edge Function (Recommended):

Create a scheduled Edge Function that runs daily:

```typescript
// supabase/functions/process-expired-subscriptions/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const supabase = createClient(...)
  
  const { data, error } = await supabase.rpc('process_expired_subscriptions')
  
  return new Response(JSON.stringify({ processed: data }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

Schedule via Supabase Dashboard → Edge Functions → Cron Jobs

## Testing Cancellation

### Test Scenarios:

1. **Cancel active subscription**
   - Status should change to `cancelled`
   - Expiration date should remain
   - User should still have access

2. **Wait for expiration**
   - Run `process_expired_subscriptions()`
   - Status should change to `expired`
   - Type should revert to `free`
   - Limit should be 1

3. **Resubscribe after cancellation**
   - Should reactivate subscription
   - New expiration date set
   - Status back to `active`

## Security Considerations

- ✅ Only authenticated users can cancel their own subscription
- ✅ Backend verifies `auth.uid()` matches parent_id
- ✅ Cancellation reason is logged for audit
- ✅ Expired subscriptions automatically revert (prevents abuse)

## Next Steps

1. ✅ Database functions created
2. ✅ UI cancellation flow implemented
3. ⏳ Set up cron job for expiration processing
4. ⏳ Integrate Stripe Customer Portal (optional)
5. ⏳ Set up Stripe webhooks (optional but recommended)


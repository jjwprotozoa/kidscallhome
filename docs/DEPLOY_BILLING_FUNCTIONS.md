# Deploy Billing Edge Functions

## Functions to Deploy

You need to deploy these new edge functions:

1. **`stripe-create-checkout-session`** - Creates Stripe Checkout sessions
2. **`stripe-create-portal-session`** - Creates Customer Portal sessions (replaces `create-customer-portal-session`)
3. **`stripe-change-subscription`** - Modifies subscription prices
4. **`stripe-webhook`** - Updated to use `billing_subscriptions` table

## Quick Deployment via Dashboard

1. Go to: <https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt/edge-functions>

2. For each function:
   - Click **"Create a new function"**
   - Enter the exact function name (with hyphens, not underscores)
   - Copy code from `supabase/functions/[function-name]/index.ts`
   - Paste and click **"Deploy"**

## Important Notes

### Function Names

- ✅ Use hyphens: `stripe-create-checkout-session`
- ❌ Don't use underscores: `stripe_create_checkout_session`
- ❌ Don't use camelCase: `stripeCreateCheckoutSession`

### Shared Code

The edge functions have been updated to inline shared code (no `_shared` folder imports) because Supabase Edge Functions may not support cross-function imports.

### Environment Variables

Make sure these are set in Supabase Dashboard → Edge Functions → Secrets:

- `STRIPE_SECRET_KEY` (or `STRIPE_SECRET_KEY_TEST` and `STRIPE_SECRET_KEY_LIVE`)
- `STRIPE_WEBHOOK_SECRET`
- `APP_URL` (optional, defaults to origin)

## Testing

After deployment, test each function:

1. **Check function exists:**

   ```javascript
   fetch('https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-create-checkout-session', {
     method: 'OPTIONS'
   }).then(r => console.log('Status:', r.status));
   ```

   Should return 200 or 204.

2. **Test from upgrade page:**
   - Navigate to `/parent/upgrade`
   - Click "Select Plan" on monthly or annual
   - Should redirect to Stripe Checkout (not show CORS error)

## Troubleshooting

### CORS Error

- Verify function is deployed and active
- Check function name matches exactly (with hyphens)
- Verify `localhost:8080` is in allowed origins

### Function Not Found (404)

- Check function name spelling
- Verify function is deployed (not just saved as draft)
- Check you're in the correct Supabase project

### Import Errors

- All shared code has been inlined - no imports from `_shared` folder
- If you see import errors, check the function code matches the file exactly

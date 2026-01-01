# Fix: Webhook 401 "Missing authorization header" Error

## Problem

Stripe webhooks are failing with `401 ERR` and error message:
```json
{
  "code": 401,
  "message": "Missing authorization header"
}
```

## Root Cause

Supabase Edge Functions require an `Authorization` header by default, but Stripe webhooks don't send one. Stripe uses signature-based authentication instead.

## Solution

Supabase Edge Functions can be called without authentication if they're configured correctly. The webhook function code already handles Stripe signature verification, so we just need to ensure the function is accessible.

### Option 1: Use Anon Key in Webhook URL (Recommended)

Add the Supabase anon key to the webhook URL as a query parameter:

1. **Get your Supabase Anon Key:**
   - Go to: Supabase Dashboard → Settings → API
   - Copy the **"anon public"** key

2. **Update Webhook URL in Stripe:**
   - Go to: Stripe Dashboard → Webhooks → Your endpoint
   - Click **"Edit destination"** or **"..."** → **"Edit"**
   - Update the URL to:
     ```
     https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-webhook?apikey=YOUR_ANON_KEY_HERE
     ```
   - Replace `YOUR_ANON_KEY_HERE` with your actual anon key
   - Click **"Save"**

3. **Update Webhook Function Code (if needed):**

   The function should handle the apikey parameter. Check if it's already handling it, or add this at the start of the function:

   ```typescript
   // Allow apikey in query string for webhook access
   const url = new URL(req.url);
   const apikey = url.searchParams.get('apikey');
   
   // If apikey is provided, validate it matches anon key
   const expectedAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
   if (apikey && apikey !== expectedAnonKey) {
     return new Response(JSON.stringify({ error: "Invalid API key" }), {
       status: 401,
       headers: { "Content-Type": "application/json" },
     });
   }
   ```

### Option 2: Use Authorization Header in Stripe (Alternative)

Stripe allows adding custom headers to webhook requests:

1. **In Stripe Dashboard → Webhooks → Your endpoint:**
   - Click **"Edit destination"**
   - Look for **"Headers"** or **"Custom headers"** section
   - Add header:
     - **Name:** `Authorization`
     - **Value:** `Bearer YOUR_ANON_KEY_HERE`
   - Replace `YOUR_ANON_KEY_HERE` with your Supabase anon key
   - Click **"Save"**

### Option 3: Make Function Public (If Supported)

Some Supabase configurations allow making edge functions public:

1. **Check Supabase Dashboard:**
   - Go to: Edge Functions → `stripe-webhook`
   - Look for a **"Public"** or **"Require Auth"** toggle
   - If available, set it to **"Public"** or disable **"Require Auth"**

   **Note:** This option may not be available in all Supabase plans.

## Verification

After applying the fix:

1. **Test the webhook:**
   - Go to Stripe Dashboard → Webhooks → Your endpoint
   - Click **"Send test webhook"**
   - Select event: `checkout.session.completed`
   - Click **"Send test webhook"**

2. **Check delivery status:**
   - Should show ✅ (green checkmark) instead of ❌
   - Status should be "Delivered" not "Failed"

3. **Check Supabase logs:**
   - Go to: Supabase Dashboard → Edge Functions → `stripe-webhook` → Logs
   - Should see: "Webhook endpoint called:" and "Webhook signature verified successfully"

4. **Resend failed events:**
   - In Stripe Dashboard → Webhooks → Your endpoint → Recent events
   - Click on failed events
   - Click **"Resend"** button
   - They should now succeed

## Important Notes

- **Security:** The webhook function still verifies Stripe signatures, so it's secure even with the anon key
- **Anon Key is Public:** The anon key is meant to be public (it's in your frontend code), so using it in the webhook URL is safe
- **Service Role Key:** Don't use the service role key - it's secret and should never be exposed

## After Fix

Once webhooks are working:

1. Failed events will be automatically retried by Stripe
2. New checkout events will be processed immediately
3. `billing_subscriptions` table will be populated automatically
4. You can delete the manual SQL fix (if you created one)



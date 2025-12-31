# Testing Webhooks Locally with Stripe CLI

## Overview

The [Stripe CLI](https://docs.stripe.com/stripe-cli/install) lets you test webhooks locally by forwarding Stripe events to your local development server. This is perfect for debugging webhook issues without affecting production.

## Installation

### macOS

```bash
brew install stripe/stripe-cli/stripe
```

### Windows

**Option 1: Using Scoop (if you have Scoop installed)**

```powershell
scoop install stripe
```

**Option 2: Using winget (Windows Package Manager - built into Windows 11/10)**

```powershell
winget install stripe.stripe-cli
```

**Option 3: Using Chocolatey (if you have Chocolatey installed)**

```powershell
choco install stripe-cli
```

**Option 4: Manual Installation**

1. Download the latest release from: <https://github.com/stripe/stripe-cli/releases>
2. Look for `stripe_X.X.X_windows_x86_64.zip` (or `x86_32.zip` for 32-bit)
3. Extract the ZIP file
4. Add the extracted folder to your PATH, or run `stripe.exe` directly from the folder

### Linux

```bash
# Debian/Ubuntu
sudo apt-get install stripe

# RHEL/CentOS
sudo yum install stripe
```

## Authentication

1. **Log in to Stripe CLI:**

   ```bash
   stripe login
   ```

   - Press Enter to open browser
   - Complete authentication in browser
   - This generates restricted keys for CLI use

2. **Or use API key directly:**

   ```bash
   stripe login --api-key sk_test_YOUR_KEY_HERE
   ```

## Forward Webhooks to Local Supabase

### Option 1: Forward to Local Supabase (if running locally)

If you're running Supabase locally:

```bash
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

### Option 2: Forward to Remote Supabase with Anon Key

Forward to your remote Supabase function with the anon key:

```bash
stripe listen --forward-to "https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-webhook?apikey=YOUR_ANON_KEY"
```

Replace `YOUR_ANON_KEY` with your Supabase anon key.

### Option 3: Forward to ngrok/Other Tunnel

If you need to test with a public URL:

1. **Set up ngrok:**

   ```bash
   ngrok http 54321
   ```

2. **Forward Stripe webhooks:**

   ```bash
   stripe listen --forward-to https://YOUR_NGROK_URL.ngrok.io/functions/v1/stripe-webhook
   ```

## Trigger Test Events

Once forwarding is active, trigger test events:

### Test Checkout Completion

```bash
stripe trigger checkout.session.completed
```

### Test Subscription Created

```bash
stripe trigger customer.subscription.created
```

### Test Payment Succeeded

```bash
stripe trigger invoice.payment_succeeded
```

## Monitor Events

### Stream Events in Real-Time

```bash
stripe listen
```

This shows all events happening in your Stripe account in real-time.

### Filter Specific Events

```bash
stripe listen --events checkout.session.completed,customer.subscription.created
```

## Testing Your Webhook Function

1. **Start forwarding:**

   ```bash
   stripe listen --forward-to "https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-webhook?apikey=YOUR_ANON_KEY"
   ```

2. **In another terminal, trigger an event:**

   ```bash
   stripe trigger checkout.session.completed
   ```

3. **Check Supabase logs:**
   - Go to: Supabase Dashboard → Edge Functions → `stripe-webhook` → Logs
   - You should see the webhook being processed

4. **Check database:**

   ```sql
   SELECT * FROM billing_subscriptions ORDER BY created_at DESC LIMIT 1;
   ```

## Common Use Cases

### Debug 401 Errors

If you're getting 401 errors, test locally first:

```bash
# Forward with anon key
stripe listen --forward-to "https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-webhook?apikey=YOUR_ANON_KEY"

# Trigger test event
stripe trigger checkout.session.completed
```

Check if it works locally before fixing production webhook URL.

### Test Webhook Signature Verification

The CLI automatically includes proper signatures, so you can test signature verification:

```bash
stripe listen --forward-to "YOUR_WEBHOOK_URL"
```

### Replay Failed Events

If you have failed events in Stripe Dashboard:

1. **Get event ID from Stripe Dashboard:**
   - Go to: Webhooks → Your endpoint → Recent events
   - Click on failed event
   - Copy the Event ID (e.g., `evt_1SkQe5llyqCwTeH2NnMdGVZz`)

2. **Replay the event:**

   ```bash
   stripe events resend evt_1SkQe5llyqCwTeH2NnMdGVZz
   ```

## CLI Commands Reference

### Authentication

```bash
stripe login                    # Interactive login
stripe login --api-key KEY     # Login with API key
stripe logout                  # Logout
```

### Webhook Forwarding

```bash
stripe listen                                  # Listen to all events
stripe listen --forward-to URL                 # Forward to URL
stripe listen --events event1,event2          # Filter events
stripe listen --print-secret                   # Print webhook secret
```

### Trigger Events

```bash
stripe trigger EVENT_TYPE                      # Trigger specific event
stripe trigger checkout.session.completed      # Example
```

### View Events

```bash
stripe events list                             # List recent events
stripe events retrieve evt_XXX                 # Get specific event
stripe events resend evt_XXX                   # Resend event
```

## Troubleshooting

### "Command not found"

- Make sure Stripe CLI is installed
- Check it's in your PATH: `which stripe` (macOS/Linux) or `where stripe` (Windows)

### "Authentication failed"

- Run `stripe login` again
- Make sure you're using the correct API key for your mode (test vs live)

### "Webhook forwarding failed"

- Check the URL is correct
- Make sure the endpoint is accessible
- For Supabase, include the `?apikey=` parameter

### "Signature verification failed"

- The CLI automatically includes correct signatures
- If testing manually, make sure you're using the webhook secret from `stripe listen --print-secret`

## Next Steps

After testing locally:

1. **Fix production webhook URL** (add `?apikey=` parameter)
2. **Resend failed events** from Stripe Dashboard
3. **Verify events are being processed** in Supabase logs
4. **Check database** for new records in `billing_subscriptions`

## Resources

- [Stripe CLI Installation](https://docs.stripe.com/stripe-cli/install)
- [Stripe CLI Reference](https://docs.stripe.com/stripe-cli)
- [Testing Webhooks](https://docs.stripe.com/webhooks/test)

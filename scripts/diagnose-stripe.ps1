# scripts/diagnose-stripe.ps1
# Purpose: Diagnose Stripe subscription sync issues

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   STRIPE SUBSCRIPTION DIAGNOSTIC" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check 1: Verify environment variables
Write-Host "Step 1: Checking environment variables..." -ForegroundColor Yellow

$envVars = @(
    "STRIPE_SECRET_KEY",
    "STRIPE_SECRET_KEY_LIVE",
    "STRIPE_SECRET_KEY_TEST",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_WEBHOOK_SECRET_TEST",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY"
)

foreach ($var in $envVars) {
    $value = [Environment]::GetEnvironmentVariable($var)
    if ($value) {
        $masked = $value.Substring(0, [Math]::Min(10, $value.Length)) + "..."
        Write-Host "  [OK] $var = $masked" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $var" -ForegroundColor Red
    }
}

Write-Host "`nStep 2: What to check in Stripe Dashboard" -ForegroundColor Yellow
Write-Host @"

  1. Go to: https://dashboard.stripe.com/webhooks
  
  2. Find endpoint: https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/stripe-webhook
  
  3. Check:
     - Is the endpoint ENABLED?
     - Are these events selected?
       * checkout.session.completed
       * customer.subscription.created
       * customer.subscription.updated
       * customer.subscription.deleted
       * invoice.payment_succeeded
       * invoice.payment_failed
  
  4. Click "Recent events" - look for checkout.session.completed
     - Green checkmark = Delivered OK
     - Red X = Failed (click to see error)
  
  5. Get the Signing Secret:
     - Click "Reveal" next to "Signing secret"
     - Copy the whsec_... value
     - This MUST match STRIPE_WEBHOOK_SECRET in Supabase

"@ -ForegroundColor White

Write-Host "Step 3: What to check in Supabase Dashboard" -ForegroundColor Yellow
Write-Host @"

  1. Go to: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt/functions
  
  2. Click on "stripe-webhook" function
  
  3. Check Logs tab for:
     - "Webhook endpoint called:" (webhook is receiving requests)
     - "Webhook signature verified successfully" (signature matches)
     - "Extracted user_id from checkout session:" (user_id found)
     - "Successfully upserted billing subscription" (database updated)
  
  4. Check Secrets tab:
     - STRIPE_SECRET_KEY or STRIPE_SECRET_KEY_LIVE is set
     - STRIPE_WEBHOOK_SECRET is set (matches Stripe's signing secret)

"@ -ForegroundColor White

Write-Host "Step 4: Manual Database Check" -ForegroundColor Yellow
Write-Host @"

  Run this SQL in Supabase SQL Editor:
  
  -- Check if any billing subscriptions exist
  SELECT * FROM billing_subscriptions ORDER BY created_at DESC LIMIT 10;
  
  -- Check for your specific user (replace with your user_id)
  SELECT * FROM billing_subscriptions WHERE user_id = 'YOUR_USER_ID_HERE';
  
  -- Check parents table for stripe_customer_id
  SELECT id, email, stripe_customer_id FROM parents WHERE stripe_customer_id IS NOT NULL;

"@ -ForegroundColor White

Write-Host "Step 5: Quick Fix - Manual Sync" -ForegroundColor Yellow
Write-Host @"

  If webhook isn't working, you can manually sync:
  
  1. Get your checkout_session_id from Stripe Dashboard
     (Payments -> Checkout Sessions -> click on your session -> copy ID)
  
  2. Get your user_id from Supabase
     (Authentication -> Users -> copy your user's UUID)
  
  3. Run the sync script:
     
     `$env:STRIPE_SECRET_KEY = "sk_live_..."  # or sk_test_...
     `$env:SUPABASE_URL = "https://itmhojbjfacocrpmslmt.supabase.co"
     `$env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
     
     node stripe/sync-checkout-session.cjs cs_live_xxx YOUR_USER_ID

"@ -ForegroundColor White

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   END OF DIAGNOSTIC" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan


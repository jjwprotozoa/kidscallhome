# stripe/setup-env.ps1
# Helper script to set environment variables for local webhook testing
# 
# Usage:
#   1. Get your keys from Vercel (Stripe) and Supabase Dashboard
#   2. Run: .\stripe\setup-env.ps1
#   3. Or manually set the variables shown below

Write-Host "`n🔑 Environment Variables Setup for Local Webhook Server`n" -ForegroundColor Cyan

# Check Stripe variables
Write-Host "Stripe Variables:" -ForegroundColor Yellow
if ($env:STRIPE_SECRET_KEY) {
    Write-Host "  ✅ STRIPE_SECRET_KEY: $($env:STRIPE_SECRET_KEY.Substring(0, 12))..." -ForegroundColor Green
} else {
    Write-Host "  ❌ STRIPE_SECRET_KEY: Not set" -ForegroundColor Red
    Write-Host "     Get from: Vercel → Settings → Environment Variables" -ForegroundColor Gray
    Write-Host "     Set with: `$env:STRIPE_SECRET_KEY='sk_test_...'" -ForegroundColor White
}

if ($env:STRIPE_WEBHOOK_SECRET) {
    Write-Host "  ✅ STRIPE_WEBHOOK_SECRET: $($env:STRIPE_WEBHOOK_SECRET.Substring(0, 12))..." -ForegroundColor Green
} else {
    Write-Host "  ❌ STRIPE_WEBHOOK_SECRET: Not set" -ForegroundColor Red
    Write-Host "     Get from: Stripe CLI output when running 'stripe listen'" -ForegroundColor Gray
    Write-Host "     Set with: `$env:STRIPE_WEBHOOK_SECRET='whsec_...'" -ForegroundColor White
}

# Check Supabase variables (optional, for database updates)
Write-Host "`nSupabase Variables (Optional - for database updates):" -ForegroundColor Yellow
if ($env:SUPABASE_URL) {
    Write-Host "  ✅ SUPABASE_URL: $env:SUPABASE_URL" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  SUPABASE_URL: Not set (database updates will be skipped)" -ForegroundColor Yellow
    Write-Host "     Get from: Supabase Dashboard → Settings → API → Project URL" -ForegroundColor Gray
    Write-Host "     Set with: `$env:SUPABASE_URL='https://your-project.supabase.co'" -ForegroundColor White
}

if ($env:SUPABASE_SERVICE_ROLE_KEY) {
    Write-Host "  ✅ SUPABASE_SERVICE_ROLE_KEY: $($env:SUPABASE_SERVICE_ROLE_KEY.Substring(0, 12))..." -ForegroundColor Green
} else {
    Write-Host "  ⚠️  SUPABASE_SERVICE_ROLE_KEY: Not set (database updates will be skipped)" -ForegroundColor Yellow
    Write-Host "     Get from: Supabase Dashboard → Settings → API → Service Role Key" -ForegroundColor Gray
    Write-Host "     ⚠️  WARNING: Keep this secret! Never commit it to git." -ForegroundColor Red
    Write-Host "     Set with: `$env:SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'" -ForegroundColor White
}

Write-Host "`n📝 Quick Setup Commands:" -ForegroundColor Cyan
Write-Host "   # Stripe (required)" -ForegroundColor White
Write-Host "   `$env:STRIPE_SECRET_KEY='sk_test_...'" -ForegroundColor Gray
Write-Host "   `$env:STRIPE_WEBHOOK_SECRET='whsec_...'  # From 'stripe listen' output" -ForegroundColor Gray
Write-Host "" -ForegroundColor White
Write-Host "   # Supabase (optional, for DB updates)" -ForegroundColor White
Write-Host "   `$env:SUPABASE_URL='https://itmhojbjfacocrpmslmt.supabase.co'" -ForegroundColor Gray
Write-Host "   `$env:SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'" -ForegroundColor Gray
Write-Host "`n"


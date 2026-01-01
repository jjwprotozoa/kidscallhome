# stripe/test-webhook.ps1
# Quick test script to verify webhook setup

Write-Host "`n🧪 Testing Webhook Setup`n" -ForegroundColor Cyan

# Check environment variables
Write-Host "Environment Variables:" -ForegroundColor Yellow
if ($env:STRIPE_SECRET_KEY) {
    Write-Host "  ✅ STRIPE_SECRET_KEY: $($env:STRIPE_SECRET_KEY.Substring(0, 12))..." -ForegroundColor Green
} else {
    Write-Host "  ❌ STRIPE_SECRET_KEY: Not set" -ForegroundColor Red
}

if ($env:STRIPE_WEBHOOK_SECRET) {
    Write-Host "  ✅ STRIPE_WEBHOOK_SECRET: $($env:STRIPE_WEBHOOK_SECRET.Substring(0, 12))..." -ForegroundColor Green
} else {
    Write-Host "  ❌ STRIPE_WEBHOOK_SECRET: Not set" -ForegroundColor Red
}

# Check if webhook server is running
Write-Host "`nWebhook Server Status:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:4242/health" -Method GET -TimeoutSec 2 -ErrorAction Stop
    Write-Host "  ✅ Webhook server is running" -ForegroundColor Green
    Write-Host "  Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ Webhook server is not running or not accessible" -ForegroundColor Red
    Write-Host "  Make sure to run: npm run stripe:webhook" -ForegroundColor Gray
}

Write-Host "`n📝 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Make sure webhook server is running (npm run stripe:webhook)" -ForegroundColor White
Write-Host "  2. Make sure stripe listen is running in another terminal" -ForegroundColor White
Write-Host "  3. Trigger test event: C:\Users\DevBox\stripe.exe trigger checkout.session.completed" -ForegroundColor White
Write-Host "  4. Check webhook server terminal for logs`n" -ForegroundColor White



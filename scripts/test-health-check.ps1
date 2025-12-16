# Test Health Check Edge Function
# Usage: .\scripts\test-health-check.ps1

param(
    [string]$AnonKey = $env:SUPABASE_ANON_KEY
)

$BASE_URL = if ($env:BASE_URL) { $env:BASE_URL } else { "https://itmhojbjfacocrpmslmt.supabase.co" }
$FUNCTION_BASE = "$BASE_URL/functions/v1"
$HEALTH_CHECK_URL = "$FUNCTION_BASE/health-check"

Write-Host "🏥 Testing Health Check Endpoint" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

if (-not $AnonKey) {
    Write-Host "⚠️  SUPABASE_ANON_KEY not set" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To get your anon key:" -ForegroundColor Cyan
    Write-Host "  1. Go to: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt/settings/api" -ForegroundColor White
    Write-Host "  2. Copy the 'anon' or 'public' key" -ForegroundColor White
    Write-Host "  3. Set it with: `$env:SUPABASE_ANON_KEY = 'your-key-here'" -ForegroundColor White
    Write-Host ""
    Write-Host "Or run this script with:" -ForegroundColor Cyan
    Write-Host "  .\scripts\test-health-check.ps1 -AnonKey 'your-key-here'" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "URL: $HEALTH_CHECK_URL" -ForegroundColor Cyan
Write-Host ""

try {
    $headers = @{
        "Authorization" = "Bearer $AnonKey"
        "Content-Type" = "application/json"
    }
    
    Write-Host "Sending request..." -ForegroundColor Yellow
    $response = Invoke-WebRequest -Uri $HEALTH_CHECK_URL -Method GET -Headers $headers -UseBasicParsing
    
    Write-Host ""
    Write-Host "✅ Response received (Status: $($response.StatusCode))" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response Body:" -ForegroundColor Cyan
    Write-Host "==============" -ForegroundColor Cyan
    
    # Pretty print JSON
    $json = $response.Content | ConvertFrom-Json
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10 | Write-Host
    
    Write-Host ""
    Write-Host "Summary:" -ForegroundColor Cyan
    Write-Host "  Overall Status: $($json.overall.status)" -ForegroundColor $(if ($json.overall.status -eq "healthy") { "Green" } else { "Yellow" })
    Write-Host "  Environment Check: $($json.checks.environment.status)" -ForegroundColor $(if ($json.checks.environment.status -eq "ok") { "Green" } else { "Yellow" })
    Write-Host "  Supabase Check: $($json.checks.supabase.status)" -ForegroundColor $(if ($json.checks.supabase.status -eq "ok") { "Green" } else { "Red" })
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorMessage = $_.Exception.Message
    
    Write-Host ""
    Write-Host "❌ Error occurred" -ForegroundColor Red
    Write-Host "  Status Code: $statusCode" -ForegroundColor Red
    Write-Host "  Message: $errorMessage" -ForegroundColor Red
    Write-Host ""
    
    if ($statusCode -eq 401) {
        Write-Host "💡 Tip: 401 means authentication failed. Check that:" -ForegroundColor Yellow
        Write-Host "  - Your anon key is correct" -ForegroundColor White
        Write-Host "  - The Authorization header format is: 'Bearer <key>'" -ForegroundColor White
    } elseif ($statusCode -eq 404) {
        Write-Host "💡 Tip: 404 means the function isn't deployed yet." -ForegroundColor Yellow
        Write-Host "  Deploy it via Supabase Dashboard → Edge Functions" -ForegroundColor White
    }
    
    exit 1
}

Write-Host ""
Write-Host "✅ Test completed" -ForegroundColor Green







# Example: Set Environment Variables for Security Tests
# Copy this file and modify with your actual values, then run it

# Your Supabase project URL
$env:BASE_URL = "https://itmhojbjfacocrpmslmt.supabase.co"

# Function base URL (usually BASE_URL + /functions/v1)
$env:FUNCTION_BASE = "$env:BASE_URL/functions/v1"

# Optional: Auth token (get from Supabase dashboard or browser DevTools)
# $env:AUTH_TOKEN = "your-auth-token-here"

Write-Host "✅ Environment variables set:" -ForegroundColor Green
Write-Host "   BASE_URL: $env:BASE_URL" -ForegroundColor Cyan
Write-Host "   FUNCTION_BASE: $env:FUNCTION_BASE" -ForegroundColor Cyan
if ($env:AUTH_TOKEN) {
    Write-Host "   AUTH_TOKEN: SET" -ForegroundColor Cyan
} else {
    Write-Host "   AUTH_TOKEN: NOT SET (optional)" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Now run: .\scripts\security-tests.ps1 all" -ForegroundColor Green








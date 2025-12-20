# Setup Test Environment Variables
# Purpose: Quick setup script for security testing
# Usage: .\scripts\setup-test-env.ps1

Write-Host "🔒 Security Test Environment Setup" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""

# Prompt for Supabase project URL
$supabaseUrl = Read-Host "Enter your Supabase project URL (e.g., https://itmhojbjfacocrpmslmt.supabase.co)"
if ([string]::IsNullOrWhiteSpace($supabaseUrl)) {
    Write-Host "❌ Supabase URL is required" -ForegroundColor Red
    exit 1
}

# Set BASE_URL
$env:BASE_URL = $supabaseUrl
Write-Host "✅ BASE_URL set to: $supabaseUrl" -ForegroundColor Green

# Set FUNCTION_BASE
$env:FUNCTION_BASE = "$supabaseUrl/functions/v1"
Write-Host "✅ FUNCTION_BASE set to: $env:FUNCTION_BASE" -ForegroundColor Green

# Optional: Prompt for auth token
Write-Host ""
$setToken = Read-Host "Do you want to set AUTH_TOKEN? (y/n)"
if ($setToken -eq "y" -or $setToken -eq "Y") {
    $token = Read-Host "Enter your auth token (or leave blank to skip)"
    if (-not [string]::IsNullOrWhiteSpace($token)) {
        $env:AUTH_TOKEN = $token
        Write-Host "✅ AUTH_TOKEN set" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  AUTH_TOKEN not set (some tests may fail)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Environment variables set for current PowerShell session" -ForegroundColor Cyan
Write-Host ""
Write-Host "To persist these settings, add them to your PowerShell profile:" -ForegroundColor Yellow
Write-Host "  `$env:BASE_URL = '$supabaseUrl'" -ForegroundColor Cyan
Write-Host "  `$env:FUNCTION_BASE = '$env:FUNCTION_BASE'" -ForegroundColor Cyan
if ($env:AUTH_TOKEN) {
    Write-Host "  `$env:AUTH_TOKEN = 'your-token-here'" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "Now you can run:" -ForegroundColor Green
Write-Host "  .\scripts\security-tests.ps1 all" -ForegroundColor Cyan
Write-Host ""











# Quick Run Script for Security Tests
# This script sets up environment variables and runs security tests
# Usage: .\kidscallhome\scripts\RUN_TESTS.ps1

# Set your Supabase project URL (update this with your actual project)
$env:BASE_URL = "https://itmhojbjfacocrpmslmt.supabase.co"
$env:FUNCTION_BASE = "$env:BASE_URL/functions/v1"

# Optional: Set auth token if you have one
# $env:AUTH_TOKEN = "your-auth-token-here"

Write-Host "🔒 Running Security Tests" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  BASE_URL: $env:BASE_URL" -ForegroundColor Gray
Write-Host "  FUNCTION_BASE: $env:FUNCTION_BASE" -ForegroundColor Gray
Write-Host ""

# Run the tests
& "$PSScriptRoot\security-tests.ps1" all







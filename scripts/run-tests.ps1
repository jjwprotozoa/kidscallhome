# Run Security Tests (from scripts directory)
# Usage: .\run-tests.ps1 [test-name]
# This script works when run from the scripts directory

# Get the script directory (where this file is located)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Set default environment variables if not already set
if (-not $env:BASE_URL) {
    $env:BASE_URL = "https://itmhojbjfacocrpmslmt.supabase.co"
    Write-Host "ℹ️  Using default BASE_URL: $env:BASE_URL" -ForegroundColor Cyan
    Write-Host "   To override: `$env:BASE_URL = 'https://your-project.supabase.co'" -ForegroundColor Gray
    Write-Host ""
}

if (-not $env:FUNCTION_BASE) {
    $env:FUNCTION_BASE = "$env:BASE_URL/functions/v1"
}

# Get test name parameter (default to "all")
$TestName = if ($args.Count -gt 0) { $args[0] } else { "all" }

# Run the security tests script (in the same directory)
& "$ScriptDir\security-tests.ps1" $TestName


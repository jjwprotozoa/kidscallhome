# Quick Security Tests Runner
# Run this from anywhere in the project

# Get the script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Set default environment variables if not already set
if (-not $env:BASE_URL) {
    $env:BASE_URL = "https://itmhojbjfacocrpmslmt.supabase.co"
    Write-Host "ℹ️  Using default BASE_URL: $env:BASE_URL" -ForegroundColor Cyan
}

if (-not $env:FUNCTION_BASE) {
    $env:FUNCTION_BASE = "$env:BASE_URL/functions/v1"
}

# Get test name parameter (default to "all")
$TestName = if ($args.Count -gt 0) { $args[0] } else { "all" }

# Run the security tests script
& "$ProjectRoot\scripts\security-tests.ps1" $TestName











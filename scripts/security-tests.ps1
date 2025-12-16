# Security Testing Scripts (PowerShell)
# Purpose: Quick verification of security fixes
# Usage: .\scripts\security-tests.ps1 [test-name]

param(
    [Parameter(Position=0)]
    [string]$TestName = "all"
)

# Configuration
$BASE_URL = if ($env:BASE_URL) { $env:BASE_URL } else { "https://your-project.supabase.co" }
$FUNCTION_BASE = if ($env:FUNCTION_BASE) { $env:FUNCTION_BASE } else { "$BASE_URL/functions/v1" }
$AUTH_TOKEN = if ($env:AUTH_TOKEN) { $env:AUTH_TOKEN } else { "your-auth-token-here" }

Write-Host "🔒 Security Testing Scripts" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

# Check if using placeholder values
if ($BASE_URL -eq "https://your-project.supabase.co" -or $AUTH_TOKEN -eq "your-auth-token-here") {
    Write-Host "⚠️  CONFIGURATION REQUIRED" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please set the following environment variables:" -ForegroundColor Yellow
    Write-Host "  `$env:BASE_URL = 'https://your-actual-project.supabase.co'" -ForegroundColor Cyan
    Write-Host "  `$env:FUNCTION_BASE = '`$env:BASE_URL/functions/v1' (optional)" -ForegroundColor Cyan
    Write-Host "  `$env:AUTH_TOKEN = 'your-actual-auth-token' (optional for some tests)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Example:" -ForegroundColor Yellow
    Write-Host "  `$env:BASE_URL = 'https://itmhojbjfacocrpmslmt.supabase.co'" -ForegroundColor Cyan
    Write-Host "  `$env:AUTH_TOKEN = 'eyJhbGc...' (from Supabase dashboard)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Current Configuration:" -ForegroundColor Yellow
    Write-Host "  BASE_URL: $BASE_URL" -ForegroundColor Gray
    Write-Host "  FUNCTION_BASE: $FUNCTION_BASE" -ForegroundColor Gray
    Write-Host "  AUTH_TOKEN: $(if ($AUTH_TOKEN -eq 'your-auth-token-here') { 'NOT SET' } else { 'SET' })" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Continuing with placeholder values (tests will fail)..." -ForegroundColor Yellow
    Write-Host ""
}

# Test 1: CORS Validation - Allowed Origin
function Test-CorsAllowed {
    Write-Host "Test 1.1: CORS - Allowed Origin" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri "$FUNCTION_BASE/create-stripe-subscription" `
            -Method POST `
            -Headers @{
                "Origin" = "https://www.kidscallhome.com"
                "Content-Type" = "application/json"
                "Authorization" = "Bearer $AUTH_TOKEN"
            } `
            -Body '{"subscriptionType":"additional-kid-monthly"}' `
            -UseBasicParsing `
            -ErrorAction SilentlyContinue
        
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 401) {
            Write-Host "✅ PASS: Request from allowed origin accepted" -ForegroundColor Green
        } else {
            Write-Host "❌ FAIL: Unexpected response code: $($response.StatusCode)" -ForegroundColor Red
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($null -eq $statusCode) {
            Write-Host "❌ FAIL: Connection error - Check BASE_URL and network connectivity" -ForegroundColor Red
            Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
        } elseif ($statusCode -eq 401 -or $statusCode -eq 200) {
            Write-Host "✅ PASS: Request from allowed origin accepted (Status: $statusCode)" -ForegroundColor Green
        } elseif ($statusCode -eq 404) {
            Write-Host "⚠️  SKIP: Endpoint not found (404) - Edge Function may not be deployed" -ForegroundColor Yellow
            Write-Host "   This is expected if functions aren't deployed yet" -ForegroundColor Gray
        } else {
            Write-Host "❌ FAIL: Unexpected response code: $statusCode" -ForegroundColor Red
        }
    }
    Write-Host ""
}

# Test 2: CORS Validation - Disallowed Origin
function Test-CorsDisallowed {
    Write-Host "Test 2.1: CORS - Disallowed Origin" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri "$FUNCTION_BASE/create-stripe-subscription" `
            -Method POST `
            -Headers @{
                "Origin" = "https://evil-kidscallhome.com"
                "Content-Type" = "application/json"
                "Authorization" = "Bearer $AUTH_TOKEN"
            } `
            -Body '{"subscriptionType":"additional-kid-monthly"}' `
            -UseBasicParsing `
            -ErrorAction Stop
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($null -eq $statusCode) {
            Write-Host "❌ FAIL: Connection error - Check BASE_URL and network connectivity" -ForegroundColor Red
            Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
        } elseif ($statusCode -eq 403) {
            Write-Host "✅ PASS: Request from disallowed origin blocked" -ForegroundColor Green
        } elseif ($statusCode -eq 404) {
            Write-Host "⚠️  SKIP: Endpoint not found (404) - Edge Function may not be deployed" -ForegroundColor Yellow
            Write-Host "   This is expected if functions aren't deployed yet" -ForegroundColor Gray
        } else {
            Write-Host "❌ FAIL: Expected 403, got: $statusCode" -ForegroundColor Red
        }
    }
    Write-Host ""
}

# Test 3: Content-Type Validation - Valid
function Test-ContentTypeValid {
    Write-Host "Test 3.1: Content-Type - Valid (application/json)" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri "$FUNCTION_BASE/create-stripe-subscription" `
            -Method POST `
            -Headers @{
                "Origin" = "https://www.kidscallhome.com"
                "Content-Type" = "application/json"
                "Authorization" = "Bearer $AUTH_TOKEN"
            } `
            -Body '{"subscriptionType":"additional-kid-monthly"}' `
            -UseBasicParsing `
            -ErrorAction SilentlyContinue
        
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 401) {
            Write-Host "✅ PASS: Valid Content-Type accepted" -ForegroundColor Green
        } elseif ($response.StatusCode -eq 404) {
            Write-Host "⚠️  SKIP: Endpoint not found (404) - Edge Function may not be deployed" -ForegroundColor Yellow
            Write-Host "   See scripts/DEPLOYMENT_NOTES.md for deployment instructions" -ForegroundColor Gray
        } else {
            Write-Host "❌ FAIL: Unexpected response: $($response.StatusCode)" -ForegroundColor Red
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 401 -or $statusCode -eq 200) {
            Write-Host "✅ PASS: Valid Content-Type accepted (Status: $statusCode)" -ForegroundColor Green
        } elseif ($statusCode -eq 404) {
            Write-Host "⚠️  SKIP: Endpoint not found (404) - Edge Function may not be deployed" -ForegroundColor Yellow
            Write-Host "   See scripts/DEPLOYMENT_NOTES.md for deployment instructions" -ForegroundColor Gray
        } else {
            Write-Host "❌ FAIL: Unexpected response: $statusCode" -ForegroundColor Red
        }
    }
    Write-Host ""
}

# Test 4: Content-Type Validation - Invalid
function Test-ContentTypeInvalid {
    Write-Host "Test 4.1: Content-Type - Invalid (text/plain)" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri "$FUNCTION_BASE/create-stripe-subscription" `
            -Method POST `
            -Headers @{
                "Origin" = "https://www.kidscallhome.com"
                "Content-Type" = "text/plain"
                "Authorization" = "Bearer $AUTH_TOKEN"
            } `
            -Body '{"subscriptionType":"additional-kid-monthly"}' `
            -UseBasicParsing `
            -ErrorAction Stop
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 400) {
            Write-Host "✅ PASS: Invalid Content-Type rejected" -ForegroundColor Green
        } elseif ($statusCode -eq 404) {
            Write-Host "⚠️  SKIP: Endpoint not found (404) - Edge Function may not be deployed" -ForegroundColor Yellow
        } else {
            Write-Host "❌ FAIL: Expected 400, got: $statusCode" -ForegroundColor Red
        }
    }
    Write-Host ""
}

# Test 5: Input Validation - Quantity Valid
function Test-QuantityValid {
    Write-Host "Test 5.1: Input Validation - Valid Quantity (1-10)" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri "$FUNCTION_BASE/create-stripe-subscription" `
            -Method POST `
            -Headers @{
                "Origin" = "https://www.kidscallhome.com"
                "Content-Type" = "application/json"
                "Authorization" = "Bearer $AUTH_TOKEN"
            } `
            -Body '{"subscriptionType":"additional-kid-monthly","quantity":5}' `
            -UseBasicParsing `
            -ErrorAction SilentlyContinue
        
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 401) {
            Write-Host "✅ PASS: Valid quantity accepted" -ForegroundColor Green
        } elseif ($response.StatusCode -eq 404) {
            Write-Host "⚠️  SKIP: Endpoint not found (404) - Edge Function may not be deployed" -ForegroundColor Yellow
            Write-Host "   See scripts/DEPLOYMENT_NOTES.md for deployment instructions" -ForegroundColor Gray
        } else {
            Write-Host "❌ FAIL: Unexpected response: $($response.StatusCode)" -ForegroundColor Red
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 401 -or $statusCode -eq 200) {
            Write-Host "✅ PASS: Valid quantity accepted (Status: $statusCode)" -ForegroundColor Green
        } elseif ($statusCode -eq 404) {
            Write-Host "⚠️  SKIP: Endpoint not found (404) - Edge Function may not be deployed" -ForegroundColor Yellow
        } else {
            Write-Host "❌ FAIL: Unexpected response: $statusCode" -ForegroundColor Red
        }
    }
    Write-Host ""
}

# Test 6: Input Validation - Quantity Invalid (too high)
function Test-QuantityInvalidHigh {
    Write-Host "Test 6.1: Input Validation - Invalid Quantity (11)" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri "$FUNCTION_BASE/create-stripe-subscription" `
            -Method POST `
            -Headers @{
                "Origin" = "https://www.kidscallhome.com"
                "Content-Type" = "application/json"
                "Authorization" = "Bearer $AUTH_TOKEN"
            } `
            -Body '{"subscriptionType":"additional-kid-monthly","quantity":11}' `
            -UseBasicParsing `
            -ErrorAction Stop
        
        $body = $response.Content
        if ($response.StatusCode -eq 400 -and $body -match "Invalid quantity") {
            Write-Host "✅ PASS: Invalid quantity rejected with proper error" -ForegroundColor Green
        } else {
            Write-Host "❌ FAIL: Expected 400 with quantity error, got: $($response.StatusCode)" -ForegroundColor Red
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        try {
            $responseBody = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($responseBody)
            $body = $reader.ReadToEnd() | ConvertFrom-Json -ErrorAction SilentlyContinue
        } catch {
            $body = $null
        }
        
        if ($statusCode -eq 400) {
            Write-Host "✅ PASS: Invalid quantity rejected (Status: $statusCode)" -ForegroundColor Green
        } elseif ($statusCode -eq 404) {
            Write-Host "⚠️  SKIP: Endpoint not found (404) - Edge Function may not be deployed" -ForegroundColor Yellow
        } else {
            Write-Host "❌ FAIL: Expected 400, got: $statusCode" -ForegroundColor Red
        }
    }
    Write-Host ""
}

# Test 7: Rate Limiting - Webhook Endpoint
function Test-RateLimitWebhook {
    Write-Host "Test 7.1: Rate Limiting - Webhook Endpoint" -ForegroundColor Yellow
    Write-Host "Sending 101 requests to test rate limiting..." -ForegroundColor Yellow
    
    $successCount = 0
    $rateLimited = 0
    
    for ($i = 1; $i -le 101; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "$FUNCTION_BASE/stripe-webhook" `
                -Method POST `
                -Headers @{
                    "Content-Type" = "application/json"
                    "stripe-signature" = "test-signature"
                } `
                -Body '{"type":"test.event"}' `
                -UseBasicParsing `
                -ErrorAction SilentlyContinue
            
            if ($response.StatusCode -eq 200) {
                $successCount++
            }
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            if ($statusCode -eq 429) {
                $rateLimited++
            } elseif ($statusCode -eq 400) {
                $successCount++
            }
        }
    }
    
    Write-Host "Successful: $successCount, Rate Limited: $rateLimited" -ForegroundColor Cyan
    
    if ($rateLimited -gt 0) {
        Write-Host "✅ PASS: Rate limiting working (some requests rate limited)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  WARNING: No rate limiting detected (may need to wait for window reset)" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Test 8: Security Headers
function Test-SecurityHeaders {
    Write-Host "Test 8.1: Security Headers" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri $BASE_URL -Method GET -UseBasicParsing
        
        $xFrameOptions = $response.Headers["X-Frame-Options"]
        $xContentTypeOptions = $response.Headers["X-Content-Type-Options"]
        $xXssProtection = $response.Headers["X-XSS-Protection"]
        
        if ($xFrameOptions -eq "DENY") {
            Write-Host "✅ PASS: X-Frame-Options: DENY present" -ForegroundColor Green
        } else {
            Write-Host "❌ FAIL: X-Frame-Options missing or incorrect (found: $xFrameOptions)" -ForegroundColor Red
        }
        
        if ($xContentTypeOptions -eq "nosniff") {
            Write-Host "✅ PASS: X-Content-Type-Options: nosniff present" -ForegroundColor Green
        } else {
            Write-Host "❌ FAIL: X-Content-Type-Options missing" -ForegroundColor Red
        }
    } catch {
        Write-Host "⚠️  WARNING: Could not test security headers (may need to test on deployed URL)" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Test 9: Health Check Endpoint
function Test-HealthCheck {
    Write-Host "Test 9.1: Health Check Endpoint" -ForegroundColor Yellow
    
    try {
        $healthCheckUrl = "$FUNCTION_BASE/health-check"
        $anonKey = $env:SUPABASE_ANON_KEY
        
        if (-not $anonKey) {
            Write-Host "⚠️  SKIP: SUPABASE_ANON_KEY not set (required for health check test)" -ForegroundColor Yellow
            Write-Host "   Set with: `$env:SUPABASE_ANON_KEY = 'your-anon-key'" -ForegroundColor Gray
            Write-Host ""
            return
        }
        
        $headers = @{
            "Authorization" = "Bearer $anonKey"
            "Content-Type" = "application/json"
        }
        
        $response = Invoke-WebRequest -Uri $healthCheckUrl -Method GET -Headers $headers -UseBasicParsing
        
        if ($response.StatusCode -eq 200) {
            $healthData = $response.Content | ConvertFrom-Json
            
            if ($healthData.overall.status -eq "healthy") {
                Write-Host "✅ PASS: Health check endpoint is healthy" -ForegroundColor Green
                Write-Host "   Status: $($healthData.overall.status)" -ForegroundColor Gray
                Write-Host "   Environment: $($healthData.checks.environment.status)" -ForegroundColor Gray
                Write-Host "   Supabase: $($healthData.checks.supabase.status)" -ForegroundColor Gray
            } elseif ($healthData.overall.status -eq "degraded") {
                Write-Host "⚠️  WARNING: Health check shows degraded status" -ForegroundColor Yellow
                Write-Host "   Status: $($healthData.overall.status)" -ForegroundColor Gray
            } else {
                Write-Host "❌ FAIL: Health check shows unhealthy status" -ForegroundColor Red
                Write-Host "   Status: $($healthData.overall.status)" -ForegroundColor Gray
            }
        } else {
            Write-Host "❌ FAIL: Health check returned status code $($response.StatusCode)" -ForegroundColor Red
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 404) {
            Write-Host "⚠️  SKIP: Health check endpoint not found (404) - Function may not be deployed" -ForegroundColor Yellow
            Write-Host "   This is expected if the health-check function isn't deployed yet" -ForegroundColor Gray
        } elseif ($statusCode -eq 401) {
            Write-Host "⚠️  SKIP: Health check requires authentication (401)" -ForegroundColor Yellow
            Write-Host "   Set SUPABASE_ANON_KEY environment variable to test" -ForegroundColor Gray
        } else {
            Write-Host "❌ FAIL: Health check error - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    Write-Host ""
}

# Run all tests
function Run-AllTests {
    Write-Host "Running all security tests..." -ForegroundColor Green
    Write-Host ""
    
    Test-CorsAllowed
    Test-CorsDisallowed
    Test-ContentTypeValid
    Test-ContentTypeInvalid
    Test-QuantityValid
    Test-QuantityInvalidHigh
    Test-SecurityHeaders
    Test-HealthCheck
    
    Write-Host "Note: Rate limiting test requires manual verification" -ForegroundColor Yellow
    Write-Host "Note: Webhook signature test requires Stripe CLI" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "✅ All automated tests completed" -ForegroundColor Green
}

# Main execution
switch ($TestName.ToLower()) {
    "cors-allowed" {
        Test-CorsAllowed
    }
    "cors-disallowed" {
        Test-CorsDisallowed
    }
    "content-type-valid" {
        Test-ContentTypeValid
    }
    "content-type-invalid" {
        Test-ContentTypeInvalid
    }
    "quantity-valid" {
        Test-QuantityValid
    }
    "quantity-invalid" {
        Test-QuantityInvalidHigh
    }
    "rate-limit" {
        Test-RateLimitWebhook
    }
    "headers" {
        Test-SecurityHeaders
    }
    "health-check" {
        Test-HealthCheck
    }
    "all" {
        Run-AllTests
    }
    default {
        Write-Host "Usage: .\scripts\security-tests.ps1 [test-name]" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Available tests:" -ForegroundColor Yellow
        Write-Host "  cors-allowed, cors-disallowed"
        Write-Host "  content-type-valid, content-type-invalid"
        Write-Host "  quantity-valid, quantity-invalid"
        Write-Host "  rate-limit, headers, health-check"
        Write-Host "  all (default)"
        Write-Host ""
        Write-Host "Environment Variables:" -ForegroundColor Yellow
        Write-Host "  BASE_URL - Base URL of your API"
        Write-Host "  FUNCTION_BASE - Base URL for Edge Functions"
        Write-Host "  AUTH_TOKEN - Authentication token for testing"
        Write-Host "  SUPABASE_ANON_KEY - Anon key for health check test (optional)"
        exit 1
    }
}


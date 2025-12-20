# Security Testing Scripts

This directory contains scripts for automated security testing.

## Available Scripts

### PowerShell (Windows)
- **`security-tests.ps1`** - Comprehensive security test suite for Windows/PowerShell

### Bash (Linux/Mac/Git Bash)
- **`security-tests.sh`** - Comprehensive security test suite for Unix systems
- **`stripe-webhook-test.sh`** - Stripe webhook signature testing

## Quick Start

### Windows (PowerShell)

```powershell
# Set environment variables
$env:BASE_URL = "https://your-project.supabase.co"
$env:FUNCTION_BASE = "$env:BASE_URL/functions/v1"
$env:AUTH_TOKEN = "your-auth-token-here"

# Run all tests
.\scripts\security-tests.ps1 all

# Run specific test
.\scripts\security-tests.ps1 cors-allowed
.\scripts\security-tests.ps1 content-type-invalid
```

### Linux/Mac/Git Bash

```bash
# Set environment variables
export BASE_URL="https://your-project.supabase.co"
export FUNCTION_BASE="${BASE_URL}/functions/v1"
export AUTH_TOKEN="your-auth-token-here"

# Run all tests
./scripts/security-tests.sh all

# Run specific test
./scripts/security-tests.sh cors-allowed
./scripts/security-tests.sh content-type-invalid
```

## Available Tests

### CORS Tests
- `cors-allowed` - Test requests from allowed origins
- `cors-disallowed` - Test requests from disallowed origins

### Content-Type Tests
- `content-type-valid` - Test valid Content-Type headers
- `content-type-invalid` - Test invalid Content-Type rejection

### Input Validation Tests
- `quantity-valid` - Test valid quantity parameter (1-10)
- `quantity-invalid` - Test invalid quantity rejection

### Other Tests
- `rate-limit` - Test webhook rate limiting
- `headers` - Test security headers
- `all` - Run all tests (default)

## Configuration

Set these environment variables before running:

- **BASE_URL** - Base URL of your API (e.g., `https://your-project.supabase.co`)
- **FUNCTION_BASE** - Base URL for Edge Functions (defaults to `$BASE_URL/functions/v1`)
- **AUTH_TOKEN** - Authentication token for testing authenticated endpoints

## Prerequisites

### PowerShell Script
- Windows PowerShell 5.1+ or PowerShell Core 7+
- No additional dependencies

### Bash Scripts
- Bash shell (Linux, Mac, or Git Bash on Windows)
- `curl` command available
- For webhook tests: Stripe CLI installed

## Stripe Webhook Testing

For webhook signature verification testing, use the Stripe CLI:

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Test webhook
stripe listen --forward-to https://your-api.com/webhook
stripe trigger checkout.session.completed
```

Or use the provided script:

```bash
./scripts/stripe-webhook-test.sh
```

## Troubleshooting

### PowerShell Execution Policy

If you get an execution policy error:

```powershell
# Check current policy
Get-ExecutionPolicy

# Set policy for current user (if needed)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Bash Script Permissions

If you get a permission denied error:

```bash
chmod +x scripts/security-tests.sh
chmod +x scripts/stripe-webhook-test.sh
```

### Connection Errors

- Verify your `BASE_URL` is correct
- Check that your API is accessible
- Ensure `AUTH_TOKEN` is valid (if testing authenticated endpoints)
- For local testing, use `http://localhost:8080` or your local URL

## Expected Results

### Successful Tests
- ✅ CORS allowed origin: 200 or 401 (auth required)
- ✅ CORS disallowed origin: 403 Forbidden
- ✅ Valid Content-Type: 200 or 401
- ✅ Invalid Content-Type: 400 Bad Request
- ✅ Valid quantity: 200 or 401
- ✅ Invalid quantity: 400 Bad Request
- ✅ Security headers: Present in response

### Notes
- Some tests may return 401 (Unauthorized) if authentication is required - this is expected
- Rate limiting tests may need multiple runs to trigger (window resets)
- Webhook signature tests require Stripe CLI and valid webhook secret

## Integration with CI/CD

See `docs/SECURITY_CI_CD_SETUP.md` for CI/CD integration examples.










